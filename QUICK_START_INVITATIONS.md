# Quick Start: Model Invitations

## 3-Step Setup

### 1. Run Database Migration

```bash
cd /Users/macmini1/vixxxen/agency-studio-export/database
node run-migration.js 008_model_invitations.sql
```

**If migration script fails**, run SQL directly in Supabase:
1. Open: https://app.supabase.com/project/YOUR_PROJECT/editor
2. Copy all content from `database/migrations/008_model_invitations.sql`
3. Paste and execute in SQL editor

### 2. Configure Resend API Key

Get your API key from https://resend.com/api-keys and add to backend/.env:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

The following are already configured:
```bash
RESEND_FROM_EMAIL=noreply@vixxxen.com  # ✅ Already added
FRONTEND_URL=http://localhost:5173     # ✅ Already set
```

### 3. Test the Flow

1. **Start servers** (if not already running):
   ```bash
   # Terminal 1 - Backend
   cd agency-studio-export/backend && npm start

   # Terminal 2 - Frontend
   cd agency-studio-export/frontend && npm run dev
   ```

2. **Send invitation**:
   - Login as admin
   - Go to Admin → Models
   - Click "Invite Model" button
   - Enter email (use one you can access)
   - Click "Send Invitation"

3. **Accept invitation**:
   - Check email inbox
   - Click "Complete Your Profile"
   - Fill out form
   - Submit

4. **Verify**:
   - Model appears in Models list
   - Portal access works
   - Login works (if created)

## That's It!

See `MODEL_INVITATION_IMPLEMENTATION.md` for complete documentation, testing guide, and troubleshooting.

## Invitation URL Format

```
http://localhost:5173/{agencySlug}/model-invite/{invite-token}
```

Example:
```
http://localhost:5173/my-agency/model-invite/123e4567-e89b-12d3-a456-426614174000
```

## Quick Troubleshooting

**Email not sending?**
- Check RESEND_API_KEY is set
- Verify in Resend dashboard (test mode requires verified email)

**Migration failed?**
- Run SQL manually in Supabase SQL Editor
- Check backend/.env has Supabase credentials

**Link not working?**
- Verify migration ran successfully
- Check FRONTEND_URL matches actual frontend URL
- Check browser console for errors
