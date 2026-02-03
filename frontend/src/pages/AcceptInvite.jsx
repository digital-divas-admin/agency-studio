/**
 * Accept Invite Page
 * Accept team invitation and set up account
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { supabase } from '../services/supabase';

export function AcceptInvitePage() {
  const { token } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });

  const navigate = useNavigate();

  useEffect(() => {
    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/validate-invite/${token}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid invitation');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to validate invitation');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setSubmitting(true);

    try {
      // Accept invitation via API
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: formData.name,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      // Sign in with the created account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: formData.password
      });

      if (signInError) {
        throw signInError;
      }

      // Mark as first login for onboarding
      localStorage.setItem('show_team_onboarding', 'true');

      // Redirect to onboarding page
      navigate('/onboarding');
    } catch (err) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-surface rounded-xl border border-border p-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text mb-2">Invalid Invitation</h1>
            <p className="text-text-muted mb-6">{error}</p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
            {invitation.agency.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-text">Join {invitation.agency.name}</h1>
          <p className="text-text-muted mt-2">
            You've been invited as a <span className="font-semibold capitalize">{invitation.role}</span>
          </p>
        </div>

        {/* Setup Form */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-sm text-blue-500">
                <span className="font-semibold">Email: </span>
                {invitation.email}
              </div>
            </div>

            <Input
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
            />

            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
            />

            <div className="pt-2">
              <Button type="submit" loading={submitting} className="w-full">
                Accept Invitation & Join
              </Button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-sm mt-6">
          This invitation expires on {new Date(invitation.expires_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}
