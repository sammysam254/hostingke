const SupabaseService = require('./supabase');
const GitService = require('./git');
const CDNService = require('./cdn');

class DeploymentService {
  constructor(io) {
    this.io = io;
    this.buildQueue = [];
    this.isProcessing = false;
  }

  async queueDeployment(project, deployment, commitInfo = null) {
    try {
      // Update deployment with commit info if available
      if (commitInfo) {
        const { error } = await SupabaseService.updateDeployment(deployment.id, {
          commit_sha: commitInfo.commitSha,
          commit_message: commitInfo.commitMessage
        });
        
        if (error) {
          console.error('Failed to update deployment with commit info:', error);
        }
      }

      this.buildQueue.push({
        deploymentId: deployment.id,
        project,
        deployment
      });

      this.emitDeploymentUpdate(deployment.id, {
        status: 'queued',
        message: 'Deployment queued for processing'
      });

      if (!this.isProcessing) {
        this.processQueue();
      }

      return deployment;
    } catch (error) {
      console.error('Failed to queue deployment:', error);
      throw error;
    }
  }

  async processQueue() {
    if (this.buildQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const { deploymentId, project, deployment } = this.buildQueue.shift();

    try {
      await this.buildAndDeploy(deploymentId, project, deployment);
    } catch (error) {
      console.error('Deployment failed:', error);
      await this.updateDeploymentStatus(deploymentId, 'error', error.message);
    }

    // Process next in queue
    setTimeout(() => this.processQueue(), 1000);
  }

  async buildAndDeploy(deploymentId, project, deployment) {
    const startTime = Date.now();
    
    try {
      // Update status to building
      await this.updateDeploymentStatus(deploymentId, 'building', 'Starting build process');

      // Step 1: Clone/Pull repository
      this.emitBuildLog(deploymentId, '📥 Fetching repository...');
      const repoPath = await this.fetchRepository(project);

      // Step 2: Install dependencies
      this.emitBuildLog(deploymentId, '📦 Installing dependencies...');
      await this.installDependencies(repoPath, deploymentId);

      // Step 3: Run build command
      this.emitBuildLog(deploymentId, '🔨 Running build command...');
      await this.runBuildCommand(repoPath, project.build_settings, deploymentId);

      // Step 4: Process assets
      this.emitBuildLog(deploymentId, '🎨 Processing assets...');
      const assets = await this.processAssets(repoPath, project.build_settings.directory);

      // Step 5: Deploy to CDN
      this.emitBuildLog(deploymentId, '🚀 Deploying to CDN...');
      const deploymentUrl = await this.deployToCDN(deploymentId, repoPath, project);

      // Step 6: Update deployment record
      const buildTime = Math.round((Date.now() - startTime) / 1000);
      
      const { error } = await SupabaseService.updateDeployment(deploymentId, {
        status: 'ready',
        build_time: buildTime,
        url: deploymentUrl,
        assets,
        size: assets.reduce((total, asset) => total + asset.size, 0)
      });

      if (error) {
        console.error('Failed to update deployment:', error);
      }

      this.emitDeploymentUpdate(deploymentId, {
        status: 'ready',
        url: deploymentUrl,
        build_time: buildTime,
        message: `✅ Deployment successful in ${buildTime}s`
      });

    } catch (error) {
      await this.updateDeploymentStatus(deploymentId, 'error', error.message);
      throw error;
    }
  }

  async fetchRepository(project) {
    if (project.repository?.url) {
      // In a real implementation, you'd get the git provider info from the user
      // For now, we'll simulate this
      return await GitService.cloneRepository(
        project.repository.url,
        project.id,
        null // accessToken would come from user's git_providers
      );
    }
    throw new Error('No repository configured');
  }

  async installDependencies(repoPath, deploymentId) {
    return new Promise((resolve, reject) => {
      const fs = require('fs').promises;
      const path = require('path');
      const { spawn } = require('child_process');
      
      // Check for package.json
      const packageJsonPath = path.join(repoPath, 'package.json');
      
      fs.access(packageJsonPath)
        .then(() => {
          const npm = spawn('npm', ['install'], { 
            cwd: repoPath,
            stdio: 'pipe'
          });

          npm.stdout.on('data', (data) => {
            this.emitBuildLog(deploymentId, data.toString());
          });

          npm.stderr.on('data', (data) => {
            this.emitBuildLog(deploymentId, data.toString());
          });

          npm.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`npm install failed with code ${code}`));
            }
          });
        })
        .catch(() => {
          // No package.json, skip dependency installation
          this.emitBuildLog(deploymentId, 'No package.json found, skipping dependency installation');
          resolve();
        });
    });
  }

  async runBuildCommand(repoPath, buildSettings, deploymentId) {
    if (!buildSettings.command) {
      this.emitBuildLog(deploymentId, 'No build command specified, skipping build step');
      return;
    }

    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const [command, ...args] = buildSettings.command.split(' ');
      
      const buildProcess = spawn(command, args, {
        cwd: repoPath,
        stdio: 'pipe',
        env: { 
          ...process.env, 
          ...buildSettings.environment
        }
      });

      buildProcess.stdout.on('data', (data) => {
        this.emitBuildLog(deploymentId, data.toString());
      });

      buildProcess.stderr.on('data', (data) => {
        this.emitBuildLog(deploymentId, data.toString());
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build command failed with code ${code}`));
        }
      });
    });
  }

  async processAssets(repoPath, buildDirectory) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const buildPath = path.join(repoPath, buildDirectory);
    const assets = [];

    async function processDirectory(dirPath, relativePath = '') {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);
          const assetPath = path.join(relativePath, item.name);

          if (item.isDirectory()) {
            await processDirectory(fullPath, assetPath);
          } else {
            const stats = await fs.stat(fullPath);
            const asset = {
              path: assetPath,
              size: stats.size,
              content_type: getContentType(item.name)
            };

            assets.push(asset);
          }
        }
      } catch (error) {
        console.error('Error processing directory:', error);
      }
    }

    try {
      await processDirectory(buildPath);
    } catch (error) {
      console.error('Asset processing failed:', error);
    }

    return assets;
  }

  async deployToCDN(deploymentId, repoPath, project) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const buildPath = path.join(repoPath, project.build_settings.directory);
    const deploymentUrl = `https://${project.slug}.yourplatform.com`;

    // Create deployment directory
    const deploymentPath = path.join(process.cwd(), 'deployed-sites', deploymentId);
    await fs.mkdir(deploymentPath, { recursive: true });

    // Copy build files
    await this.copyDirectory(buildPath, deploymentPath);

    return deploymentUrl;
  }

  async copyDirectory(src, dest) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const items = await fs.readdir(src, { withFileTypes: true });

      for (const item of items) {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);

        if (item.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await this.copyDirectory(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      console.error('Copy directory error:', error);
      throw error;
    }
  }

  async updateDeploymentStatus(deploymentId, status, message) {
    const updates = { status };
    if (status === 'error') {
      updates.error = { message };
    }

    const { error } = await SupabaseService.updateDeployment(deploymentId, updates);
    
    if (error) {
      console.error('Failed to update deployment status:', error);
    }

    this.emitDeploymentUpdate(deploymentId, { status, message });
  }

  emitDeploymentUpdate(deploymentId, data) {
    this.io.to(`deployment-${deploymentId}`).emit('deployment-update', {
      deploymentId,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  emitBuildLog(deploymentId, message) {
    this.io.to(`deployment-${deploymentId}`).emit('build-log', {
      deploymentId,
      message: message.trim(),
      timestamp: new Date().toISOString()
    });

    // Also save to database
    this.saveBuildLog(deploymentId, message.trim());
  }

  async saveBuildLog(deploymentId, message) {
    try {
      // Get current deployment
      const { data: deployment, error } = await SupabaseService.getDeployment(deploymentId);
      
      if (error || !deployment) {
        console.error('Failed to get deployment for log update:', error);
        return;
      }

      // Update build log
      const buildLog = deployment.build_log || [];
      buildLog.push(message);

      await SupabaseService.updateDeployment(deploymentId, {
        build_log: buildLog
      });
    } catch (error) {
      console.error('Failed to save build log:', error);
    }
  }
}

function getContentType(filename) {
  const path = require('path');
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = DeploymentService;