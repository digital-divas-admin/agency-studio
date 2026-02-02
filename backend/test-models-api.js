/**
 * Test script for models API with new profile fields
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('./services/supabase');

async function testModelsAPI() {
  console.log('🧪 Testing Models API with Profile Fields\n');

  // Test 1: Check if new columns exist
  console.log('1. Checking database schema...');
  try {
    const { data, error } = await supabaseAdmin
      .from('agency_models')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Database query failed:', error.message);
      return;
    }

    const model = data[0] || {};
    const newFields = [
      'email', 'phone', 'bio', 'joined_date',
      'social_media', 'contract_split', 'contract_notes',
      'content_preferences', 'field_visibility'
    ];

    console.log('✅ Database schema check:');
    newFields.forEach(field => {
      const exists = field in model || data.length === 0;
      console.log(`   ${exists ? '✓' : '✗'} ${field}`);
    });
    console.log();

  } catch (err) {
    console.error('❌ Schema check failed:', err.message);
  }

  // Test 2: Create a test model with all new fields
  console.log('2. Testing model creation with new fields...');
  try {
    // Get first agency
    const { data: agencies } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .limit(1);

    if (!agencies || agencies.length === 0) {
      console.log('⚠️  No agencies found. Skipping creation test.');
      return;
    }

    const agencyId = agencies[0].id;
    const testSlug = `test-model-${Date.now()}`;

    const { data: testModel, error: createError } = await supabaseAdmin
      .from('agency_models')
      .insert({
        agency_id: agencyId,
        name: 'Test Model',
        slug: testSlug,
        email: 'test@example.com',
        phone: '+1-555-555-5555',
        bio: 'This is a test bio',
        joined_date: '2026-01-01',
        social_media: {
          instagram: '@testmodel',
          twitter: '@testmodel'
        },
        contract_split: '70/30',
        contract_notes: 'Test contract notes',
        content_preferences: {
          willing_to_do: ['lingerie', 'bikini'],
          will_not_do: ['explicit'],
          special_notes: 'Test notes'
        },
        field_visibility: {
          email: false,
          phone: false,
          bio: true,
          social_media: true,
          onlyfans_handle: true,
          joined_date: false,
          contract_split: false,
          contract_notes: false,
          content_preferences: false
        },
        portal_token: uuidv4(),
        status: 'active'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Model creation failed:', createError.message);
      return;
    }

    console.log('✅ Model created successfully');
    console.log('   ID:', testModel.id);
    console.log('   Email:', testModel.email);
    console.log('   Bio:', testModel.bio);
    console.log('   Social Media:', JSON.stringify(testModel.social_media));
    console.log('   Content Preferences:', JSON.stringify(testModel.content_preferences));
    console.log();

    // Test 3: Update the model
    console.log('3. Testing model update...');
    const { data: updatedModel, error: updateError } = await supabaseAdmin
      .from('agency_models')
      .update({
        bio: 'Updated bio',
        phone: '+1-555-555-6666'
      })
      .eq('id', testModel.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Model update failed:', updateError.message);
    } else {
      console.log('✅ Model updated successfully');
      console.log('   New Bio:', updatedModel.bio);
      console.log('   New Phone:', updatedModel.phone);
      console.log();
    }

    // Test 4: Field visibility filtering
    console.log('4. Testing field visibility logic...');
    const isAdmin = true;
    const isRegularUser = false;

    function filterModelFields(model, isAdmin) {
      if (isAdmin) return model;

      const visibility = model.field_visibility || {};
      const filtered = { ...model };

      if (!visibility.email) delete filtered.email;
      if (!visibility.phone) delete filtered.phone;
      if (!visibility.bio) delete filtered.bio;
      if (!visibility.social_media) delete filtered.social_media;
      if (!visibility.onlyfans_handle) delete filtered.onlyfans_handle;
      if (!visibility.joined_date) delete filtered.joined_date;
      if (!visibility.contract_split) delete filtered.contract_split;
      if (!visibility.content_preferences) delete filtered.content_preferences;

      delete filtered.field_visibility;
      delete filtered.notes;
      delete filtered.contract_notes;

      return filtered;
    }

    const adminView = filterModelFields(updatedModel, isAdmin);
    const userView = filterModelFields(updatedModel, isRegularUser);

    console.log('✅ Field filtering test:');
    console.log('   Admin can see email:', 'email' in adminView);
    console.log('   Regular user can see email:', 'email' in userView);
    console.log('   Admin can see contract_notes:', 'contract_notes' in adminView);
    console.log('   Regular user can see contract_notes:', 'contract_notes' in userView);
    console.log();

    // Cleanup
    console.log('5. Cleaning up test model...');
    const { error: deleteError } = await supabaseAdmin
      .from('agency_models')
      .delete()
      .eq('id', testModel.id);

    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError.message);
    } else {
      console.log('✅ Test model deleted');
    }

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }

  console.log('\n✅ All tests completed!\n');
}

// Run tests
testModelsAPI().catch(console.error);
