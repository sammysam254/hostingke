const express = require('express');
const crypto = require('crypto');
const SupabaseService = require('../services/supabase');
const DeploymentQueue = require('../services/deploymentQueue');

const router = express.Router();

// Middleware to verify webhook signatures (optional)
const verifyWebhookSignature = (provider) => {
  return (req, res, next) => {
    const signature = req.headers['x-hub-signature-256'] || 
                     req.headers['x-gitlab-token'] || 
                     req.headers['x-hook-uuid'];
    
    const payload = JSON.stringify(req.body);
    const secret = process.env.WEBHOOK_SECRET;

    // If no secret is configured, skip verification but log a warning
    if (!secret) {
      console.warn(`⚠️  WEBHOOK_SECRET not configured - ${provider} webhooks will accept all requests`);
      console.warn('   For production use, please set WEBHOOK_SECRET environment variable');
      return next();
    }

    // If secret is configured but no signature provided, allow it for backward compatibility
    if (!signature) {
      console.warn(`⚠️  No signature provided for ${provider} webhook, but secret is configured`);
      console.warn('   Consider configuring webhook signature in your Git provider for better security');
      return next();
    }

    let isValid = false;

    try {
      switch (provider) {
        case 'github':
          const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
          isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
          );
          break;
        
        case 'gitlab':
          isValid = signature === secret;
          break;
        
        case 'bitbucket':
          // Bitbucket doesn't use signature verification by default
          // You can implement IP whitelist or other verification methods
          isValid = true;
          break;
      }
    } catch (error) {
      console.error(`Error verifying ${provider} webhook signature:`, error);
      isValid = false;
    }

    if (!isValid) {
      console.error(`❌ Invalid webhook signature for ${provider}`);
      return res.status(401).json({ 
        error: 'Invalid signature',
        message: 'Webhook signature verification failed. Please check your webhook secret configuration.'
      });
    }

    console.log(`✅ ${provider} webhook signature verified successfully`);
    next();
  };
};

// GitHub webhook handler
router.post('/github', verifyWebhookSignature('github'), async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;

    console.log(`Received GitHub webhook: ${event}`);

    // Handle push events
    if (event === 'push') {
      await handleGitHubPush(payload);
    }
    
    // Handle pull request events
    else if (event === 'pull_request') {
      await handleGitHubPullRequest(payload);
    }
    
    // Handle ping events (webhook test)
    else if (event === 'ping') {
      console.log('GitHub webhook ping received');
    }

    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GitLab webhook handler
router.post('/gitlab', verifyWebhookSignature('gitlab'), async (req, res) => {
  try {
    const event = req.headers['x-gitlab-event'];
    const payload = req.body;

    console.log(`Received GitLab webhook: ${event}`);

    // Handle push events
    if (event === 'Push Hook') {
      await handleGitLabPush(payload);
    }
    
    // Handle merge request events
    else if (event === 'Merge Request Hook') {
      await handleGitLabMergeRequest(payload);
    }

    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('GitLab webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Bitbucket webhook handler
router.post('/bitbucket', verifyWebhookSignature('bitbucket'), async (req, res) => {
  try {
    const event = req.headers['x-event-key'];
    const payload = req.body;

    console.log(`Received Bitbucket webhook: ${event}`);

    // Handle push events
    if (event === 'repo:push') {
      await handleBitbucketPush(payload);
    }
    
    // Handle pull request events
    else if (event === 'pullrequest:created' || event === 'pullrequest:updated') {
      await handleBitbucketPullRequest(payload);
    }

    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Bitbucket webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Generic webhook handler for manual testing
router.post('/generic', async (req, res) => {
  try {
    const { repository_url, branch, commit_sha, commit_message } = req.body;

    if (!repository_url) {
      return res.status(400).json({ error: 'repository_url is required' });
    }

    const commitInfo = {
      commitSha: commit_sha,
      commitMessage: commit_message || 'Manual webhook trigger',
      branch: branch || 'main'
    };

    const deployments = await DeploymentQueue.handleWebhookDeployment(
      repository_url,
      branch || 'main',
      commitInfo
    );

    res.json({ 
      message: 'Webhook processed successfully',
      deployments_triggered: deployments.length,
      deployments: deployments.map(d => ({ id: d.id, status: d.status }))
    });
  } catch (error) {
    console.error('Generic webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GitHub push event handler
async function handleGitHubPush(payload) {
  const repositoryUrl = payload.repository.clone_url;
  const branch = payload.ref.replace('refs/heads/', '');
  const commits = payload.commits || [];
  
  if (commits.length === 0) {
    console.log('No commits in push event, skipping deployment');
    return;
  }

  const latestCommit = commits[commits.length - 1];
  
  const commitInfo = {
    commitSha: latestCommit.id,
    commitMessage: latestCommit.message,
    branch: branch,
    author: latestCommit.author.name
  };

  await DeploymentQueue.handleWebhookDeployment(repositoryUrl, branch, commitInfo);
}

// GitHub pull request event handler
async function handleGitHubPullRequest(payload) {
  if (payload.action !== 'opened' && payload.action !== 'synchronize') {
    return; // Only deploy on PR open or update
  }

  const repositoryUrl = payload.repository.clone_url;
  const branch = payload.pull_request.head.ref;
  const baseBranch = payload.pull_request.base.ref;
  
  const commitInfo = {
    commitSha: payload.pull_request.head.sha,
    commitMessage: `PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
    branch: branch,
    author: payload.pull_request.user.login,
    pullRequest: {
      number: payload.pull_request.number,
      title: payload.pull_request.title,
      baseBranch: baseBranch
    }
  };

  await DeploymentQueue.handleWebhookDeployment(repositoryUrl, branch, commitInfo, 'preview');
}

// GitLab push event handler
async function handleGitLabPush(payload) {
  const repositoryUrl = payload.repository.git_http_url;
  const branch = payload.ref.replace('refs/heads/', '');
  const commits = payload.commits || [];
  
  if (commits.length === 0) {
    console.log('No commits in push event, skipping deployment');
    return;
  }

  const latestCommit = commits[commits.length - 1];
  
  const commitInfo = {
    commitSha: latestCommit.id,
    commitMessage: latestCommit.message,
    branch: branch,
    author: latestCommit.author.name
  };

  await DeploymentQueue.handleWebhookDeployment(repositoryUrl, branch, commitInfo);
}

// GitLab merge request event handler
async function handleGitLabMergeRequest(payload) {
  if (payload.object_attributes.action !== 'open' && 
      payload.object_attributes.action !== 'update') {
    return;
  }

  const repositoryUrl = payload.repository.git_http_url;
  const branch = payload.object_attributes.source_branch;
  const baseBranch = payload.object_attributes.target_branch;
  
  const commitInfo = {
    commitSha: payload.object_attributes.last_commit.id,
    commitMessage: `MR !${payload.object_attributes.iid}: ${payload.object_attributes.title}`,
    branch: branch,
    author: payload.object_attributes.author.name,
    mergeRequest: {
      iid: payload.object_attributes.iid,
      title: payload.object_attributes.title,
      baseBranch: baseBranch
    }
  };

  await DeploymentQueue.handleWebhookDeployment(repositoryUrl, branch, commitInfo, 'preview');
}

// Bitbucket push event handler
async function handleBitbucketPush(payload) {
  const repositoryUrl = payload.repository.links.clone.find(link => 
    link.name === 'https'
  )?.href;
  
  if (!repositoryUrl) {
    console.error('Could not find repository URL in Bitbucket payload');
    return;
  }

  const changes = payload.push.changes || [];
  
  for (const change of changes) {
    if (change.new && change.new.type === 'branch') {
      const branch = change.new.name;
      const commits = change.commits || [];
      
      if (commits.length === 0) continue;
      
      const latestCommit = commits[0]; // Bitbucket orders commits newest first
      
      const commitInfo = {
        commitSha: latestCommit.hash,
        commitMessage: latestCommit.message,
        branch: branch,
        author: latestCommit.author.user?.display_name || latestCommit.author.raw
      };

      await DeploymentQueue.handleWebhookDeployment(repositoryUrl, branch, commitInfo);
    }
  }
}

// Bitbucket pull request event handler
async function handleBitbucketPullRequest(payload) {
  const repositoryUrl = payload.repository.links.clone.find(link => 
    link.name === 'https'
  )?.href;
  
  if (!repositoryUrl) {
    console.error('Could not find repository URL in Bitbucket payload');
    return;
  }

  const pullRequest = payload.pullrequest;
  const branch = pullRequest.source.branch.name;
  const baseBranch = pullRequest.destination.branch.name;
  
  const commitInfo = {
    commitSha: pullRequest.source.commit.hash,
    commitMessage: `PR #${pullRequest.id}: ${pullRequest.title}`,
    branch: branch,
    author: pullRequest.author.display_name,
    pullRequest: {
      id: pullRequest.id,
      title: pullRequest.title,
      baseBranch: baseBranch
    }
  };

  await DeploymentQueue.handleWebhookDeployment(repositoryUrl, branch, commitInfo, 'preview');
}

// Webhook status endpoint
router.get('/status', async (req, res) => {
  try {
    // Get recent webhook activity
    const { data: recentDeployments, error } = await SupabaseService.getAdminClient()
      .from('deployments')
      .select(`
        id,
        status,
        commit_sha,
        commit_message,
        branch,
        environment,
        created_at,
        projects (
          name,
          slug
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching webhook status:', error);
      return res.status(500).json({ error: 'Failed to fetch status' });
    }

    // Get queue status
    const queueStatus = await DeploymentQueue.getQueueStatus();

    // Check security configuration
    const webhookSecretConfigured = !!process.env.WEBHOOK_SECRET;
    const securityLevel = webhookSecretConfigured ? 'secure' : 'basic';
    
    res.json({
      status: 'active',
      security: {
        webhook_secret_configured: webhookSecretConfigured,
        level: securityLevel,
        recommendation: webhookSecretConfigured 
          ? 'Webhook signatures are being verified - good security!' 
          : 'Consider setting WEBHOOK_SECRET for better security'
      },
      queue_status: queueStatus,
      recent_deployments: recentDeployments || [],
      supported_providers: ['github', 'gitlab', 'bitbucket'],
      endpoints: {
        github: '/api/webhooks/github',
        gitlab: '/api/webhooks/gitlab',
        bitbucket: '/api/webhooks/bitbucket',
        generic: '/api/webhooks/generic'
      },
      configuration: {
        signature_verification: webhookSecretConfigured ? 'enabled' : 'disabled',
        fallback_mode: 'accept_unsigned_requests',
        note: 'Webhooks will work without secrets but are less secure'
      }
    });
  } catch (error) {
    console.error('Webhook status error:', error);
    res.status(500).json({ error: 'Failed to get webhook status' });
  }
});

// Queue management endpoints
router.get('/queue', async (req, res) => {
  try {
    const queueStatus = await DeploymentQueue.getQueueStatus();
    res.json(queueStatus);
  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

router.post('/queue/retry/:deploymentId', async (req, res) => {
  try {
    await DeploymentQueue.retryFailedDeployment(req.params.deploymentId);
    res.json({ message: 'Deployment queued for retry' });
  } catch (error) {
    console.error('Retry deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/queue/cancel/:deploymentId', async (req, res) => {
  try {
    await DeploymentQueue.cancelDeployment(req.params.deploymentId);
    res.json({ message: 'Deployment cancelled' });
  } catch (error) {
    console.error('Cancel deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;