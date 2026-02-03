# Authentication Troubleshooting Guide

**Last Updated:** 2026-02-03
**Status:** Definitive reference for all auth issues

---

## Table of Contents
1. [Common Issues Overview](#common-issues-overview)
2. [401 vs 403 Errors](#401-vs-403-errors)
3. [Token Storage Issue (Fixed)](#token-storage-issue-fixed)
4. [User Not in Agency (403 Error)](#user-not-in-agency-403-error)
5. [Complete User Setup](#complete-user-setup)
6. [Health Check Endpoints](#health-check-endpoints)
7. [Testing Authentication](#testing-authentication)

---

## Common Issues Overview

### Issue 1: Token Storage Mismatch (401 Errors)
- **Symptom**: 401 errors after successful login
- **Cause**: Supabase stores tokens in cookies, but API reads from localStorage
- **Status**: ✅ FIXED (see details below)

### Issue 2: User Not in Agency (403 Errors)
- **Symptom**: 403 errors after login, "User not found in agency"
- **Cause**: User exists in auth.users but not linked to any agency
- **Solution**: Add user to agency_users table (see details below)

---

## 401 vs 403 Errors

### 401 Unauthorized
- **Meaning**: Authentication failed - no valid token or invalid token
- **Common causes**:
  - Not logged in
  - Token expired
  - Token storage mismatch (FIXED)
  - Session cleared

### 403 Forbidden
- **Meaning**: Authentication succeeded but authorization failed
- **Common causes**:
  - User not in agency_users table
  - User doesn't have required role
  - User's agency is different from requested resource

---

## Token Storage Issue (Fixed)

### The Problem
**Root Cause**: Token storage location mismatch
- Supabase Auth stores tokens in **cookies** (via cookieStorage)
- API service was reading from **localStorage**
- Result: Token exists but API can't find it → 401 errors

### The Solution
**Fixed in**: `frontend/src/services/api.js`

Created `getAuthToken()` function that:
1. Reads from **cookies FIRST** (where Supabase stores tokens)
2. Falls back to localStorage for backward compatibility
3. Includes proper error handling

```javascript
function getAuthToken() {
  // Primary: Read from cookies (where Supabase stores it)
  const cookieToken = cookieStorage.getItem('supabase.auth.token');

  if (cookieToken) {
    try {
      const parsed = JSON.parse(cookieToken);
      return parsed?.access_token || null;
    } catch (e) {
      console.error('Failed to parse auth token from cookies:', e);
      return null;
    }
  }

  // Fallback: Check localStorage for backward compatibility
  const localToken = localStorage.getItem('supabase.auth.token');
  if (localToken) {
    console.warn('Auth token found in localStorage (deprecated location)');
    try {
      const parsed = JSON.parse(localToken);
      return parsed?.access_token || null;
    } catch (e) {
      console.error('Failed to parse token from localStorage:', e);
      return null;
    }
  }

  return null;
}
```

### Verification
If you see this warning in console:
```
Auth token found in localStorage (deprecated location)
```

Clear browser data and login fresh:
```javascript
// In browser console:
document.cookie.split(";").forEach(c => {
  document.cookie = c.trim().split("=")[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
});
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## User Not in Agency (403 Error)

### The Problem
User successfully logs in (authentication works) but gets 403 errors because they're not associated with an agency.

### Backend Log Signs
```
User [uuid] not found in agency [agency_uuid]
GET /api/agency/me 403
```

### The Solution
Add user to the `agency_users` table.

**CRITICAL**: The column is `auth_user_id`, NOT `user_id`!

---

## Complete User Setup

### Database Schema
The `agency_users` table structure:
```sql
CREATE TABLE agency_users (
    id UUID PRIMARY KEY,
    agency_id UUID REFERENCES agencies(id),
    auth_user_id UUID UNIQUE,  -- Links to auth.users.id
    email TEXT NOT NULL,
    name TEXT,
    role TEXT CHECK (role IN ('owner', 'admin', 'member')),
    -- ... other fields
);
```

### Step 1: Check if User Exists
```sql
-- Check user in Supabase Auth
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'user@example.com';
```

If user doesn't exist:
1. Go to Supabase → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Copy the user ID from the result

### Step 2: Check if Agency Exists
```sql
-- Check if agency exists
SELECT id, slug, name
FROM agencies
WHERE slug = 'your-agency-slug';
```

If agency doesn't exist, create it:
```sql
INSERT INTO agencies (slug, name, settings)
VALUES ('your-agency-slug', 'Your Agency Name', '{"trial_days": 14}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
```

### Step 3: Link User to Agency
**IMPORTANT**: Use `auth_user_id`, not `user_id`!

```sql
-- Add user to agency
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'your-agency-slug'),
  'user-uuid-from-step-1',  -- The UUID from auth.users
  'user@example.com',
  'owner'  -- or 'admin' or 'member'
)
ON CONFLICT (auth_user_id) DO UPDATE
  SET role = EXCLUDED.role,
      agency_id = EXCLUDED.agency_id;
```

### Step 4: Verify Setup
```sql
-- Verify user is linked to agency
SELECT
  au.email,
  a.slug as agency,
  au.role,
  au.auth_user_id
FROM agency_users au
JOIN agencies a ON au.agency_id = a.id
WHERE au.email = 'user@example.com';
```

Should return:
```
email              | agency          | role  | auth_user_id
-------------------+-----------------+-------+-------------
user@example.com   | your-agency     | owner | uuid-here
```

---

## Health Check Endpoints

### Check Configuration
```bash
curl http://localhost:3001/health/config | jq
```

**Healthy Response**:
```json
{
  "status": "healthy",
  "checks": {
    "environment": {
      "supabase_url": true,
      "supabase_keys": true,
      "frontend_url": true,
      "node_env": true
    },
    "services": {
      "database": true
    }
  },
  "warnings": []
}
```

### Basic Health Check
```bash
curl http://localhost:3001/health
```

### Detailed Health Check
```bash
curl http://localhost:3001/health/detailed
```

---

## Testing Authentication

### 1. Clear Browser Data
```javascript
// In browser console (http://localhost:5173)
document.cookie.split(";").forEach(c => {
  document.cookie = c.trim().split("=")[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
});
localStorage.clear();
sessionStorage.clear();
```

### 2. Login Test
1. Navigate to http://localhost:5173/login
2. Enter credentials
3. Should redirect to dashboard
4. Check browser console for errors

### 3. Check Token Storage
```javascript
// In browser console after login
console.log('Cookies:', document.cookie);
console.log('Has auth token:', document.cookie.includes('supabase.auth.token'));

// Should see the token in cookies
```

### 4. Check Network Requests
1. Open DevTools → Network tab
2. Make an API call (load gallery, etc.)
3. Check request headers
4. Should see: `Authorization: Bearer <token>`

### 5. Check Backend Logs
Backend should show successful requests:
```
GET /api/agency/config 200
GET /api/agency/me 200
```

**NOT**:
```
GET /api/agency/me 401  ❌ (auth failed)
GET /api/agency/me 403  ❌ (not in agency)
```

---

## Quick Reference: SQL Templates

### Create User and Link to Agency
```sql
-- 1. Create agency if needed
INSERT INTO agencies (slug, name, settings)
VALUES ('my-agency', 'My Agency', '{"trial_days": 14}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- 2. Link existing auth user to agency
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'my-agency'),
  'auth-user-uuid-here',
  'user@example.com',
  'owner'
)
ON CONFLICT (auth_user_id) DO UPDATE
  SET role = 'owner',
      agency_id = EXCLUDED.agency_id;

-- 3. Verify
SELECT
  au.email,
  a.slug,
  au.role
FROM agency_users au
JOIN agencies a ON au.agency_id = a.id
WHERE au.email = 'user@example.com';
```

### Find User's Agency
```sql
SELECT
  u.email,
  a.slug as agency_slug,
  a.name as agency_name,
  au.role
FROM auth.users u
LEFT JOIN agency_users au ON u.id = au.auth_user_id
LEFT JOIN agencies a ON au.agency_id = a.id
WHERE u.email = 'user@example.com';
```

### Check All Users in an Agency
```sql
SELECT
  au.email,
  au.role,
  au.created_at
FROM agency_users au
JOIN agencies a ON au.agency_id = a.id
WHERE a.slug = 'my-agency'
ORDER BY au.created_at DESC;
```

---

## Common Mistakes

### ❌ Using `user_id` instead of `auth_user_id`
```sql
-- WRONG - will fail with "column user_id does not exist"
INSERT INTO agency_users (agency_id, user_id, email, role)
VALUES (...);

-- CORRECT
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
VALUES (...);
```

### ❌ Forgetting to include `email` field
```sql
-- WRONG - email is required
INSERT INTO agency_users (agency_id, auth_user_id, role)
VALUES (...);

-- CORRECT - always include email
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
VALUES (...);
```

### ❌ Not clearing browser data before testing
Old tokens in localStorage can mask issues. Always clear:
```javascript
localStorage.clear();
sessionStorage.clear();
// Clear cookies too
```

### ❌ Checking wrong error code
- 401 = Authentication issue (token problem)
- 403 = Authorization issue (permissions/agency problem)

Don't confuse them!

---

## Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=  # Leave empty for same-origin
```

### Backend (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

---

## Troubleshooting Checklist

When authentication issues occur:

- [ ] Check backend logs for error messages
- [ ] Identify if it's 401 (auth) or 403 (authorization)
- [ ] If 401: Check token storage and cookies
- [ ] If 403: Check if user is in agency_users table
- [ ] Run `/health/config` to verify environment
- [ ] Check user exists in auth.users
- [ ] Check agency exists in agencies table
- [ ] Verify user is linked in agency_users table
- [ ] Use correct column name: `auth_user_id` not `user_id`
- [ ] Include `email` field when inserting
- [ ] Clear browser data and test fresh login
- [ ] Check network tab for Authorization header

---

## Prevention Measures

### For Developers
1. Always use the health check endpoint before deployment
2. Test with fresh browser session (cleared data)
3. Verify SQL column names match schema
4. Check both frontend and backend logs
5. Don't assume 401 = token issue (could be 403 in disguise)

### For Deployment
1. Run `curl http://localhost:3001/health/config`
2. Ensure status is "healthy"
3. All environment variables set correctly
4. Test login flow before announcing deployment
5. Monitor backend logs for 403/401 patterns

---

## Related Documentation

- [AUTH_FIX_IMPLEMENTATION.md](./AUTH_FIX_IMPLEMENTATION.md) - Token storage fix details
- [AUTH_FIX_PROOF.md](./AUTH_FIX_PROOF.md) - Verification proof
- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) - Complete setup guide
- [backend/.env.example](./backend/.env.example) - Environment template
- [database/schema.sql](./database/schema.sql) - Database schema reference

---

## Getting Help

If issues persist:
1. Check this guide first
2. Review backend logs: `tail -f /path/to/backend.log`
3. Check Supabase logs in dashboard
4. Run health checks: `curl http://localhost:3001/health/config`
5. Verify database state with SQL queries above
6. Clear all browser data and retry

---

**Remember**:
- 401 = Can't authenticate (token issue)
- 403 = Authenticated but not authorized (permission issue)
- Column is `auth_user_id` not `user_id`
- Always include `email` field in agency_users
- Token storage fix is in place and working
