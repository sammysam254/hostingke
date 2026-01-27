const express = require('express');
const multer = require('multer');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs').promises;

const Deployment = require('../models/Deployment');
const Project = require('../models/Project');
const DeploymentService = require('../services/deployment');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Get deployments for a project
router.get('/', async (req, res) => {
  try {
    const { project } = req.query;
    
    const query = {};
    if (project) {
      // Verify user owns the project
      const projectDoc = await Project.findOne({
        _id: project,
        owner: req.user.id
      });
      
      if (!projectDoc) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      query.project = project;
    } else {
      // Get all projects owned by user
      const userProjects = await Project.find({ owner: req.user.id });
      query.project = { $in: userProjects.map(p => p._id) };
    }

    const deployments = await Deployment.find(query)
      .populate('project', 'name slug')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(deployments);
  } catch (error) {
    console.error('Get deployments error:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// Get single deployment
router.get('/:id', async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id)
      .populate({
        path: 'project',
        match: { owner: req.user.id },
        select: 'name slug owner'
      });

    if (!deployment || !deployment.project) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json(deployment);
  } catch (error) {
    console.error('Get deployment error:', error);
    res.status(500).json({ error: 'Failed to fetch deployment' });
  }
});

// Upload and deploy (for CLI and drag-drop)
router.post('/upload', upload.single('site'), async (req, res) => {
  try {
    const projectId = req.headers['x-project-id'];
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create deployment record
    const deployment = new Deployment({
      project: project._id,
      status: 'building',
      environment: 'production',
      buildSettings: {
        command: 'Direct upload',
        directory: '.'
      }
    });

    await deployment.save();

    // Extract uploaded zip file
    const deploymentPath = path.join(process.cwd(), 'deployed-sites', deployment._id.toString());
    await fs.mkdir(deploymentPath, { recursive: true });

    try {
      // Extract zip file
      await new Promise((resolve, reject) => {
        const stream = require('stream');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);
        
        bufferStream
          .pipe(unzipper.Extract({ path: deploymentPath }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Update deployment as ready
      const deploymentUrl = `https://${project.slug}.yourplatform.com`;
      
      await Deployment.findByIdAndUpdate(deployment._id, {
        status: 'ready',
        url: deploymentUrl,
        buildTime: 1,
        size: req.file.size
      });

      res.json({
        message: 'Deployment successful',
        deploymentId: deployment._id,
        url: deploymentUrl
      });

    } catch (extractError) {
      await Deployment.findByIdAndUpdate(deployment._id, {
        status: 'error',
        error: { message: 'Failed to extract uploaded file' }
      });
      
      throw extractError;
    }

  } catch (error) {
    console.error('Upload deployment error:', error);
    res.status(500).json({ error: 'Deployment failed' });
  }
});

// Cancel deployment
router.post('/:id/cancel', async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id)
      .populate({
        path: 'project',
        match: { owner: req.user.id }
      });

    if (!deployment || !deployment.project) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (!['queued', 'building'].includes(deployment.status)) {
      return res.status(400).json({ error: 'Cannot cancel deployment in current state' });
    }

    await Deployment.findByIdAndUpdate(deployment._id, {
      status: 'cancelled'
    });

    res.json({ message: 'Deployment cancelled successfully' });
  } catch (error) {
    console.error('Cancel deployment error:', error);
    res.status(500).json({ error: 'Failed to cancel deployment' });
  }
});

// Rollback to previous deployment
router.post('/:id/rollback', async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id)
      .populate({
        path: 'project',
        match: { owner: req.user.id }
      });

    if (!deployment || !deployment.project) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (deployment.status !== 'ready') {
      return res.status(400).json({ error: 'Can only rollback to successful deployments' });
    }

    // Create new deployment based on the rollback target
    const rollbackDeployment = new Deployment({
      project: deployment.project._id,
      commitSha: deployment.commitSha,
      commitMessage: `Rollback to ${deployment.commitSha?.substring(0, 7) || 'previous deployment'}`,
      branch: deployment.branch,
      status: 'ready',
      url: deployment.url,
      environment: 'production',
      buildSettings: deployment.buildSettings,
      assets: deployment.assets,
      size: deployment.size
    });

    await rollbackDeployment.save();

    // Copy deployment files
    const sourcePath = path.join(process.cwd(), 'deployed-sites', deployment._id.toString());
    const targetPath = path.join(process.cwd(), 'deployed-sites', rollbackDeployment._id.toString());
    
    await fs.mkdir(targetPath, { recursive: true });
    await copyDirectory(sourcePath, targetPath);

    res.json({
      message: 'Rollback successful',
      deploymentId: rollbackDeployment._id,
      url: rollbackDeployment.url
    });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Rollback failed' });
  }
});

// Get deployment analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id)
      .populate({
        path: 'project',
        match: { owner: req.user.id }
      });

    if (!deployment || !deployment.project) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Mock analytics data - in real implementation, get from CDN/analytics service
    const analytics = {
      requests: Math.floor(Math.random() * 10000),
      bandwidth: Math.floor(Math.random() * 1000000000),
      uniqueVisitors: Math.floor(Math.random() * 5000),
      topPages: [
        { path: '/', views: Math.floor(Math.random() * 3000) },
        { path: '/about', views: Math.floor(Math.random() * 1000) },
        { path: '/contact', views: Math.floor(Math.random() * 500) }
      ],
      referrers: [
        { source: 'Direct', visits: Math.floor(Math.random() * 2000) },
        { source: 'Google', visits: Math.floor(Math.random() * 1500) },
        { source: 'Social Media', visits: Math.floor(Math.random() * 800) }
      ],
      performance: {
        averageLoadTime: 1.2 + Math.random() * 2,
        lighthouseScore: 85 + Math.random() * 10
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Helper function to copy directory
async function copyDirectory(src, dest) {
  try {
    const items = await fs.readdir(src, { withFileTypes: true });

    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);

      if (item.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error('Copy directory error:', error);
    throw error;
  }
}

module.exports = router;