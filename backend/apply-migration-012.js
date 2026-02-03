#!/usr/bin/env node
/**
 * Apply database migration 012_white_label_tiers.sql
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📋 Reading migration file...');

  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '012_white_label_tiers.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('🔍 Migration file loaded:', migrationPath);
  console.log('📏 SQL length:', migrationSQL.length, 'characters');
  console.log('');
  console.log('⚠️  IMPORTANT: This will modify your database schema');
  console.log('⚠️  Make sure you have a backup before proceeding');
  console.log('');
  console.log('🚀 Applying white-label tier system migration...');
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
    const tables = ['custom_domains', 'asset_uploads'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (error && error.message.includes('does not exist')) {
        console.log(`   ❌ Table ${table} does not exist`);
      } else {
        console.log(`   ✅ Table ${table} exists`);
      }
    }

    // Check if white_label_tier column exists
    const { data: plans, error: plansError } = await supabase
      .from('agency_plans')
      .select('name, white_label_tier, white_label_features')
      .limit(5);

    if (plansError) {
      console.log('   ❌ White-label columns check failed:', plansError.message);
    } else {
      console.log(`   ✅ White-label columns exist (found ${plans.length} plans)`);
      if (plans.length > 0) {
        console.log('   📝 Plan tiers:');
        plans.forEach(p => {
          console.log(`      - ${p.name}: ${p.white_label_tier || 'none'}`);
        });
      }
    }

    console.log('');
    console.log('✅ Migration application complete!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Create Supabase Storage bucket: agency-assets');
    console.log('   2. Set bucket to public read access');
    console.log('   3. Configure CORS if needed');
    console.log('   4. Install backend packages: npm install sharp multer');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('💡 Suggestion: Apply the migration manually via Supabase SQL Editor');
    console.error('   1. Go to your Supabase dashboard');
    console.error('   2. Open SQL Editor');
    console.error('   3. Copy/paste the contents of database/migrations/012_white_label_tiers.sql');
    console.error('   4. Execute');
    process.exit(1);
  }
}

applyMigration();
