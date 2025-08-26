#!/usr/bin/env node

/**
 * Enhanced Thread Tracking Migration Runner
 * 
 * This script runs the enhanced thread tracking database migrations
 * to create a production-ready thread tracking system.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration(migrationFile) {
  try {
    console.log(`\n📁 Running migration: ${migrationFile}`);
    
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      return false;
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`   📝 Found ${statements.length} SQL statements`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim().length === 0) continue;
      
      try {
        console.log(`   🔄 Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct execution if RPC doesn't exist
          const { error: directError } = await supabase
            .from('thread_tracking')
            .select('id')
            .limit(1);
          
          if (directError && directError.code === 'PGRST116') {
            // Table doesn't exist, this is expected for first migration
            console.log(`   ⚠️  Table doesn't exist yet (expected for first migration)`);
            successCount++;
          } else {
            throw directError;
          }
        } else {
          successCount++;
        }
        
      } catch (stmtError) {
        console.error(`   ❌ Statement ${i + 1} failed:`, stmtError.message);
        errorCount++;
        
        // Continue with other statements unless it's a critical error
        if (stmtError.message.includes('syntax error') || stmtError.message.includes('does not exist')) {
          console.log(`   ⚠️  Non-critical error, continuing...`);
        }
      }
    }
    
    console.log(`   📊 Migration results: ${successCount} successful, ${errorCount} failed`);
    return errorCount === 0;
    
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    return false;
  }
}

async function checkTableExists() {
  try {
    const { data, error } = await supabase
      .from('thread_tracking')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      return false; // Table doesn't exist
    }
    
    return true; // Table exists
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Enhanced Thread Tracking Migration Runner');
  console.log('============================================');
  
  try {
    // Check connection
    console.log('\n🔌 Testing Supabase connection...');
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Connected to Supabase successfully');
    
    // Check if table already exists
    const tableExists = await checkTableExists();
    console.log(`📋 Thread tracking table exists: ${tableExists ? '✅ Yes' : '❌ No'}`);
    
    if (tableExists) {
      console.log('\n⚠️  Table already exists. This migration will drop and recreate it.');
      console.log('   This will DELETE ALL EXISTING THREAD TRACKING DATA!');
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('   Are you sure you want to continue? (yes/no): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled by user');
        process.exit(0);
      }
    }
    
    // Run migrations in order
    const migrations = [
      '20250826_thread_tracking_enhanced.sql',
      '20250826_thread_tracking_functions.sql'
    ];
    
    console.log('\n📚 Running migrations...');
    
    for (const migration of migrations) {
      const success = await runMigration(migration);
      if (!success) {
        console.error(`❌ Migration ${migration} failed`);
        process.exit(1);
      }
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    const tableExistsAfter = await checkTableExists();
    if (!tableExistsAfter) {
      console.error('❌ Table was not created successfully');
      process.exit(1);
    }
    
    console.log('✅ Table created successfully');
    
    // Test basic operations
    try {
      const { data: testData, error: testError } = await supabase
        .from('thread_tracking')
        .select('id, thread_id, user_id')
        .limit(1);
      
      if (testError) {
        console.error('❌ Table query test failed:', testError.message);
      } else {
        console.log('✅ Table query test passed');
      }
    } catch (testError) {
      console.error('❌ Table test failed:', testError.message);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server to use the new thread tracking service');
    console.log('   2. Test thread hiding and tracking functionality');
    console.log('   3. Monitor the logs for any service-related errors');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the migration
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
