/**
 * Agency Resolution Middleware
 * Resolves the current agency from hostname and attaches to request
 * Includes in-memory caching to reduce database queries
 */

const { supabaseAdmin } = require('../services/supabase');
const { logger } = require('../services/logger');
const { config } = require('../config');

// In-memory cache for agency lookups
// Key: slug or custom_domain, Value: { agency, timestamp }
const agencyCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get agency from cache if available and not expired
 */
function getCachedAgency(key) {
  const cached = agencyCache.get(key);
  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
  if (isExpired) {
    agencyCache.delete(key);
    return null;
  }

  return cached.agency;
}

/**
 * Store agency in cache
 */
function setCachedAgency(key, agency) {
  agencyCache.set(key, {
    agency,
    timestamp: Date.now(),
  });

  // Prevent cache from growing unbounded (simple LRU-like behavior)
  if (agencyCache.size > 1000) {
    const firstKey = agencyCache.keys().next().value;
    agencyCache.delete(firstKey);
  }
}

/**
 * Clear agency from cache (useful for updates)
 */
function clearAgencyCache(key) {
  agencyCache.delete(key);
}

/**
 * Extract agency slug from hostname
 * Patterns:
 *   - {slug}.agencystudio.com -> slug
 *   - {slug}.localhost:3001 -> slug (dev)
 *   - custom.domain.com -> lookup by custom_domain
 */
function extractAgencyIdentifier(hostname) {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Check for subdomain pattern
  const parts = host.split('.');

  // localhost or IP - check for dev override header
  if (host === 'localhost' || host === '127.0.0.1' || parts.length === 1) {
    return { type: 'dev', value: null };
  }

  // Subdomain pattern: {slug}.agencystudio.com or {slug}.domain.com
  if (parts.length >= 2) {
    const subdomain = parts[0];
    // Skip www
    if (subdomain === 'www') {
      return { type: 'custom_domain', value: host };
    }
    return { type: 'slug', value: subdomain };
  }

  // Treat as custom domain
  return { type: 'custom_domain', value: host };
}

/**
 * Middleware to resolve agency from request
 * Attaches agency object to req.agency
 */
async function resolveAgency(req, res, next) {
  try {
    // Development override - use header or query param (disabled in production)
    let agencySlug = config.isDev
      ? (req.headers['x-agency-slug'] || req.query._agency)
      : null;

    if (!agencySlug) {
      const identifier = extractAgencyIdentifier(req.hostname);

      if (identifier.type === 'dev') {
        // In development without override, use default test agency
        agencySlug = process.env.DEFAULT_AGENCY_SLUG || 'demo';
      } else if (identifier.type === 'slug') {
        agencySlug = identifier.value;
      } else if (identifier.type === 'custom_domain') {
        // Check cache first
        const cacheKey = `domain:${identifier.value}`;
        let agency = getCachedAgency(cacheKey);

        if (!agency) {
          // Lookup by custom domain (accept both active and trial statuses)
          const { data, error } = await supabaseAdmin
            .from('agencies')
            .select('*')
            .eq('custom_domain', identifier.value)
            .in('status', ['active', 'trial'])
            .single();

          if (error || !data) {
            logger.warn(`Agency not found for custom domain: ${identifier.value}`);
            return res.status(404).json({ error: 'Agency not found' });
          }

          agency = data;
          setCachedAgency(cacheKey, agency);
        }

        req.agency = agency;
        return next();
      }
    }

    // Check cache first
    const cacheKey = `slug:${agencySlug}`;
    let agency = getCachedAgency(cacheKey);

    if (!agency) {
      // Lookup by slug from database (accept both active and trial statuses)
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .eq('slug', agencySlug)
        .in('status', ['active', 'trial'])
        .single();

      if (error || !data) {
        logger.warn(`Agency not found for slug: ${agencySlug}`);
        return res.status(404).json({ error: 'Agency not found' });
      }

      agency = data;
      setCachedAgency(cacheKey, agency);
    }

    req.agency = agency;
    next();
  } catch (error) {
    logger.error('Error resolving agency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Optional agency resolution - doesn't fail if no agency found
 * Useful for public routes that may or may not be agency-scoped
 */
async function resolveAgencyOptional(req, res, next) {
  try {
    // Development override only (disabled in production)
    const agencySlug = config.isDev
      ? (req.headers['x-agency-slug'] || req.query._agency)
      : null;

    if (agencySlug) {
      const { data: agency } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .eq('slug', agencySlug)
        .in('status', ['active', 'trial'])
        .single();

      req.agency = agency || null;
    } else {
      req.agency = null;
    }

    next();
  } catch (error) {
    logger.error('Error in optional agency resolution:', error);
    req.agency = null;
    next();
  }
}

module.exports = {
  resolveAgency,
  resolveAgencyOptional,
  extractAgencyIdentifier,
  clearAgencyCache, // Export for manual cache invalidation when agencies are updated
};
