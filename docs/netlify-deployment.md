# Netlify Deployment Guide

This guide shows you how to deploy your hosting platform to Netlify using Netlify Functions.

## 🚀 Quick Deployment

### Step 1: Push Fixed Code to GitHub

The package.json has been updated to fix all dependency issues. Commit and push:

```bash
git add .
git commit -m "Fix all dependencies and serverless wrapper for Netlify deployment"
git push origin main
```

### Step 2: Deploy to Netlify

1. **Go to [netlify.com](https://netlify.com)**
2. **Click "Add new site" → "Import an existing project"**
3. **Connect to GitHub and select your repository**
4. **Configure build settings:**
   - **Build command**: `npm run build`
   - **Publish directory**: Leave empty (this is a serverless API)
   - **Functions directory**: `netlify/functions`

### Step 3: Set Environment Variables

In Netlify dashboard, go to **Site settings** → **Environment variables** and add:

```env
SUPABASE_URL=https://dupchzgsexrfpduxdmtb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=production
BASE_URL=https://your-site-name.netlify.app
```

### Step 4: Deploy!

Click **Deploy site** and wait for the build to complete.

## 🔧 Configuration Files Added

### netlify.toml
- Configures Netlify build settings
- Sets up redirects to route all requests to the serverless function
- Adds security headers
- Sets Node.js version to 20 (required for Supabase)

### netlify/functions/server.js
- Wraps your Express app for serverless deployment
- Uses `serverless-http` to handle Lambda/Netlify Functions
- Fixed to properly access the Express app instance

## 📋 What Was Fixed

### 1. Package Dependencies
- ✅ Fixed `rate-limiter-flexible` version from `^3.0.8` to `^2.4.1`
- ✅ Added missing `@octokit/rest` for GitHub API integration
- ✅ Added missing `mongoose` and `bcryptjs` dependencies
- ✅ Added `serverless-http` for Netlify Functions compatibility

### 2. Server Configuration
- ✅ Fixed serverless wrapper to properly access Express app
- ✅ Modified server.js to export properly for serverless
- ✅ Added conditional server startup (only runs locally)
- ✅ Made it compatible with Netlify Functions

### 3. Build Process
- ✅ Set Node.js version to 20 for Supabase compatibility
- ✅ Simplified build command for API-only deployment
- ✅ Added Netlify-specific configuration
- ✅ Set up proper redirects for API routes

## 🌐 How It Works

### Serverless Architecture
- Your Express app runs as a Netlify Function
- All requests are routed through `/.netlify/functions/server`
- No persistent server - functions spin up on demand

### Request Flow
```
User Request → Netlify CDN → Netlify Function → Your Express App → Supabase
```

### API Endpoints
After deployment, your API will be available at:
```
https://your-site-name.netlify.app/api/auth/login
https://your-site-name.netlify.app/api/projects
https://your-site-name.netlify.app/api/webhooks/github
```

## ⚠️ Limitations on Netlify

### Function Timeout
- Netlify Functions have a 10-second timeout on free plan
- 26-second timeout on paid plans
- Long-running deployments might timeout

### File System
- No persistent file system
- Deployed sites and repositories won't persist between function calls
- Consider using Supabase Storage for file persistence

### WebSockets
- Limited WebSocket support in serverless environment
- Real-time features may not work as expected
- Consider using Supabase real-time instead

## 🔄 Alternative: Better Hosting Options

For a full hosting platform, consider these alternatives:

### 1. Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### 2. Render
- Better for persistent applications
- Supports WebSockets and long-running processes
- Free tier available

### 3. Vercel
- Similar to Netlify but with better Node.js support
- Supports longer function timeouts
- Built-in database support

### 4. DigitalOcean App Platform
- Full application hosting
- Persistent storage
- Database integration

## 🛠️ Post-Deployment Setup

### 1. Update BASE_URL
Update your environment variable:
```env
BASE_URL=https://your-actual-netlify-url.netlify.app
```

### 2. Configure Webhooks
Update your Git repository webhooks to point to:
```
https://your-site-name.netlify.app/api/webhooks/github
```

### 3. Test API Endpoints
```bash
# Health check
curl https://your-site-name.netlify.app/health

# Webhook status
curl https://your-site-name.netlify.app/api/webhooks/status
```

## 🐛 Troubleshooting

### Build Failures
1. **Check build logs** in Netlify dashboard
2. **Verify all dependencies** are correctly versioned
3. **Check Node.js version** compatibility

### Function Errors
1. **Check function logs** in Netlify dashboard
2. **Verify environment variables** are set correctly
3. **Test locally** with `netlify dev`

### Database Connection Issues
1. **Verify Supabase credentials** are correct
2. **Check network connectivity** from Netlify
3. **Test with curl** from local machine

## 🎯 Success Indicators

After successful deployment:
- ✅ Build completes without errors
- ✅ Function deploys successfully  
- ✅ Health endpoint returns 200
- ✅ API endpoints are accessible
- ✅ Supabase connection works

## 📈 Monitoring

### Netlify Analytics
- Function invocations
- Error rates
- Response times
- Bandwidth usage

### Custom Monitoring
Set up alerts for:
- Function timeout errors
- Database connection failures
- High error rates
- Unusual traffic patterns

## 💡 Tips for Success

1. **Test locally first** with `netlify dev`
2. **Use environment variables** for all configuration
3. **Monitor function logs** for errors
4. **Keep functions lightweight** to avoid timeouts
5. **Consider upgrading** to paid plan for better limits

Your hosting platform should now be successfully deployed to Netlify! 🎉