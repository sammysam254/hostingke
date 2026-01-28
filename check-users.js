#!/usr/bin/env node

/**
 * User Check Script
 * Checks if there are any users in the database
 */

require('dotenv').config();
const SupabaseService = require('./src/services/supabase');

async function checkUsers() {
  console.log('👥 Checking Users in Database...\n');
  
  try {
    // List all users
    const { data: users, error } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('📭 No users found in database');
      console.log('\n💡 You need to register a user first!');
      console.log('   Visit your app and create an account to start using it.');
      return;
    }
    
    console.log(`✅ Found ${users.length} user(s):\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ User check failed:', error);
  }
}

checkUsers();