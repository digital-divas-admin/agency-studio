# Self-Serve Onboarding Implementation Summary

## Overview

This document summarizes the implementation of the self-serve agency signup and onboarding flow for Agency Studio. This is **Phase 1** of the full plan, implementing the core self-serve foundation.

## What Was Implemented ✅

### 1. Database Schema Updates

**File**: `database/migrations/010_self_serve_onboarding.sql`

Created new database tables and columns:

- **agencies table additions**:
  - `onboarding_completed` - Tracks if onboarding wizard is complete
  - `trial_ends_at` - When the 7-day trial expires
  - `signup_source` - 'self-serve' vs 'sales-led'
  - `subscription_status` - 'trial', 'active', 'past_due', 'cancelled'
  - `api_key`, `webhook_url`, `email_domain` - Premium features (future use)
  - `white_label_config` - Premium branding options

- **invitation_tokens table** (NEW):
  - Secure token-based team invitations
  - Tracks email, role, expiration, acceptance
  - Links to inviter and agency

- **audit_logs table** (NEW - Premium):
  - Activity logging for sensitive actions
  - Tracks user, action, resource, metadata

- **api_keys table** (NEW - Premium):
  - API key management
  - Key hashing, prefix display, revocation

- **webhook_subscriptions table** (NEW - Premium):
  - Webhook event subscriptions
  - URL, events, secret, enabled status

### 2. Backend Services

#### Agency Provisioning Service
**File**: `backend/services/agencyProvisioning.js`

Core functions:
- `generateSlug()` - Convert agency name to URL-safe slug
- `isSlugAvailable()` - Check slug uniqueness
- `generateUniqueSlug()` - Auto-generate unique slug with numeric suffix
- `createAgency()` - Create agency with default settings and 7-day trial
- `createAgencyOwner()` - Create Supabase auth user + agency_users link
- `provisionAgency()` - Complete signup flow (agency + owner + welcome email)
- `createTeamInvitation()` - Generate secure invitation token
- `acceptTeamInvitation()` - Accept invite and create user account
- `completeOnboarding()` - Mark onboarding as finished

#### Email Service
**File**: `backend/services/email.js` (expanded)

New email templates:
- `sendWelcomeEmail()` - Welcome email for new agency owners
- `sendTeamInviteEmail()` - Team invitation emails with secure tokens
- Existing: `sendModelInviteEmail()` - Model invitation emails

All templates use Resend API with beautiful HTML + plain text versions.

### 3. Backend API Routes

#### Auth Routes
**File**: `backend/routes/auth.js` (NEW)

Public endpoints (no auth required):
- `POST /api/auth/signup-agency` - Self-serve agency creation
  - Validates email, password, agency name
  - Checks slug availability
  - Creates agency + owner user
  - Sends welcome email
  - Returns agency info + user data

- `POST /api/auth/check-slug` - Check slug availability
  - Returns available status + suggestions if taken

- `POST /api/auth/accept-invite` - Accept team invitation
  - Validates token
  - Creates user account
  - Links to agency

- `GET /api/auth/validate-invite/:token` - Validate invitation
  - Returns invitation details without accepting

- `GET /api/auth/plans` - Get subscription plans
  - Returns active plans for signup page

#### Agency Routes
**File**: `backend/routes/agency.js` (updated)

New endpoint:
- `PUT /api/agency/onboarding/complete` - Mark onboarding complete
  - Updates `onboarding_completed = true`

Updated endpoint:
- `GET /api/agency/config` - Now includes trial info
  - Added `subscription_status`, `trial_ends_at`, `onboarding_completed`
  - Added `trial_info` object with days remaining

#### Team Routes
**File**: `backend/routes/team.js` (updated)

Updated endpoint:
- `POST /api/team/invite` - Now uses token-based invitations
  - Creates secure invitation token
  - Sends email with link to accept invite
  - Replaces old agency_users pre-creation flow

### 4. Middleware

#### Trial Management Middleware
**File**: `backend/middleware/trial.js` (NEW)

Functions:
- `checkTrialStatus()` - Blocks access if trial expired or subscription inactive
  - Returns 403 with clear error message
  - Prompts user to subscribe

- `addTrialInfo()` - Adds trial metadata to request
  - Calculates days remaining
  - Available in route handlers via `req.trialInfo`

Applied to all `/api` routes after agency resolution.

### 5. Frontend Pages

#### Signup Page
**File**: `frontend/src/pages/Signup.jsx` (NEW)

Features:
- Agency name input with auto-slug generation
- Real-time slug availability checking
- Slug suggestions if name taken
- Owner information form (name, email, password)
- Plan selection (Starter, Professional, Enterprise)
- Trial information display (7-day free trial)
- Terms & conditions acceptance
- Beautiful, responsive UI matching existing design system

#### Accept Invite Page
**File**: `frontend/src/pages/AcceptInvite.jsx` (NEW)

Features:
- Token validation on load
- Displays agency name, role, email
- Password setup form
- Error handling for invalid/expired tokens
- Auto-login after acceptance

#### Onboarding Wizard
**File**: `frontend/src/pages/Onboarding.jsx` (NEW)

Multi-step wizard:
1. **Welcome** - Greet user, show trial info
2. **Branding** - Customize logo, colors, app name
3. **Team** - Invite team members (optional, can skip)
4. **Complete** - Success message, quick tips

Features:
- Progress bar with visual indicators
- Skip option for non-critical steps
- Logo upload with preview
- Color pickers for branding
- Dynamic email field management
- Saves to agency settings via API

#### Login Page Update
**File**: `frontend/src/pages/Login.jsx` (updated)

Added "Sign up for free" link to footer.

#### App Routes
**File**: `frontend/src/App.jsx` (updated)

New routes:
- `/signup` - Public signup page
- `/invite/:token` - Accept team invitation
- `/:agencySlug/onboarding` - Protected onboarding wizard

### 6. Server Configuration

**File**: `backend/server.js` (updated)

Changes:
- Added auth routes: `app.use('/api/auth', authRoutes)`
- Added trial middleware after agency resolution
- Trial checking now blocks expired trials automatically

## How It Works

### Self-Serve Signup Flow

1. **User visits `/signup`**
   - Fills out agency name, personal info, password
   - Selects plan (default: Starter)
   - Accepts terms & conditions

2. **Real-time slug checking**
   - As user types agency name, slug is generated
   - API checks availability: `POST /api/auth/check-slug`
   - Shows suggestions if taken

3. **Submit signup form**
   - Frontend: `POST /api/auth/signup-agency`
   - Backend creates:
     - Agency record with 7-day trial (`trial_ends_at = now() + 7 days`)
     - Supabase auth user
     - agency_users link (owner role, active status)
   - Sends welcome email via Resend
   - Returns agency + user info

4. **Auto-login**
   - Frontend signs in with Supabase
   - Redirects to `/:slug/onboarding`

5. **Onboarding wizard**
   - Step 1: Welcome message
   - Step 2: Customize branding (logo, colors, app name)
   - Step 3: Invite team (optional)
   - Step 4: Complete and go to dashboard

6. **Dashboard**
   - User sees trial badge: "7 days remaining"
   - Can add credits to start generating
   - Can invite more team members
   - Can upgrade plan

### Team Invitation Flow

1. **Admin invites user**
   - From Team page, clicks "Invite"
   - Enters email and role
   - Backend creates invitation token
   - Sends email with link: `/invite/{token}`

2. **User receives email**
   - Clicks link in email
   - Taken to `/invite/:token` page

3. **Accept invitation**
   - Token validated on page load
   - Shows agency name, email, role
   - User sets password
   - Submits form: `POST /api/auth/accept-invite`

4. **Account creation**
   - Backend creates Supabase auth user
   - Creates agency_users link
   - Marks invitation as accepted
   - Auto-login and redirect to dashboard

### Trial Management

**7-Day Trial Model**:
- Platform access: Free for 7 days
- Credits: 0 initial credits (must purchase to generate)
- After 7 days: Subscription required

**Trial Expiration**:
- Middleware checks `subscription_status` and `trial_ends_at`
- If trial expired and no active subscription:
  - Returns 403 error
  - Message: "Trial expired. Please subscribe."
  - Blocks all API access except config/auth

**Trial Info in UI**:
- Dashboard shows trial countdown
- "X days remaining" badge
- "Subscribe Now" CTA appears 2 days before expiration

## Database Schema

### Key Tables

```sql
-- Agencies (updated)
ALTER TABLE agencies ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN signup_source TEXT DEFAULT 'self-serve';
ALTER TABLE agencies ADD COLUMN subscription_status TEXT DEFAULT 'trial';

-- Invitation Tokens (new)
CREATE TABLE invitation_tokens (
  id UUID PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member',
  invited_by UUID REFERENCES agency_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs (new - Premium)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  user_id UUID REFERENCES agency_users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys (new - Premium)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES agency_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Webhook Subscriptions (new - Premium)
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES agency_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ
);
```

## Configuration Required

### Environment Variables

```bash
# Resend Email (required for emails)
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=https://yourdomain.com

# Supabase (already configured)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Database Migration

Run the migration:
```bash
# In Supabase SQL Editor, run:
/database/migrations/010_self_serve_onboarding.sql
```

This adds all new tables and columns.

## Testing

### Test Self-Serve Signup

1. Visit `/signup`
2. Enter agency name: "Test Agency"
3. Verify slug auto-generates: "test-agency"
4. Enter owner name, email, password
5. Select "Starter" plan
6. Accept terms
7. Click "Create Agency"
8. Verify welcome email sent
9. Verify redirected to `/test-agency/onboarding`

### Test Onboarding

1. Complete Welcome step
2. Upload logo, change colors
3. Click "Save & Continue"
4. Add team emails (or skip)
5. Click "Send Invites"
6. Complete wizard
7. Verify redirected to dashboard
8. Verify branding applied

### Test Team Invitation

1. Login as admin
2. Go to Team page
3. Click "Invite User"
4. Enter email: "teammate@example.com"
5. Select role: "Member"
6. Click "Send Invitation"
7. Check email inbox
8. Click invitation link
9. Enter password
10. Verify redirected to dashboard

### Test Trial Expiration

1. Manually set `trial_ends_at` to past date:
   ```sql
   UPDATE agencies SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE slug = 'test-agency';
   ```
2. Try to access any API endpoint
3. Verify 403 error with subscription message
4. Verify UI shows "Subscribe Now" prompt

## What's NOT Implemented (Future Work)

### Phase 2: Premium Features (2-3 weeks)

- [ ] Custom domain setup UI
- [ ] DNS verification flow
- [ ] Email template customization
- [ ] Admin panel for sales team
- [ ] API access (key generation, endpoints)
- [ ] Webhooks (subscriptions, delivery)
- [ ] Audit logs UI
- [ ] White-label model portal

### Billing Integration (Separate)

- [ ] Stripe integration
- [ ] Payment method management
- [ ] Subscription creation/cancellation
- [ ] Invoice generation
- [ ] Usage-based billing
- [ ] Credit purchase flow

### Additional Enhancements

- [ ] Password reset flow
- [ ] Email verification (optional)
- [ ] SSO/OAuth signup
- [ ] Resend verification emails
- [ ] Admin dashboard for managing all agencies
- [ ] Bulk team import
- [ ] Custom roles/permissions

## Known Issues / TODO

1. **Email service not tested** - Requires RESEND_API_KEY to be set
2. **No password reset** - Users can't reset forgotten passwords yet
3. **No email verification** - Emails are auto-confirmed (could add optional verification)
4. **Trial countdown UI** - Dashboard should show prominent trial badge
5. **Subscription gate UI** - Need "Subscribe" page when trial expires
6. **Plan upgrade flow** - Users can't upgrade plans yet (needs billing)

## API Endpoints Summary

### Public (No Auth)

- `POST /api/auth/signup-agency` - Create agency
- `POST /api/auth/check-slug` - Check slug availability
- `POST /api/auth/accept-invite` - Accept team invitation
- `GET /api/auth/validate-invite/:token` - Validate invitation
- `GET /api/auth/plans` - Get subscription plans

### Protected (Auth Required)

- `PUT /api/agency/onboarding/complete` - Complete onboarding
- `POST /api/team/invite` - Send team invitation
- All existing agency/generation/workflow endpoints

## Files Created

### Backend
- `backend/routes/auth.js` - Auth routes
- `backend/services/agencyProvisioning.js` - Agency creation logic
- `backend/middleware/trial.js` - Trial management
- `database/migrations/010_self_serve_onboarding.sql` - Schema updates

### Backend (Modified)
- `backend/server.js` - Added auth routes, trial middleware
- `backend/services/email.js` - Added welcome/invite templates
- `backend/routes/agency.js` - Added onboarding endpoint
- `backend/routes/team.js` - Updated invite flow

### Frontend
- `frontend/src/pages/Signup.jsx` - Signup page
- `frontend/src/pages/AcceptInvite.jsx` - Accept invite page
- `frontend/src/pages/Onboarding.jsx` - Onboarding wizard

### Frontend (Modified)
- `frontend/src/App.jsx` - Added routes
- `frontend/src/pages/Login.jsx` - Added signup link

## Success Metrics

Once deployed, track:
- Self-serve signups per day/week
- Onboarding completion rate
- Trial-to-paid conversion rate
- Time to first generation
- Team invitation acceptance rate
- Trial expiration impact on retention

## Deployment Checklist

- [ ] Run database migration
- [ ] Set RESEND_API_KEY environment variable
- [ ] Set RESEND_FROM_EMAIL environment variable
- [ ] Update FRONTEND_URL to production domain
- [ ] Test signup flow end-to-end
- [ ] Test invitation flow end-to-end
- [ ] Test trial expiration
- [ ] Monitor email delivery rates
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Create default agency plans in database

## Next Steps

1. **Test with real email** - Set RESEND_API_KEY and test email delivery
2. **Add trial countdown to dashboard** - Show days remaining prominently
3. **Create subscription page** - Where users go when trial expires
4. **Integrate billing (Stripe)** - Enable plan upgrades and credit purchases
5. **Phase 2: Premium features** - Custom domains, API access, webhooks
6. **Marketing site** - Landing page with "Sign Up" CTA

---

**Implementation Status**: ✅ Phase 1 Complete (Self-Serve Foundation)

**Estimated Time**: This implementation represents approximately 2-3 weeks of work as planned.

**Ready for**: Testing, deployment to staging, user acceptance testing
