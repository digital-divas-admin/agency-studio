/**
 * Health Check Routes
 * For monitoring and load balancer health checks
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');

/**
 * GET /health
 * Basic health check
 */
router.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'agency-studio-api',
  });
});

/**
 * GET /health/detailed
 * Detailed health check including dependencies
 */
router.get('/detailed', async (req, res) => {
  const checks = {
    api: 'ok',
    database: 'unknown',
  };

  try {
    // Check Supabase connection
    const { error } = await supabaseAdmin
      .from('agencies')
      .select('count')
      .limit(1);

    checks.database = error ? 'error' : 'ok';
  } catch (e) {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/config
 * Configuration validation endpoint
 */
router.get('/config', async (req, res) => {
  const { config } = require('../config');

  const checks = {
    environment: {
      supabase_url: !!config.supabase.url && config.supabase.url.startsWith('https://'),
      supabase_keys: !!config.supabase.anonKey && !!config.supabase.serviceRoleKey,
      frontend_url: !!config.frontendUrl,
      node_env: !!config.nodeEnv,
    },
    services: {
      database: 'unknown',
    },
  };

  // Test database connection
  try {
    const { error } = await supabaseAdmin
      .from('agencies')
      .select('count')
      .limit(1);
    checks.services.database = !error;
  } catch (e) {
    checks.services.database = false;
  }

  const envOk = Object.values(checks.environment).every(v => v === true);
  const servicesOk = Object.values(checks.services).every(v => v === true);
  const allOk = envOk && servicesOk;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    warnings: !envOk ? ['Some environment variables are missing or invalid'] : [],
  });
});

module.exports = router;
