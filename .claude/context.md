# Agency Studio - Claude Project Context

## 🚨 CRITICAL: Authentication Knowledge

### Issue 1: 401 vs 403 Errors - Know the Difference!

**401 Unauthorized** = Authentication failed (token problem)
**403 Forbidden** = Authenticated but not authorized (user not in agency)

**DO NOT confuse these!** They require different fixes.

### Issue 2: Database Column Names - CRITICAL!

The `agency_users` table uses:
- ✅ `auth_user_id` (links to auth.users.id)
- ❌ NOT `user_id` (does not exist!)

**Always use `auth_user_id` when writing SQL for agency_users table.**

### Issue 3: Token Storage (FIXED)

**Problem**: Supabase stores tokens in cookies, but API was reading from localStorage.

**Solution**: `frontend/src/services/api.js` has `getAuthToken()` function that:
1. Reads from cookies FIRST (where Supabase stores tokens)
2. Falls back to localStorage for backward compatibility

**Status**: ✅ Fixed and verified working

### Common SQL for User Setup

```sql
-- Add user to agency (CORRECT column names!)
INSERT INTO agency_users (agency_id, auth_user_id, email, role)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'agency-slug'),
  'user-uuid-from-auth.users',
  'user@example.com',
  'owner'
)
ON CONFLICT (auth_user_id) DO UPDATE
  SET role = EXCLUDED.role,
      agency_id = EXCLUDED.agency_id;
```

### Quick Troubleshooting

1. **User can't login / 401 errors**:
   - Check token storage (should be in cookies)
   - Clear browser data and retry
   - Check `/health/config` endpoint

2. **User gets 403 "not found in agency"**:
   - User exists in auth.users but not in agency_users
   - Run SQL to add them (use `auth_user_id` not `user_id`)
   - Must include `email` field

3. **SQL errors about user_id**:
   - You used `user_id` instead of `auth_user_id`
   - Fix: Replace `user_id` with `auth_user_id`

### Health Check Endpoints

```bash
# Check all config is valid
curl http://localhost:3001/health/config

# Should return "healthy" with all checks passing
```

### Documentation

Full details in: [AUTHENTICATION_GUIDE.md](../AUTHENTICATION_GUIDE.md)

---

## Project Structure

```
agency-studio-export/
├── backend/              # Express.js API
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, agency resolution, validation
│   └── services/        # Business logic
├── frontend/            # React + Vite
│   └── src/
│       └── services/    # API client, Supabase (auth fixed here)
└── database/
    ├── schema.sql       # Base schema (agency_users defined here)
    └── migrations/      # Incremental changes
```

---

## Key Files for Auth

- `frontend/src/services/api.js` - Token storage fix (getAuthToken function)
- `frontend/src/services/supabase.js` - Supabase client, env validation
- `backend/routes/health.js` - Health check endpoints including /config
- `backend/middleware/auth.js` - JWT verification
- `backend/middleware/agency.js` - Agency resolution
- `database/schema.sql` - agency_users table definition

---

## Environment Setup

### Required Frontend Env (.env)
```env
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=  # Leave empty for same-origin
```

### Required Backend Env (.env)
```env
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

---

## Testing Checklist

After making auth changes:
1. ✅ Clear browser cookies/localStorage
2. ✅ Restart frontend server
3. ✅ Login at http://localhost:5173/login
4. ✅ Check DevTools → Network → Authorization header present
5. ✅ Check backend logs for 200 responses (not 401/403)
6. ✅ Run curl http://localhost:3001/health/config

---

## Common Mistakes to Avoid

❌ Using `user_id` instead of `auth_user_id`
❌ Forgetting to include `email` in agency_users INSERT
❌ Confusing 401 (auth) with 403 (authorization)
❌ Not clearing browser data when testing auth changes
❌ Not checking backend logs to see actual error

---

**Remember**: When in doubt about auth issues, check [AUTHENTICATION_GUIDE.md](../AUTHENTICATION_GUIDE.md)!
