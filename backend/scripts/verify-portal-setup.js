/**
 * Portal Setup Verification Script
 *
 * Checks that all models have portal tokens and are active.
 * Run with: cd backend && node scripts/verify-portal-setup.js
 */

// Load environment variables
require('dotenv').config();

const { supabaseAdmin } = require('../services/supabase');

async function verifyPortalSetup() {
  console.log('🔍 Verifying Portal Setup...\n');

  try {
    // Check models have portal tokens
    const { data: models, error } = await supabaseAdmin
      .from('agency_models')
      .select('id, name, portal_token, status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }

    if (!models || models.length === 0) {
      console.log('⚠️  No models found in database');
      process.exit(0);
    }

    console.log(`📊 Total models: ${models.length}\n`);

    let hasIssues = false;
    let nullTokenCount = 0;
    let inactiveCount = 0;

    models.forEach((model, index) => {
      const hasToken = !!model.portal_token;
      const isActive = model.status === 'active';

      console.log(`${index + 1}. ${model.name}`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Token: ${hasToken ? model.portal_token.substring(0, 8) + '...' : '❌ NULL'}`);
      console.log(`   Status: ${model.status || '❌ NULL'}`);

      if (!hasToken) {
        console.log('   ⚠️  WARNING: Missing portal token!');
        hasIssues = true;
        nullTokenCount++;
      }

      if (!isActive) {
        console.log(`   ⚠️  WARNING: Status is '${model.status || 'NULL'}', should be 'active'`);
        hasIssues = true;
        inactiveCount++;
      }

      console.log('');
    });

    console.log('\n' + '='.repeat(60) + '\n');

    if (hasIssues) {
      console.log('❌ Issues found!');
      console.log(`   ${nullTokenCount} model(s) without portal tokens`);
      console.log(`   ${inactiveCount} model(s) not active\n`);
      console.log('🔧 Run this SQL in Supabase SQL Editor to fix:\n');

      if (nullTokenCount > 0) {
        console.log('-- Generate portal tokens for models that don\'t have them');
        console.log('UPDATE agency_models');
        console.log('SET portal_token = uuid_generate_v4()');
        console.log('WHERE portal_token IS NULL;\n');
      }

      if (inactiveCount > 0) {
        console.log('-- Set all models to active status');
        console.log('UPDATE agency_models');
        console.log('SET status = \'active\'');
        console.log('WHERE status != \'active\' OR status IS NULL;\n');
      }

      console.log('-- Verify fix');
      console.log('SELECT COUNT(*) as null_tokens FROM agency_models WHERE portal_token IS NULL;');
      console.log('SELECT COUNT(*) as inactive FROM agency_models WHERE status != \'active\';');
      console.log('-- Both should return 0\n');

      process.exit(1);
    } else {
      console.log('✅ All models have portal tokens and are active!');
      console.log('✅ Portal system is ready to use\n');
      console.log('📋 Next steps:');
      console.log('   1. Create a content request in the app');
      console.log('   2. Copy the portal link from request details');
      console.log('   3. Test accessing the portal in an incognito window');
      console.log('   4. For mobile: Replace "localhost" with your IP address\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyPortalSetup();
