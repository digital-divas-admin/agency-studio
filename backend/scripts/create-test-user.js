/**
 * Create Test User Script
 * Creates a Supabase auth user and links them to the demo agency
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestUser(email, password, name) {
  console.log('\n🔧 Creating test user...\n');

  try {
    // Step 1: Check if demo agency exists
    console.log('1. Checking for demo agency...');
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name, slug')
      .eq('slug', 'demo')
      .single();

    if (agencyError) {
      console.error('❌ Demo agency not found. Creating it...');

      // Create demo agency
      const { data: newAgency, error: createAgencyError } = await supabase
        .from('agencies')
        .insert({
          name: 'Demo Studio',
          slug: 'demo',
          status: 'active',
          monthly_credit_allocation: 10000,
          credit_pool: 10000,
        })
        .select()
        .single();

      if (createAgencyError) {
        throw new Error(`Failed to create demo agency: ${createAgencyError.message}`);
      }

      console.log(`✅ Created demo agency: ${newAgency.name} (${newAgency.slug})`);
      agency = newAgency;
    } else {
      console.log(`✅ Found demo agency: ${agency.name} (${agency.slug})`);
    }

    // Step 2: Create auth user in Supabase
    console.log(`\n2. Creating Supabase auth user: ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        console.log('⚠️  User already exists in Supabase Auth. Looking up existing user...');

        // Get existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email === email);
        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }

        console.log(`✅ Found existing auth user: ${existingUser.id}`);
        authData = { user: existingUser };
      } else {
        throw authError;
      }
    } else {
      console.log(`✅ Created auth user: ${authData.user.id}`);
    }

    // Step 3: Link user to agency
    console.log(`\n3. Linking user to demo agency...`);

    // Check if agency_user already exists
    const { data: existingAgencyUser } = await supabase
      .from('agency_users')
      .select('*')
      .eq('email', email)
      .eq('agency_id', agency.id)
      .single();

    if (existingAgencyUser) {
      console.log('⚠️  User already linked to agency. Updating...');

      const { error: updateError } = await supabase
        .from('agency_users')
        .update({
          auth_user_id: authData.user.id,
          name,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .eq('id', existingAgencyUser.id);

      if (updateError) throw updateError;
      console.log('✅ Updated agency user record');
    } else {
      const { error: insertError } = await supabase
        .from('agency_users')
        .insert({
          agency_id: agency.id,
          auth_user_id: authData.user.id,
          email,
          name,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      console.log('✅ Created agency user record');
    }

    console.log('\n✨ Success! Test user created:\n');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Agency:   ${agency.name} (${agency.slug})`);
    console.log(`   Role:     owner`);
    console.log('\n🚀 You can now login at http://localhost:5173\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get args from command line or use defaults
const email = process.argv[2] || 'ndavipt@gmail.com';
const password = process.argv[3] || 'password';
const name = process.argv[4] || 'Test User';

createTestUser(email, password, name);
