/**
 * Signup Page
 * Self-serve agency signup flow
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

export function SignupPage() {
  const [formData, setFormData] = useState({
    agencyName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    planId: ''
  });
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState({ available: null, checking: false });
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const navigate = useNavigate();

  // Fetch available plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Check slug availability when agency name changes
  useEffect(() => {
    if (formData.agencyName.length >= 3) {
      checkSlugAvailability(formData.agencyName);
    } else {
      setSlug('');
      setSlugStatus({ available: null, checking: false });
    }
  }, [formData.agencyName]);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/plans`);
      const data = await response.json();

      if (data.plans && data.plans.length > 0) {
        setPlans(data.plans);
        // Default to Starter plan
        const starterPlan = data.plans.find(p => p.name === 'Starter');
        if (starterPlan) {
          setFormData(prev => ({ ...prev, planId: starterPlan.id }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  };

  const checkSlugAvailability = async (agencyName) => {
    setSlugStatus({ available: null, checking: true });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check-slug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyName })
      });

      const data = await response.json();
      setSlug(data.slug);
      setSlugStatus({ available: data.available, checking: false, suggestions: data.suggestions });
    } catch (err) {
      console.error('Failed to check slug:', err);
      setSlugStatus({ available: null, checking: false });
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
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!slugStatus.available) {
      setError('Agency name is not available. Please choose a different name.');
      return;
    }

    setLoading(true);

    try {
      // Create agency via API
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/signup-agency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName: formData.agencyName,
          ownerName: formData.ownerName,
          email: formData.email,
          password: formData.password,
          planId: formData.planId,
          slug: slug
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create agency');
      }

      // Sign in with the created account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (signInError) {
        throw signInError;
      }

      // Redirect to onboarding
      navigate(`/${data.agency.slug}/onboarding`);
    } catch (err) {
      setError(err.message || 'Failed to create agency');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
            A
          </div>
          <h1 className="text-3xl font-bold text-text">Start Your Free Trial</h1>
          <p className="text-text-muted mt-2">Create your agency in 60 seconds</p>
        </div>

        {/* Signup Form */}
        <div className="bg-surface rounded-xl border border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* Agency Information */}
            <div>
              <h2 className="text-lg font-semibold text-text mb-4">Agency Information</h2>
              <div className="space-y-4">
                <div>
                  <Input
                    label="Agency Name"
                    name="agencyName"
                    value={formData.agencyName}
                    onChange={handleChange}
                    placeholder="Acme Studios"
                    required
                  />
                  {slug && (
                    <div className="mt-2 text-sm">
                      <span className="text-text-muted">Your URL: </span>
                      <span className={`font-mono ${slugStatus.available ? 'text-green-500' : 'text-red-500'}`}>
                        {slug}.agencystudio.com
                      </span>
                      {slugStatus.checking && (
                        <span className="ml-2 text-text-muted">(checking...)</span>
                      )}
                      {!slugStatus.available && slugStatus.suggestions && slugStatus.suggestions.length > 0 && (
                        <div className="mt-2">
                          <span className="text-text-muted">Suggestions: </span>
                          {slugStatus.suggestions.slice(0, 3).map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, agencyName: s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }));
                              }}
                              className="ml-2 text-primary hover:text-primary-hover underline"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <h2 className="text-lg font-semibold text-text mb-4">Your Information</h2>
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />

                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@acme.com"
                  required
                  autoComplete="email"
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
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <h2 className="text-lg font-semibold text-text mb-4">Choose Your Plan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      formData.planId === plan.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      name="planId"
                      value={plan.id}
                      checked={formData.planId === plan.id}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="font-semibold text-text mb-1">{plan.name}</div>
                      <div className="text-2xl font-bold text-text mb-2">
                        ${(plan.price_cents / 100).toFixed(0)}
                        <span className="text-sm text-text-muted">/mo</span>
                      </div>
                      <div className="text-sm text-text-muted mb-3">{plan.description}</div>
                      <div className="space-y-1 text-xs text-text-muted">
                        <div>{plan.monthly_credits.toLocaleString()} credits/mo</div>
                        <div>Up to {plan.max_users} users</div>
                        {plan.custom_domain_allowed && <div>Custom domain</div>}
                      </div>
                    </div>
                    {formData.planId === plan.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Trial Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-semibold text-blue-500 mb-1">7-Day Free Trial</div>
                  <div className="text-sm text-blue-500/80">
                    Explore all features for free. Add credits anytime to start generating content.
                    No credit card required.
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 rounded border-border bg-surface"
              />
              <span className="text-sm text-text-muted">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary hover:text-primary-hover underline">
                  Terms & Conditions
                </a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="text-primary hover:text-primary-hover underline">
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Submit Button */}
            <Button
              type="submit"
              loading={loading}
              disabled={!slugStatus.available || loading}
              className="w-full"
            >
              Create Agency
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
