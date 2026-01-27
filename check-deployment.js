#!/usr/bin/env node

/**
 * Quick deployment status checker for HostingKE
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://hostingke-platform.onrender.com';

async function checkDeployment() {
  console.log(`🔍 Checking deployment status for: ${BASE_URL}`);
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 10000 });
    console.log('✅ Health check:', healthResponse.data);
    
    // Test frontend
    const frontendResponse = await axios.get(`${BASE_URL}/`, { timeout: 10000 });
    if (frontendResponse.data.includes('HostingKE')) {
      console.log('✅ Frontend is accessible');
    }
    
    // Test webhook status
    const webhookResponse = await axios.get(`${BASE_URL}/api/webhooks/status`, { timeout: 10000 });
    console.log('✅ Webhook system:', webhookResponse.data.status);
    
    console.log('\n🎉 Deployment is working correctly!');
    console.log(`🌐 Visit your platform at: ${BASE_URL}`);
    
  } catch (error) {
    console.error('❌ Deployment check failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 The service might still be starting up. Try again in a few minutes.');
    }
    process.exit(1);
  }
}

checkDeployment();