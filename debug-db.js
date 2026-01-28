#!/usr/bin/env node

/**
 * Database Debug Script
 * Checks database connection and lists projects
 */

require('dotenv').config();
const SupabaseService = require('./src/services/supabase');

async function debugDatabase() {
  console.log('🔍 Debugging Database Connection...\n');
  
  try {
    // Test connection
    console.log('Testing Supabase connection...');
    await SupabaseService.connect();
    
    // List all projects
    console.log('\n📋 Listing all projects:');
    const { data: projects, error } = await SupabaseService.getAdminClient()
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching projects:', error);
      return;
    }
    
    if (!projects || projects.length === 0) {
      console.log('📭 No projects found in database');
      console.log('\n💡 This explains the "project not found" error!');
      console.log('   You need to create a project first through the web interface.');
      return;
    }
    
    console.log(`✅ Found ${projects.length} project(s):\n`);
    
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Slug: ${project.slug}`);
      console.log(`   URL: https://${project.slug}.hostingke.onrender.com`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Created: ${new Date(project.created_at).toLocaleString()}`);
      console.log('');
    });
    
    // Check deployments
    console.log('🚀 Checking deployments:');
    const { data: deployments, error: deployError } = await SupabaseService.getAdminClient()
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (deployError) {
      console.error('❌ Error fetching deployments:', deployError);
      return;
    }
    
    if (!deployments || deployments.length === 0) {
      console.log('📭 No deployments found');
    } else {
      console.log(`✅ Found ${deployments.length} recent deployment(s):\n`);
      deployments.forEach((deployment, index) => {
        console.log(`${index + 1}. Project ID: ${deployment.project_id}`);
        console.log(`   Status: ${deployment.status}`);
        console.log(`   Created: ${new Date(deployment.created_at).toLocaleString()}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Database debug failed:', error);
  }
}

debugDatabase();