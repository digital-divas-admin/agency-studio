# Debug: Content Request Creation Not Working

## Changes Made

1. **Added error display in CreateRequestModal**
   - Shows error message if request creation fails
   - Displays in red alert box with icon
   - Frontend rebuilt with these changes

2. **Fixed modal closing behavior**
   - Modal now only closes on successful creation
   - Stays open to show error if creation fails

---

## Debugging Steps

### Step 1: Check Backend is Running

```bash
# In backend directory
npm run dev

# You should see:
# Server running on port 3001
```

### Step 2: Check Frontend is Running

```bash
# In frontend directory
npm run dev

# You should see:
# Local: http://localhost:5173
```

### Step 3: Open Browser Console

1. Open Chrome/Firefox DevTools (F12)
2. Go to Console tab
3. Try creating a request again
4. Look for errors in red

**Common errors:**
- `401 Unauthorized` - Not logged in
- `404 Not Found` - API endpoint not found
- `500 Internal Server Error` - Backend error
- Network error - Backend not running

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Try creating request again
3. Look for `POST /api/content-requests`
4. Click on it to see:
   - **Request payload** - What you sent
   - **Response** - What backend returned
   - **Status code** - 200 = success, 400/500 = error

---

## Common Issues & Solutions

### Issue 1: "401 Unauthorized"
**Cause:** Not logged in or session expired

**Solution:**
```bash
# Make sure you're logged in
# Refresh the page
# Try logging out and back in
```

### Issue 2: "Model not found"
**Cause:** No models exist in the database

**Solution:**
```sql
-- Check if you have models
SELECT * FROM agency_models;

-- If none, create one via the UI first:
-- Go to Models page → Add Model
```

### Issue 3: Backend not responding
**Cause:** Backend server not running

**Solution:**
```bash
cd backend
npm run dev

# Check it starts without errors
```

### Issue 4: CORS error
**Cause:** Frontend and backend URLs mismatch

**Solution:**
Check `.env` files:
```bash
# frontend/.env
VITE_API_URL=http://localhost:3001

# backend/.env
FRONTEND_URL=http://localhost:5173
```

### Issue 5: Database error
**Cause:** Supabase connection issue

**Solution:**
```bash
# Check backend/.env has valid Supabase credentials:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
```

---

## Manual Test: Create Request via API

Test the backend directly:

```bash
# Get your auth token first
# Open DevTools → Application → Local Storage
# Copy the token from 'supabase.auth.token'

# Then test the API:
curl -X POST http://localhost:3001/api/content-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "model_id": "your-model-id",
    "title": "Test Request",
    "description": "Testing",
    "quantity_photo": 5,
    "quantity_video": 0,
    "priority": "normal"
  }'

# Expected response:
# {
#   "id": "...",
#   "title": "Test Request",
#   ...
# }
```

---

## Check Backend Logs

When you try to create a request, backend should log:

```bash
# Good (success):
POST /api/content-requests 201

# Bad (error):
Error creating content request: [error details]
```

---

## Verify Database Schema

Make sure the table exists:

```sql
-- Check content_requests table
SELECT * FROM content_requests LIMIT 1;

-- Check agency_models table
SELECT id, name FROM agency_models;

-- Check your agency_id
SELECT * FROM agencies LIMIT 1;
```

---

## What to Check Now

1. **Is backend running?**
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok"}
   ```

2. **Are you logged in?**
   - Check top-right corner of app
   - Should see your name/email

3. **Do you have models?**
   - Go to Models page
   - Should see at least one model listed

4. **Try creating request again**
   - Fill out the form
   - Click "Create Request"
   - **Look for red error box now!**
   - Check browser console for errors

---

## Quick Fix Checklist

- [ ] Backend is running (`npm run dev` in backend folder)
- [ ] Frontend is running (`npm run dev` in frontend folder)
- [ ] Logged in to the application
- [ ] At least one model exists
- [ ] Browser console open (F12)
- [ ] Network tab open in DevTools
- [ ] Try creating request again
- [ ] **Error message should now appear if it fails!**

---

## Report Back

After trying again, please share:

1. **What error message appears** (should be red box in modal now)
2. **Console errors** (copy from browser console)
3. **Network tab** (screenshot of POST /api/content-requests)
4. **Backend logs** (any errors in terminal)

This will help identify the exact issue!
