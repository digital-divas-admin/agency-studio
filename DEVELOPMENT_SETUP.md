# Development Setup Guide

Complete guide for setting up the Agency Studio development environment.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (via Supabase)
- Git

## Quick Start

### 1. Clone and Install

```bash
# Clone repository (if not already done)
git clone <repo-url>
cd agency-studio-export

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup (Supabase)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings > API
4. Copy these values (you'll need them for .env files):
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key (keep this secure!)

### 3. Backend Configuration

```bash
cd backend

# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

**Required Backend Environment Variables:**

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Development
DEFAULT_AGENCY_SLUG=fresh-test
```

**Optional API Keys** (for AI generation features):
- `REPLICATE_API_KEY` - Image/video generation
- `GOOGLE_API_KEY` - Veo video generation
- `OPENROUTER_API_KEY` - Chat features
- `ELEVENLABS_API_KEY` - Voice generation
- `RESEND_API_KEY` - Email notifications

### 4. Frontend Configuration

```bash
cd ../frontend

# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required Frontend Environment Variables:**

```env
# Supabase (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# API URL (leave empty for same-origin)
VITE_API_URL=
```

**Important:** `VITE_API_URL` should be empty for local development. The frontend will automatically connect to the backend on the same domain.

### 5. Database Migrations

Run all database migrations to set up tables:

```bash
cd database/migrations

# Run each migration in order (001, 002, etc.)
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" < 001_initial_schema.sql
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" < 002_agencies.sql
# ... continue for all migrations
```

Or use the Supabase SQL Editor in the dashboard to run each migration file.

### 6. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Backend will start on http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Frontend will start on http://localhost:5173

### 7. Verify Configuration

Visit the configuration health check endpoint:

```bash
curl http://localhost:3001/health/config
```

You should see:
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
  }
}
```

If any checks fail, review your .env files.

### 8. Create Your First User

1. Navigate to http://localhost:5173/login
2. Click "Sign Up" (if onboarding is enabled)
3. Or use Supabase dashboard to create a test user:
   - Go to Authentication > Users
   - Click "Add user" > "Create new user"
   - Enter email and password

### 9. Set Up Test Agency

```bash
# In Supabase SQL Editor or psql:
INSERT INTO agencies (slug, name, settings)
VALUES ('fresh-test', 'Test Agency', '{"trial_days": 14}'::jsonb);

# Link your user to the agency:
INSERT INTO agency_users (agency_id, user_id, role)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'fresh-test'),
  (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
  'owner'
);
```

## Common Issues and Solutions

### "Authentication required" errors after login

**Cause:** Token storage mismatch between Supabase client and API service.

**Solution:** This has been fixed in the latest version. Clear browser cookies and localStorage, then restart the frontend dev server.

### "Missing Supabase environment variables" error

**Cause:** .env file not loaded or variables not set correctly.

**Solutions:**
1. Verify .env file exists in both `backend/` and `frontend/`
2. Check variable names match exactly (case-sensitive)
3. Ensure no extra spaces around `=` signs
4. Restart dev servers after changing .env files
5. For frontend, variables MUST start with `VITE_`

### Database connection fails

**Cause:** Invalid Supabase credentials or network issues.

**Solutions:**
1. Verify SUPABASE_URL starts with `https://`
2. Check that service role key is correct (not the anon key)
3. Test connection in Supabase dashboard
4. Check firewall/network settings

### CORS errors in browser console

**Cause:** Frontend URL not configured in backend CORS settings.

**Solution:** Ensure `FRONTEND_URL=http://localhost:5173` is set in backend .env

### "Cannot find module" errors

**Cause:** Dependencies not installed.

**Solution:**
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### Port already in use

**Cause:** Previous server instance still running.

**Solutions:**
```bash
# Find and kill process on port 3001 (backend)
lsof -ti:3001 | xargs kill -9

# Find and kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

Or use different ports in .env files.

## Development Workflow

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Code Formatting

```bash
# Format all code
npm run format

# Check formatting
npm run format:check
```

### Database Changes

1. Create new migration file: `database/migrations/XXX_description.sql`
2. Write SQL DDL (CREATE, ALTER, etc.)
3. Test locally first
4. Run migration on Supabase
5. Document changes in migration file comments

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

## Production Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production deployment instructions.

## Architecture Overview

```
agency-studio-export/
├── backend/              # Express.js API server
│   ├── config/          # Configuration management
│   ├── middleware/      # Auth, validation, error handling
│   ├── routes/          # API endpoints
│   └── services/        # Business logic
├── frontend/            # React + Vite SPA
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   └── services/    # API clients, Supabase
│   └── public/          # Static assets
└── database/            # SQL migrations
    └── migrations/      # Ordered migration files
```

## Key Technologies

- **Backend:** Node.js, Express.js, Supabase (PostgreSQL)
- **Frontend:** React, Vite, TailwindCSS
- **Auth:** Supabase Auth (JWT)
- **Storage:** Supabase Storage
- **AI APIs:** Replicate, OpenRouter, Google, ElevenLabs

## Getting Help

1. Check this guide first
2. Review error messages in console
3. Check `/health/config` endpoint
4. Review logs in Supabase dashboard
5. Check recent commits for related changes
6. Ask team members

## Security Notes

- Never commit .env files to git (already in .gitignore)
- Keep service role keys secure (backend only)
- Use anon key in frontend (public)
- Enable Row Level Security (RLS) on all Supabase tables
- Use HTTPS in production
- Rotate API keys periodically

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
