/**
 * Create model-uploads storage bucket in Supabase
 */

require('dotenv').config();
const { supabaseAdmin } = require('./services/supabase');

async function createBucket() {
  console.log('🪣 Creating model-uploads storage bucket...\n');

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
      return;
    }

    const existingBucket = buckets.find(b => b.name === 'model-uploads');

    if (existingBucket) {
      console.log('✅ Bucket "model-uploads" already exists!');
      console.log('   ID:', existingBucket.id);
      console.log('   Public:', existingBucket.public);
      return;
    }

    // Create the bucket
    const { data, error } = await supabaseAdmin.storage.createBucket('model-uploads', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    });

    if (error) {
      console.error('❌ Failed to create bucket:', error.message);

      // If it's a permissions error, show manual instructions
      if (error.message.includes('permission') || error.message.includes('not authorized')) {
        console.log('\n⚠️  Permission denied. Please create the bucket manually:\n');
        console.log('1. Go to: https://app.supabase.com/project/YOUR_PROJECT/storage/buckets');
        console.log('2. Click "New bucket"');
        console.log('3. Name: model-uploads');
        console.log('4. Make it PUBLIC');
        console.log('5. Set size limit: 10MB');
        console.log('6. Click "Create bucket"\n');
      }
      return;
    }

    console.log('✅ Bucket "model-uploads" created successfully!');
    console.log('   Name:', data.name);
    console.log('   Public: true');
    console.log('   Max file size: 10MB\n');

    // Test upload to verify it works
    console.log('🧪 Testing bucket with a small file...');

    const testBuffer = Buffer.from('test');
    const testPath = `test/${Date.now()}.txt`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('model-uploads')
      .upload(testPath, testBuffer, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ Test upload failed:', uploadError.message);
    } else {
      console.log('✅ Test upload successful!\n');

      // Clean up test file
      await supabaseAdmin.storage
        .from('model-uploads')
        .remove([testPath]);

      console.log('✅ Test file cleaned up');
    }

    console.log('\n🎉 Setup complete! You can now upload avatars.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createBucket();
