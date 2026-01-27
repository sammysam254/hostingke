#!/usr/bin/env node

/**
 * API Testing Script for HostingKE Platform
 * Tests all major endpoints to ensure deployment is working correctly
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test data
const testUser = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'testpassword123'
};

let authToken = null;
let testProjectId = null;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test functions
async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status === 200 && response.data.status === 'OK') {
      logSuccess('Health check passed');
      return true;
    } else {
      logError('Health check failed - invalid response');
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testUserRegistration() {
  try {
    const response = await axios.post(`${API_BASE}/auth/register`, testUser);
    if (response.status === 201) {
      logSuccess('User registration successful');
      return true;
    } else {
      logError('User registration failed - unexpected status');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.error?.includes('already exists')) {
      logWarning('User already exists - this is expected in repeated tests');
      return true;
    }
    logError(`User registration failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testUserLogin() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      logSuccess('User login successful');
      return true;
    } else {
      logError('User login failed - no token received');
      return false;
    }
  } catch (error) {
    logError(`User login failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testAuthenticatedEndpoint() {
  if (!authToken) {
    logError('No auth token available for authenticated endpoint test');
    return false;
  }

  try {
    const response = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200 && response.data.user) {
      logSuccess('Authenticated endpoint test passed');
      return true;
    } else {
      logError('Authenticated endpoint test failed');
      return false;
    }
  } catch (error) {
    logError(`Authenticated endpoint test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testProjectCreation() {
  if (!authToken) {
    logError('No auth token available for project creation test');
    return false;
  }

  const projectData = {
    name: `Test Project ${Date.now()}`,
    repository_url: 'https://github.com/example/test-repo',
    branch: 'main',
    build_settings: {
      command: 'npm run build',
      directory: 'dist'
    }
  };

  try {
    const response = await axios.post(`${API_BASE}/projects`, projectData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 201 && response.data.project) {
      testProjectId = response.data.project.id;
      logSuccess('Project creation successful');
      return true;
    } else {
      logError('Project creation failed');
      return false;
    }
  } catch (error) {
    logError(`Project creation failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testProjectsList() {
  if (!authToken) {
    logError('No auth token available for projects list test');
    return false;
  }

  try {
    const response = await axios.get(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200 && Array.isArray(response.data.projects)) {
      logSuccess(`Projects list retrieved (${response.data.projects.length} projects)`);
      return true;
    } else {
      logError('Projects list test failed');
      return false;
    }
  } catch (error) {
    logError(`Projects list test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testWebhookStatus() {
  try {
    const response = await axios.get(`${API_BASE}/webhooks/status`);
    if (response.status === 200 && response.data.status) {
      logSuccess('Webhook status endpoint working');
      return true;
    } else {
      logError('Webhook status test failed');
      return false;
    }
  } catch (error) {
    logError(`Webhook status test failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testStaticFileServing() {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    if (response.status === 200 && response.data.includes('HostingKE')) {
      logSuccess('Static file serving working (frontend accessible)');
      return true;
    } else {
      logError('Static file serving test failed');
      return false;
    }
  } catch (error) {
    logError(`Static file serving test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('\n🚀 Starting HostingKE API Tests', 'blue');
  log(`Testing against: ${BASE_URL}`, 'blue');
  log('=' * 50, 'blue');

  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Static File Serving', fn: testStaticFileServing },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Authenticated Endpoint', fn: testAuthenticatedEndpoint },
    { name: 'Project Creation', fn: testProjectCreation },
    { name: 'Projects List', fn: testProjectsList },
    { name: 'Webhook Status', fn: testWebhookStatus }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    logInfo(`Running: ${test.name}`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      logError(`Test "${test.name}" threw an error: ${error.message}`);
      failed++;
    }
    console.log(''); // Empty line for readability
  }

  // Summary
  log('=' * 50, 'blue');
  log(`\n📊 Test Results Summary:`, 'blue');
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  } else {
    logSuccess(`Failed: ${failed}`);
  }
  
  const total = passed + failed;
  const percentage = Math.round((passed / total) * 100);
  
  if (percentage === 100) {
    logSuccess(`\n🎉 All tests passed! Your HostingKE platform is working perfectly!`);
  } else if (percentage >= 80) {
    logWarning(`\n✨ Most tests passed (${percentage}%). Your platform is mostly working!`);
  } else {
    logError(`\n🔧 Several tests failed (${percentage}% passed). Please check the errors above.`);
  }

  // Cleanup
  if (testProjectId && authToken) {
    logInfo('Cleaning up test project...');
    try {
      await axios.delete(`${API_BASE}/projects/${testProjectId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      logSuccess('Test project cleaned up');
    } catch (error) {
      logWarning('Could not clean up test project (this is okay)');
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
HostingKE API Testing Script

Usage: node test-api.js [options]

Options:
  --help, -h     Show this help message
  --url <url>    Set the base URL (default: http://localhost:3000)

Environment Variables:
  BASE_URL       Set the base URL for testing

Examples:
  node test-api.js
  node test-api.js --url https://your-app.onrender.com
  BASE_URL=https://your-app.onrender.com node test-api.js
  `);
  process.exit(0);
}

// Check for URL argument
const urlIndex = process.argv.indexOf('--url');
if (urlIndex !== -1 && process.argv[urlIndex + 1]) {
  process.env.BASE_URL = process.argv[urlIndex + 1];
}

// Run tests
runAllTests().catch(error => {
  logError(`Test runner failed: ${error.message}`);
  process.exit(1);
});