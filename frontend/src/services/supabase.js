/**
 * Supabase Client
 * Frontend Supabase client for authentication
 *
 * SECURITY NOTE:
 * Uses cookie-based storage instead of localStorage to reduce XSS attack surface.
 * Cookies are set with Secure and SameSite flags for additional protection.
 *
 * For full httpOnly cookie protection, consider implementing server-side
 * auth flow where the backend sets httpOnly cookies.
 */

import { createClient } from '@supabase/supabase-js';
import { cookieStorage } from './cookieStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Strict validation
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase configuration.\n' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.\n' +
    'See frontend/.env.example for reference.'
  );
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error(
    `Invalid VITE_SUPABASE_URL: "${supabaseUrl}".\n` +
    'Must start with https:// (e.g., https://your-project.supabase.co)'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: cookieStorage,
    storageKey: 'supabase.auth.token',
  },
});
