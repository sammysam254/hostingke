const express = require('express');
const SupabaseService = require('../services/supabase');
const DeploymentQueue = require('../services/deploymentQueue');

const router = express.Router();

// Test webhook endpoint - no authentication required
router.post('/test-deployment', async (req, res) => {
  try {
    const { 
      repository_url, 
      branch = 'main', 
      commit_sha = 'test-commit', 
      commit_message = 'Test deployment via webhook test endpoint',
      project_id 
    } = req.body;

    if (!repository_url && !project_id) {
      return res.status(400).json({ 
        error: 'Either repository_url or project_id is required',
        example: {
          repository_url: 'https://github.com/user/repo.git',
          branch: 'main',
          commit_sha: 'abc123',
          commit_message: 'Test deployment'
        }
      });
    }

    let projects = [];

    if (project_id) {
      // Test specific project
      const { data: project, error } = await SupabaseService.getAdminClient()
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single();

      if (error || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      projects = [project];
    } else {
      // Find projects by repository URL
      const { data: foundProjects, error } = await SupabaseService.getAdminClient()
        .from('projects')
        .select('*')
        .eq('repository->>url', repository_url);

      if (error) {
        return res.status(500).json({ error: 'Database error' });
      }

      projects = foundProjects || [];
    }

    if (projects.length === 0) {
      return res.status(404).json({ 
        error: 'No projects found',
        message: project_id 
          ? `No project found with ID: ${project_id}`
          : `No projects found for repository: ${repository_url}`
      });
    }

    const commitInfo = {
      commitSha: commit_sha,
      commitMessage: commit_message,
      branch: branch
    };

    const deployments = [];

    // Create test deployments
    for (const project of projects) {
      try {
        const deployment = await DeploymentQueue.queueDeployment(
          project.id, 
          commitInfo, 
          'production'
        );
        
        deployments.push({
          deployment_id: deployment.id,
          project_id: project.id,
          project_name: project.name,
          project_slug: project.slug,
          status: deployment.status
        });
      } catch (error) {
        console.error(`Failed to queue deployment for project ${project.id}:`, error);
        deployments.push({
          project_id: project.id,
          project_name: project.name,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Test webhook processed successfully',
      projects_found: projects.length,
      deployments_created: deployments.filter(d => !d.error).length,
      deployments: deployments,
      test_info: {
        repository_url: repository_url || projects[0]?.repository?.url,
        branch,
        commit_sha,
        commit_message,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ 
      error: 'Test webhook failed',
      message: error.message 
    });
  }
});

// List all projects for testing
router.get('/projects', async (req, res) => {
  try {
    const { data: projects, error } = await SupabaseService.getAdminClient()
      .from('projects')
      .select('id, name, slug, repository, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.json({
      projects: projects || [],
      count: projects?.length || 0,
      message: 'Use project_id in test-deployment endpoint to test specific projects'
    });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Simulate different Git provider payloads
router.post('/simulate/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { repository_url, branch = 'main' } = req.body;

    if (!repository_url) {
      return res.status(400).json({ error: 'repository_url is required' });
    }

    let simulatedPayload;
    let webhookUrl;

    switch (provider) {
      case 'github':
        simulatedPayload = {
          ref: `refs/heads/${branch}`,
          repository: {
            clone_url: repository_url,
            name: 'test-repo',
            full_name: 'user/test-repo'
          },
          commits: [{
            id: 'simulated-commit-' + Date.now(),
            message: 'Simulated GitHub push event',
            author: {
              name: 'Test User',
              email: 'test@example.com'
            }
          }]
        };
        webhookUrl = '/api/webhooks/github';
        break;

      case 'gitlab':
        simulatedPayload = {
          ref: `refs/heads/${branch}`,
          repository: {
            git_http_url: repository_url,
            name: 'test-repo'
          },
          commits: [{
            id: 'simulated-commit-' + Date.now(),
            message: 'Simulated GitLab push event',
            author: {
              name: 'Test User',
              email: 'test@example.com'
            }
          }]
        };
        webhookUrl = '/api/webhooks/gitlab';
        break;

      case 'bitbucket':
        simulatedPayload = {
          repository: {
            links: {
              clone: [{
                name: 'https',
                href: repository_url
              }]
            }
          },
          push: {
            changes: [{
              new: {
                name: branch,
                type: 'branch'
              },
              commits: [{
                hash: 'simulated-commit-' + Date.now(),
                message: 'Simulated Bitbucket push event',
                author: {
                  raw: 'Test User <test@example.com>'
                }
              }]
            }]
          }
        };
        webhookUrl = '/api/webhooks/bitbucket';
        break;

      default:
        return res.status(400).json({ 
          error: 'Invalid provider',
          supported: ['github', 'gitlab', 'bitbucket']
        });
    }

    // Make internal request to webhook endpoint
    const axios = require('axios');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    try {
      const response = await axios.post(`${baseUrl}${webhookUrl}`, simulatedPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Simulated-Webhook': 'true'
        }
      });

      res.json({
        message: `Simulated ${provider} webhook sent successfully`,
        webhook_url: webhookUrl,
        payload: simulatedPayload,
        response: response.data
      });
    } catch (webhookError) {
      res.status(500).json({
        error: 'Failed to send simulated webhook',
        webhook_url: webhookUrl,
        payload: simulatedPayload,
        webhook_error: webhookError.response?.data || webhookError.message
      });
    }

  } catch (error) {
    console.error('Simulate webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook simulation failed',
      message: error.message 
    });
  }
});

// Health check for webhook testing
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Webhook testing endpoints are available',
    endpoints: {
      test_deployment: 'POST /api/webhooks-test/test-deployment',
      list_projects: 'GET /api/webhooks-test/projects',
      simulate_github: 'POST /api/webhooks-test/simulate/github',
      simulate_gitlab: 'POST /api/webhooks-test/simulate/gitlab',
      simulate_bitbucket: 'POST /api/webhooks-test/simulate/bitbucket'
    },
    examples: {
      test_deployment: {
        repository_url: 'https://github.com/user/repo.git',
        branch: 'main',
        commit_sha: 'abc123',
        commit_message: 'Test deployment'
      },
      test_by_project_id: {
        project_id: 'uuid-here',
        branch: 'main'
      }
    }
  });
});

module.exports = router;