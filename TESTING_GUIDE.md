# Self-Serve Onboarding - Testing Guide

## Prerequisites

1. **Database Migration**
   ```bash
   # Run in Supabase SQL Editor
   # Execute: database/migrations/010_self_serve_onboarding.sql
   ```

2. **Environment Variables**
   ```bash
   # Required for email functionality
   RESEND_API_KEY=re_xxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   FRONTEND_URL=http://localhost:5173  # or your frontend URL
   ```

3. **Seed Data** (if needed)
   ```bash
   # Make sure agency_plans table has plans
   # The migration doesn't create them, schema.sql does
   # Check: SELECT * FROM agency_plans;
   ```

## Test Scenarios

### 1. Self-Serve Signup (Happy Path)

**Steps**:
1. Navigate to `http://localhost:5173/signup`
2. Fill out form:
   - Agency Name: "Test Studios"
   - Full Name: "John Doe"
   - Email: "john@teststudios.com"
   - Password: "Password123!"
   - Confirm Password: "Password123!"
   - Plan: Select "Starter"
3. Accept Terms & Conditions
4. Click "Create Agency"

**Expected**:
- Slug auto-generates as you type: "test-studios"
- Slug availability check shows green checkmark
- Form submits successfully
- Welcome email sent to john@teststudios.com
- Auto-login and redirect to `/test-studios/onboarding`

**Verify in Database**:
```sql
-- Check agency created
SELECT * FROM agencies WHERE slug = 'test-studios';
-- Should show: trial_ends_at = now() + 7 days, onboarding_completed = false

-- Check user created
SELECT * FROM agency_users WHERE email = 'john@teststudios.com';
-- Should show: role = 'owner', status = 'active'

-- Check Supabase Auth
SELECT * FROM auth.users WHERE email = 'john@teststudios.com';
```

### 2. Slug Validation

**Test Duplicate Slug**:
1. Try to sign up with agency name "Test Studios" again
2. Slug should show as "test-studios" but with red X (not available)
3. Suggestions should appear: "test-studios-1", "test-studios-2", etc.
4. Cannot submit until unique slug chosen

**Test Manual Slug Check**:
```bash
curl -X POST http://localhost:3000/api/auth/check-slug \
  -H "Content-Type: application/json" \
  -d '{"agencyName": "Test Studios"}'

# Response:
{
  "slug": "test-studios",
  "available": false,
  "suggestions": ["test-studios-1", "test-studios-2", ...]
}
```

### 3. Onboarding Wizard

**Steps**:
1. After signup, should be on `/test-studios/onboarding`
2. **Step 1: Welcome**
   - See welcome message with agency name
   - See trial info: "7-Day Free Trial"
   - Click "Get Started"

3. **Step 2: Branding**
   - Change App Name: "Test Studios Pro"
   - Upload logo (PNG/JPG, < 2MB)
   - Change primary color: #FF6B6B
   - Change secondary color: #4ECDC4
   - Click "Save & Continue"

4. **Step 3: Team** (optional)
   - Add email: "teammate@teststudios.com"
   - Click "Add Another Email"
   - Add email: "admin@teststudios.com"
   - Click "Send Invites"

5. **Step 4: Complete**
   - See success message
   - See quick tips
   - Click "Go to Dashboard"

**Expected**:
- Progress bar updates at each step
- Branding saves correctly
- Invitation emails sent
- Redirected to dashboard at end
- `onboarding_completed = true` in database

**Verify**:
```sql
-- Check onboarding completed
SELECT onboarding_completed, settings FROM agencies WHERE slug = 'test-studios';

-- Check branding saved
SELECT settings->'branding' FROM agencies WHERE slug = 'test-studios';

-- Check invitations created
SELECT * FROM invitation_tokens WHERE agency_id = (SELECT id FROM agencies WHERE slug = 'test-studios');
```

### 4. Team Invitation Flow

**Send Invitation**:
1. Login as john@teststudios.com
2. Go to Team page
3. Click "Invite User"
4. Email: "newuser@teststudios.com"
5. Role: "Member"
6. Click "Send Invitation"

**Expected**:
- Success message
- Email sent to newuser@teststudios.com
- Invitation token created in database

**Accept Invitation**:
1. Check email (or get token from database)
2. Visit: `http://localhost:5173/invite/{token}`
3. See agency name, email, role
4. Enter:
   - Full Name: "Jane Smith"
   - Password: "Password123!"
   - Confirm Password: "Password123!"
5. Click "Accept Invitation & Join"

**Expected**:
- Account created
- Auto-login
- Redirected to `/test-studios` (dashboard)
- Can see agency content

**Verify**:
```sql
-- Check user created
SELECT * FROM agency_users WHERE email = 'newuser@teststudios.com';
-- Should show: role = 'member', status = 'active'

-- Check invitation accepted
SELECT * FROM invitation_tokens WHERE email = 'newuser@teststudios.com';
-- Should show: accepted_at IS NOT NULL
```

### 5. Trial Management

**Test Trial Info**:
1. Login to dashboard
2. Check agency config:
```bash
curl http://localhost:3000/api/agency/config \
  -H "X-Agency-Slug: test-studios"
```

**Expected Response**:
```json
{
  "subscription_status": "trial",
  "trial_ends_at": "2026-02-09T...",
  "trial_info": {
    "is_trial": true,
    "days_remaining": 7,
    "expired": false
  }
}
```

**Test Trial Expiration**:
1. Set trial to expired:
```sql
UPDATE agencies
SET trial_ends_at = NOW() - INTERVAL '1 day'
WHERE slug = 'test-studios';
```

2. Try to access any API endpoint:
```bash
curl http://localhost:3000/api/agency/me \
  -H "X-Agency-Slug: test-studios" \
  -H "Authorization: Bearer {token}"
```

**Expected Response**:
```json
{
  "error": "Trial expired",
  "message": "Your trial period has ended. Please subscribe to continue using the platform.",
  "subscription_required": true
}
```

3. Restore trial:
```sql
UPDATE agencies
SET trial_ends_at = NOW() + INTERVAL '7 days'
WHERE slug = 'test-studios';
```

### 6. Error Handling

**Test Email Already Exists**:
```bash
curl -X POST http://localhost:3000/api/auth/signup-agency \
  -H "Content-Type: application/json" \
  -d '{
    "agencyName": "Another Studio",
    "ownerName": "John Doe",
    "email": "john@teststudios.com",
    "password": "Password123!"
  }'
```

**Expected**: 409 Conflict
```json
{
  "error": "An account with this email already exists"
}
```

**Test Invalid Token**:
```bash
curl http://localhost:3000/api/auth/validate-invite/invalid-token
```

**Expected**: 404 Not Found
```json
{
  "error": "Invalid invitation token"
}
```

**Test Expired Token**:
1. Create invitation
2. Manually expire it:
```sql
UPDATE invitation_tokens
SET expires_at = NOW() - INTERVAL '1 day'
WHERE token = 'your-token-here';
```
3. Try to validate

**Expected**: 400 Bad Request
```json
{
  "error": "This invitation has expired"
}
```

### 7. Email Testing

**Test Welcome Email**:
1. Sign up new agency
2. Check email inbox (or Resend dashboard)
3. Verify email contains:
   - Agency name
   - Owner name
   - Trial info (7 days)
   - Link to dashboard
   - Quick start guide

**Test Team Invite Email**:
1. Send team invitation
2. Check email inbox
3. Verify email contains:
   - Agency name
   - Inviter name
   - Role (Member/Admin)
   - Invitation link
   - Expiration date (7 days from now)

**Mock Email Testing** (without Resend):
If RESEND_API_KEY is not set:
- Email functions will throw error
- Check server logs for error messages
- Use console.log to debug email content

### 8. Plan Selection

**Test Different Plans**:
1. Sign up with "Professional" plan
2. Verify in database:
```sql
SELECT a.name, a.slug, p.name as plan_name, p.monthly_credits, p.max_users
FROM agencies a
JOIN agency_plans p ON a.plan_id = p.id
WHERE a.slug = 'your-slug';
```

3. Check that:
   - `monthly_credit_allocation` matches plan
   - `credit_pool` is 0 (no initial credits)

### 9. User Limit Enforcement

**Test User Limit**:
1. Create agency with Starter plan (5 users max)
2. Invite 4 users (total 5 including owner)
3. Try to invite 6th user

**Expected**: 403 Forbidden
```json
{
  "error": "User limit reached",
  "message": "Your plan allows 5 users. Please upgrade to add more."
}
```

### 10. Integration Testing

**Full End-to-End Flow**:
1. Sign up → Onboarding → Dashboard
2. Invite teammate → They accept
3. Upload model
4. Purchase credits (when billing implemented)
5. Generate content
6. Verify credits deducted
7. Check trial countdown in UI

## Manual Testing Checklist

- [ ] Self-serve signup works
- [ ] Slug generation is correct
- [ ] Slug validation prevents duplicates
- [ ] Welcome email sent
- [ ] Onboarding wizard completes
- [ ] Branding saves correctly
- [ ] Team invitations sent
- [ ] Invitation acceptance works
- [ ] Trial info displays in UI
- [ ] Trial expiration blocks access
- [ ] Plan selection works
- [ ] User limits enforced
- [ ] Error messages are clear
- [ ] Navigation flows correctly
- [ ] Auto-login works after signup/accept

## Automated Testing (Future)

Create tests for:
- API endpoint responses
- Database transactions
- Email template rendering
- Token generation/validation
- Trial expiration logic
- Slug generation uniqueness

## Common Issues

### Issue: Slug always shows as taken
- Check database for existing agencies
- Clear test data: `DELETE FROM agencies WHERE slug LIKE 'test%'`

### Issue: Email not sending
- Verify RESEND_API_KEY is set
- Check Resend dashboard for errors
- Check server logs for error messages
- Test with curl to isolate frontend issues

### Issue: Onboarding doesn't redirect
- Check browser console for errors
- Verify agency slug in URL
- Check if user is authenticated
- Verify onboarding_completed flag

### Issue: Trial not enforcing
- Check trial_ends_at is in past
- Verify middleware is applied
- Check server logs for middleware execution
- Test API directly with curl

### Issue: Invitation link broken
- Verify frontend route exists: `/invite/:token`
- Check token format in email
- Test token validation endpoint first
- Check invitation_tokens table for record

## Database Cleanup

After testing, clean up test data:

```sql
-- Delete test agencies (cascades to users, invitations, etc.)
DELETE FROM agencies WHERE slug LIKE 'test%';

-- Or delete specific agency
DELETE FROM agencies WHERE slug = 'test-studios';

-- Clean up orphaned Supabase auth users
-- (requires admin access to auth.users)
```

## Performance Testing

Test with:
- 100 concurrent signups
- 1000 slug availability checks
- 50 invitation emails at once
- Database query performance on large datasets

## Security Testing

Verify:
- SQL injection protection (use parameterized queries)
- XSS protection (sanitize inputs)
- CSRF protection (use CORS properly)
- Rate limiting on signup endpoint
- Password strength enforcement
- Token expiration enforcement
- Email validation
- Role-based access control

---

**Testing Status**: Ready for QA

**Next Steps**:
1. Run through all scenarios
2. Fix any issues found
3. Deploy to staging
4. User acceptance testing
5. Production deployment
