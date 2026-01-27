const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

const Project = require('../models/Project');

const router = express.Router();

// Configure multer for function uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for functions
  }
});

// Get all functions for a project
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get function details with stats
    const functionsWithStats = await Promise.all(
      project.functions.map(async (func) => {
        const stats = await getFunctionStats(projectId, func.name);
        return {
          ...func.toObject(),
          stats
        };
      })
    );

    res.json(functionsWithStats);

  } catch (error) {
    console.error('Get functions error:', error);
    res.status(500).json({ error: 'Failed to fetch functions' });
  }
});

// Deploy a new function
router.post('/:projectId/deploy', upload.single('function'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, runtime = 'nodejs' } = req.body;

    if (!name || !req.file) {
      return res.status(400).json({ error: 'Function name and file are required' });
    }

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate function name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid function name. Use only letters, numbers, hyphens, and underscores.' });
    }

    // Create function directory
    const functionsPath = path.join(process.cwd(), 'functions', projectId);
    const functionPath = path.join(functionsPath, name);
    
    await fs.mkdir(functionPath, { recursive: true });

    // Save function file
    const fileName = runtime === 'nodejs' ? 'index.js' : 
                    runtime === 'python' ? 'main.py' : 'main.go';
    const filePath = path.join(functionPath, fileName);
    
    await fs.writeFile(filePath, req.file.buffer);

    // Create package.json for Node.js functions
    if (runtime === 'nodejs') {
      const packageJson = {
        name: name,
        version: '1.0.0',
        main: 'index.js',
        dependencies: {}
      };
      
      await fs.writeFile(
        path.join(functionPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    }

    // Update project with function info
    const existingFunctionIndex = project.functions.findIndex(f => f.name === name);
    const functionInfo = {
      name,
      path: functionPath,
      runtime
    };

    if (existingFunctionIndex >= 0) {
      project.functions[existingFunctionIndex] = functionInfo;
    } else {
      project.functions.push(functionInfo);
    }

    await project.save();

    // Build and deploy function
    const deployResult = await deployFunction(projectId, name, runtime, functionPath);

    res.json({
      message: 'Function deployed successfully',
      function: functionInfo,
      endpoint: `${process.env.BASE_URL || 'http://localhost:3000'}/api/functions/${projectId}/${name}/invoke`,
      ...deployResult
    });

  } catch (error) {
    console.error('Deploy function error:', error);
    res.status(500).json({ error: 'Function deployment failed' });
  }
});

// Invoke a function
router.post('/:projectId/:functionName/invoke', async (req, res) => {
  try {
    const { projectId, functionName } = req.params;
    const { body: requestBody, headers: requestHeaders, query } = req;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const func = project.functions.find(f => f.name === functionName);
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    // Execute function
    const result = await executeFunction(projectId, functionName, func.runtime, {
      body: requestBody,
      headers: requestHeaders,
      query,
      method: req.method
    });

    // Log function invocation
    await logFunctionInvocation(projectId, functionName, {
      timestamp: new Date(),
      duration: result.duration,
      statusCode: result.statusCode,
      error: result.error
    });

    res.status(result.statusCode || 200).json(result.body);

  } catch (error) {
    console.error('Function invocation error:', error);
    res.status(500).json({ error: 'Function execution failed' });
  }
});

// Get function logs
router.get('/:projectId/:functionName/logs', async (req, res) => {
  try {
    const { projectId, functionName } = req.params;
    const { limit = 100 } = req.query;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const logs = await getFunctionLogs(projectId, functionName, parseInt(limit));
    res.json(logs);

  } catch (error) {
    console.error('Get function logs error:', error);
    res.status(500).json({ error: 'Failed to fetch function logs' });
  }
});

// Delete a function
router.delete('/:projectId/:functionName', async (req, res) => {
  try {
    const { projectId, functionName } = req.params;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove function from project
    project.functions = project.functions.filter(f => f.name !== functionName);
    await project.save();

    // Delete function files
    const functionPath = path.join(process.cwd(), 'functions', projectId, functionName);
    try {
      await fs.rmdir(functionPath, { recursive: true });
    } catch (error) {
      console.error('Failed to delete function files:', error);
    }

    res.json({ message: 'Function deleted successfully' });

  } catch (error) {
    console.error('Delete function error:', error);
    res.status(500).json({ error: 'Failed to delete function' });
  }
});

// Helper functions

async function deployFunction(projectId, functionName, runtime, functionPath) {
  try {
    if (runtime === 'nodejs') {
      // Install dependencies
      await new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install'], { 
          cwd: functionPath,
          stdio: 'pipe'
        });

        npm.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`npm install failed with code ${code}`));
        });
      });
    }

    return {
      status: 'deployed',
      deployedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Function deployment error:', error);
    throw error;
  }
}

async function executeFunction(projectId, functionName, runtime, event) {
  const startTime = Date.now();
  
  try {
    const functionPath = path.join(process.cwd(), 'functions', projectId, functionName);
    
    let result;
    
    if (runtime === 'nodejs') {
      result = await executeNodeFunction(functionPath, event);
    } else if (runtime === 'python') {
      result = await executePythonFunction(functionPath, event);
    } else {
      throw new Error(`Unsupported runtime: ${runtime}`);
    }

    const duration = Date.now() - startTime;

    return {
      statusCode: result.statusCode || 200,
      body: result.body || result,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      statusCode: 500,
      body: { error: error.message },
      duration,
      error: error.message
    };
  }
}

async function executeNodeFunction(functionPath, event) {
  // In a real implementation, this would run in a sandboxed environment
  const indexPath = path.join(functionPath, 'index.js');
  
  // Clear require cache
  delete require.cache[require.resolve(indexPath)];
  
  const handler = require(indexPath);
  
  if (typeof handler.handler === 'function') {
    return await handler.handler(event);
  } else if (typeof handler === 'function') {
    return await handler(event);
  } else {
    throw new Error('Function must export a handler function');
  }
}

async function executePythonFunction(functionPath, event) {
  // Execute Python function using child process
  return new Promise((resolve, reject) => {
    const python = spawn('python', [path.join(functionPath, 'main.py')], {
      stdio: 'pipe'
    });

    python.stdin.write(JSON.stringify(event));
    python.stdin.end();

    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          resolve({ body: output });
        }
      } else {
        reject(new Error(error || `Python process exited with code ${code}`));
      }
    });
  });
}

async function getFunctionStats(projectId, functionName) {
  // Mock stats - in real implementation, get from monitoring service
  return {
    invocations: Math.floor(Math.random() * 1000),
    errors: Math.floor(Math.random() * 10),
    averageDuration: 100 + Math.random() * 500,
    lastInvocation: new Date(Date.now() - Math.random() * 86400000).toISOString()
  };
}

async function logFunctionInvocation(projectId, functionName, logData) {
  // In real implementation, save to database or logging service
  console.log(`Function ${functionName} invoked:`, logData);
}

async function getFunctionLogs(projectId, functionName, limit) {
  // Mock logs - in real implementation, get from logging service
  const logs = [];
  
  for (let i = 0; i < Math.min(limit, 50); i++) {
    logs.push({
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: Math.random() > 0.9 ? 'ERROR' : 'INFO',
      message: `Function execution ${i + 1}`,
      duration: 100 + Math.random() * 500,
      requestId: `req-${Math.random().toString(36).substr(2, 9)}`
    });
  }
  
  return logs;
}

module.exports = router;