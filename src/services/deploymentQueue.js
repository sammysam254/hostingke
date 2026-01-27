const SupabaseService = require('./supabase');
const DeploymentService = require('./deployment');

class DeploymentQueue {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
    this.deploymentService = null;
  }

  initialize(io) {
    this.deploymentService = new DeploymentService(io);
    this.startProcessing();
    console.log('✅ Deployment queue initialized');
  }

  startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Check for queued deployments every 5 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueuedDeployments();
      }
    }, 5000);
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async processQueuedDeployments() {
    if (this.isProcessing || !this.deploymentService) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get queued deployments
      const { data: queuedDeployments, error } = await SupabaseService.getAdminClient()
        .from('deployments')
        .select(`
          *,
          projects (
            id,
            name,
            slug,
            owner_id,
            repository,
            build_settings,
            domains
          )
        `)
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(5); // Process up to 5 deployments at once

      if (error) {
        console.error('Error fetching queued deployments:', error);
        return;
      }

      if (!queuedDeployments || queuedDeployments.length === 0) {
        return; // No queued deployments
      }

      console.log(`Processing ${queuedDeployments.length} queued deployment(s)`);

      // Process each deployment
      for (const deployment of queuedDeployments) {
        try {
          await this.processDeployment(deployment);
        } catch (error) {
          console.error(`Failed to process deployment ${deployment.id}:`, error);
          
          // Mark deployment as failed
          await SupabaseService.updateDeployment(deployment.id, {
            status: 'error',
            error: { message: error.message }
          });
        }
      }
    } catch (error) {
      console.error('Error processing deployment queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processDeployment(deployment) {
    const project = deployment.projects;
    
    if (!project) {
      throw new Error('Project not found for deployment');
    }

    console.log(`Processing deployment ${deployment.id} for project ${project.name}`);

    // Update status to building
    await SupabaseService.updateDeployment(deployment.id, {
      status: 'building'
    });

    // Create commit info object
    const commitInfo = {
      commitSha: deployment.commit_sha,
      commitMessage: deployment.commit_message,
      branch: deployment.branch
    };

    // Queue the deployment with the deployment service
    await this.deploymentService.queueDeployment(project, deployment, commitInfo);
  }

  async queueDeployment(projectId, commitInfo = null, environment = 'production') {
    try {
      // Get project details
      const { data: project, error: projectError } = await SupabaseService.getAdminClient()
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new Error('Project not found');
      }

      // Create deployment record
      const deploymentData = {
        project_id: projectId,
        commit_sha: commitInfo?.commitSha,
        commit_message: commitInfo?.commitMessage || 'Manual deployment',
        branch: commitInfo?.branch || project.repository?.branch || 'main',
        status: 'queued',
        environment: environment,
        build_settings: project.build_settings
      };

      const { data: deployment, error } = await SupabaseService.createDeployment(deploymentData);

      if (error) {
        throw new Error(`Failed to create deployment: ${error.message}`);
      }

      console.log(`Deployment ${deployment.id} queued successfully`);
      return deployment;
    } catch (error) {
      console.error('Error queuing deployment:', error);
      throw error;
    }
  }

  async cancelDeployment(deploymentId) {
    try {
      const { data: deployment, error } = await SupabaseService.getDeployment(deploymentId);

      if (error || !deployment) {
        throw new Error('Deployment not found');
      }

      if (!['queued', 'building'].includes(deployment.status)) {
        throw new Error('Cannot cancel deployment in current state');
      }

      await SupabaseService.updateDeployment(deploymentId, {
        status: 'cancelled'
      });

      console.log(`Deployment ${deploymentId} cancelled`);
      return true;
    } catch (error) {
      console.error('Error cancelling deployment:', error);
      throw error;
    }
  }

  async getQueueStatus() {
    try {
      const { data: queuedDeployments, error } = await SupabaseService.getAdminClient()
        .from('deployments')
        .select('id, project_id, status, created_at')
        .in('status', ['queued', 'building'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error getting queue status:', error);
        return { queued: 0, building: 0, deployments: [] };
      }

      const queued = queuedDeployments.filter(d => d.status === 'queued').length;
      const building = queuedDeployments.filter(d => d.status === 'building').length;

      return {
        queued,
        building,
        total: queuedDeployments.length,
        deployments: queuedDeployments,
        isProcessing: this.isProcessing
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { queued: 0, building: 0, deployments: [] };
    }
  }

  // Webhook integration methods
  async handleWebhookDeployment(repositoryUrl, branch, commitInfo, environment = 'production') {
    try {
      // Find projects with matching repository and branch
      let query = SupabaseService.getAdminClient()
        .from('projects')
        .select('*')
        .eq('repository->>url', repositoryUrl);

      // For production deployments, match the exact branch
      // For preview deployments, find any project with the same repository
      if (environment === 'production') {
        query = query.eq('repository->>branch', branch);
      }

      const { data: projects, error } = await query;

      if (error) {
        console.error('Error finding projects for webhook:', error);
        return [];
      }

      if (!projects || projects.length === 0) {
        console.log(`No projects found for repository ${repositoryUrl} on branch ${branch}`);
        return [];
      }

      console.log(`Found ${projects.length} project(s) for webhook deployment`);

      const deployments = [];

      // Create deployments for each matching project
      for (const project of projects) {
        try {
          const deployment = await this.queueDeployment(project.id, commitInfo, environment);
          deployments.push(deployment);
        } catch (error) {
          console.error(`Failed to queue deployment for project ${project.id}:`, error);
        }
      }

      return deployments;
    } catch (error) {
      console.error('Error handling webhook deployment:', error);
      return [];
    }
  }

  async retryFailedDeployment(deploymentId) {
    try {
      const { data: deployment, error } = await SupabaseService.getDeployment(deploymentId);

      if (error || !deployment) {
        throw new Error('Deployment not found');
      }

      if (deployment.status !== 'error') {
        throw new Error('Can only retry failed deployments');
      }

      // Reset deployment status to queued
      await SupabaseService.updateDeployment(deploymentId, {
        status: 'queued',
        error: null,
        build_log: [...(deployment.build_log || []), '--- Retrying deployment ---']
      });

      console.log(`Deployment ${deploymentId} queued for retry`);
      return true;
    } catch (error) {
      console.error('Error retrying deployment:', error);
      throw error;
    }
  }

  // Cleanup old deployments
  async cleanupOldDeployments(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data: oldDeployments, error } = await SupabaseService.getAdminClient()
        .from('deployments')
        .select('id')
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['ready', 'error', 'cancelled']);

      if (error) {
        console.error('Error finding old deployments:', error);
        return 0;
      }

      if (!oldDeployments || oldDeployments.length === 0) {
        return 0;
      }

      // Delete old deployments (you might want to archive instead)
      const { error: deleteError } = await SupabaseService.getAdminClient()
        .from('deployments')
        .delete()
        .in('id', oldDeployments.map(d => d.id));

      if (deleteError) {
        console.error('Error deleting old deployments:', deleteError);
        return 0;
      }

      console.log(`Cleaned up ${oldDeployments.length} old deployments`);
      return oldDeployments.length;
    } catch (error) {
      console.error('Error cleaning up old deployments:', error);
      return 0;
    }
  }
}

// Export singleton instance
module.exports = new DeploymentQueue();