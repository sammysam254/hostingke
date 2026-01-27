const express = require('express');
const SupabaseService = require('../services/supabase');
const DeploymentService = require('../services/deployment');
const GitService = require('../services/git');

const router = express.Router();

// Get all projects for user
router.get('/', async (req, res) => {
  try {
    const { data: projects, error } = await SupabaseService.getProjects(req.user.id);

    if (error) {
      console.error('Get projects error:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.json(projects || []);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create new project
router.post('/', async (req, res) => {
  try {
    const { name, repository, buildSettings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Generate unique slug
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let slug = baseSlug;
    let counter = 1;

    // Check if slug exists
    while (true) {
      const { data: existingProject } = await SupabaseService.getAdminClient()
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!existingProject) break;
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const projectData = {
      name,
      slug,
      repository: repository || {},
      build_settings: {
        command: buildSettings?.command || 'npm run build',
        directory: buildSettings?.directory || 'dist',
        environment: buildSettings?.environment || {}
      },
      domains: [{
        domain: `${slug}.yourplatform.com`,
        is_custom: false,
        ssl_enabled: true,
        verified: true
      }]
    };

    const { data: project, error } = await SupabaseService.createProject(req.user.id, projectData);

    if (error) {
      console.error('Create project error:', error);
      return res.status(500).json({ error: 'Failed to create project' });
    }

    // Setup webhook if repository is provided
    if (repository?.url) {
      try {
        const gitProvider = req.user.git_providers?.find(p => p.provider === repository.provider);
        
        if (gitProvider) {
          const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/webhooks/git`;
          await GitService.setupWebhook(repository.url, gitProvider.access_token, webhookUrl);
        }
      } catch (webhookError) {
        console.error('Webhook setup failed:', webhookError);
        // Continue without webhook - user can set it up manually
      }
    }

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const { data: project, error } = await SupabaseService.getProject(req.params.id, req.user.id);

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const { name, buildSettings, repository } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (buildSettings) {
      updates.build_settings = {
        command: buildSettings.command,
        directory: buildSettings.directory,
        environment: buildSettings.environment || {}
      };
    }
    if (repository) updates.repository = repository;

    const { data: project, error } = await SupabaseService.updateProject(
      req.params.id, 
      req.user.id, 
      updates
    );

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await SupabaseService.deleteProject(req.params.id, req.user.id);

    if (error) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Trigger manual deployment
router.post('/:id/deploy', async (req, res) => {
  try {
    const { data: project, error } = await SupabaseService.getProject(req.params.id, req.user.id);

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get latest commit info if repository is connected
    let commitInfo = null;
    if (project.repository?.url) {
      try {
        const gitProvider = req.user.git_providers?.find(p => p.provider === project.repository.provider);
        if (gitProvider) {
          const repoPath = await GitService.cloneRepository(
            project.repository.url,
            project.id,
            gitProvider.access_token
          );
          commitInfo = await GitService.pullLatest(repoPath, project.repository.branch);
        }
      } catch (gitError) {
        console.error('Git operation failed:', gitError);
      }
    }

    // Create deployment record
    const deploymentData = {
      project_id: project.id,
      commit_sha: commitInfo?.commitSha,
      commit_message: commitInfo?.commitMessage || 'Manual deployment',
      branch: commitInfo?.branch || project.repository?.branch || 'main',
      status: 'queued',
      environment: 'production',
      build_settings: project.build_settings
    };

    const { data: deployment, error: deployError } = await SupabaseService.createDeployment(deploymentData);

    if (deployError) {
      return res.status(500).json({ error: 'Failed to create deployment' });
    }

    // Queue deployment using the deployment queue
    const DeploymentQueue = require('../services/deploymentQueue');
    await DeploymentQueue.queueDeployment(project.id, commitInfo);

    res.json({
      message: 'Deployment queued successfully',
      deploymentId: deployment.id
    });
  } catch (error) {
    console.error('Deploy project error:', error);
    res.status(500).json({ error: 'Failed to deploy project' });
  }
});

// Add custom domain
router.post('/:id/domains', async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const { data: project, error } = await SupabaseService.getProject(req.params.id, req.user.id);

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if domain already exists
    const domains = project.domains || [];
    if (domains.some(d => d.domain === domain)) {
      return res.status(400).json({ error: 'Domain already added' });
    }

    // Add new domain
    domains.push({
      domain,
      is_custom: true,
      ssl_enabled: false,
      verified: false
    });

    const { data: updatedProject, error: updateError } = await SupabaseService.updateProject(
      req.params.id,
      req.user.id,
      { domains }
    );

    if (updateError) {
      return res.status(500).json({ error: 'Failed to add domain' });
    }

    res.json({ message: 'Domain added successfully', project: updatedProject });
  } catch (error) {
    console.error('Add domain error:', error);
    res.status(500).json({ error: 'Failed to add domain' });
  }
});

module.exports = router;