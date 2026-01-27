# Webhook Setup Guide

This guide explains how to set up webhooks for automatic deployments when you push code to your Git repositories.

## Overview

Webhooks enable automatic deployments by notifying your hosting platform when changes are pushed to your repository. The platform supports webhooks from:

- **GitHub** - Push events and Pull Requests
- **GitLab** - Push hooks and Merge Requests  
- **Bitbucket** - Repository push and Pull Requests

## Webhook Endpoints

Your platform provides the following webhook endpoints:

```
https://your-platform.com/api/webhooks/github
https://your-platform.com/api/webhooks/gitlab
https://your-platform.com/api/webhooks/bitbucket
https://your-platform.com/api/webhooks/generic
```

## Security

All webhooks are secured using signature verification:

- **GitHub**: Uses `X-Hub-Signature-256` header with HMAC-SHA256
- **GitLab**: Uses `X-GitLab-Token` header with secret token
- **Bitbucket**: Optional signature verification (can use IP whitelist)

Set your webhook secret in the environment variable:
```env
WEBHOOK_SECRET=your-super-secret-webhook-key
```

## GitHub Setup

### 1. Navigate to Repository Settings
1. Go to your GitHub repository
2. Click **Settings** → **Webhooks**
3. Click **Add webhook**

### 2. Configure Webhook
- **Payload URL**: `https://your-platform.com/api/webhooks/github`
- **Content type**: `application/json`
- **Secret**: Your webhook secret from environment variables
- **Events**: Select "Just the push event" or customize:
  - ✅ Pushes (for automatic deployments)
  - ✅ Pull requests (for preview deployments)

### 3. Test Webhook
Click **Add webhook** and GitHub will send a ping event to test the connection.

## GitLab Setup

### 1. Navigate to Project Settings
1. Go to your GitLab project
2. Click **Settings** → **Webhooks**

### 2. Configure Webhook
- **URL**: `https://your-platform.com/api/webhooks/gitlab`
- **Secret Token**: Your webhook secret
- **Trigger events**:
  - ✅ Push events (for automatic deployments)
  - ✅ Merge request events (for preview deployments)
- **SSL verification**: ✅ Enable SSL verification

### 3. Test Webhook
Click **Add webhook** then **Test** → **Push events** to verify the setup.

## Bitbucket Setup

### 1. Navigate to Repository Settings
1. Go to your Bitbucket repository
2. Click **Repository settings** → **Webhooks**
3. Click **Add webhook**

### 2. Configure Webhook
- **Title**: "Hosting Platform Deployment"
- **URL**: `https://your-platform.com/api/webhooks/bitbucket`
- **Status**: Active
- **Triggers**: Choose from a full list of triggers:
  - ✅ Repository push
  - ✅ Pull request created
  - ✅ Pull request updated

### 3. Test Webhook
Save the webhook and push a commit to test the integration.

## Manual/Generic Webhook

For testing or custom integrations, use the generic webhook endpoint:

```bash
curl -X POST https://your-platform.com/api/webhooks/generic \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/user/repo.git",
    "branch": "main",
    "commit_sha": "abc123def456",
    "commit_message": "Update homepage"
  }'
```

## Webhook Events

### Production Deployments
Triggered when code is pushed to the configured branch (usually `main` or `master`):

- **GitHub**: Push to main branch
- **GitLab**: Push to main branch  
- **Bitbucket**: Push to main branch

### Preview Deployments
Triggered for pull/merge requests:

- **GitHub**: Pull request opened or updated
- **GitLab**: Merge request opened or updated
- **Bitbucket**: Pull request created or updated

## Deployment Process

When a webhook is received:

1. **Verification**: Webhook signature is verified
2. **Project Matching**: Find projects with matching repository URL
3. **Branch Filtering**: Check if the branch matches project configuration
4. **Queue Deployment**: Create deployment record and add to processing queue
5. **Build Process**: Clone repo, install dependencies, run build command
6. **Deploy**: Upload assets to CDN and update DNS

## Troubleshooting

### Webhook Not Triggering

1. **Check webhook secret**: Ensure `WEBHOOK_SECRET` environment variable is set
2. **Verify URL**: Make sure webhook URL is accessible from the internet
3. **Check repository URL**: Ensure project repository URL matches exactly
4. **Branch configuration**: Verify the branch in project settings matches the pushed branch

### View Webhook Status

Check webhook activity and queue status:

```bash
curl https://your-platform.com/api/webhooks/status
```

Response includes:
- Recent deployments triggered by webhooks
- Queue status (queued, building deployments)
- Webhook configuration status

### View Deployment Queue

Monitor the deployment queue:

```bash
curl https://your-platform.com/api/webhooks/queue
```

### Retry Failed Deployment

Retry a failed deployment:

```bash
curl -X POST https://your-platform.com/api/webhooks/queue/retry/DEPLOYMENT_ID
```

### Cancel Deployment

Cancel a queued or building deployment:

```bash
curl -X POST https://your-platform.com/api/webhooks/queue/cancel/DEPLOYMENT_ID
```

## Best Practices

### Security
- Always use HTTPS for webhook URLs
- Set a strong webhook secret
- Regularly rotate webhook secrets
- Monitor webhook logs for suspicious activity

### Performance
- Use specific branch targeting to avoid unnecessary deployments
- Configure build caching to speed up deployments
- Set appropriate build timeouts

### Monitoring
- Set up alerts for failed deployments
- Monitor webhook delivery success rates
- Track deployment frequency and duration

## Advanced Configuration

### Custom Build Commands
Configure different build commands per branch:

```json
{
  "command": "npm run build:production",
  "directory": "dist",
  "environment": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com"
  }
}
```

### Environment Variables
Set different environment variables for preview vs production:

- **Production**: Uses project's main environment variables
- **Preview**: Can override with preview-specific variables

### Multiple Environments
Configure different deployment targets:

- **production**: Main branch → Production environment
- **preview**: Pull requests → Preview environment  
- **staging**: Staging branch → Staging environment

## Webhook Payload Examples

### GitHub Push Event
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "clone_url": "https://github.com/user/repo.git"
  },
  "commits": [{
    "id": "abc123def456",
    "message": "Update homepage",
    "author": {
      "name": "John Doe"
    }
  }]
}
```

### GitLab Push Hook
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "git_http_url": "https://gitlab.com/user/repo.git"
  },
  "commits": [{
    "id": "abc123def456",
    "message": "Update homepage",
    "author": {
      "name": "John Doe"
    }
  }]
}
```

### Bitbucket Push Event
```json
{
  "repository": {
    "links": {
      "clone": [{
        "name": "https",
        "href": "https://bitbucket.org/user/repo.git"
      }]
    }
  },
  "push": {
    "changes": [{
      "new": {
        "name": "main",
        "type": "branch"
      },
      "commits": [{
        "hash": "abc123def456",
        "message": "Update homepage"
      }]
    }]
  }
}
```

## Support

If you encounter issues with webhook setup:

1. Check the webhook status endpoint for diagnostics
2. Review deployment logs in your dashboard
3. Verify repository and branch configuration
4. Test with the generic webhook endpoint
5. Contact support with webhook delivery logs