# Cloudflare Setup Guide

This guide shows you how to get your Cloudflare Zone ID and API Token for DNS management and CDN integration.

## What is Cloudflare Integration?

The hosting platform can integrate with Cloudflare to:
- **Automatically manage DNS records** for custom domains
- **Purge CDN cache** when deployments complete
- **Configure SSL settings** programmatically
- **Manage page rules** and security settings

## Getting Your Cloudflare Credentials

### 1. Cloudflare Zone ID

**What it is:** A unique identifier for your domain in Cloudflare

**How to find it:**

1. **Login to Cloudflare Dashboard**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Login with your Cloudflare account

2. **Select Your Domain**
   - Click on the domain you want to use
   - You'll see the domain overview page

3. **Find Zone ID**
   - Scroll down to the **"API"** section in the right sidebar
   - Copy the **Zone ID** (it looks like: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`)

**Example Zone ID:**
```
Zone ID: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

### 2. Cloudflare API Token

**What it is:** An authentication token that allows the platform to manage your Cloudflare settings

**How to create it:**

1. **Go to API Tokens Page**
   - In Cloudflare dashboard, click your profile icon (top right)
   - Select **"My Profile"**
   - Go to **"API Tokens"** tab
   - Click **"Create Token"**

2. **Use Custom Token Template**
   - Click **"Get started"** next to **"Custom token"**

3. **Configure Token Permissions**
   ```
   Token name: Hosting Platform DNS Management
   
   Permissions:
   - Zone:Zone Settings:Edit
   - Zone:Zone:Read  
   - Zone:DNS:Edit
   - Zone:Cache Purge:Purge
   
   Zone Resources:
   - Include: Specific zone: yourdomain.com
   
   Client IP Address Filtering: (optional)
   - Leave blank or add your server IPs
   
   TTL: (optional)
   - Leave blank for no expiration
   ```

4. **Create and Copy Token**
   - Click **"Continue to summary"**
   - Click **"Create Token"**
   - **Copy the token immediately** (you won't see it again!)

**Example API Token:**
```
API Token: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z
```

## Environment Configuration

Add your credentials to `.env`:

```env
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z
CLOUDFLARE_ZONE_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

## Step-by-Step Visual Guide

### Finding Zone ID

```
Cloudflare Dashboard → Select Domain → Right Sidebar → API Section

┌─────────────────────────────────────┐
│ 📊 Analytics                        │
│ 🔒 SSL/TLS                         │
│ 🌐 DNS                             │
│ ⚡ Speed                           │
│ 🛡️ Security                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔧 API                          │ │
│ │                                 │ │
│ │ Zone ID                         │ │
│ │ 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p│ │
│ │ [Copy] 📋                       │ │
│ │                                 │ │
│ │ Account ID                      │ │
│ │ 9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k│ │
│ │ [Copy] 📋                       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Creating API Token

```
Profile → My Profile → API Tokens → Create Token

┌─────────────────────────────────────┐
│ Create API Token                    │
│                                     │
│ Token name: Hosting Platform        │
│                                     │
│ Permissions:                        │
│ ✅ Zone:Zone Settings:Edit          │
│ ✅ Zone:Zone:Read                   │
│ ✅ Zone:DNS:Edit                    │
│ ✅ Zone:Cache Purge:Purge           │
│                                     │
│ Zone Resources:                     │
│ 🎯 Include: yourdomain.com          │
│                                     │
│ [Continue to summary] 🔄            │
└─────────────────────────────────────┘
```

## Testing Your Configuration

### 1. Test API Connection
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "id": "your-zone-id",
    "name": "yourdomain.com",
    "status": "active"
  }
}
```

### 2. Test DNS Record Creation
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "test",
    "content": "example.com",
    "ttl": 300
  }'
```

### 3. Platform Integration Test
```bash
# Test Cloudflare integration in your platform
curl -X POST https://your-platform.com/api/domains/test-cloudflare \
  -H "Authorization: Bearer your-platform-token" \
  -H "Content-Type: application/json"
```

## What Each Credential Does

### Zone ID
- **Identifies your domain** in Cloudflare's system
- **Required for all API calls** to manage your domain
- **Public information** (not secret, but specific to your domain)
- **One per domain** (if you have multiple domains, each has its own Zone ID)

### API Token
- **Authenticates your requests** to Cloudflare API
- **Secret credential** (keep it secure!)
- **Scoped permissions** (only has access to what you configured)
- **Can be revoked** anytime from Cloudflare dashboard

## Multiple Domains Setup

If you have multiple domains in Cloudflare:

### Option 1: One Token for All Domains
Create a token with access to all zones:
```
Zone Resources: Include All zones
```

Then use multiple Zone IDs:
```env
CLOUDFLARE_API_TOKEN=your-single-token
CLOUDFLARE_ZONE_ID_MAIN=zone-id-for-main-domain
CLOUDFLARE_ZONE_ID_BLOG=zone-id-for-blog-domain
```

### Option 2: Separate Tokens per Domain
```env
CLOUDFLARE_API_TOKEN_MAIN=token-for-main-domain
CLOUDFLARE_ZONE_ID_MAIN=zone-id-for-main-domain

CLOUDFLARE_API_TOKEN_BLOG=token-for-blog-domain  
CLOUDFLARE_ZONE_ID_BLOG=zone-id-for-blog-domain
```

## Security Best Practices

### 1. Minimal Permissions
Only grant the permissions your platform actually needs:
- ✅ `Zone:DNS:Edit` - For managing DNS records
- ✅ `Zone:Cache Purge:Purge` - For clearing cache
- ❌ `Zone:Zone Settings:Edit` - Only if you need to change zone settings

### 2. IP Restrictions
Restrict token usage to your server IPs:
```
Client IP Address Filtering: 
- 192.168.1.100 (your server IP)
- 10.0.0.50 (backup server IP)
```

### 3. Token Rotation
- Rotate API tokens every 90 days
- Use different tokens for different environments
- Monitor token usage in Cloudflare dashboard

### 4. Environment Separation
```env
# Production
CLOUDFLARE_API_TOKEN=prod-token-here
CLOUDFLARE_ZONE_ID=prod-zone-id

# Staging  
CLOUDFLARE_API_TOKEN=staging-token-here
CLOUDFLARE_ZONE_ID=staging-zone-id
```

## Troubleshooting

### Common Errors

**1. Invalid Zone ID**
```json
{"success": false, "errors": [{"code": 1001, "message": "Zone not found"}]}
```
**Solution:** Double-check Zone ID from Cloudflare dashboard

**2. Invalid API Token**
```json
{"success": false, "errors": [{"code": 10000, "message": "Authentication error"}]}
```
**Solution:** Verify API token and permissions

**3. Insufficient Permissions**
```json
{"success": false, "errors": [{"code": 10000, "message": "Insufficient permissions"}]}
```
**Solution:** Add required permissions to your API token

**4. Rate Limiting**
```json
{"success": false, "errors": [{"code": 10013, "message": "Rate limit exceeded"}]}
```
**Solution:** Implement request throttling in your application

### Debug Commands

**Check Zone Information:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**List DNS Records:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**Test Token Permissions:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Alternative: Using Global API Key (Not Recommended)

Instead of API tokens, you can use the Global API Key (less secure):

1. Go to **My Profile** → **API Tokens**
2. Find **Global API Key** → **View**
3. Enter your password to reveal the key

```env
# Less secure method (not recommended)
CLOUDFLARE_EMAIL=your-email@domain.com
CLOUDFLARE_GLOBAL_API_KEY=your-global-api-key
CLOUDFLARE_ZONE_ID=your-zone-id
```

**Why API Tokens are better:**
- ✅ Scoped permissions (more secure)
- ✅ Can be easily revoked
- ✅ IP restrictions available
- ✅ Expiration dates supported

## Integration Features

Once configured, your platform can:

### DNS Management
- Automatically create CNAME records for custom domains
- Update A records for IP changes
- Manage subdomain routing

### Cache Management  
- Purge cache when deployments complete
- Selective cache purging for specific files
- Cache warming for new deployments

### SSL Management
- Configure SSL settings via API
- Manage SSL certificates
- Update security headers

### Analytics Integration
- Fetch traffic analytics from Cloudflare
- Monitor performance metrics
- Track security events

## Cost Considerations

- **Cloudflare Free Plan**: Includes API access
- **API Requests**: Free tier includes generous API limits
- **Rate Limits**: 1,200 requests per 5 minutes per token
- **No additional cost** for API usage on paid plans

## Support Resources

- **Cloudflare API Documentation**: [api.cloudflare.com](https://api.cloudflare.com)
- **Community Forum**: [community.cloudflare.com](https://community.cloudflare.com)
- **API Status**: [cloudflarestatus.com](https://cloudflarestatus.com)
- **Support**: Available for paid plans