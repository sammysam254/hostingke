#!/usr/bin/env node

/**
 * Simple health check script to verify server startup
 */

require('dotenv').config();

async function healthCheck() {
  console.log('🏥 Running Health Check...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`PORT: ${process.env.PORT}`);
  console.log(`BASE_URL: ${process.env.BASE_URL}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`SESSION_SECRET: ${process.env.SESSION_SECRET !== 'your-session-secret-change-in-production' ? '✅ Set' : '❌ Default value'}`);
  
  // Test Supabase connection
  console.log('\n🔗 Testing Supabase Connection...');
  try {
    const SupabaseService = require('./src/services/supabase');
    await SupabaseService.connect();
    console.log('✅ Supabase connection successful');
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message);
  }
  
  // Test server startup (without actually starting)
  console.log('\n🚀 Testing Server Configuration...');
  try {
    const HostingPlatform = require('./src/server');
    console.log('✅ Server configuration loaded successfully');
  } catch (error) {
    console.log('❌ Server configuration failed:', error.message);
  }
  
  console.log('\n✅ Health check complete!');
}

healthCheck().catch(console.error);