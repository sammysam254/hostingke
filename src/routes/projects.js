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

    // Get deployment counts and other stats
    const projectsWithStats = await Promise.all((projects || []).map(async (project) => {
      try {
        const { data: deployments } = await SupabaseService.getAdminClient()
          .from('deployments')
          .select('id, status')
          .eq('project_id', project.id);

        const deploymentCount = deployments?.length || 0;
        const successfulDeployments = deployments?.filter(d => d.status === 'ready').length || 0;

        return {
          ...project,
          deployment_count: deploymentCount,
          successful_deployments: successfulDeployments,
          url: project.slug ? `https://${project.slug}.hostingke.com` : null
        };
      } catch (err) {
        console.error('Error getting project stats:', err);
        return project;
      }
    }));

    // Calculate totals
    const totalDeployments = projectsWithStats.reduce((sum, p) => sum + (p.deployment_count || 0), 0);
    const totalDomains = projectsWithStats.filter(p => p.url).length;

    res.json({
      projects: projectsWithStats,
      totalDeployments,
      totalDomains,
      totalViews: 0 // TODO: Implement analytics
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create new project
router.post('/', async (req, res) => {
  try {
    console.log('Creating project with data:', req.body);
    const { name, repository, build_settings } = req.body;

    if (!name || !repository) {
      return res.status(400).json({ error: 'Project name and repository are required' });
    }

    // Extract repository information
    const repository_url = repository.url || repository.clone_url;
    const branch = repository.branch || repository.default_branch || 'main';
    const git_provider = repository.provider || 'github';

    if (!repository_url) {
      return res.status(400).json({ error: 'Repository URL is required' });
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
      owner_id: req.user.id,
      repository: {
        provider: git_provider,
        url: repository_url,
        branch: branch,
        full_name: repository.full_name
      },
      build_settings: {
        command: build_settings?.command || 'npm run build',
        directory: build_settings?.directory || 'dist',
        environment: build_settings?.environment || {}
      },
      domains: [{
        domain: `${slug}.hostingke.com`,
        is_custom: false,
        ssl_enabled: true,
        verified: true
      }],
      status: 'active'
    };

    console.log('Creating project with processed data:', projectData);

    const { data: project, error } = await SupabaseService.getAdminClient()
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('Create project error:', error);
      return res.status(500).json({ error: 'Failed to create project: ' + error.message });
    }

    console.log('Project created successfully:', project.id);

    // Trigger initial deployment
    try {
      console.log('Triggering initial deployment...');
      const deploymentData = {
        project_id: project.id,
        commit_sha: null,
        commit_message: 'Initial deployment',
        branch: branch,
        environment: 'production',
        status: 'queued'
      };

      const { data: deployment, error: deployError } = await SupabaseService.getAdminClient()
        .from('deployments')
        .insert(deploymentData)
        .select()
        .single();

      if (deployError) {
        console.error('Failed to create initial deployment:', deployError);
      } else {
        console.log('Initial deployment created:', deployment.id);
        
        // Start deployment process (async)
        try {
          const DeploymentQueue = require('../services/deploymentQueue');
          DeploymentQueue.addDeployment(deployment);
        } catch (queueError) {
          console.error('Failed to queue deployment:', queueError);
        }
      }
    } catch (deploymentError) {
      console.error('Deployment trigger failed:', deploymentError);
    }

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project: ' + error.message });
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

// Deploy project
router.post('/:id/deploy', async (req, res) => {
  try {
    console.log('Manual deployment triggered for project:', req.params.id);
    
    // Get project details
    const { data: project, error: projectError } = await SupabaseService.getProject(req.params.id, req.user.id);

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create deployment record
    const deploymentData = {
      project_id: project.id,
      commit_sha: null,
      commit_message: 'Manual deployment',
      branch: project.branch || 'main',
      environment: 'production',
      status: 'pending'
    };

    const { data: deployment, error: deployError } = await SupabaseService.createDeployment(deploymentData);

    if (deployError) {
      console.error('Failed to create deployment:', deployError);
      return res.status(500).json({ error: 'Failed to create deployment' });
    }

    console.log('Deployment created:', deployment.id);

    // Start deployment process (async)
    DeploymentService.processDeployment(deployment.id).catch(err => {
      console.error('Deployment processing failed:', err);
    });

    res.json({ 
      message: 'Deployment started successfully',
      deployment: deployment
    });
  } catch (error) {
    console.error('Deploy project error:', error);
    res.status(500).json({ error: 'Failed to start deployment' });
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