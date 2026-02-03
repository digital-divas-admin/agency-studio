# Agency Studio - OnlyFans Agency Management Platform

A white-label B2B SaaS platform for OnlyFans agency management, designed for multi-tenancy with strict data isolation.

**Status**: ✅ Phase 1 & 2 SaaS optimizations complete - Ready for staging deployment

---

## Business Model

This is a white-label B2B SaaS platform for OnlyFans agency management, sold as a subscription to multiple agencies.

### Tiers

**Self-serve (automated)**
- Agencies sign up, pick a plan, and pay via the website
- Automatically provisioned at `{agency-slug}.ourplatform.com`
- Basic white-labeling: logo, brand colors, custom text
- Lower price point, no manual setup required

**Premium (sales-led)**
- Agencies contact us, we handle onboarding
- Custom domain support: `app.theiragency.com`
- Full white-label: our branding completely removed
- Custom email templates, deeper customization
- Higher price point, may involve manual DNS/SSL setup initially

### Multi-tenancy Requirements

- Strict data isolation between agencies — no tenant can access another's data
- Tenant context must be enforced at every layer (API, database queries, background jobs)
- Each agency has their own users, settings, and configurations
- Support for both subdomain-based and custom domain-based tenant resolution

### Current Status

- ✅ Multi-tenancy architecture implemented with defense-in-depth
- ✅ Performance and security optimizations complete (Phase 1 & 2)
- ⏳ Working locally, not yet deployed to production
- 🎯 Focus: Architecture and code quality, not infrastructure/DevOps yet

---

## Quick Reference

See these guides for detailed information:
- **SAAS_READINESS_IMPLEMENTATION.md** - Complete implementation details
- **DEPLOYMENT_CHECKLIST.md** - Step-by-step deployment guide
- **TEST_RESULTS.md** - All test results and verification
- **IMPLEMENTATION_SUMMARY.md** - Executive summary

---

## Performance Metrics (After Phase 1 & 2)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Scheduler queries | 400+ | 4 | **99% ↓** |
| Agency lookup | 50ms | <1ms | **50-100x ↑** |
| Gallery query | 200ms | 20ms | **10x ↑** |
| Image thumbnails (4) | 8s | 2s | **4x ↑** |

---

## Security Improvements

- ✅ XSS protection (localStorage → cookies)
- ✅ CSP headers enabled
- ✅ Input validation (2000-char limits)
- ✅ DoS prevention (query limits)
- ✅ N+1 query attacks eliminated

---

## Local Development

### Prerequisites
- Node.js v18+ (v22.14.0+ recommended)
- PostgreSQL or Supabase account
- API keys for generation services

### Quick Start

**Backend**:
```bash
cd backend
npm install
npm run dev  # Runs on http://localhost:3001
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

**Database**:
```bash
cd database
npm run migrate:run 009  # Run all migrations including latest indexes
```

---

## Next Steps

1. **Manual Testing** (1-2 hours)
   - Run in development environment
   - Test all functionality
   - Verify no runtime errors

2. **Staging Deployment** (2-4 hours)
   - Deploy to staging
   - Run full test suite
   - Monitor for 24-48 hours

3. **Production Deployment** (After staging)
   - Follow DEPLOYMENT_CHECKLIST.md
   - Monitor performance metrics

---

**Last Updated**: 2026-02-02 (Phase 1 & 2 Complete)
