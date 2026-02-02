# 🧪 Portal Testing Guide - Quick Start

## Prerequisites
- Backend running on port 3001
- Frontend running on port 5173
- Database migrations applied (especially 005_content_requests.sql)

## Quick Testing Steps

### 1. Verify Database Setup

Open Supabase SQL Editor and run:
```sql
-- Check models have portal tokens
SELECT id, name, portal_token, status FROM agency_models;
```

**Expected:** All models should have non-NULL portal_token UUIDs and status='active'

**If any are NULL:** Run the backfill:
```sql
UPDATE agency_models SET portal_token = uuid_generate_v4() WHERE portal_token IS NULL;
```

---

### 2. Desktop Testing (Fast Verification)

1. **Login** to app: `http://localhost:5173`
2. **Go to** Content Requests page
3. **Click** "Create Request" button
4. **Fill out:**
   - Select a model
   - Add title: "Test Upload Request"
   - Add description: "Testing portal flow"
5. **Click** "Create Request"
6. **Click** on the newly created request in the list
7. **Copy** the portal link shown at the top
8. **Open incognito/private browser window**
9. **Paste** the portal link
10. **Verify** portal loads with model name and upload interface

**Expected Result:** Portal should load successfully showing the model's upload interface

---

### 3. Mobile Testing (Full Workflow)

#### A. Setup Network Access

1. **Find your Mac's IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Example output: inet 192.168.10.108
   ```

2. **Verify frontend is accessible:**
   - Frontend should already be running with `--host` flag
   - Check console shows: `Network: http://192.168.10.108:5173/`

3. **On your phone's browser, access:**
   ```
   http://192.168.10.108:5173
   ```

#### B. Generate Mobile-Friendly Portal Link

1. **On your computer:**
   - Login at `http://192.168.10.108:5173` (use IP, not localhost)
   - Create a new content request
   - Click on the request to view details
   - Copy the portal link

2. **The link should look like:**
   ```
   http://192.168.10.108:5173/portal/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

3. **Send link to your phone:**
   - AirDrop (easiest on Mac/iPhone)
   - Text message
   - Email to yourself

#### C. Test Upload on Phone

1. **Open the link on your phone**
2. **Verify portal loads** showing:
   - Model name and avatar
   - Agency name
   - Upload interface
3. **Tap "Select Files"**
4. **Choose photos from your phone**
5. **Tap "Upload"**
6. **Verify:**
   - Upload progress shows
   - Success message appears
   - Recent uploads section shows your uploads

#### D. Verify Upload on Desktop

1. **On computer, go back to Content Requests page**
2. **Click on the request again**
3. **Scroll to uploads section**
4. **Verify your uploaded files appear**
5. **Test approve/reject** buttons

---

### 4. Debugging Failed Portal Links

If portal shows "invalid link" error:

#### Check Backend Logs

Terminal running backend should show:
```
Portal token validation attempt: abcd1234...
Portal access granted for model: ModelName (uuid)
```

Or if failing:
```
Invalid portal token attempt: abcd1234... - No matching active model found
```

#### Check Database

```sql
-- Get the token from the URL, e.g., if URL is:
-- http://localhost:5173/portal/12345678-90ab-cdef-1234-567890abcdef
-- Use that UUID in this query:

SELECT * FROM agency_models
WHERE portal_token = '12345678-90ab-cdef-1234-567890abcdef';
```

**If no results:** The token doesn't exist in database
**If result but status != 'active':** Update status:
```sql
UPDATE agency_models SET status = 'active' WHERE portal_token = '...';
```

#### Check Portal Token in Request Detail

```sql
-- Find your content request
SELECT
  cr.id,
  cr.title,
  am.name as model_name,
  am.portal_token,
  am.status
FROM content_requests cr
JOIN agency_models am ON cr.model_id = am.id
WHERE cr.title LIKE '%Test%'
ORDER BY cr.created_at DESC
LIMIT 5;
```

**Expected:** Should show the model's portal_token (UUID) and status='active'

---

### 5. Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Invalid link" on desktop | portal_token is NULL | Run backfill SQL |
| "Invalid link" on mobile only | Using localhost URL on phone | Use IP address URL |
| Portal loads but can't upload | API URL wrong in .env | Update VITE_API_URL to use IP |
| "Connection refused" on mobile | Phone not on same WiFi | Connect phone to same network |
| Portal shows but model name is wrong | Cached old portal data | Hard refresh browser |

---

### 6. Network Testing Checklist

For mobile testing, verify:

- [ ] Backend running on port 3001
- [ ] Frontend running with `--host` flag
- [ ] Frontend shows Network URL in console
- [ ] Phone connected to same WiFi as computer
- [ ] Can access `http://YOUR_IP:5173` from phone browser
- [ ] VITE_API_URL in .env is localhost (NOT IP - for desktop)
- [ ] Portal link uses IP address (NOT localhost)

---

### 7. Testing Matrix

| Access Method | URL Format | Expected Result |
|---------------|------------|-----------------|
| Desktop browser → localhost | `http://localhost:5173/portal/TOKEN` | ✅ Works |
| Desktop browser → IP | `http://192.168.X.X:5173/portal/TOKEN` | ✅ Works |
| Mobile browser → localhost | `http://localhost:5173/portal/TOKEN` | ❌ Fails (localhost = phone) |
| Mobile browser → IP | `http://192.168.X.X:5173/portal/TOKEN` | ✅ Works |

**Key Insight:** Always use IP address URLs for mobile testing, not localhost

---

### 8. Quick Verification Script

Save this as `scripts/verify-portal-setup.js`:

```javascript
const { supabaseAdmin } = require('../backend/services/supabase');
const { logger } = require('../backend/services/logger');

async function verifyPortalSetup() {
  console.log('🔍 Verifying Portal Setup...\n');

  // Check models have portal tokens
  const { data: models, error } = await supabaseAdmin
    .from('agency_models')
    .select('id, name, portal_token, status');

  if (error) {
    console.error('❌ Database error:', error);
    return;
  }

  console.log(`📊 Total models: ${models.length}\n`);

  let hasIssues = false;

  models.forEach((model, index) => {
    console.log(`${index + 1}. ${model.name}`);
    console.log(`   ID: ${model.id}`);
    console.log(`   Token: ${model.portal_token || '❌ NULL'}`);
    console.log(`   Status: ${model.status}`);

    if (!model.portal_token) {
      console.log('   ⚠️  WARNING: Missing portal token!');
      hasIssues = true;
    }

    if (model.status !== 'active') {
      console.log(`   ⚠️  WARNING: Status is '${model.status}', should be 'active'`);
      hasIssues = true;
    }

    console.log('');
  });

  if (hasIssues) {
    console.log('❌ Issues found! Run this SQL to fix:');
    console.log('   UPDATE agency_models SET portal_token = uuid_generate_v4() WHERE portal_token IS NULL;');
    console.log('   UPDATE agency_models SET status = \'active\' WHERE status != \'active\';');
  } else {
    console.log('✅ All models have portal tokens and are active!');
  }

  process.exit(0);
}

verifyPortalSetup();
```

**Run with:**
```bash
cd backend
node scripts/verify-portal-setup.js
```

---

## SQL Backfill Script

If you need to fix NULL portal tokens in your database:

```sql
-- Step 1: Check how many models are affected
SELECT COUNT(*) as models_without_tokens
FROM agency_models
WHERE portal_token IS NULL;

-- Step 2: Backfill missing portal tokens
UPDATE agency_models
SET portal_token = uuid_generate_v4()
WHERE portal_token IS NULL;

-- Step 3: Ensure all models are active
UPDATE agency_models
SET status = 'active'
WHERE status IS NULL OR status != 'active';

-- Step 4: Verify all fixed
SELECT
  COUNT(*) FILTER (WHERE portal_token IS NULL) as null_tokens,
  COUNT(*) FILTER (WHERE status != 'active') as inactive_models,
  COUNT(*) as total_models
FROM agency_models;
-- Should show 0 null_tokens and 0 inactive_models
```

---

## Success Criteria

After running through this guide, you should have:

✅ All models have non-NULL portal_token UUIDs in database
✅ All models have status='active'
✅ Can create content request on desktop
✅ Portal link appears in request detail
✅ Portal link opens in incognito window successfully
✅ Portal shows model name and upload interface
✅ Can access portal from phone using IP address
✅ Can upload files from phone
✅ Uploads appear in manager interface
✅ Backend logs show successful validation
✅ Frontend console shows portal URL generation

---

## Tips for Production

When deploying to production:

1. **Use HTTPS:** Portal tokens over HTTP can be intercepted
2. **Set Token Expiry:** Consider adding expiration dates to portal tokens
3. **Rate Limiting:** Add rate limits to portal upload endpoints
4. **File Validation:** Validate file types and sizes on backend
5. **Monitor Failed Validations:** Track failed portal access attempts
6. **Regenerate Tokens:** Add ability for managers to regenerate portal tokens

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check backend logs for detailed error messages
2. Check browser console for frontend errors
3. Verify database schema matches migration 005
4. Ensure all environment variables are set correctly
5. Test with a fresh incognito window to avoid cache issues
