#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const program = new Command();

// Configuration
let config = {
  apiUrl: 'http://localhost:3000/api',
  token: null
};

const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.netlify-clone-cli.json');

async function loadConfig() {
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    config = { ...config, ...JSON.parse(configData) };
  } catch (error) {
    // Config file doesn't exist, use defaults
  }
}

async function saveConfig() {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

async function apiRequest(method, endpoint, data = null) {
  try {
    const response = await axios({
      method,
      url: `${config.apiUrl}${endpoint}`,
      data,
      headers: {
        'Authorization': config.token ? `Bearer ${config.token}` : undefined,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'API request failed');
    }
    throw error;
  }
}

// CLI Commands

program
  .name('netlify-clone')
  .description('CLI for Netlify Clone hosting platform')
  .version('1.0.0');

// Login command
program
  .command('login')
  .description('Login to your account')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --password <password>', 'Password')
  .action(async (options) => {
    try {
      const email = options.email || await promptInput('Email: ');
      const password = options.password || await promptInput('Password: ', true);

      const response = await apiRequest('POST', '/auth/login', { email, password });
      
      config.token = response.token;
      await saveConfig();
      
      console.log('✅ Successfully logged in!');
      console.log(`Welcome, ${response.user.name}!`);
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      process.exit(1);
    }
  });

// Deploy command
program
  .command('deploy')
  .description('Deploy current directory')
  .option('-d, --dir <directory>', 'Directory to deploy', '.')
  .option('-p, --project <project>', 'Project ID or name')
  .action(async (options) => {
    try {
      if (!config.token) {
        console.error('❌ Please login first: netlify-clone login');
        process.exit(1);
      }

      const deployDir = path.resolve(options.dir);
      
      // Check if directory exists
      try {
        await fs.access(deployDir);
      } catch {
        console.error(`❌ Directory not found: ${deployDir}`);
        process.exit(1);
      }

      console.log(`📦 Deploying ${deployDir}...`);

      // Create deployment archive
      const archiver = require('archiver');
      const archive = archiver('zip');
      const chunks = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', async () => {
        try {
          const zipBuffer = Buffer.concat(chunks);
          
          // Upload deployment
          const response = await axios.post(`${config.apiUrl}/deployments/upload`, zipBuffer, {
            headers: {
              'Authorization': `Bearer ${config.token}`,
              'Content-Type': 'application/zip',
              'X-Project-ID': options.project
            }
          });

          console.log('✅ Deployment successful!');
          console.log(`🔗 URL: ${response.data.url}`);
          console.log(`📊 Deployment ID: ${response.data.deploymentId}`);
        } catch (error) {
          console.error('❌ Deployment failed:', error.message);
          process.exit(1);
        }
      });

      archive.directory(deployDir, false);
      archive.finalize();

    } catch (error) {
      console.error('❌ Deploy failed:', error.message);
      process.exit(1);
    }
  });

// List projects
program
  .command('projects')
  .description('List all projects')
  .action(async () => {
    try {
      if (!config.token) {
        console.error('❌ Please login first: netlify-clone login');
        process.exit(1);
      }

      const projects = await apiRequest('GET', '/projects');
      
      if (projects.length === 0) {
        console.log('No projects found. Create one at the dashboard.');
        return;
      }

      console.log('\n📁 Your Projects:\n');
      projects.forEach(project => {
        console.log(`  ${project.name} (${project.slug})`);
        console.log(`    URL: https://${project.slug}.yourplatform.com`);
        console.log(`    Status: ${project.status}`);
        console.log(`    Last updated: ${new Date(project.updatedAt).toLocaleDateString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error.message);
      process.exit(1);
    }
  });

// Create project
program
  .command('create')
  .description('Create a new project')
  .option('-n, --name <name>', 'Project name')
  .option('-r, --repo <repo>', 'Git repository URL')
  .action(async (options) => {
    try {
      if (!config.token) {
        console.error('❌ Please login first: netlify-clone login');
        process.exit(1);
      }

      const name = options.name || await promptInput('Project name: ');
      const repo = options.repo || await promptInput('Git repository URL (optional): ');

      const projectData = { name };
      if (repo) {
        projectData.repository = {
          url: repo,
          provider: detectGitProvider(repo),
          branch: 'main'
        };
      }

      const project = await apiRequest('POST', '/projects', projectData);
      
      console.log('✅ Project created successfully!');
      console.log(`📁 Name: ${project.name}`);
      console.log(`🔗 URL: https://${project.slug}.yourplatform.com`);
      console.log(`📊 Project ID: ${project._id}`);
    } catch (error) {
      console.error('❌ Failed to create project:', error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show deployment status')
  .option('-p, --project <project>', 'Project ID or name')
  .action(async (options) => {
    try {
      if (!config.token) {
        console.error('❌ Please login first: netlify-clone login');
        process.exit(1);
      }

      const projects = await apiRequest('GET', '/projects');
      let project;

      if (options.project) {
        project = projects.find(p => p._id === options.project || p.name === options.project);
      } else if (projects.length === 1) {
        project = projects[0];
      } else {
        console.error('❌ Please specify a project with -p flag');
        process.exit(1);
      }

      if (!project) {
        console.error('❌ Project not found');
        process.exit(1);
      }

      const deployments = await apiRequest('GET', `/deployments?project=${project._id}`);
      
      console.log(`\n📊 Status for ${project.name}:\n`);
      
      if (deployments.length === 0) {
        console.log('No deployments yet.');
        return;
      }

      const latest = deployments[0];
      console.log(`Latest deployment: ${latest.status}`);
      console.log(`URL: ${latest.url || 'N/A'}`);
      console.log(`Created: ${new Date(latest.createdAt).toLocaleString()}`);
      
      if (latest.buildTime) {
        console.log(`Build time: ${latest.buildTime}s`);
      }
      
      if (latest.error) {
        console.log(`Error: ${latest.error.message}`);
      }
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    }
  });

// Logs command
program
  .command('logs')
  .description('Show build logs')
  .option('-p, --project <project>', 'Project ID or name')
  .option('-d, --deployment <deployment>', 'Deployment ID')
  .action(async (options) => {
    try {
      if (!config.token) {
        console.error('❌ Please login first: netlify-clone login');
        process.exit(1);
      }

      let deploymentId = options.deployment;
      
      if (!deploymentId) {
        const projects = await apiRequest('GET', '/projects');
        let project;

        if (options.project) {
          project = projects.find(p => p._id === options.project || p.name === options.project);
        } else if (projects.length === 1) {
          project = projects[0];
        } else {
          console.error('❌ Please specify a project with -p flag');
          process.exit(1);
        }

        const deployments = await apiRequest('GET', `/deployments?project=${project._id}`);
        if (deployments.length === 0) {
          console.log('No deployments found.');
          return;
        }
        
        deploymentId = deployments[0]._id;
      }

      const deployment = await apiRequest('GET', `/deployments/${deploymentId}`);
      
      console.log(`\n📋 Build logs for deployment ${deploymentId}:\n`);
      
      if (deployment.buildLog && deployment.buildLog.length > 0) {
        deployment.buildLog.forEach(log => console.log(log));
      } else {
        console.log('No logs available.');
      }
    } catch (error) {
      console.error('❌ Failed to get logs:', error.message);
      process.exit(1);
    }
  });

// Helper functions
async function promptInput(question, hidden = false) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let input = '';
      process.stdin.on('data', (char) => {
        if (char === '\u0003') { // Ctrl+C
          process.exit();
        } else if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(input);
        } else if (char === '\u007f') { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

function detectGitProvider(url) {
  if (url.includes('github.com')) return 'github';
  if (url.includes('gitlab.com')) return 'gitlab';
  if (url.includes('bitbucket.org')) return 'bitbucket';
  return 'github'; // default
}

// Initialize and run
async function main() {
  await loadConfig();
  program.parse();
}

main().catch(console.error);