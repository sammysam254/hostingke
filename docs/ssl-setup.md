# SSL Certificate Setup Guide

This guide explains how to configure automatic SSL certificate generation using Let's Encrypt ACME protocol.

## What is ACME?

**ACME (Automatic Certificate Management Environment)** is a protocol used by Let's Encrypt to automatically issue and renew SSL certificates. You don't need to obtain any keys beforehand - the system generates them automatically.

## Configuration

### Required Environment Variables

```env
# Your email address (for Let's Encrypt notifications)
ACME_EMAIL=your-email@yourdomain.com

# Let's Encrypt server URL
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
```

### Email Address (`ACME_EMAIL`)

**What it is:** Your email address for Let's Encrypt notifications

**Where to get it:** Use any valid email address you own

**Purpose:**
- Receive certificate expiration warnings
- Get notified about Let's Encrypt service updates
- Required by Let's Encrypt terms of service

**Examples:**
```env
ACME_EMAIL=admin@yourcompany.com
ACME_EMAIL=ssl-admin@yourdomain.com
ACME_EMAIL=your-personal-email@gmail.com
```

### Directory URL (`ACME_DIRECTORY_URL`)

**What it is:** The Let's Encrypt server endpoint

**Options:**

**Production (Default):**
```env
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
```
- Use for live websites
- Issues real SSL certificates
- Rate limited (50 certificates per week per domain)

**Staging (Testing):**
```env
ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```
- Use for development and testing
- Issues fake certificates (not trusted by browsers)
- Higher rate limits for testing

## How SSL Certificate Generation Works

### 1. Automatic Key Generation
When you first request a certificate, the system automatically:
- Generates an ACME account private key
- Stores it in `certificates/account.key`
- Registers with Let's Encrypt using your email

### 2. Domain Validation
For each domain, Let's Encrypt validates ownership using:
- **HTTP-01 Challenge**: Places a file at `/.well-known/acme-challenge/`
- **DNS-01 Challenge**: Creates a DNS TXT record (advanced)

### 3. Certificate Issuance
Once validated:
- Let's Encrypt issues the SSL certificate
- Certificate is stored in `certificates/yourdomain.com.crt`
- Private key is stored in `certificates/yourdomain.com.key`

## Setup Examples

### Basic Setup (Production)
```env
# Use your real email
ACME_EMAIL=admin@mycompany.com

# Production Let's Encrypt server
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
```

### Development Setup (Staging)
```env
# Use your email (can be same as production)
ACME_EMAIL=dev@mycompany.com

# Staging server for testing
ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```

### Multiple Environments
```env
# Production
ACME_EMAIL=ssl@mycompany.com
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory

# Staging (comment out production, uncomment staging)
# ACME_EMAIL=ssl-staging@mycompany.com
# ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```

## Domain SSL Certificate Process

### 1. Add Custom Domain
```bash
curl -X POST https://your-platform.com/api/domains \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-id",
    "domain": "example.com"
  }'
```

### 2. Configure DNS
Point your domain to your platform:
```
CNAME example.com your-project.yourplatform.com
```

### 3. Verify Domain
```bash
curl -X POST https://your-platform.com/api/domains/domain-id/verify \
  -H "Authorization: Bearer your-token"
```

### 4. Automatic SSL
The system automatically:
- Detects the verified domain
- Requests SSL certificate from Let's Encrypt
- Configures HTTPS for your domain

## File Structure

After SSL setup, you'll have:
```
certificates/
├── account.key              # ACME account key (auto-generated)
├── example.com.crt         # SSL certificate
├── example.com.key         # Private key
└── www.example.com.crt     # Additional domains
```

## Troubleshooting

### Common Issues

**1. Invalid Email Error**
```
Error: Invalid email address
```
**Solution:** Use a valid email format
```env
ACME_EMAIL=valid-email@domain.com
```

**2. Rate Limit Exceeded**
```
Error: too many certificates already issued
```
**Solution:** Use staging server for testing
```env
ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```

**3. Domain Validation Failed**
```
Error: Challenge failed for domain
```
**Solutions:**
- Ensure domain points to your server
- Check firewall allows HTTP traffic on port 80
- Verify `.well-known/acme-challenge/` is accessible

**4. Permission Errors**
```
Error: EACCES: permission denied, open 'certificates/...'
```
**Solution:** Ensure write permissions to certificates directory
```bash
mkdir -p certificates
chmod 755 certificates
```

### Debug Commands

**Check ACME configuration:**
```bash
curl https://your-platform.com/api/domains/ssl-status
```

**Test domain validation:**
```bash
curl http://yourdomain.com/.well-known/acme-challenge/test
```

**View certificate info:**
```bash
openssl x509 -in certificates/yourdomain.com.crt -text -noout
```

## Security Best Practices

### 1. Protect Private Keys
```bash
# Set proper permissions
chmod 600 certificates/*.key
chmod 644 certificates/*.crt
```

### 2. Backup Certificates
```bash
# Regular backup of certificates directory
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz certificates/
```

### 3. Monitor Expiration
- Let's Encrypt certificates expire in 90 days
- The system auto-renews certificates at 30 days
- Monitor logs for renewal failures

### 4. Use Strong Account Key
The system generates a 2048-bit RSA key by default, which is secure.

## Alternative SSL Options

### 1. Manual Certificates
If you prefer manual SSL management:
```env
# Disable ACME
# ACME_EMAIL=
# ACME_DIRECTORY_URL=
```

Then manually place certificates in:
- `certificates/yourdomain.com.crt`
- `certificates/yourdomain.com.key`

### 2. Cloudflare SSL
Use Cloudflare's SSL termination:
- Enable Cloudflare proxy for your domain
- Set SSL mode to "Full" or "Full (strict)"
- Platform handles HTTP, Cloudflare handles HTTPS

### 3. Load Balancer SSL
Use your cloud provider's load balancer:
- AWS Application Load Balancer with ACM
- Google Cloud Load Balancer with managed certificates
- Azure Application Gateway with Key Vault

## Production Checklist

- [ ] Set valid email address in `ACME_EMAIL`
- [ ] Use production Let's Encrypt URL
- [ ] Ensure port 80 is accessible for validation
- [ ] Configure proper DNS records
- [ ] Test certificate generation with staging first
- [ ] Set up certificate backup strategy
- [ ] Monitor certificate renewal logs

## Rate Limits

### Let's Encrypt Production Limits
- **50 certificates per week** per registered domain
- **5 duplicate certificates per week**
- **300 new orders per account per 3 hours**

### Staging Limits
- **30,000 certificates per week** per registered domain
- Much higher limits for testing

## Support

For SSL-related issues:
1. Check the SSL setup logs
2. Verify domain DNS configuration
3. Test with staging server first
4. Review Let's Encrypt status page
5. Contact support with certificate generation logs