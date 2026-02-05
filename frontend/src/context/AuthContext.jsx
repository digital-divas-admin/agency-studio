/**
 * Auth Context
 * Manages user authentication state with unified state machine pattern
 */

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { api, setAgencySlug, getAgencySlug, clearAgencySlug } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Unified auth state - updates atomically to prevent race conditions
  const [authState, setAuthState] = useState({
    user: null,
    agencyUser: null,
    credits: null,
    loading: true,
    error: null,
  });

  // Ref-based guard for synchronous check (not state, to avoid async batching issues)
  const loadingRef = useRef(false);

  /**
   * Load user profile from API
   * Uses passed token directly to avoid cookie timing issues during auth state changes
   */
  const loadUserProfile = async (supabaseUser, accessToken) => {
    // Synchronous guard - prevents concurrent calls from StrictMode double renders
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = true;

    try {
      let slug = getAgencySlug();
      let data;

      try {
        // Try with current agency slug
        data = await api.getMeWithToken(accessToken, slug);
      } catch (err) {
        if (err.status === 403) {
          // Auto-detect agency if not in current one
          const { agencies } = await api.getMyAgencies(accessToken);
          if (agencies?.length > 0) {
            slug = agencies[0].slug;
            setAgencySlug(slug);
            data = await api.getMeWithToken(accessToken, slug);
          } else {
            throw new Error('No agency found for your account');
          }
        } else {
          throw err;
        }
      }

      // Atomic state update - both user and agencyUser together
      setAuthState({
        user: supabaseUser,
        agencyUser: data.user,
        credits: data.credits,
        loading: false,
        error: null,
      });

      if (data.agency?.slug) {
        setAgencySlug(data.agency.slug);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err.status, err.message);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    } finally {
      loadingRef.current = false;
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user && session?.access_token) {
        await loadUserProfile(session.user, session.access_token);
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    }).catch(err => {
      console.error('Initial getSession error:', err);
      if (mounted) {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user && session?.access_token) {
          await loadUserProfile(session.user, session.access_token);
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            agencyUser: null,
            credits: null,
            loading: false,
            error: null,
          });
          clearAgencySlug();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email/password
  const signIn = async (email, password) => {
    setAuthState(prev => ({ ...prev, error: null }));
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthState(prev => ({ ...prev, error: error.message }));
      throw error;
    }

    return data;
  };

  // Sign up (for invited users)
  const signUp = async (email, password, name) => {
    setAuthState(prev => ({ ...prev, error: null }));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      setAuthState(prev => ({ ...prev, error: error.message }));
      throw error;
    }

    return data;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    setAuthState({
      user: null,
      agencyUser: null,
      credits: null,
      loading: false,
      error: null,
    });
    clearAgencySlug();
  };

  // Reset password
  const resetPassword = async (email) => {
    setAuthState(prev => ({ ...prev, error: null }));
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setAuthState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  };

  // Refresh credits
  const refreshCredits = async () => {
    if (!authState.user) return;
    try {
      const data = await api.getMe();
      setAuthState(prev => ({ ...prev, credits: data.credits }));
    } catch (err) {
      console.error('Failed to refresh credits:', err);
    }
  };

  const isAuthenticated = !!authState.user && !!authState.agencyUser;

  const value = {
    user: authState.user,
    agencyUser: authState.agencyUser,
    credits: authState.credits,
    loading: authState.loading,
    error: authState.error,
    isAuthenticated,
    isAdmin: authState.agencyUser?.role === 'admin' || authState.agencyUser?.role === 'owner',
    isOwner: authState.agencyUser?.role === 'owner',
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshCredits,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
