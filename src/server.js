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
    // Security middleware
    this.app.use(helmet());
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
    // Serve static files from public directory
    this.app.use(express.static('public'));

    // API routes
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

    // Static file serving for deployed sites
    this.app.use('/sites', express.static('deployed-sites'));

    // Serve index.html for all non-API routes (SPA support)
    this.app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        const indexPath = path.join(process.cwd(), 'public', 'index.html');
        console.log('Attempting to serve index.html from:', indexPath);
        
        // Check if file exists before sending
        const fs = require('fs');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          console.error('index.html not found at:', indexPath);
          console.log('Current working directory:', process.cwd());
          console.log('Directory contents:', fs.readdirSync(process.cwd()));
          res.status(404).json({ 
            error: 'Frontend not found',
            message: 'The frontend application is not available. Please check the deployment.',
            path: indexPath
          });
        }
      }
    });

    // Error handling
    this.app.use(errorHandler);
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