# GitHub OAuth Setup Guide

This guide shows you how to set up GitHub OAuth integration for your HostingKE platform, allowing users to connect their GitHub accounts and access their repositories.

## 🚀 Why GitHub OAuth?

With GitHub OAuth integration, users can:
- ✅ **Connect GitHub Account** - One-click authentication
- ✅ **Access All Repositories** - See all their repos in the dashboard
- ✅ **Auto-Deploy** - Automatic deployments when they push to GitHub
- ✅ **Webhook Setup** - Automatic webhook configuration
- ✅ **Seamless Experience** - No need to manually enter repository URLs

## 📋 Step 1: Create GitHub OAuth App

### 1. Go to GitHub Settings
1. Visit [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"OAuth Apps"** in the left sidebar
3. Click **"New OAuth App"**

### 2. Configure OAuth App
Fill in the following details:

```
Application name: HostingKE Platform
Homepage URL: https://hostingke.onrender.com
Application description: A hosting platform for deploying websites from GitHub repositories
Authorization callback URL: https://hostingke.onrender.com/api/auth/github/callback
```

**For local development, also create a separate app:**
```
Application name: HostingKE Platform (Development)
Homepage URL: http://localhost:3000
Authorization callback URL: http://localhost:3000/api/auth/github/callback
```

### 3. Get Client Credentials
After creating the app, you'll get:
- **Client ID** (public)
- **Client Secret** (keep this secret!)

## 🔧 Step 2: Configure Environment Variables

### Production (Render)
In your Render dashboard, add these environment variables:

```env
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
SESSION_SECRET=your_random_session_secret_here
```

### Local Development
In your `.env` file:

```env
GITHUB_CLIENT_ID=your_development_client_id
GITHUB_CLIENT_SECRET=your_development_client_secret
SESSION_SECRET=your_random_session_secret_here
```

## 🎯 Step 3: How It Works

### User Flow
1. **User clicks "Connect GitHub"** in project creation modal
2. **Redirected to GitHub** for authorization
3. **User authorizes the app** and grants repository access
4. **Redirected back to platform** with access token
5. **Platform fetches user's repositories** and displays them
6. **User selects repository** and creates project
7. **Automatic deployment** starts immediately

### Technical Flow
```
Frontend → /api/auth/github → GitHub OAuth → /api/auth/github/callback → Frontend
```

### Permissions Requested
- `repo` - Access to repositories (read/write)
- `user:email` - Access to user's email address

## 🔐 Security Features

### Secure Token Storage
- GitHub access tokens are stored securely in Supabase
- Tokens are encrypted and only accessible by the user
- Session management with secure cookies

### State Parameter
- CSRF protection using state parameter
- Prevents authorization code interception attacks

### Webhook Security
- Automatic webhook secret generation
- Signature verification for all webhook requests
- Secure webhook endpoints

## 🛠️ Step 4: Testing the Integration

### 1. Test OAuth Flow
1. Start your application
2. Click "Get Started" or "Sign Up"
3. Create an account or log in
4. Click "Create Project"
5. Click "Connect GitHub"
6. Authorize the application
7. You should see your repositories listed

### 2. Test Repository Selection
1. Select a repository from the list
2. Configure build settings
3. Click "Deploy Project"
4. Verify the project is created and deployment starts

### 3. Test Automatic Deployments
1. Make a change to your repository
2. Push to the main branch
3. Check that a new deployment is triggered automatically

## 🚨 Troubleshooting

### Common Issues

#### "OAuth App not found"
- Check that your `GITHUB_CLIENT_ID` is correct
- Ensure the OAuth app exists in your GitHub settings

#### "Invalid client secret"
- Verify `GITHUB_CLIENT_SECRET` is correct
- Make sure there are no extra spaces or characters

#### "Redirect URI mismatch"
- Check that the callback URL in GitHub matches your `BASE_URL`
- For production: `https://your-app.onrender.com/api/auth/github/callback`
- For development: `http://localhost:3000/api/auth/github/callback`

#### "No repositories found"
- Check that the user has repositories in their GitHub account
- Verify the OAuth app has the correct permissions (`repo` scope)
- Check the GitHub API rate limits

#### "Failed to create project"
- Check Supabase connection and credentials
- Verify the database schema is set up correctly
- Check server logs for detailed error messages

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

This will show detailed logs for OAuth flow and API requests.

## 🎉 Success Indicators

After successful setup, users should be able to:
- ✅ Click "Connect GitHub" and see GitHub authorization page
- ✅ Complete OAuth flow and return to the platform
- ✅ See their repositories listed in the project creation modal
- ✅ Select a repository and create a project
- ✅ See automatic deployments when they push to GitHub

## 📈 Advanced Features

### Webhook Management
The platform automatically:
- Creates webhooks for selected repositories
- Configures webhook secrets for security
- Handles webhook events for automatic deployments

### Repository Filtering
- Shows only non-fork repositories
- Sorts by last updated
- Displays repository metadata (language, description, etc.)

### Branch Selection
- Auto-detects default branch
- Allows custom branch selection
- Supports multiple branch deployments

## 🔄 Updating OAuth Settings

If you need to update your OAuth app settings:
1. Go to your GitHub OAuth app settings
2. Update the necessary fields
3. Update environment variables if needed
4. Restart your application

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify all environment variables are set correctly
4. Test with a simple repository first

Your GitHub OAuth integration should now be fully functional! 🎉