# Netlify Clone - Hosting Platform with Supabase

A comprehensive hosting platform similar to Netlify with all core features including continuous deployment, serverless functions, custom domains, and more. Built with **Supabase** as the backend and database.

## 🚀 Features

### Core Hosting Features
- **Static Site Hosting** - Deploy and host static websites with global CDN
- **Continuous Deployment** - Automatic deployments from Git repositories
- **Custom Domains** - Add your own domains with SSL certificates
- **Branch Deployments** - Deploy preview versions from different branches
- **Rollback Support** - Instantly rollback to previous deployments

### Developer Experience
- **Git Integration** - Connect GitHub, GitLab, and Bitbucket repositories
- **Build System** - Configurable build commands and environments
- **Real-time Logs** - Live build logs and deployment status
- **CLI Tool** - Command-line interface for deployments and management
- **WebSocket Updates** - Real-time deployment notifications

### Advanced Features
- **Serverless Functions** - Deploy and run backend functions
- **Form Handling** - Built-in form processing with notifications
- **Split Testing** - A/B test different versions of your site
- **Analytics** - Traffic and performance analytics
- **Edge Optimization** - Asset optimization and compression

### Security & Performance
- **SSL Certificates** - Automatic SSL certificate provisioning
- **Row Level Security** - Supabase RLS for data protection
- **Global CDN** - Content delivery from multiple edge locations
- **Asset Optimization** - Automatic image and asset optimization
- **Caching** - Intelligent caching strategies

## 📦 Installation

### Prerequisites
- Node.js 16+ 
- Supabase account and project
- Git

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd netlify-clone
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**

Create a new Supabase project at [supabase.com](https://supabase.com)

Run the database schema:
```sql
-- Copy and paste the contents of supabase/schema.sql into your Supabase SQL editor
```

Optionally add seed data:
```sql
-- Copy and paste the contents of supabase/seed.sql into your Supabase SQL editor
```

4. **Environment Configuration**
Create a `.env` file:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Email Configuration (optional, for custom emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourplatform.com

# Git Webhook Secret
WEBHOOK_SECRET=your-webhook-secret

# Other optional configurations...
```

5. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

## 🗄️ Database Schema

The platform uses Supabase PostgreSQL with the following main tables:

- **users** - User profiles and settings
- **projects** - Website projects and configurations
- **deployments** - Deployment history and status
- **analytics** - Site traffic and performance data
- **form_submissions** - Form submission data
- **function_logs** - Serverless function execution logs
- **domains** - Custom domain management

### Row Level Security (RLS)

All tables have RLS policies ensuring users can only access their own data:
- Users can only view/edit their own projects
- Deployments are filtered by project ownership
- Analytics data is restricted to project owners
- Form submissions are publicly insertable but privately readable

## 🔐 Authentication

Authentication is handled entirely by Supabase Auth:

- **Email/Password** - Standard email authentication
- **OAuth Providers** - GitHub, Google, etc. (configurable in Supabase)
- **Magic Links** - Passwordless authentication
- **JWT Tokens** - Secure API access

## 🖥️ CLI Usage

### Installation
```bash
npm install -g netlify-clone-cli
```

### Commands

**Login**
```bash
netlify-clone login
```

**Deploy current directory**
```bash
netlify-clone deploy
netlify-clone deploy --dir ./build --project my-project
```

**List projects**
```bash
netlify-clone projects
```

**Create new project**
```bash
netlify-clone create --name "My Website" --repo "https://github.com/user/repo"
```

**Check deployment status**
```bash
netlify-clone status --project my-project
```

**View build logs**
```bash
netlify-clone logs --project my-project
```

## 🔧 API Endpoints

### Authentication (Supabase Auth)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/refresh` - Refresh access token

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/deploy` - Trigger deployment

### Deployments
- `GET /api/deployments` - List deployments
- `GET /api/deployments/:id` - Get deployment details
- `POST /api/deployments/upload` - Upload and deploy
- `POST /api/deployments/:id/cancel` - Cancel deployment
- `POST /api/deployments/:id/rollback` - Rollback deployment

### Domains
- `GET /api/domains` - List domains
- `POST /api/domains` - Add custom domain
- `PUT /api/domains/:id/verify` - Verify domain
- `DELETE /api/domains/:id` - Remove domain

## 🏗️ Architecture

### Backend Services
- **Express.js** - Web framework
- **Supabase** - Database, authentication, real-time, storage
- **Socket.io** - Real-time communication
- **Multer** - File upload handling

### Supabase Features Used
- **Database** - PostgreSQL with Row Level Security
- **Auth** - User authentication and management
- **Real-time** - Live updates for deployments
- **Storage** - File storage for deployments and functions
- **Edge Functions** - Serverless function execution (optional)

### Deployment Pipeline
1. **Git Integration** - Clone/pull from repositories
2. **Build Process** - Run build commands in isolated environment
3. **Asset Processing** - Optimize images, minify files
4. **CDN Deployment** - Deploy to global edge locations
5. **DNS Updates** - Update routing for custom domains

### Security Features
- **Supabase Auth** - Secure authentication system
- **Row Level Security** - Database-level access control
- **Rate Limiting** - Prevent abuse
- **Input Validation** - Sanitize user inputs
- **HTTPS Enforcement** - SSL/TLS encryption

## 🚀 Deployment

### Supabase Setup
1. Create a new Supabase project
2. Run the schema.sql file in the SQL editor
3. Configure authentication providers if needed
4. Set up storage buckets for deployments and functions

### Environment Variables
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Docker Deployment
```bash
# Build image
docker build -t netlify-clone .

# Run container
docker run -p 3000:3000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  netlify-clone
```

### Production Considerations
- Use a process manager like PM2
- Set up reverse proxy with Nginx
- Configure SSL certificates
- Set up monitoring and logging
- Use Supabase production instance
- Configure CDN for static assets

## 🔄 Real-time Features

The platform uses Supabase real-time subscriptions for:
- **Live deployment status** - Watch deployments in real-time
- **Build logs streaming** - See build output as it happens
- **Project updates** - Instant updates when projects change
- **Analytics updates** - Real-time visitor tracking

## 📊 Analytics & Monitoring

Built-in analytics track:
- **Page views and unique visitors**
- **Geographic distribution**
- **Traffic sources and referrers**
- **Performance metrics**
- **Bandwidth usage**
- **Function execution stats**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🔐 SSL Certificate Configuration (Optional)

The platform can automatically generate SSL certificates using Let's Encrypt. This is **optional** - you can run the platform without SSL or use your own certificates.

### ACME Configuration
```env
# Your email for Let's Encrypt notifications (required if using auto-SSL)
ACME_EMAIL=your-email@domain.com

# Let's Encrypt server (production)
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory

# For testing, use staging server:
# ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```

**What these do:**
- `ACME_EMAIL`: Your email address for Let's Encrypt notifications (use any valid email you own)
- `ACME_DIRECTORY_URL`: Let's Encrypt server endpoint (no keys needed - certificates are generated automatically)

**You don't need to obtain any keys beforehand** - the system generates everything automatically when you add custom domains.

See `docs/ssl-setup.md` for detailed SSL configuration guide.

## 🆘 Support

- Documentation: [docs.yourplatform.com](https://docs.yourplatform.com)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Community: [Discord](https://discord.gg/your-server)
- Supabase Docs: [supabase.com/docs](https://supabase.com/docs)

---

Built with ❤️ using Supabase and modern web technologies

## 📄 License

MIT License - see LICENSE file for details