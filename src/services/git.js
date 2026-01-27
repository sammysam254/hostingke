const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

class GitService {
  constructor() {
    this.reposPath = path.join(process.cwd(), 'repositories');
  }

  async ensureReposDirectory() {
    try {
      await fs.access(this.reposPath);
    } catch {
      await fs.mkdir(this.reposPath, { recursive: true });
    }
  }

  async cloneRepository(repoUrl, projectId, accessToken) {
    await this.ensureReposDirectory();
    
    const repoPath = path.join(this.reposPath, projectId);
    
    // Add authentication to URL if needed
    let authenticatedUrl = repoUrl;
    if (accessToken && repoUrl.includes('github.com')) {
      authenticatedUrl = repoUrl.replace('https://github.com/', `https://${accessToken}@github.com/`);
    }

    try {
      // Remove existing directory if it exists
      try {
        await fs.rmdir(repoPath, { recursive: true });
      } catch {}

      const git = simpleGit();
      await git.clone(authenticatedUrl, repoPath);
      
      return repoPath;
    } catch (error) {
      console.error('Git clone failed:', error);
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async pullLatest(repoPath, branch = 'main') {
    try {
      const git = simpleGit(repoPath);
      await git.checkout(branch);
      await git.pull('origin', branch);
      
      const log = await git.log(['-1']);
      return {
        commitSha: log.latest.hash,
        commitMessage: log.latest.message,
        author: log.latest.author_name,
        date: log.latest.date
      };
    } catch (error) {
      console.error('Git pull failed:', error);
      throw new Error(`Failed to pull latest changes: ${error.message}`);
    }
  }

  async getCommitInfo(repoPath, commitSha) {
    try {
      const git = simpleGit(repoPath);
      const log = await git.show([commitSha, '--format=fuller']);
      return log;
    } catch (error) {
      console.error('Failed to get commit info:', error);
      throw new Error(`Failed to get commit info: ${error.message}`);
    }
  }

  async getBranches(repoPath) {
    try {
      const git = simpleGit(repoPath);
      const branches = await git.branch(['-r']);
      return branches.all.map(branch => branch.replace('origin/', ''));
    } catch (error) {
      console.error('Failed to get branches:', error);
      throw new Error(`Failed to get branches: ${error.message}`);
    }
  }

  async setupWebhook(repoUrl, accessToken, webhookUrl) {
    // Implementation depends on Git provider (GitHub, GitLab, etc.)
    // This is a simplified version
    try {
      if (repoUrl.includes('github.com')) {
        return await this.setupGitHubWebhook(repoUrl, accessToken, webhookUrl);
      }
      // Add support for other providers
    } catch (error) {
      console.error('Webhook setup failed:', error);
      throw error;
    }
  }

  async setupGitHubWebhook(repoUrl, accessToken, webhookUrl) {
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({ auth: accessToken });

    const [owner, repo] = repoUrl.split('/').slice(-2);
    const repoName = repo.replace('.git', '');

    try {
      const response = await octokit.repos.createWebhook({
        owner,
        repo: repoName,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: process.env.WEBHOOK_SECRET
        },
        events: ['push', 'pull_request']
      });

      return response.data;
    } catch (error) {
      if (error.status === 422) {
        console.log('Webhook already exists');
        return null;
      }
      throw error;
    }
  }
}

module.exports = new GitService();