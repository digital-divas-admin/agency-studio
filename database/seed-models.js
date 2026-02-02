#!/usr/bin/env node
/**
 * Seed Script — Dummy Agency Models
 * Creates test creator/talent profiles for development.
 *
 * Usage:
 *   node database/seed-models.js          (from agency-studio-export/)
 *   cd backend && node ../database/seed-models.js
 *
 * Requires: backend/.env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

const path = require('path');

// Resolve modules from the backend directory
module.paths.unshift(path.join(__dirname, '../backend/node_modules'));

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DUMMY_MODELS = [
  {
    name: 'Bella Rose',
    slug: 'bella-rose',
    avatar_url: 'https://i.pravatar.cc/300?u=bella-rose',
    onlyfans_handle: 'bellarose',
    notes: 'Top earner, specialty in glamour and lifestyle content',
    status: 'active',
    lora_config: {
      path: '/workspace/loras/bella_rose_v2.safetensors',
      triggerWord: 'bellarose_style',
      weight: 0.75,
    },
  },
  {
    name: 'Luna Starr',
    slug: 'luna-starr',
    avatar_url: 'https://i.pravatar.cc/300?u=luna-starr',
    onlyfans_handle: 'lunastarr',
    notes: 'Alternative / tattoo aesthetic, high engagement',
    status: 'active',
    lora_config: {
      path: '/workspace/loras/luna_starr_v1.safetensors',
      triggerWord: 'lunastarr_style',
      weight: 0.7,
    },
  },
  {
    name: 'Sofia Valentina',
    slug: 'sofia-valentina',
    avatar_url: 'https://i.pravatar.cc/300?u=sofia-valentina',
    onlyfans_handle: 'sofiaval',
    notes: 'Fitness / wellness niche, strong PPV performance',
    status: 'active',
    lora_config: {
      path: '/workspace/loras/sofia_val_v3.safetensors',
      triggerWord: 'sofiaval_style',
      weight: 0.8,
    },
  },
  {
    name: 'Jade Monroe',
    slug: 'jade-monroe',
    avatar_url: 'https://i.pravatar.cc/300?u=jade-monroe',
    onlyfans_handle: 'jademonroe',
    notes: 'New talent, LoRA still in training',
    status: 'active',
    lora_config: {},
  },
  {
    name: 'Aria Blake',
    slug: 'aria-blake',
    avatar_url: 'https://i.pravatar.cc/300?u=aria-blake',
    onlyfans_handle: 'ariablake',
    notes: 'Archived — left agency Q3 2025',
    status: 'archived',
    lora_config: {
      path: '/workspace/loras/aria_blake_v1.safetensors',
      triggerWord: 'ariablake_style',
      weight: 0.65,
    },
  },
];

async function seed() {
  // 1. Find the first agency to attach models to
  const { data: agencies, error: agencyErr } = await supabase
    .from('agencies')
    .select('id, name')
    .limit(1);

  if (agencyErr) {
    console.error('Failed to fetch agencies:', agencyErr.message);
    process.exit(1);
  }

  if (!agencies || agencies.length === 0) {
    console.error('No agencies found. Create an agency first.');
    process.exit(1);
  }

  const agency = agencies[0];
  console.log(`Seeding models for agency: ${agency.name} (${agency.id})\n`);

  // 2. Insert each model
  let created = 0;
  let skipped = 0;

  for (const model of DUMMY_MODELS) {
    // Check if slug already exists for this agency
    const { data: existing } = await supabase
      .from('agency_models')
      .select('id')
      .eq('agency_id', agency.id)
      .eq('slug', model.slug)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP  ${model.name} (slug "${model.slug}" already exists)`);
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase
      .from('agency_models')
      .insert({
        agency_id: agency.id,
        ...model,
      });

    if (insertErr) {
      console.error(`  FAIL  ${model.name}: ${insertErr.message}`);
    } else {
      const loraStatus = model.lora_config?.path ? '✓ LoRA' : '  no LoRA';
      console.log(`  OK    ${model.name} [${model.status}] ${loraStatus}`);
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
