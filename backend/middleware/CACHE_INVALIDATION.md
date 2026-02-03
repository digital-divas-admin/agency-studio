# Agency Middleware Cache Invalidation Guide

## Overview

The agency middleware now includes in-memory caching to reduce database queries. This cache stores agency data for 5 minutes (300,000ms) per lookup.

**Cache Keys**:
- `slug:{agency-slug}` - For subdomain-based lookups (e.g., `myagency.agencystudio.com`)
- `domain:{custom-domain}` - For custom domain lookups (e.g., `app.mycompany.com`)

## When to Invalidate Cache

You must manually invalidate the cache when agency data changes:

### 1. Agency Settings Updated
When agency settings, branding, or configuration changes:

```javascript
const { clearAgencyCache } = require('../middleware/agency');

// After updating agency
await supabaseAdmin
  .from('agencies')
  .update({ settings: newSettings })
  .eq('id', agencyId);

// Clear cache
clearAgencyCache(`slug:${agencySlug}`);

// If agency has custom domain, also clear that
if (agency.custom_domain) {
  clearAgencyCache(`domain:${agency.custom_domain}`);
}
```

### 2. Agency Slug Changed
When agency slug is updated (subdomain change):

```javascript
const oldSlug = agency.slug;
const newSlug = req.body.slug;

await supabaseAdmin
  .from('agencies')
  .update({ slug: newSlug })
  .eq('id', agencyId);

// Clear both old and new slug caches
clearAgencyCache(`slug:${oldSlug}`);
clearAgencyCache(`slug:${newSlug}`);
```

### 3. Custom Domain Added/Changed
When custom domain is configured or updated:

```javascript
const oldDomain = agency.custom_domain;
const newDomain = req.body.custom_domain;

await supabaseAdmin
  .from('agencies')
  .update({ custom_domain: newDomain })
  .eq('id', agencyId);

// Clear old domain cache (if existed)
if (oldDomain) {
  clearAgencyCache(`domain:${oldDomain}`);
}

// Clear new domain cache
clearAgencyCache(`domain:${newDomain}`);

// Also clear slug cache (in case they access via subdomain)
clearAgencyCache(`slug:${agency.slug}`);
```

### 4. Agency Status Changed
When agency is activated, deactivated, or suspended:

```javascript
await supabaseAdmin
  .from('agencies')
  .update({ status: 'suspended' })
  .eq('id', agencyId);

// Clear all caches for this agency
clearAgencyCache(`slug:${agency.slug}`);
if (agency.custom_domain) {
  clearAgencyCache(`domain:${agency.custom_domain}`);
}
```

## Implementation Examples

### Example 1: Agency Settings Route

```javascript
// backend/routes/agency.js

const { clearAgencyCache } = require('../middleware/agency');

router.put('/settings', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  const { agency } = req;
  const { settings } = req.body;

  try {
    // Update agency settings
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .update({ settings })
      .eq('id', agency.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    // IMPORTANT: Invalidate cache after update
    clearAgencyCache(`slug:${agency.slug}`);
    if (agency.custom_domain) {
      clearAgencyCache(`domain:${agency.custom_domain}`);
    }

    res.json({ success: true, agency: data });
  } catch (error) {
    logger.error('Error updating agency settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Example 2: Agency Profile Update

```javascript
router.put('/profile', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  const { agency } = req;
  const { name, slug, custom_domain } = req.body;

  try {
    const oldSlug = agency.slug;
    const oldDomain = agency.custom_domain;

    // Update agency profile
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .update({ name, slug, custom_domain })
      .eq('id', agency.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    // Invalidate OLD caches
    clearAgencyCache(`slug:${oldSlug}`);
    if (oldDomain) {
      clearAgencyCache(`domain:${oldDomain}`);
    }

    // Invalidate NEW caches (in case they were cached from failed attempts)
    if (slug !== oldSlug) {
      clearAgencyCache(`slug:${slug}`);
    }
    if (custom_domain && custom_domain !== oldDomain) {
      clearAgencyCache(`domain:${custom_domain}`);
    }

    res.json({ success: true, agency: data });
  } catch (error) {
    logger.error('Error updating agency profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Cache Behavior

### Cache Hit (Typical Case)
```
Request → Agency Middleware → Check Cache → Cache Hit ✅ → Continue (1ms)
```

### Cache Miss (First Request or Expired)
```
Request → Agency Middleware → Check Cache → Cache Miss ❌ → DB Query (50ms) → Store in Cache → Continue
```

### After Update (Cache Invalidated)
```
Update Agency → clearAgencyCache() → Next Request → Cache Miss → DB Query → Store in Cache
```

## Cache Statistics

To monitor cache effectiveness, you can add logging:

```javascript
// In agency.js, add cache hit/miss tracking

let cacheHits = 0;
let cacheMisses = 0;

function getCachedAgency(key) {
  const cached = agencyCache.get(key);
  if (!cached) {
    cacheMisses++;
    return null;
  }

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
  if (isExpired) {
    agencyCache.delete(key);
    cacheMisses++;
    return null;
  }

  cacheHits++;
  return cached.agency;
}

// Add endpoint to view stats
router.get('/cache-stats', (req, res) => {
  const hitRate = (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2);
  res.json({
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: `${hitRate}%`,
    cacheSize: agencyCache.size,
  });
});
```

## Multi-Instance Considerations

### Current Implementation (Single Instance)
- Cache is stored in-memory per process
- Works perfectly for single-instance deployments
- No external dependencies (Redis, Memcached)

### For Multi-Instance Deployments
If you scale to multiple backend instances, consider:

**Option 1: Redis Cache (Recommended)**
```javascript
const redis = require('redis');
const client = redis.createClient();

async function getCachedAgency(key) {
  const cached = await client.get(`agency:${key}`);
  return cached ? JSON.parse(cached) : null;
}

async function setCachedAgency(key, agency) {
  await client.setex(`agency:${key}`, 300, JSON.stringify(agency)); // 5 min TTL
}
```

**Option 2: Sticky Sessions**
- Route requests from same agency to same instance
- Allows in-memory cache to remain effective
- Simpler than Redis but less flexible

**Option 3: Shorter TTL**
- Reduce cache TTL to 1-2 minutes
- Allows stale data to expire faster
- Eventual consistency across instances

## Troubleshooting

### Users seeing stale agency data
**Cause**: Cache not invalidated after update
**Solution**: Ensure `clearAgencyCache()` called after every agency UPDATE

### Cache growing too large
**Current Limit**: 1000 agencies cached
**If Exceeded**: Oldest entries automatically removed (LRU-like)
**To Monitor**: Add cache size logging

### Cache not improving performance
**Possible Causes**:
1. TTL too short (default: 5 minutes)
2. Cache invalidation too aggressive
3. Low traffic (cache keeps expiring)

**Solution**: Monitor cache hit rate and adjust TTL accordingly

## Performance Impact

Expected metrics with caching:

| Metric | Without Cache | With Cache | Improvement |
|--------|---------------|------------|-------------|
| Agency lookup time | 50ms | <1ms | 50-100x faster |
| Database queries | 1 per request | 0.01 per request (99% cached) | 99% reduction |
| Throughput | 1000 req/min | 50,000+ req/min | 50x increase |

## Future Improvements

1. **Redis Cache**: Shared cache across instances
2. **Cache Warming**: Pre-load active agencies on startup
3. **Metrics**: Detailed cache hit/miss statistics
4. **TTL Configuration**: Per-agency TTL based on update frequency
5. **Cache Tags**: Invalidate by tags (all caches for agency X)

---

**Last Updated**: 2026-02-02
**Cache Version**: 1.0
**TTL**: 5 minutes (300,000ms)
