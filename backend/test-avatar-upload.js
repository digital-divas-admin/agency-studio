/**
 * Test avatar upload endpoint
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAvatarUpload() {
  console.log('🧪 Testing Avatar Upload Endpoint\n');

  // Create a simple test image (1x1 PNG)
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const testImagePath = path.join(__dirname, 'test-avatar.png');
  fs.writeFileSync(testImagePath, testImageBuffer);

  console.log('1. Creating test image...');
  console.log('   ✓ Test image created:', testImagePath);
  console.log();

  // Get a test token (you'll need to manually set this)
  console.log('2. Testing upload endpoint...');
  console.log('   Note: This requires a valid auth token');
  console.log('   Checking if endpoint exists...');

  try {
    const form = new FormData();
    form.append('avatar', fs.createReadStream(testImagePath));

    const response = await fetch('http://localhost:3001/api/models/upload-avatar', {
      method: 'POST',
      body: form,
      headers: {
        // You would need a real token here
        'Authorization': 'Bearer invalid-test-token',
        ...form.getHeaders()
      }
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      console.log('   ✓ Endpoint exists and requires authentication');
      console.log('   Response:', data);
    } else if (response.status === 200) {
      console.log('   ✓ Upload successful!');
      console.log('   URL:', data.url);
    } else {
      console.log('   ✗ Unexpected response:', response.status, data);
    }
  } catch (err) {
    console.error('   ✗ Request failed:', err.message);
  }

  // Cleanup
  fs.unlinkSync(testImagePath);
  console.log('\n3. Cleanup complete');
  console.log('   ✓ Test image deleted\n');

  console.log('✅ Upload endpoint test completed!\n');
  console.log('To fully test uploads:');
  console.log('1. Open http://localhost:5173');
  console.log('2. Go to Models page');
  console.log('3. Click "Add Model"');
  console.log('4. Try uploading an image\n');
}

testAvatarUpload().catch(console.error);
