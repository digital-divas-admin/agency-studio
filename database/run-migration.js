/**
 * Run database migrations via Supabase
 * Usage: node run-migration.js <migration-file>
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { createClient } = require('@supabase/supabase-js');

// Parse args
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>');
  process.exit(1);
}

// Check environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

// Read migration file
const migrationPath = path.join(__dirname, 'migrations', migrationFile);
if (!fs.existsSync(migrationPath)) {
  console.error(`Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

// Run migration
async function runMigration() {
  console.log(`Running migration: ${migrationFile}`);
  console.log('---');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Execute SQL via RPC
  // Note: Supabase doesn't have a direct SQL execution endpoint, so we'll use a workaround
  // We'll split the SQL into individual statements and execute them

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    // Skip comments
    if (statement.trim().startsWith('--') || statement.trim().startsWith('COMMENT')) {
      console.log(`Skipping: ${statement.substring(0, 60)}...`);
      continue;
    }

    try {
      // Use RPC to execute SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`✗ Error executing statement ${i + 1}:`, error.message);
        console.error(`  SQL: ${statement.substring(0, 100)}...`);
        errorCount++;
      } else {
        console.log(`✓ Executed statement ${i + 1}`);
        successCount++;
      }
    } catch (err) {
      console.error(`✗ Exception executing statement ${i + 1}:`, err.message);
      errorCount++;
    }
  }

  console.log('---');
  console.log(`Migration complete: ${successCount} successful, ${errorCount} errors`);

  if (errorCount > 0) {
    console.log('\nNote: Some SQL features may not be available via Supabase RPC.');
    console.log('Please run the migration manually in the Supabase SQL Editor:');
    console.log(`  https://app.supabase.com/project/YOUR_PROJECT/editor`);
    console.log(`\nOr use psql directly with your database connection string.`);
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
