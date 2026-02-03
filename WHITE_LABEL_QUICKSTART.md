# White-Label System - Quick Start Guide

## What's Been Implemented

Phases 1 & 2 are **COMPLETE** ✅

The foundation and Basic tier UI are fully implemented and ready to test!

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Apply Database Migration

```sql
-- Go to Supabase Dashboard → SQL Editor
-- Copy/paste contents of: database/migrations/012_white_label_tiers.sql
-- Click "Run"
```

The migration will:
- Add white-label columns to `agency_plans` table
- Create `custom_domains` table
- Create `asset_uploads` table
- Seed tier data (Starter=none, Professional=professional, Enterprise=enterprise)

### Step 2: Create Storage Bucket

In Supabase Dashboard:
1. Go to **Storage**
2. Click **New Bucket**
3. Name: `agency-assets`
4. Set to **Public** bucket
5. Click **Create**

### Step 3: Test the UI

1. Start your backend and frontend servers:
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

2. Login to the app

3. Navigate to the Branding page (you'll need to add a route/link)

4. Try uploading a logo and changing colors!

---

## 🎨 What Works Right Now

### Basic Tier Features
- ✅ Logo upload (PNG, JPG, WebP, SVG - max 2MB)
- ✅ Favicon upload (PNG, ICO - max 512KB)
- ✅ App name customization
- ✅ Primary color picker
- ✅ Real-time preview of assets
- ✅ Delete/remove assets

### Backend Features
- ✅ Tier enforcement middleware
- ✅ Image optimization with Sharp
- ✅ Supabase Storage integration
- ✅ Asset validation (size, format)
- ✅ Automatic settings updates

### UI Features
- ✅ Tabbed interface (Basic/Professional/Enterprise)
- ✅ Locked state for unavailable tiers
- ✅ Upgrade prompts
- ✅ Loading states
- ✅ Error handling
- ✅ Success messages

---

## 🔗 Adding Branding Page to Navigation

You'll need to add a link to the Branding page in your navigation. Example:

```jsx
// In your Sidebar or navigation component
import { Palette } from 'lucide-react';

<NavLink to="/admin/branding">
  <Palette className="h-5 w-5" />
  <span>Branding</span>
</NavLink>
```

And add the route in your router:

```jsx
// In App.jsx or Routes.jsx
import { Branding } from './pages/Branding';

<Route path="/admin/branding" element={<Branding />} />
```

---

## 🧪 Testing Scenarios

### Test 1: Basic Tier Upload
1. Navigate to Branding page
2. Click "Basic" tab
3. Upload a logo (should succeed)
4. Upload a favicon (should succeed)
5. Change primary color (should succeed)
6. Click "Professional" tab (should be locked 🔒)

### Test 2: Save & Reload
1. Upload logo and change color
2. Click "Save Changes"
3. Wait for success message
4. Reload page
5. Verify logo and color persisted

### Test 3: Delete Asset
1. Upload a logo
2. Click the X button to remove
3. Confirm deletion
4. Verify logo removed

### Test 4: Tier Enforcement
If you have access to change agency plan tier:
1. Update agency plan to Professional tier in database
2. Reload page
3. "Professional" tab should now be unlocked
4. Try secondary color and login background features

---

## 🐛 Troubleshooting

### "Failed to upload asset"
- **Check**: Is Supabase Storage bucket created?
- **Check**: Is bucket named exactly `agency-assets`?
- **Check**: Is bucket set to Public access?

### "Storage path not found"
- **Check**: Backend has correct Supabase credentials
- **Check**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in backend/.env

### "Migration failed"
- **Solution**: Apply migration manually via Supabase SQL Editor
- Copy contents of `database/migrations/012_white_label_tiers.sql`
- Paste in SQL Editor and run

### Images not displaying
- **Check**: Supabase Storage bucket is Public
- **Check**: CORS is configured if using custom domain
- **Check**: Browser console for any errors

### "Feature not available in your plan"
- **Check**: Agency plan tier in database
- Run this query to check:
```sql
SELECT a.name, p.name as plan, p.white_label_tier
FROM agencies a
JOIN agency_plans p ON a.plan_id = p.id
WHERE a.slug = 'your-agency-slug';
```

---

## 📊 Database Queries for Testing

### Check tier configuration
```sql
SELECT name, white_label_tier, white_label_features
FROM agency_plans;
```

### Check uploaded assets
```sql
SELECT
  asset_type,
  file_name,
  file_size_bytes / 1024 as size_kb,
  url,
  created_at
FROM asset_uploads
WHERE agency_id = 'your-agency-id'
ORDER BY created_at DESC;
```

### Manually set agency tier
```sql
-- Set agency to Professional tier
UPDATE agencies
SET plan_id = (SELECT id FROM agency_plans WHERE name = 'Professional')
WHERE slug = 'your-agency-slug';
```

### Check agency branding settings
```sql
SELECT
  slug,
  name,
  settings->'branding' as branding,
  settings->'white_label' as white_label
FROM agencies
WHERE slug = 'your-agency-slug';
```

---

## 🎯 What's Next?

Phase 3-7 still need to be implemented:

- **Phase 3**: Professional tier (secondary colors, login background, hide branding)
- **Phase 4**: Custom domain support with DNS verification
- **Phase 5**: Branded email templates
- **Phase 6**: Enterprise tier (full palette, custom CSS)
- **Phase 7**: Testing, polish, and documentation

See `WHITE_LABEL_IMPLEMENTATION_STATUS.md` for full details.

---

## 🆘 Need Help?

Check these files for reference:
- **Status Doc**: `WHITE_LABEL_IMPLEMENTATION_STATUS.md`
- **Backend Code**:
  - `backend/middleware/tierCheck.js`
  - `backend/services/assetStorage.js`
  - `backend/routes/admin/assets.js`
  - `backend/routes/admin/branding.js`
- **Frontend Code**:
  - `frontend/src/hooks/useWhiteLabelTier.js`
  - `frontend/src/pages/Branding.jsx`
  - `frontend/src/components/branding/`

---

**Happy Branding!** 🎨
