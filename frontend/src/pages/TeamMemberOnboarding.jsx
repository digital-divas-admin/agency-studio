/**
 * Team Member Onboarding Page
 * Wrapper for FirstLoginOnboarding that fetches user data
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FirstLoginOnboarding from '../components/onboarding/FirstLoginOnboarding';
import { api } from '../services/api';

export function TeamMemberOnboardingPage() {
  const [user, setUser] = useState(null);
  const [assignedModels, setAssignedModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if onboarding should be shown
    const shouldShow = localStorage.getItem('show_team_onboarding');
    if (!shouldShow) {
      // Already seen onboarding, go to dashboard
      navigate('/dashboard');
      return;
    }

    loadUserData();
  }, [navigate]);

  const loadUserData = async () => {
    try {
      setLoading(true);

      // Get current user info
      const meData = await api.getMe();
      setUser(meData.user);

      // Get user's assigned models
      if (meData.user) {
        try {
          const modelsData = await api.getUserModels(meData.user.id);
          setAssignedModels(modelsData.models || []);
        } catch (err) {
          console.error('Failed to load assigned models:', err);
          // Non-critical error, continue with empty models
          setAssignedModels([]);
        }
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      // If API fails, redirect to dashboard
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return <FirstLoginOnboarding user={user} assignedModels={assignedModels} />;
}
