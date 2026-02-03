# Self-Serve Onboarding - Deployment Guide

## Pre-Deployment Checklist

### 1. Database Setup

- [ ] **Run Migration**
  ```sql
  -- In Supabase SQL Editor
  -- Execute: database/migrations/010_self_serve_onboarding.sql
  ```

- [ ] **Verify Tables Created**
  ```sql
  -- Check new tables exist
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('invitation_tokens', 'audit_logs', 'api_keys', 'webhook_subscriptions');

  -- Check new columns exist
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'agencies'
  AND column_name IN ('onboarding_completed', 'trial_ends_at', 'signup_source', 'subscription_status');
  ```

- [ ] **Create Default Plans** (if not already present)
  ```sql
  -- Check if plans exist
  SELECT * FROM agency_plans;

  -- If empty, create default plans
  INSERT INTO agency_plans (name, description, monthly_credits, max_users, price_cents, custom_domain_allowed, features) VALUES
  ('Starter', 'Perfect for small teams getting started', 5000, 5, 9900, false, '{"priority_support": false}'::jsonb),
  ('Professional', 'For growing agencies with more needs', 20000, 25, 29900, true, '{"priority_support": true}'::jsonb),
  ('Enterprise', 'Custom solution for large organizations', 100000, 999, 99900, true, '{"priority_support": true, "dedicated_support": true}'::jsonb);
  ```

### 2. Environment Variables

Set these in your hosting environment (Vercel, Railway, etc.):

**Required**:
```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=https://yourdomain.com

# Supabase (should already be set)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Node Environment
NODE_ENV=production
```

**Optional**:
```bash
# Rate limiting (already has defaults)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# Port (default: 3000)
PORT=3000
```

### 3. Email Service Setup (Resend)

- [ ] **Create Resend Account**
  1. Go to https://resend.com
  2. Sign up for free account
  3. Verify your domain (optional but recommended)

- [ ] **Get API Key**
  1. Go to Settings → API Keys
  2. Create new API key
  3. Copy and save (you won't see it again!)

- [ ] **Configure From Email**
  - Without domain verification: Use `onboarding@resend.dev` (free tier)
  - With domain verification: Use `noreply@yourdomain.com`

- [ ] **Test Email Sending**
  ```bash
  # Use Resend dashboard to send test email
  # Or use their API testing tool
  ```

### 4. Frontend Build

- [ ] **Update Config**
  ```bash
  # frontend/.env.production
  VITE_API_URL=https://api.yourdomain.com
  VITE_SUPABASE_URL=https://xxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGc...
  ```

- [ ] **Build Frontend**
  ```bash
  cd frontend
  npm install
  npm run build
  ```

- [ ] **Verify Build**
  ```bash
  # Check dist folder created
  ls -la dist/
  ```

### 5. Backend Deployment

- [ ] **Install Dependencies**
  ```bash
  cd backend
  npm install --production
  ```

- [ ] **Test Locally**
  ```bash
  npm start
  # Verify server starts without errors
  ```

- [ ] **Deploy Backend**
  - Railway: Connect GitHub repo, auto-deploy
  - Render: Connect repo, set environment vars
  - Heroku: `git push heroku main`
  - VPS: PM2 process manager recommended

### 6. DNS & Domain Setup

- [ ] **Backend API Domain**
  - Set A record: `api.yourdomain.com → [server IP]`
  - Or CNAME: `api.yourdomain.com → yourapp.railway.app`

- [ ] **Frontend Domain**
  - Set A record: `yourdomain.com → [frontend IP]`
  - Or CNAME: `yourdomain.com → your-app.vercel.app`

- [ ] **Agency Subdomains** (future)
  - Wildcard CNAME: `*.yourdomain.com → yourapp.railway.app`
  - For multi-tenant subdomain routing

### 7. SSL Certificates

Most hosting providers handle SSL automatically:
- Vercel: Auto SSL via Let's Encrypt
- Railway: Auto SSL via Let's Encrypt
- Render: Auto SSL via Let's Encrypt

For custom servers:
- Use Certbot for Let's Encrypt
- Or use Cloudflare for SSL proxy

### 8. CORS Configuration

Backend is already configured for:
- Localhost (development)
- Subdomain pattern: `*.agencystudio.com`
- Configured frontend URL

Update if needed in `backend/server.js`:
```javascript
// Update CORS to allow your domain
if (origin.match(/^https:\/\/[a-z0-9-]+\.yourdomain\.com$/)) {
  return callback(null, true);
}
```

## Deployment Steps

### Option A: Vercel (Frontend) + Railway (Backend)

**Backend (Railway)**:
1. Connect GitHub repo
2. Select `backend` folder as root
3. Set environment variables
4. Deploy
5. Note API URL: `yourapp.railway.app`

**Frontend (Vercel)**:
1. Connect GitHub repo
2. Select `frontend` folder as root
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Set environment variables
6. Deploy
7. Note frontend URL: `yourapp.vercel.app`

### Option B: Single VPS (DigitalOcean, Linode, etc.)

1. **Setup Server**
   ```bash
   # Install Node.js, PM2, Nginx
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   sudo apt-get install nginx
   ```

2. **Deploy Backend**
   ```bash
   cd /var/www/agency-studio/backend
   npm install --production
   pm2 start server.js --name agency-api
   pm2 save
   pm2 startup
   ```

3. **Deploy Frontend**
   ```bash
   cd /var/www/agency-studio/frontend
   npm install
   npm run build
   sudo cp -r dist/* /var/www/html/
   ```

4. **Configure Nginx**
   ```nginx
   # /etc/nginx/sites-available/agency-studio
   server {
     listen 80;
     server_name yourdomain.com;

     location / {
       root /var/www/html;
       try_files $uri $uri/ /index.html;
     }

     location /api {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

5. **Enable SSL**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Option C: Docker Deployment

1. **Create Dockerfile (Backend)**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     api:
       build: ./backend
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - RESEND_API_KEY=${RESEND_API_KEY}
       restart: unless-stopped

     frontend:
       image: nginx:alpine
       volumes:
         - ./frontend/dist:/usr/share/nginx/html
       ports:
         - "80:80"
       restart: unless-stopped
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

## Post-Deployment Verification

### 1. Health Checks

- [ ] **Backend Health**
  ```bash
  curl https://api.yourdomain.com/health
  # Expected: {"status": "ok", "timestamp": "..."}
  ```

- [ ] **Frontend Loads**
  ```bash
  curl https://yourdomain.com
  # Expected: HTML with React app
  ```

- [ ] **Database Connected**
  ```bash
  curl https://api.yourdomain.com/api/auth/plans
  # Expected: {"plans": [...]}
  ```

### 2. Test Signup Flow

- [ ] Visit `https://yourdomain.com/signup`
- [ ] Fill out form and submit
- [ ] Verify account created in database
- [ ] Verify welcome email received
- [ ] Verify onboarding wizard loads
- [ ] Complete onboarding
- [ ] Verify redirected to dashboard

### 3. Test Invitation Flow

- [ ] Login as admin
- [ ] Send team invitation
- [ ] Verify email received
- [ ] Accept invitation
- [ ] Verify account created

### 4. Monitor Logs

**Backend Logs**:
```bash
# Railway: View in dashboard
# PM2: pm2 logs agency-api
# Docker: docker-compose logs -f api
```

Check for:
- No startup errors
- Successful database connections
- API requests logging correctly
- No email sending errors

### 5. Database Monitoring

```sql
-- Check new signups today
SELECT COUNT(*) FROM agencies
WHERE DATE(created_at) = CURRENT_DATE;

-- Check active trials
SELECT COUNT(*) FROM agencies
WHERE subscription_status = 'trial'
AND trial_ends_at > NOW();

-- Check pending invitations
SELECT COUNT(*) FROM invitation_tokens
WHERE accepted_at IS NULL
AND expires_at > NOW();
```

## Monitoring & Alerts

### 1. Application Monitoring

**Recommended Services**:
- Sentry (errors)
- LogRocket (session replay)
- DataDog (infrastructure)
- Uptime Robot (uptime)

**Setup Sentry**:
```bash
npm install @sentry/node

# In backend/server.js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: "YOUR_DSN" });
```

### 2. Email Delivery Monitoring

- Monitor Resend dashboard for:
  - Delivery rate
  - Bounce rate
  - Spam complaints
- Set up alerts for delivery issues

### 3. Database Monitoring

- Enable Supabase logs
- Monitor query performance
- Set up alerts for:
  - High CPU usage
  - Slow queries
  - Failed connections

### 4. Uptime Monitoring

Setup checks for:
- `https://yourdomain.com` (200 OK)
- `https://api.yourdomain.com/health` (200 OK)
- Email sending (daily test)

## Rollback Plan

If deployment fails:

1. **Database Rollback**
   ```sql
   -- Drop new tables
   DROP TABLE IF EXISTS webhook_subscriptions;
   DROP TABLE IF EXISTS api_keys;
   DROP TABLE IF EXISTS audit_logs;
   DROP TABLE IF EXISTS invitation_tokens;

   -- Remove new columns
   ALTER TABLE agencies DROP COLUMN IF EXISTS onboarding_completed;
   ALTER TABLE agencies DROP COLUMN IF EXISTS trial_ends_at;
   -- ... etc
   ```

2. **Code Rollback**
   ```bash
   # Git revert
   git revert HEAD
   git push origin main

   # Or rollback to previous commit
   git reset --hard <previous-commit-hash>
   git push --force origin main
   ```

3. **Hosting Rollback**
   - Railway/Vercel: Revert to previous deployment in dashboard
   - PM2: `pm2 restart agency-api --update-env`
   - Docker: `docker-compose down && git checkout main && docker-compose up -d`

## Security Hardening

- [ ] **Environment Variables**
  - Never commit secrets to git
  - Use .env files (gitignored)
  - Rotate keys regularly

- [ ] **Rate Limiting**
  - Already configured for `/api` routes
  - Monitor for abuse
  - Adjust limits if needed

- [ ] **Input Validation**
  - Already implemented in routes
  - Test for SQL injection
  - Test for XSS

- [ ] **HTTPS Only**
  - Force SSL in production
  - Set secure cookie flags
  - Use HSTS headers

- [ ] **Database Security**
  - Use RLS (Row Level Security) - already enabled
  - Service role key kept secret
  - Regular backups enabled

## Performance Optimization

- [ ] **Frontend**
  - Enable gzip compression
  - Add CDN (Cloudflare)
  - Cache static assets
  - Lazy load routes

- [ ] **Backend**
  - Enable response compression
  - Cache frequently accessed data
  - Use database connection pooling
  - Optimize slow queries

- [ ] **Database**
  - Add indexes (already added in migration)
  - Monitor query performance
  - Enable query caching
  - Set up read replicas if needed

## Compliance & Legal

- [ ] **Terms & Conditions**
  - Create terms page
  - Update signup link
  - Version and date

- [ ] **Privacy Policy**
  - Create privacy page
  - Update signup link
  - GDPR compliance

- [ ] **Email Compliance**
  - CAN-SPAM compliance
  - Unsubscribe links (for marketing emails)
  - Privacy policy link in emails

- [ ] **Data Retention**
  - Define retention policies
  - Document in privacy policy
  - Implement data deletion

## Support Documentation

- [ ] **User Guides**
  - How to sign up
  - How to complete onboarding
  - How to invite team members
  - How trial works

- [ ] **Admin Guides**
  - How to manage agencies
  - How to troubleshoot issues
  - Database queries for support

- [ ] **API Documentation**
  - Document all endpoints
  - Include examples
  - List error codes

## Launch Checklist

Final checks before going live:

- [ ] All environment variables set
- [ ] Database migration complete
- [ ] Email service tested
- [ ] Signup flow tested end-to-end
- [ ] Invitation flow tested
- [ ] Trial management tested
- [ ] Error handling verified
- [ ] Monitoring set up
- [ ] Backups enabled
- [ ] SSL certificates valid
- [ ] Domain DNS configured
- [ ] Terms & Privacy live
- [ ] Support email configured
- [ ] Analytics tracking added
- [ ] Team trained on support

## Post-Launch

After launch, monitor:

**Week 1**:
- Hourly signup rate
- Email delivery rate
- Error rate
- User feedback

**Week 2-4**:
- Trial-to-paid conversion
- Onboarding completion rate
- Team invitation acceptance
- Support ticket volume

**Month 2+**:
- Monthly recurring revenue
- Churn rate
- User engagement
- Feature requests

---

**Deployment Complexity**: Medium
**Estimated Time**: 2-4 hours (assuming env vars ready)
**Risk Level**: Low (can rollback easily)

**Next Steps**:
1. Complete pre-deployment checklist
2. Deploy to staging first
3. Test thoroughly on staging
4. Deploy to production
5. Monitor closely for 24 hours
