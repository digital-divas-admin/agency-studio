#!/usr/bin/env node
/**
 * Apply database migration 011_team_permissions.sql
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📋 Reading migration file...');

  const migrationPath = path.join(__dirname, 'database', 'migrations', '011_team_permissions.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('🔍 Migration file loaded:', migrationPath);
  console.log('📏 SQL length:', migrationSQL.length, 'characters');
  console.log('');
  console.log('⚠️  IMPORTANT: This will modify your database schema');
  console.log('⚠️  Make sure you have a backup before proceeding');
  console.log('');
  console.log('🚀 Applying migration via Supabase RPC...');
  console.log('');

  try {
    // Split migration into individual statements for better error tracking
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📦 Found ${statements.length} SQL statements to execute`);
    console.log('');

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }

      // Show progress
      const statementPreview = statement.substring(0, 80).replace(/\n/g, ' ');
      process.stdout.write(`[${i + 1}/${statements.length}] ${statementPreview}... `);

      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Check if error is because object already exists
          if (error.message.includes('already exists') ||
              error.message.includes('IF NOT EXISTS') ||
              error.message.includes('IF EXISTS')) {
            console.log('⏭️  Already exists, skipping');
            skipCount++;
          } else {
            console.log('❌ Error');
            console.error('   Error details:', error.message);
            // Continue with other statements
          }
        } else {
          console.log('✅ Success');
          successCount++;
        }
      } catch (err) {
        console.log('❌ Exception');
        console.error('   Exception:', err.message);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   📋 Total: ${statements.length}`);
    console.log('═══════════════════════════════════════');
    console.log('');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    console.log('');

    // Check if tables exist
    const tables = ['user_model_assignments', 'team_activity_log'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (error && error.message.includes('does not exist')) {
        console.log(`   ❌ Table ${table} does not exist`);
      } else {
        console.log(`   ✅ Table ${table} exists`);
      }
    }

    // Check if permissions column exists
    const { data: users, error: usersError } = await supabase
      .from('agency_users')
      .select('email, role, permissions')
      .limit(3);

    if (usersError) {
      console.log('   ❌ Permissions column check failed:', usersError.message);
    } else {
      console.log(`   ✅ Permissions column exists (found ${users.length} users)`);
      if (users.length > 0) {
        console.log('   📝 Sample user permissions:');
        users.forEach(u => {
          console.log(`      - ${u.email} (${u.role}): ${u.permissions ? 'Has permissions' : 'No permissions'}`);
        });
      }
    }

    console.log('');
    console.log('✅ Migration application complete!');
    console.log('');
    console.log('📝 Note: If using Supabase directly, you may need to run the SQL');
    console.log('   manually in the SQL Editor due to RPC limitations.');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('💡 Suggestion: Apply the migration manually via Supabase SQL Editor');
    console.error('   1. Go to your Supabase dashboard');
    console.error('   2. Open SQL Editor');
    console.error('   3. Copy/paste the contents of database/migrations/011_team_permissions.sql');
    console.error('   4. Execute');
    process.exit(1);
  }
}

applyMigration();
