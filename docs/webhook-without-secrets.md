# Using Webhooks Without Secret Keys

The hosting platform is designed to work with or without webhook secret keys. While using secrets is recommended for production environments, you can absolutely run webhooks without them for development, testing, or simpler setups.

## How It Works

### With Webhook Secrets (Recommended)
- ✅ **Secure**: Verifies webhook authenticity using cryptographic signatures
- ✅ **Protected**: Prevents malicious webhook calls
- ✅ **Production Ready**: Suitable for production environments

### Without Webhook Secrets (Simplified)
- ⚠️ **Less Secure**: Accepts all webhook requests without verification
- ✅ **Simple Setup**: No need to configure secrets in Git providers
- ✅ **Development Friendly**: Perfect for local development and testing
- ✅ **Still Functional**: All deployment features work normally

## Configuration

### Option 1: No Webhook Secret (Simplified)

**Environment Configuration:**
```env
# Leave WEBHOOK_SECRET empty or comment it out
# WEBHOOK_SECRET=

# Or don't include it at all in your .env file
```

**Git Provider Setup:**
- **GitHub**: Don't set a secret in webhook configuration
- **GitLab**: Leave "Secret Token" field empty
- **Bitbucket**: No additional configuration needed

### Option 2: With Webhook Secret (Secure)

**Environment Configuration:**
```env
WEBHOOK_SECRET=your-super-secret-webhook-key
```

**Git Provider Setup:**
- **GitHub**: Set the same secret in webhook configuration
- **GitLab**: Set the same secret as "Secret Token"
- **Bitbucket**: Optional (uses IP whitelist instead)

## Security Considerations

### Without Secrets
**Risks:**
- Anyone who knows your webhook URL can trigger deployments
- Potential for spam or malicious deployment requests
- No way to verify the webhook source

**Mitigations:**
- Use obscure webhook URLs
- Monitor deployment logs for suspicious activity
- Implement rate limiting (already included)
- Use firewall rules to restrict access

### With Secrets
**Benefits:**
- Cryptographic verification of webhook authenticity
- Protection against malicious requests
- Industry standard security practice

## Setup Examples

### GitHub Without Secret

1. Go to your repository → Settings → Webhooks
2. Add webhook with URL: `https://your-platform.com/api/webhooks/github`
3. **Leave "Secret" field empty**
4. Select events: Push, Pull requests
5. Save webhook

### GitLab Without Secret

1. Go to your project → Settings → Webhooks
2. Add webhook with URL: `https://your-platform.com/api/webhooks/gitlab`
3. **Leave "Secret token" field empty**
4. Select triggers: Push events, Merge request events
5. Add webhook

### Bitbucket (Always Works Without Secrets)

1. Go to repository → Repository settings → Webhooks
2. Add webhook with URL: `https://your-platform.com/api/webhooks/bitbucket`
3. Select triggers: Repository push, Pull request created/updated
4. Save webhook

## Testing Your Setup

### Check Webhook Status
```bash
curl https://your-platform.com/api/webhooks/status
```

**Response without secrets:**
```json
{
  "status": "active",
  "security": {
    "webhook_secret_configured": false,
    "level": "basic",
    "recommendation": "Consider setting WEBHOOK_SECRET for better security"
  },
  "configuration": {
    "signature_verification": "disabled",
    "fallback_mode": "accept_unsigned_requests",
    "note": "Webhooks will work without secrets but are less secure"
  }
}
```

### Manual Test
```bash
curl -X POST https://your-platform.com/api/webhooks/generic \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/user/repo.git",
    "branch": "main",
    "commit_sha": "abc123",
    "commit_message": "Test deployment"
  }'
```

## Console Output

### Without Secrets
```
⚠️  WEBHOOK_SECRET not configured - github webhooks will accept all requests
   For production use, please set WEBHOOK_SECRET environment variable
Received GitHub webhook: push
Found 1 project(s) for webhook deployment
Deployment queued successfully: 123e4567-e89b-12d3-a456-426614174000
```

### With Secrets
```
✅ github webhook signature verified successfully
Received GitHub webhook: push
Found 1 project(s) for webhook deployment
Deployment queued successfully: 123e4567-e89b-12d3-a456-426614174000
```

## When to Use Each Approach

### Use Without Secrets When:
- **Development/Testing**: Local development or staging environments
- **Simple Setups**: Personal projects or internal tools
- **Quick Prototyping**: Getting started quickly without security complexity
- **Trusted Networks**: Deployments behind firewalls or VPNs

### Use With Secrets When:
- **Production**: Public-facing production environments
- **Team Projects**: Multiple developers or public repositories
- **Compliance**: Security requirements or compliance needs
- **High Traffic**: Popular projects that might be targeted

## Migration Path

### Start Simple, Add Security Later

1. **Phase 1**: Start without secrets for quick setup
   ```env
   # WEBHOOK_SECRET=
   ```

2. **Phase 2**: Add secrets when moving to production
   ```env
   WEBHOOK_SECRET=your-generated-secret-key
   ```

3. **Phase 3**: Update Git provider webhook configurations with the secret

## Best Practices

### For Development (Without Secrets)
- Use local tunneling tools (ngrok, localtunnel) for testing
- Monitor logs for unexpected webhook calls
- Use development-specific webhook URLs

### For Production (With Secrets)
- Generate strong, random webhook secrets
- Use different secrets for different environments
- Rotate secrets periodically
- Monitor webhook delivery success rates

## Troubleshooting

### Common Issues Without Secrets

**Problem**: Too many webhook calls
**Solution**: Check for webhook loops or multiple webhook configurations

**Problem**: Unexpected deployments
**Solution**: Review webhook logs and repository settings

**Problem**: Webhooks not triggering
**Solution**: Verify repository URL matches exactly in project settings

### Debugging Commands

```bash
# Check webhook configuration
curl https://your-platform.com/api/webhooks/status

# View deployment queue
curl https://your-platform.com/api/webhooks/queue

# Test with manual webhook
curl -X POST https://your-platform.com/api/webhooks/generic \
  -H "Content-Type: application/json" \
  -d '{"repository_url": "your-repo-url", "branch": "main"}'
```

## Conclusion

The webhook system is flexible and works great both with and without secrets. Start simple for development and testing, then add security when you're ready for production. The platform will guide you with helpful warnings and recommendations along the way.