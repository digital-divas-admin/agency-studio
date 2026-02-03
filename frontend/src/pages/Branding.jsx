import { useState, useEffect } from 'react';
import { Palette, Save, RotateCcw, Crown, Lock } from 'lucide-react';
import { Layout, PageHeader } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { useWhiteLabelTier } from '../hooks/useWhiteLabelTier';
import { AssetUploader } from '../components/branding/AssetUploader';
import { ColorPicker } from '../components/branding/ColorPicker';
import { ColorPaletteEditor } from '../components/branding/ColorPaletteEditor';
import { CSSEditor } from '../components/branding/CSSEditor';
import { useAgency } from '../context/AgencyContext';
import { api } from '../services/api';

export function BrandingPage() {
  const { tier, hasFeature, isLocked, tierLevel } = useWhiteLabelTier();
  const { branding, refreshAgency } = useAgency();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [brandingData, setBrandingData] = useState({
    logo_url: '',
    favicon_url: '',
    app_name: '',
    primary_color: '#6366f1',
    secondary_color: '#10b981',
    login_background_url: '',
    login_background_overlay_opacity: 0.7,
    color_palette: {},
    custom_css: ''
  });

  const [whiteLabelSettings, setWhiteLabelSettings] = useState({
    hide_powered_by: false,
    remove_all_platform_refs: false,
    custom_onboarding_welcome: ''
  });

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const data = await api.getBranding();
      setBrandingData({ ...brandingData, ...data.branding });
      setWhiteLabelSettings({ ...whiteLabelSettings, ...data.whiteLabelSettings });
    } catch (err) {
      setError('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.updateBranding({
        branding: brandingData,
        whiteLabelSettings
      });

      setSuccess('Branding updated successfully!');
      refreshAgency();
      setTimeout(() => {
        setSuccess('');
        window.location.reload(); // Reload to apply CSS changes
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update branding');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all branding to defaults?')) return;

    try {
      await api.resetBranding();
      setSuccess('Branding reset successfully!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError('Failed to reset branding');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Brand Customization"
        description="Customize your platform with your brand identity"
        badge={
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary capitalize">{tier} Tier</span>
          </div>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg text-success">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1">
          <TabButton
            active={activeTab === 'basic'}
            onClick={() => setActiveTab('basic')}
            locked={false}
          >
            Basic
          </TabButton>

          <TabButton
            active={activeTab === 'professional'}
            onClick={() => setActiveTab('professional')}
            locked={tierLevel < 2}
          >
            Professional
            {tierLevel < 2 && <Lock className="h-4 w-4 ml-1" />}
          </TabButton>

          <TabButton
            active={activeTab === 'enterprise'}
            onClick={() => setActiveTab('enterprise')}
            locked={tierLevel < 3}
          >
            Enterprise
            {tierLevel < 3 && <Lock className="h-4 w-4 ml-1" />}
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Basic Tab */}
        {activeTab === 'basic' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetUploader
              type="logo"
              label="Logo"
              currentUrl={brandingData.logo_url}
              onUpload={(url) => setBrandingData({ ...brandingData, logo_url: url })}
              locked={isLocked('logo_upload')}
              maxSizeMB={2}
            />

            <AssetUploader
              type="favicon"
              label="Favicon"
              currentUrl={brandingData.favicon_url}
              onUpload={(url) => setBrandingData({ ...brandingData, favicon_url: url })}
              locked={isLocked('favicon')}
              maxSizeMB={0.5}
              accept=".png,.ico"
            />

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-2">
                App Name
              </label>
              <input
                type="text"
                value={brandingData.app_name || ''}
                onChange={(e) => setBrandingData({ ...brandingData, app_name: e.target.value })}
                placeholder="My Agency"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg
                         text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <ColorPicker
              label="Primary Color"
              value={brandingData.primary_color}
              onChange={(color) => setBrandingData({ ...brandingData, primary_color: color })}
              locked={isLocked('primary_color')}
              helpText="Main brand color for buttons, links, and accents"
            />
          </div>
        )}

        {/* Professional Tab */}
        {activeTab === 'professional' && (
          hasFeature('secondary_color') ? (
            <div className="space-y-6">
              <ColorPicker
                label="Secondary Color"
                value={brandingData.secondary_color}
                onChange={(color) => setBrandingData({ ...brandingData, secondary_color: color })}
                helpText="Accent color for success states and secondary actions"
              />

              <AssetUploader
                type="login_background"
                label="Login Page Background"
                currentUrl={brandingData.login_background_url}
                onUpload={(url) => setBrandingData({ ...brandingData, login_background_url: url })}
                maxSizeMB={5}
              />

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whiteLabelSettings.hide_powered_by || false}
                    onChange={(e) =>
                      setWhiteLabelSettings({
                        ...whiteLabelSettings,
                        hide_powered_by: e.target.checked
                      })
                    }
                    className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-text-primary">
                    Hide "Powered by Agency Studio" footer
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <UpgradePrompt tier="professional" />
          )
        )}

        {/* Enterprise Tab */}
        {activeTab === 'enterprise' && (
          hasFeature('full_color_palette') ? (
            <div className="space-y-8">
              <ColorPaletteEditor
                value={brandingData.color_palette}
                onChange={(palette) => setBrandingData({ ...brandingData, color_palette: palette })}
                locked={isLocked('full_color_palette')}
              />

              <CSSEditor
                value={brandingData.custom_css}
                onChange={(css) => setBrandingData({ ...brandingData, custom_css: css })}
                locked={isLocked('custom_css')}
              />

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whiteLabelSettings.remove_all_platform_refs || false}
                    onChange={(e) =>
                      setWhiteLabelSettings({
                        ...whiteLabelSettings,
                        remove_all_platform_refs: e.target.checked
                      })
                    }
                    className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-text-primary">
                    Remove all "Agency Studio" references
                  </span>
                </label>
                <p className="text-xs text-text-muted mt-1 ml-8">
                  Complete white-label experience with no platform branding
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Custom Onboarding Welcome Text
                </label>
                <textarea
                  value={whiteLabelSettings.custom_onboarding_welcome || ''}
                  onChange={(e) =>
                    setWhiteLabelSettings({
                      ...whiteLabelSettings,
                      custom_onboarding_welcome: e.target.value
                    })
                  }
                  placeholder="Welcome to our platform! Let's get you started..."
                  rows={4}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg
                           text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  Custom welcome message shown during onboarding
                </p>
              </div>
            </div>
          ) : (
            <UpgradePrompt tier="enterprise" />
          )
        )}
      </div>
    </Layout>
  );
}

function TabButton({ active, onClick, locked, children }) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`px-4 py-3 font-medium transition-colors relative flex items-center gap-2 ${
        locked
          ? 'text-text-muted/50 cursor-not-allowed'
          : active
          ? 'text-primary'
          : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {children}
      {active && !locked && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      )}
    </button>
  );
}

function UpgradePrompt({ tier }) {
  return (
    <div className="text-center p-12 bg-surface border-2 border-dashed border-border rounded-lg">
      <Crown className="h-16 w-16 mx-auto mb-4 text-primary" />
      <h3 className="text-xl font-semibold text-text-primary mb-2">
        Upgrade to {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
      </h3>
      <p className="text-text-muted mb-6 max-w-md mx-auto">
        Unlock advanced white-label features to customize your platform with your brand identity.
      </p>
      <a
        href="/admin/settings/billing"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white
                 rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Crown className="h-5 w-5" />
        View Upgrade Options
      </a>
    </div>
  );
}
