# HostingKE - Complete Hosting Platform

A full-featured hosting platform like Netlify, built with Node.js, Express, and Supabase. Deploy static sites, React apps, and Node.js applications with zero configuration.

## 🚀 Live Demo

**Platform URL**: [https://hostingke-platform.onrender.com](https://hostingke-platform.onrender.com)

## ✨ Features

### 🎯 Core Hosting Features
- **Instant Deployments** - Deploy from Git in seconds
- **Multiple Git Providers** - GitHub, GitLab, Bitbucket support
- **Automatic Builds** - Zero-config builds for popular frameworks
- **Custom Domains** - Use your own domain with automatic SSL
- **Preview Deployments** - Deploy pull requests automatically
- **Rollback Support** - Instantly rollback to previous deployments

### 🔧 Developer Experience
- **Real-time Updates** - WebSocket-powered deployment status
- **Build Logs** - Detailed build and deployment logs
- **CLI Tool** - Deploy and manage projects from command line
- **Webhook Integration** - Automatic deployments on git push
- **Environment Variables** - Secure environment configuration

### 📊 Analytics & Monitoring
- **Traffic Analytics** - Page views, unique visitors, referrers
- **Performance Metrics** - Load times, bounce rates
- **Error Tracking** - 404s and other errors
- **Real-time Dashboard** - Live visitor tracking

### 🌐 Advanced Features
- **Serverless Functions** - Deploy API endpoints
- **Form Handling** - Collect form submissions
- **CDN Integration** - Global content delivery
- **SSL Certificates** - Automatic HTTPS with Let's Encrypt
- **Database Integration** - Supabase PostgreSQL backend

## 🏗️ Architecture

```
Frontend (React/HTML) → Express.js API → Supabase Database
                     ↓
              Deployment Engine → Git Providers
                     ↓
                CDN/File Storage
```

### Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT with Supabase Auth
- **File Storage**: Supabase Storage
- **Real-time**: Socket.IO
- **Deployment**: Docker containers (planned)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/sammysam254/hostingke.git
cd hostingke
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Database Setup
```bash
# Run the SQL schema in your Supabase dashboard
# Import supabase/schema.sql
# Optionally run supabase/seed-safe.sql for sample data
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see your hosting platform!

## 📖 Documentation

### Deployment Guides
- [Deploy to Render](docs/render-deployment.md) ⭐ **Recommended**
- [Deploy to Netlify](docs/netlify-deployment.md)
- [Supabase Setup](docs/supabase-setup.md)
- [SSL Configuration](docs/ssl-setup.md)
- [Cloudflare Integration](docs/cloudflare-setup.md)

### Webhook Setup
- [Webhook Configuration](docs/webhook-setup.md)
- [Webhook without Secrets](docs/webhook-without-secrets.md)

## 🧪 Testing

### API Testing
```bash
# Test all endpoints
npm run test:api

# Test against deployed version
BASE_URL=https://your-app.onrender.com npm run test:api
```

### Deployment Check
```bash
# Quick deployment status check
npm run check:deployment

# Check specific URL
BASE_URL=https://your-app.onrender.com npm run check:deployment
```

## 🎮 CLI Usage

```bash
# Install CLI globally
npm install -g .

# Login to your platform
hostingke login

# Create a new project
hostingke create my-awesome-site

# Deploy current directory
hostingke deploy

# Check deployment status
hostingke status

# View deployment logs
hostingke logs
```
## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify/:token` - Email verification

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Deployments
- `GET /api/deployments` - List deployments
- `POST /api/deployments` - Create deployment
- `GET /api/deployments/:id` - Get deployment details
- `POST /api/deployments/:id/rollback` - Rollback deployment

### Webhooks
- `POST /api/webhooks/github` - GitHub webhook
- `POST /api/webhooks/gitlab` - GitLab webhook
- `POST /api/webhooks/bitbucket` - Bitbucket webhook
- `GET /api/webhooks/status` - Webhook system status

### Analytics
- `GET /api/analytics/:projectId` - Project analytics
- `POST /api/analytics/:projectId/event` - Track custom event

## 🌍 Environment Variables

### Required
```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional
```env
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com
WEBHOOK_SECRET=your-webhook-secret

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com

# SSL (Let's Encrypt)
ACME_EMAIL=your-email@domain.com

# Cloudflare (optional)
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ZONE_ID=your-zone-id
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Netlify, Vercel, and other modern hosting platforms
- Built with amazing open-source tools and libraries
- Special thanks to the Supabase team for the excellent backend-as-a-service

## 📞 Support

- 📧 Email: support@hostingke.com
- 🐛 Issues: [GitHub Issues](https://github.com/sammysam254/hostingke/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/sammysam254/hostingke/discussions)

---

**Made with ❤️ by the HostingKE Team**