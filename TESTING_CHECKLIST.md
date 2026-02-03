# Team Permissions Implementation - Testing Checklist

## Pre-Testing Setup

### 1. Apply Database Migration
```bash
cd /Users/macmini1/vixxxen/agency-studio-export

# Backup database first (IMPORTANT!)
# Connect to your Supabase project and create a backup

# Apply migration
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres < database/migrations/011_team_permissions.sql

# Or via Supabase SQL Editor:
# Copy and paste the contents of database/migrations/011_team_permissions.sql
```

### 2. Restart Backend Server
```bash
cd backend
npm run dev
```

### 3. Restart Frontend Server
```bash
cd frontend
npm run dev
```

---

## Testing Phase 1: Admin Invitation Flow

### ✅ Test 1.1: Invite with Custom Message
**Steps:**
1. Login as admin/owner
2. Navigate to Team page (`/admin/team`)
3. Click "Invite User"
4. Fill in:
   - Email: test-member@example.com
   - Role: Member
   - Custom Message: "Welcome! You'll be managing Sofia's account."
   - Assign Creators: Select "Sofia" (or any available model)
5. Click "Send Invitation"

**Expected:**
- ✅ Success message shown
- ✅ Email sent to test-member@example.com with custom message
- ✅ Invitation appears in "Pending Invites" tab
- ✅ Activity log shows "invite_sent" entry

### ✅ Test 1.2: Resend Expired Invite
**Steps:**
1. Go to "Pending Invites" tab
2. Find an invitation (or wait for it to expire, or manually expire in DB)
3. Click "Resend" button

**Expected:**
- ✅ New email sent
- ✅ Expiry date extended to 7 days from now
- ✅ Activity log shows "invite_resent"

### ✅ Test 1.3: Revoke Pending Invite
**Steps:**
1. Go to "Pending Invites" tab
2. Click "Revoke" on an invitation
3. Confirm the action

**Expected:**
- ✅ Invitation removed from list
- ✅ Activity log shows "invite_revoked"
- ✅ Token no longer works (test by trying to accept it)

---

## Testing Phase 2: Team Member Onboarding

### ✅ Test 2.1: Accept Invitation
**Steps:**
1. Open invitation email
2. Click "Accept Invitation" link
3. Fill in name and password
4. Submit form

**Expected:**
- ✅ Account created successfully
- ✅ Redirected to `/onboarding` page
- ✅ NOT redirected to dashboard immediately

### ✅ Test 2.2: First Login Onboarding
**Steps:**
1. On onboarding page, verify displayed information

**Expected:**
- ✅ User's name displayed
- ✅ Role shown (Member)
- ✅ "Assigned Creators Only" shown if scope is 'assigned'
- ✅ List of assigned creators displayed with avatars
- ✅ Permissions shown with checkmarks/X marks
- ✅ Can click "Get Started" to proceed to dashboard

### ✅ Test 2.3: No Duplicate Onboarding
**Steps:**
1. After completing onboarding, logout
2. Login again

**Expected:**
- ✅ Goes directly to dashboard
- ✅ Onboarding NOT shown again

---

## Testing Phase 3: Permission Management

### ✅ Test 3.1: Edit User Permissions
**Steps:**
1. As admin, go to Team page
2. Click "Edit Permissions" (gear icon) on a member
3. Change permissions:
   - Toggle "View Analytics" to ON
   - Toggle "Publish Content" to OFF
   - Change scope to "Assigned Creators Only"
4. Click "Save Changes"

**Expected:**
- ✅ Modal closes
- ✅ Success message shown
- ✅ User's permissions updated in backend
- ✅ Activity log shows "permissions_updated"
- ✅ Member sees updated permissions on next login

### ✅ Test 3.2: Assign Creators to User
**Steps:**
1. As admin, click "Assign Creators" (users icon) on a member
2. Select 2-3 creators from the list
3. Click "Save Assignments"

**Expected:**
- ✅ Modal closes
- ✅ Success message shown
- ✅ Team list shows assigned creator avatars
- ✅ Activity log shows "models_assigned"

### ✅ Test 3.3: Remove Creator Assignments
**Steps:**
1. Click "Assign Creators" on same member
2. Uncheck all creators
3. Save

**Expected:**
- ✅ "None" shown in team list for assigned creators
- ✅ Activity log shows "models_unassigned"

---

## Testing Phase 4: Permission Enforcement

### ✅ Test 4.1: Model Access Restriction
**Steps:**
1. Login as member with only 1 creator assigned (e.g., "Sofia")
2. Check sidebar model selector

**Expected:**
- ✅ Only shows "Sofia" in dropdown
- ✅ Does NOT show other creators

### ✅ Test 4.2: Navigation Filtering
**Steps:**
1. As restricted member, navigate through the app

**Expected:**
- ✅ Can only select assigned creator from model dropdown
- ✅ Attempts to access unassigned creator show "Access Denied" message
- ✅ NO silent redirects or console errors

### ✅ Test 4.3: Analytics Permission Check
**Steps:**
1. Login as member WITHOUT `can_view_analytics`
2. Try to access analytics/usage pages

**Expected:**
- ✅ Access denied message shown
- ✅ OR analytics features hidden/disabled

### ✅ Test 4.4: Upload Permission Check
**Steps:**
1. Login as member WITHOUT `can_upload_content`
2. Navigate to Gallery

**Expected:**
- ✅ Upload button hidden or disabled
- ✅ API rejects upload attempts with 403 error

---

## Testing Phase 5: Team Page Features

### ✅ Test 5.1: Tabs Functionality
**Steps:**
1. As admin, go to Team page
2. Click each tab: Team, Pending Invites, Activity Log

**Expected:**
- ✅ All tabs load correctly
- ✅ Content switches appropriately
- ✅ Counts shown in tab labels are accurate

### ✅ Test 5.2: Search Team Members
**Steps:**
1. On Team tab, type in search box

**Expected:**
- ✅ Filters team list in real-time
- ✅ Searches by name, email, and role

### ✅ Test 5.3: Quick Actions
**Steps:**
1. Hover over action buttons for each user
2. Verify tooltips

**Expected:**
- ✅ Edit Permissions button visible
- ✅ Assign Creators button visible
- ✅ Suspend/Activate button visible
- ✅ Remove button visible
- ✅ Owner row has NO action buttons

### ✅ Test 5.4: Activity Log Display
**Steps:**
1. Go to Activity Log tab
2. Verify recent activities

**Expected:**
- ✅ Shows all team actions chronologically
- ✅ Displays actor name, action, target user
- ✅ Shows timestamps in readable format

---

## Testing Phase 6: Edge Cases & Security

### ✅ Test 6.1: Cannot Modify Owner
**Steps:**
1. As admin, try to edit owner's permissions or remove them

**Expected:**
- ✅ Owner row has no action buttons
- ✅ API rejects any attempts to modify owner

### ✅ Test 6.2: Custom Message Length Limit
**Steps:**
1. Try to invite with a message > 500 characters

**Expected:**
- ✅ Character counter turns red
- ✅ Submit button disabled
- ✅ Error shown if somehow submitted

### ✅ Test 6.3: Invalid Model IDs
**Steps:**
1. Try to assign a model that doesn't belong to agency (via API)

**Expected:**
- ✅ API returns 400 error
- ✅ Assignment rejected

### ✅ Test 6.4: Expired Token Handling
**Steps:**
1. Try to accept an invitation with expired token

**Expected:**
- ✅ "Invalid or expired invitation" message
- ✅ Cannot create account
- ✅ Can request resend from admin

---

## Testing Phase 7: User Experience

### ✅ Test 7.1: Loading States
**Steps:**
1. Navigate to Team page
2. Watch for loading indicators

**Expected:**
- ✅ Shows spinner while fetching team
- ✅ Shows "Loading invitations..." in Pending Invites tab
- ✅ Shows "Loading activity..." in Activity Log tab

### ✅ Test 7.2: Empty States
**Steps:**
1. Check each tab when empty

**Expected:**
- ✅ Team tab shows "No team members yet" when empty
- ✅ Pending Invites shows "No pending invitations"
- ✅ Activity Log shows "No activity recorded yet"
- ✅ All empty states have helpful icons

### ✅ Test 7.3: Error Handling
**Steps:**
1. Disconnect backend
2. Try to perform actions

**Expected:**
- ✅ Friendly error messages shown
- ✅ No crashes or white screens
- ✅ Console errors logged for debugging

---

## Testing Phase 8: Cross-Browser & Responsive

### ✅ Test 8.1: Mobile View
**Steps:**
1. Resize browser to mobile width
2. Test all modals and tables

**Expected:**
- ✅ Team table scrolls horizontally or stacks appropriately
- ✅ Modals fit on screen
- ✅ Buttons and text readable

### ✅ Test 8.2: Different Browsers
**Steps:**
1. Test in Chrome, Firefox, Safari

**Expected:**
- ✅ All features work consistently
- ✅ Styling looks correct

---

## Performance Testing

### ✅ Test P.1: Team Page Load Time
**Expected:**
- ✅ Initial load < 500ms
- ✅ Tab switching < 200ms
- ✅ Modal opening instant

### ✅ Test P.2: Large Team Lists
**Steps:**
1. Test with 20+ team members

**Expected:**
- ✅ No performance degradation
- ✅ Search still fast
- ✅ No memory leaks

---

## Final Verification

### ✅ Complete E2E Flow
**Steps:**
1. Admin creates invite with custom message and assigned creators
2. Member receives email and accepts
3. Member sees onboarding with correct info
4. Member can only access assigned creators
5. Admin changes permissions
6. Member's permissions update correctly
7. Activity log shows all actions

**Expected:**
- ✅ Everything works end-to-end without errors
- ✅ Data persists correctly
- ✅ No security vulnerabilities

---

## Rollback Plan (If Critical Issues Found)

```sql
-- If needed, temporarily disable new features:

-- 1. Allow NULL permissions
ALTER TABLE agency_users ALTER COLUMN permissions DROP NOT NULL;

-- 2. Set all users to 'all' scope temporarily
UPDATE agency_users SET permissions = jsonb_set(
  permissions,
  '{scope}',
  '"all"'::jsonb
) WHERE permissions->>'scope' = 'assigned';

-- 3. Can drop new tables if absolutely necessary (LAST RESORT)
-- DROP TABLE team_activity_log;
-- DROP TABLE user_model_assignments;
```

---

## Post-Testing Cleanup

- [ ] Remove test user accounts
- [ ] Clear test invitation tokens
- [ ] Review activity logs for anomalies
- [ ] Document any bugs found
- [ ] Create tickets for any issues

---

## Success Criteria

✅ All tests pass
✅ No console errors
✅ No security vulnerabilities
✅ Performance acceptable
✅ User experience smooth
✅ Documentation complete

---

**Date:** 2026-02-03
**Tester:** _____________
**Status:** _____________
