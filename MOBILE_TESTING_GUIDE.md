# 📱 Mobile Testing Guide - Access Portal on Phone

## 🎯 Two Scenarios

### Scenario 1: Test Model Portal (Recommended - No Login Needed!)
✅ **Portal pages don't require authentication**
- Model opens portal link on phone
- Uploads content
- Sees upload status
- **No login = No auth issues!**

### Scenario 2: Test Full App on Mobile (Requires Auth Fix)
⚠️ **Login required pages need Supabase configuration**
- Dashboard, Settings, Content Request manager
- Requires adding your IP to Supabase redirect URLs
- See MOBILE_AUTH_FIX.md for details

**Most people only need Scenario 1!**

---

## The Problem

Portal links look like:
```
http://localhost:5173/portal/abc123
```

**"localhost"** means "this computer" - on your phone, it tries to connect to the phone itself, not your development computer!

---

## ✅ The Solution: Use Your Computer's IP Address

### Step 1: Find Your Computer's IP Address

**On Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

You'll see something like:
```
inet 192.168.1.156 netmask 0xffffff00 broadcast 192.168.1.255
     ↑ This is your IP!
```

**On Windows:**
```bash
ipconfig
```

Look for:
```
IPv4 Address. . . . . . . . . . . : 192.168.1.156
                                     ↑ This is your IP!
```

**Common IP patterns:**
- `192.168.1.XXX` (most home routers)
- `192.168.0.XXX` (some home routers)
- `10.0.0.XXX` (some networks)

---

### Step 2: Restart Dev Servers with Network Access

I've already updated the configs. Now restart:

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
```

You should now see:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.156:5173/  ← NEW! Use this on phone
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

Backend is already configured to accept network requests.

---

### Step 3: Update Environment Variables

**frontend/.env:**
```bash
# Change from localhost to your IP
VITE_API_URL=http://192.168.1.156:3001
```

**Note:** Replace `192.168.1.156` with YOUR actual IP from Step 1!

---

### Step 4: Test on Your Phone

1. **Make sure phone is on same WiFi** as your computer

2. **Open Safari on phone**

3. **Type the network URL:**
   ```
   http://192.168.1.156:5173/portal/abc123
   ```
   (Use YOUR IP, not 192.168.1.156)

4. **It should load!** 🎉

---

## 🔧 Complete Setup Checklist

### On Your Computer:

- [ ] Find your IP address (Step 1)
- [ ] Update `frontend/.env` with IP
  ```
  VITE_API_URL=http://YOUR_IP:3001
  ```
- [ ] **⚠️ IMPORTANT: Add IP to Supabase Redirect URLs**
  ```
  1. Go to https://supabase.com/dashboard
  2. Select your project
  3. Authentication → URL Configuration
  4. Add: http://YOUR_IP:5173/**
  5. Save changes
  ```
  **Note:** Only needed if you want to LOG IN on mobile. Portal testing works without this!

- [ ] Restart frontend dev server
  ```bash
  cd frontend
  npm run dev
  ```
- [ ] Verify you see "Network: http://YOUR_IP:5173"
- [ ] Restart backend dev server
  ```bash
  cd backend
  npm run dev
  ```

### On Your Phone:

- [ ] Connect to same WiFi as computer
- [ ] Open Safari
- [ ] Go to: `http://YOUR_IP:5173`
- [ ] Should see the app!
- [ ] Test portal link: `http://YOUR_IP:5173/portal/TOKEN`

---

## 🎯 How to Generate Mobile-Friendly Portal Links

### Option 1: Manual (Quick Test)
When you create a request:
```
1. Copy the portal link from the request detail
   Original: http://localhost:5173/portal/abc123

2. Replace localhost with your IP:
   Mobile: http://192.168.1.156:5173/portal/abc123

3. Send this to your phone (AirDrop, text, etc.)
```

### Option 2: Automatic (Better)
Update the portal URL generation to use your IP:

**frontend/src/pages/ContentRequests.jsx** (around line 448):
```javascript
// Current:
setPortalUrl(`${window.location.origin}/portal/${data.portal_token}`);

// Better for mobile testing:
const baseUrl = import.meta.env.DEV
  ? `http://192.168.1.156:5173`  // Your IP here
  : window.location.origin;
setPortalUrl(`${baseUrl}/portal/${data.portal_token}`);
```

---

## 📱 Test the Full Model Workflow

1. **On Computer: Create Request**
   - Go to Content Requests
   - Click "New Request"
   - Fill out form
   - Click "Create Request"

2. **On Computer: Get Portal Link**
   - Click on the request
   - Copy portal link
   - Replace `localhost` with your IP
   - Or use the automatic method above

3. **Send to Phone**
   - Text message
   - AirDrop
   - Email
   - Slack/WhatsApp/etc.

4. **On Phone: Open Link**
   ```
   http://192.168.1.156:5173/portal/abc123
   ```

5. **On Phone: Test Upload**
   - Should see the request
   - Tap "Select Files"
   - Choose photos from your phone
   - Tap "Upload"
   - Should see progress bar
   - Should see success message!

6. **On Computer: Verify**
   - Go back to Content Requests
   - Click on the request
   - Should see the uploads!

---

## 🐛 Troubleshooting

### Issue: "Can't connect to server"

**Cause:** Phone and computer not on same WiFi

**Fix:**
```
1. Check both devices are on same network
2. Ping your computer from phone (or vice versa)
3. Check firewall isn't blocking port 5173 or 3001
```

### Issue: "CORS error"

**Cause:** Backend not allowing your IP

**Fix:** Already fixed in `server.js`! Just restart backend:
```bash
cd backend
npm run dev
```

### Issue: "Connection refused"

**Cause:** Dev servers not running

**Fix:**
```bash
# Make sure both are running:
# Terminal 1:
cd frontend && npm run dev

# Terminal 2:
cd backend && npm run dev
```

### Issue: Portal loads but upload fails

**Cause:** Frontend is trying to call `localhost:3001` instead of your IP

**Fix:** Update `frontend/.env`:
```
VITE_API_URL=http://192.168.1.156:3001
```
Then restart frontend server.

---

## 🔒 Security Note

**Development Mode Only!**

These settings are for **local development testing only**:
- Your computer is accessible to anyone on your WiFi
- Don't use on public WiFi
- This is NOT for production

In production, you'd use:
- HTTPS (encrypted)
- Proper domain name
- Firewall rules
- Authentication tokens

---

## ✅ Quick Reference Card

Save this for easy reference:

```
┌─────────────────────────────────────┐
│  Your Development Setup             │
├─────────────────────────────────────┤
│  Computer IP: 192.168.1.___         │
│  Frontend:    http://IP:5173        │
│  Backend:     http://IP:3001        │
│  Portal URL:  http://IP:5173/portal│
├─────────────────────────────────────┤
│  1. Phone on same WiFi ✓            │
│  2. Frontend dev running ✓          │
│  3. Backend dev running ✓           │
│  4. .env updated with IP ✓          │
└─────────────────────────────────────┘
```

Fill in your IP and keep it handy!

---

## 🚀 Ready to Test!

1. Find your IP
2. Update `.env` file
3. Restart both servers
4. Replace `localhost` with your IP in portal links
5. Test on your phone!

The portal should now work perfectly on mobile! 📱✨
