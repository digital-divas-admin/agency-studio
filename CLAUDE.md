# Agency Studio - Project Context for Claude

## 🚨 CRITICAL: Authentication Knowledge - READ THIS FIRST!

### Issue 1: 401 vs 403 Errors - Know the Difference!

**401 Unauthorized** = Authentication failed (token problem)
- User can't authenticate
- Token missing, expired, or invalid
- Fix: Check token storage, clear browser data

**403 Forbidden** = Authenticated but not authorized (user not in agency)
- User IS authenticated (has valid token)
- User is NOT in agency_users table
- Fix: Add user to agency with SQL

**⚠️ DO NOT confuse these!** They look similar but need completely different fixes.

---

### Issue 2: Database Column Names - ABSOLUTELY CRITICAL!

The `agency_users` table uses:
- ✅ **`auth_user_id`** (correct - links to auth.users.id)
- ❌ **`user_id`** (WRONG - does not exist!)

**ALWAYS use `auth_user_id` when writing SQL for the agency_users table.**

If you see this error:
```
ERROR: column "user_id" of relation "agency_users" does not exist
```

You used the wrong column name. Change `user_id` to `auth_user_id`.

---

### Issue 3: Token Storage Fix (IMPLEMENTED & WORKING)

**Background**:
- Supabase Auth stores tokens in **cookies** (via cookieStorage)
- API service was reading from **localStorage**
- Result: Token existed but API couldn't find it → 401 errors

**Solution Implemented**:
File: `frontend/src/services/api.js`

The `getAuthToken()` function now:
1. Reads from **cookies FIRST** (where Supabase stores tokens)
2. Falls back to localStorage for backward compatibility
3. Logs warnings if old tokens found in localStorage

**Status**: ✅ Fixed, tested, and verified working

**Related Files**:
- `frontend/src/services/api.js` - Token retrieval (FIXED)
- `frontend/src/services/supabase.js` - Environment validation added
- `backend/routes/health.js` - New `/health/config` endpoint added

---

## Quick SQL Reference

### Add User to Agency (CORRECT!)
```sql
-- Ensure agency exists
INSERT INTO agencies (slug, name, settings)
VALUES ('fresh-test', 'Fresh Test Agency', '{"trial_days": 14}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Add user to agency (NOTE: auth_user_id, NOT user_id!)
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'fresh-test'),
  'user-uuid-from-auth.users',  -- Get this from backend logs or auth.users table
  'user@example.com',
  'owner'  -- or 'admin' or 'member'
)
ON CONFLICT (auth_user_id) DO UPDATE
  SET role = EXCLUDED.role,
      agency_id = EXCLUDED.agency_id;

-- Verify it worked
SELECT
  au.email,
  a.slug as agency,
  au.role,
  au.auth_user_id
FROM agency_users au
JOIN agencies a ON au.agency_id = a.id
WHERE au.email = 'user@example.com';
```

### Find User's Current Agency
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

---

## Troubleshooting Flowchart

### User Login Issues:

1. **Check backend logs first**
   ```
   tail -f backend.log
   ```

2. **Identify the error code:**

   **If 401** → Authentication problem:
   - Token not found or invalid
   - Clear browser cookies/localStorage
   - Login fresh
   - Check token is in cookies (not just localStorage)

   **If 403 with "User not found in agency"** → Authorization problem:
   - User authenticated successfully
   - User not in agency_users table
   - Run SQL to add user (use `auth_user_id`!)
   - Must include `email` field

3. **Check health endpoint:**
   ```bash
   curl http://localhost:3001/health/config
   ```
   Should return `"status": "healthy"` with all checks passing

---

## Common Mistakes & How to Avoid Them

### ❌ Mistake 1: Wrong Column Name
```sql
-- WRONG - will fail!
INSERT INTO agency_users (agency_id, user_id, email, role)

-- CORRECT
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
```

### ❌ Mistake 2: Missing Email Field
```sql
-- WRONG - email is required!
INSERT INTO agency_users (agency_id, auth_user_id, role)

-- CORRECT - always include email
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
```

### ❌ Mistake 3: Confusing 401 and 403
```
401 = Can't authenticate (no/bad token)
403 = Authenticated but no permission (not in agency)
```
These need DIFFERENT fixes!

### ❌ Mistake 4: Not Clearing Browser Data
When testing auth changes:
```javascript
// Run in browser console:
document.cookie.split(";").forEach(c => {
  document.cookie = c.trim().split("=")[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
});
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## Health Check Endpoints

### Check Configuration
```bash
curl http://localhost:3001/health/config | jq
```

Expected response when healthy:
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

### Basic Health
```bash
curl http://localhost:3001/health
```

### Detailed Health
```bash
curl http://localhost:3001/health/detailed
```

---

## Project Structure

```
agency-studio-export/
├── backend/
│   ├── routes/
│   │   ├── health.js          # Health checks (NEW /config endpoint)
│   │   ├── auth.js             # Auth routes
│   │   └── agency.js           # Agency routes
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── agency.js           # Agency resolution
│   │   └── trial.js            # Trial status checking
│   └── services/
│       └── supabase.js         # Supabase admin client
│
├── frontend/
│   └── src/
│       └── services/
│           ├── api.js          # 🔧 TOKEN STORAGE FIX HERE
│           ├── supabase.js     # 🔧 ENV VALIDATION ADDED
│           └── cookieStorage.js # Cookie storage implementation
│
├── database/
│   ├── schema.sql              # 📋 agency_users table defined here
│   └── migrations/             # Incremental changes
│
└── AUTHENTICATION_GUIDE.md     # Full auth documentation
```

---

## Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=  # Leave empty for same-origin API
```

### Backend (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
DEFAULT_AGENCY_SLUG=fresh-test
```

---

## Testing After Auth Changes

**Before testing:**
1. Clear browser data (cookies + localStorage)
2. Restart frontend server
3. Restart backend server (if middleware changed)

**Test flow:**
1. Navigate to http://localhost:5173/login
2. Login with test credentials
3. Check browser DevTools → Console (no errors)
4. Check DevTools → Network → API requests have Authorization header
5. Check backend logs (should see 200 responses, not 401/403)
6. Test API functionality (load gallery, models, etc.)

**Health check:**
```bash
curl http://localhost:3001/health/config
# Should return "healthy"
```

---

## When User Can't Login - Step by Step

1. **Ask user to try logging in**
2. **Check backend logs** - look for the error
3. **Read the HTTP status code:**

   - **401**: Authentication failed
     - Token problem
     - Clear browser data
     - Check `/health/config`

   - **403 with "User not found in agency"**: Authorization failed
     - Get user UUID from logs
     - Run SQL to add to agency_users
     - **Use `auth_user_id` not `user_id`!**
     - Include `email` field

4. **Verify the fix:**
   ```sql
   SELECT email, a.slug, role
   FROM agency_users au
   JOIN agencies a ON au.agency_id = a.id
   WHERE email = 'user@example.com';
   ```

5. **User refreshes browser** → Should work!

---

## Documentation Files

- **AUTHENTICATION_GUIDE.md** - Complete auth troubleshooting reference
- **AUTH_FIX_IMPLEMENTATION.md** - Details of token storage fix
- **AUTH_FIX_PROOF.md** - Verification that fix is working
- **DEVELOPMENT_SETUP.md** - Full development setup guide
- **backend/.env.example** - Environment variable template

---

## Key Takeaways

🔑 **Column name is `auth_user_id` NOT `user_id`**
🔑 **401 ≠ 403 (different problems, different solutions)**
🔑 **Token storage fix is already implemented and working**
🔑 **Always include `email` when inserting into agency_users**
🔑 **Check backend logs first to identify the real issue**
🔑 **Use `/health/config` to verify environment setup**

---

**Need more details?** See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)
