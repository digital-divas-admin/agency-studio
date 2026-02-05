/**
 * Onboarding Page
 * Multi-step wizard for new agency setup
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgency } from '../context/AgencyContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { api } from '../services/api';

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'branding', title: 'Customize Branding' },
  { id: 'team', title: 'Invite Team' },
  { id: 'complete', title: 'Get Started' }
];

export function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    appName: '',
    primaryColor: '#6366f1',
    secondaryColor: '#10b981',
    logoFile: null,
    teamEmails: ['']
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { agency, refreshAgency, branding, loading: agencyLoading } = useAgency();
  const navigate = useNavigate();

  // Initialize form with current agency data (must be before any early returns)
  useEffect(() => {
    if (agency && branding) {
      setFormData(prev => ({
        ...prev,
        appName: branding.app_name || agency.name,
        primaryColor: branding.primary_color || '#6366f1',
        secondaryColor: branding.secondary_color || '#10b981'
      }));
    }
  }, [agency, branding]);

  // Show loading while agency config loads
  if (agencyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-text-muted">Loading your agency...</p>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }
      setFormData(prev => ({ ...prev, logoFile: file }));
      setError('');
    }
  };

  const handleColorChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...formData.teamEmails];
    newEmails[index] = value;
    setFormData(prev => ({ ...prev, teamEmails: newEmails }));
  };

  const addEmailField = () => {
    setFormData(prev => ({
      ...prev,
      teamEmails: [...prev.teamEmails, '']
    }));
  };

  const removeEmailField = (index) => {
    if (formData.teamEmails.length > 1) {
      const newEmails = formData.teamEmails.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, teamEmails: newEmails }));
    }
  };

  const saveBranding = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Upload logo if provided
      let logoUrl = branding.logo_url;
      if (formData.logoFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('logo', formData.logoFile);

        const uploadResponse = await api.post('/agency/branding/logo', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        logoUrl = uploadResponse.data.logo_url;
      }

      // Update agency settings
      await api.put('/agency/settings', {
        branding: {
          logo_url: logoUrl,
          app_name: formData.appName,
          primary_color: formData.primaryColor,
          secondary_color: formData.secondaryColor
        }
      });

      await refreshAgency();
      handleNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save branding');
    } finally {
      setSubmitting(false);
    }
  };

  const sendInvitations = async () => {
    setSubmitting(true);
    setError('');

    try {
      const validEmails = formData.teamEmails.filter(email => email.trim() !== '');

      if (validEmails.length > 0) {
        await Promise.all(
          validEmails.map(email =>
            api.post('/team/invite', {
              email: email.trim(),
              role: 'member'
            })
          )
        );
      }

      handleNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitations');
    } finally {
      setSubmitting(false);
    }
  };

  const completeOnboarding = async () => {
    setSubmitting(true);

    try {
      await api.completeOnboarding();
      await refreshAgency();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center max-w-xl mx-auto">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-text mb-4">
              Welcome to {agency?.name}! 🎉
            </h2>
            <p className="text-text-muted text-lg mb-8">
              Let's get your agency set up in just a few steps. This will only take a minute.
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-8">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <div className="font-semibold text-blue-500 mb-1">Your 7-Day Trial</div>
                  <div className="text-sm text-blue-500/80">
                    Explore all features for free. Add credits anytime to start generating content.
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleNext} size="lg" className="px-8">
              Get Started
            </Button>
          </div>
        );

      case 'branding':
        return (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-text mb-2 text-center">Customize Your Branding</h2>
            <p className="text-text-muted mb-8 text-center">
              Make the platform your own with your logo and brand colors
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-6">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text mb-2">App Name</label>
                <Input
                  value={formData.appName}
                  onChange={(e) => setFormData(prev => ({ ...prev, appName: e.target.value }))}
                  placeholder="Your Agency Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">Logo</label>
                <div className="flex items-center gap-4">
                  {(formData.logoFile || branding.logo_url) && (
                    <div className="w-16 h-16 rounded-lg border border-border overflow-hidden flex-shrink-0">
                      <img
                        src={formData.logoFile ? URL.createObjectURL(formData.logoFile) : branding.logo_url}
                        alt="Logo preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <div className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text hover:bg-surface-hover transition-colors">
                      {formData.logoFile || branding.logo_url ? 'Change Logo' : 'Upload Logo'}
                    </div>
                  </label>
                </div>
                <p className="text-xs text-text-muted mt-2">PNG, JPG, or SVG. Max 2MB.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-12 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="w-12 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSkip} variant="outline" className="flex-1">
                Skip
              </Button>
              <Button onClick={saveBranding} loading={submitting} className="flex-1">
                Save & Continue
              </Button>
            </div>
          </div>
        );

      case 'team':
        return (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-text mb-2 text-center">Invite Your Team</h2>
            <p className="text-text-muted mb-8 text-center">
              Collaborate with your team members (you can always do this later)
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-6">
                {error}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {formData.teamEmails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    placeholder="teammate@example.com"
                    className="flex-1"
                  />
                  {formData.teamEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 text-text-muted hover:text-red-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addEmailField}
              className="text-sm text-primary hover:text-primary-hover flex items-center gap-2 mb-8"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Another Email
            </button>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSkip} variant="outline" className="flex-1">
                Skip
              </Button>
              <Button onClick={sendInvitations} loading={submitting} className="flex-1">
                Send Invites
              </Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center max-w-xl mx-auto">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-text mb-4">
              You're All Set! 🚀
            </h2>
            <p className="text-text-muted text-lg mb-8">
              Your agency is ready to go. Start creating amazing content for your models.
            </p>

            <div className="bg-surface rounded-lg border border-border p-6 mb-8 text-left">
              <h3 className="font-semibold text-text mb-4">Quick Tips:</h3>
              <ul className="space-y-3 text-sm text-text-muted">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Add your first model in the Models section</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Purchase credits to start generating content</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Explore workflows to automate your content creation</span>
                </li>
              </ul>
            </div>

            <Button onClick={completeOnboarding} loading={submitting} size="lg" className="px-8">
              Go to Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress Bar */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      index < currentStep
                        ? 'bg-primary text-white'
                        : index === currentStep
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover text-text-muted'
                    }`}
                  >
                    {index < currentStep ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`hidden md:block text-sm font-medium ${
                      index <= currentStep ? 'text-text' : 'text-text-muted'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 transition-colors ${
                      index < currentStep ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
