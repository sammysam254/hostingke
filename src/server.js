const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('rate-limiter-flexible');
const path = require('path');
const session = require('express-session');

// Import route modules
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const deploymentRoutes = require('./routes/deployments');
const domainRoutes = require('./routes/domains');
const functionRoutes = require('./routes/functions');
const analyticsRoutes = require('./routes/analytics');
const formRoutes = require('./routes/forms');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Import services
const SupabaseService = require('./services/supabase');
const CDNService = require('./services/cdn');

class HostingPlatform {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    this.port = process.env.PORT || 3000;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupServices();
  }

  setupMiddleware() {
    // Security middleware with relaxed CSP for inline scripts
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
    }));
    this.app.use(cors());
    this.app.use(compression());
    
    // Session middleware
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === 'production' }
    }));
    
    // Rate limiting
    const rateLimiter = new rateLimit.RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
    });

    this.app.use(async (req, res, next) => {
      try {
        await rateLimiter.consume(req.ip);
        next();
      } catch (rejRes) {
        res.status(429).json({ error: 'Too many requests' });
      }
    });

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  }

  setupRoutes() {
    // Subdomain handling middleware - must be first
    this.app.use(async (req, res, next) => {
      const host = req.get('host');
      const subdomain = this.extractSubdomain(host);
      
      if (subdomain && subdomain !== 'www') {
        // This is a project subdomain request
        req.projectSlug = subdomain;
        return this.serveProject(req, res, next);
      }
      
      next();
    });

    // API routes FIRST (before static files)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/projects', authMiddleware, projectRoutes);
    this.app.use('/api/deployments', authMiddleware, deploymentRoutes);
    this.app.use('/api/domains', authMiddleware, domainRoutes);
    this.app.use('/api/functions', authMiddleware, functionRoutes);
    this.app.use('/api/analytics', authMiddleware, analyticsRoutes);
    this.app.use('/api/forms', formRoutes);
    this.app.use('/api/webhooks', require('./routes/webhooks'));
    this.app.use('/api/webhooks-test', require('./routes/webhooks-test'));

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Serve static files from public directory
    this.app.use(express.static('public'));

    // Root route - serve index.html directly
    this.app.get('/', (req, res) => {
      const indexPath = path.join(process.cwd(), 'public', 'index.html');
      console.log('Serving index.html from:', indexPath);
      res.sendFile(indexPath);
    });

    // Test route
    this.app.get('/test', (req, res) => {
      const testPath = path.join(process.cwd(), 'public', 'test.html');
      console.log('Serving test.html from:', testPath);
      res.sendFile(testPath);
    });

    // Simple test route
    this.app.get('/simple', (req, res) => {
      const simplePath = path.join(process.cwd(), 'public', 'simple.html');
      console.log('Serving simple.html from:', simplePath);
      res.sendFile(simplePath);
    });

    // Catch-all route for SPA (LAST)
    this.app.get('*', (req, res) => {
      // Only serve index.html for non-API, non-static file routes
      if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        const indexPath = path.join(process.cwd(), 'public', 'index.html');
        console.log('SPA fallback - serving index.html from:', indexPath);
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    // Error handling
    this.app.use(errorHandler);
  }

  // Extract subdomain from host
  extractSubdomain(host) {
    if (!host) return null;
    
    const parts = host.split('.');
    
    // For localhost:3000 or similar
    if (host.includes('localhost')) {
      const localParts = host.split('.');
      if (localParts.length > 1 && localParts[0] !== 'localhost') {
        return localParts[0];
      }
      return null;
    }
    
    // For production domains like project.hostingke.onrender.com
    if (parts.length > 2) {
      return parts[0];
    }
    
    return null;
  }

  // Serve project from subdomain
  async serveProject(req, res, next) {
    try {
      const projectSlug = req.projectSlug;
      console.log('Serving project:', projectSlug);

      // Get project from database
      const SupabaseService = require('./services/supabase');
      const { data: project, error } = await SupabaseService.getAdminClient()
        .from('projects')
        .select('*')
        .eq('slug', projectSlug)
        .single();

      if (error || !project) {
        console.log('Project not found:', projectSlug);
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Project Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; }
            </style>
          </head>
          <body>
            <h1 class="error">Project Not Found</h1>
            <p>The project "${projectSlug}" does not exist or has been removed.</p>
            <a href="https://${req.get('host').replace(projectSlug + '.', '')}">← Back to HostingKE</a>
          </body>
          </html>
        `);
      }

      // Check if project has been built
      const projectPath = path.join(process.cwd(), 'deployed-sites', projectSlug);
      const fs = require('fs');
      
      if (!fs.existsSync(projectPath)) {
        console.log('Project not built yet:', projectSlug);
        return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Project Building</title>
            <meta http-equiv="refresh" content="10">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .building { color: #3498db; }
              .spinner { animation: spin 1s linear infinite; display: inline-block; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <h1 class="building">🚀 Building Project</h1>
            <div class="spinner">⚙️</div>
            <p>Your project "${project.name}" is being built and deployed.</p>
            <p>This page will refresh automatically...</p>
            <small>Project: ${projectSlug}</small>
          </body>
          </html>
        `);
      }

      // Serve the built project
      const buildDirectory = project.build_settings?.directory || 'dist';
      const fullProjectPath = path.join(projectPath, buildDirectory);
      
      if (fs.existsSync(fullProjectPath)) {
        // Serve static files from the built project
        express.static(fullProjectPath)(req, res, (err) => {
          if (err) {
            // If file not found, try to serve index.html for SPA
            const indexPath = path.join(fullProjectPath, 'index.html');
            if (fs.existsSync(indexPath)) {
              res.sendFile(indexPath);
            } else {
              res.status(404).send('File not found');
            }
          }
        });
      } else {
        res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Build Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; }
            </style>
          </head>
          <body>
            <h1 class="error">Build Error</h1>
            <p>There was an error building your project "${project.name}".</p>
            <p>Please check your build configuration and try redeploying.</p>
          </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Error serving project:', error);
      res.status(500).send('Internal server error');
    }
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('subscribe-deployment', (deploymentId) => {
        socket.join(`deployment-${deploymentId}`);
      });

      socket.on('subscribe-project', (projectId) => {
        socket.join(`project-${projectId}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // Make io available to other modules
    this.app.set('io', this.io);
  }

  async setupServices() {
    try {
      await SupabaseService.connect();
      await CDNService.initialize();
      
      // Initialize deployment queue
      const DeploymentQueue = require('./services/deploymentQueue');
      DeploymentQueue.initialize(this.io);
      
      console.log('Services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      process.exit(1);
    }
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Hosting Platform running on port ${this.port}`);
      console.log(`📊 Dashboard: http://localhost:${this.port}`);
      console.log(`🔗 API: http://localhost:${this.port}/api`);
      console.log(`🗄️  Database: Supabase`);
    });
  }
}

// Start the server only if not in serverless environment
if (require.main === module) {
  const platform = new HostingPlatform();
  platform.start();
}

// Export for serverless deployment
module.exports = new HostingPlatform();