/**
 * Settings Page (Admin only)
 * Agency configuration — feature toggles, defaults
 */

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Image,
  Video,
  Wand2,
  MessageSquare,
  Zap,
  Info,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAgency } from '../context/AgencyContext';
import { api } from '../services/api';

// ============================================================================
// FEATURE TOGGLE
// ============================================================================

function FeatureToggle({ icon: Icon, label, description, enabled, onChange }) {
  return (
    <label className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-surface-elevated/50 cursor-pointer transition-colors">
      <div className={`p-2.5 rounded-lg ${enabled ? 'bg-primary/10' : 'bg-surface-elevated'}`}>
        <Icon className={`h-5 w-5 ${enabled ? 'text-primary' : 'text-text-muted'}`} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-text">{label}</p>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5.5 left-[2px]' : 'left-[2px]'}`}
          style={{ transform: enabled ? 'translateX(22px)' : 'translateX(0)' }}
        />
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
      </div>
    </label>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function SettingsPage() {
  const { features, agency, refreshAgency } = useAgency();

  const [featureFlags, setFeatureFlags] = useState({
    image_gen: true,
    video_gen: true,
    editing: true,
    chat: true,
  });
  const [defaultCreditLimit, setDefaultCreditLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Initialize from current settings
  useEffect(() => {
    if (features) {
      setFeatureFlags({
        image_gen: features.image_gen !== false,
        video_gen: features.video_gen !== false,
        editing: features.editing !== false,
        chat: features.chat !== false,
      });
    }
    if (agency?.settings?.default_credit_limit) {
      setDefaultCreditLimit(String(agency.settings.default_credit_limit));
    }
  }, [features, agency]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      await api.updateAgencySettings({
        features: featureFlags,
        default_credit_limit: defaultCreditLimit ? parseInt(defaultCreditLimit) : null,
      });
      setSaved(true);
      refreshAgency();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (key, value) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <Layout>
      <PageHeader
        title="Settings"
        description="Configure your agency settings"
        actions={
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saved ? 'Saved!' : 'Save Settings'}
          </Button>
        }
      />

      <div className="space-y-6 max-w-2xl">
        {/* Feature Toggles */}
        <Card>
          <h3 className="font-semibold text-text mb-4">Enabled Features</h3>
          <p className="text-sm text-text-muted mb-4">
            Control which features are available to your team.
          </p>
          <div className="space-y-2">
            <FeatureToggle
              icon={Image}
              label="Image Generation"
              description="Seedream, Nano Banana, and Qwen image models"
              enabled={featureFlags.image_gen}
              onChange={(v) => toggleFeature('image_gen', v)}
            />
            <FeatureToggle
              icon={Video}
              label="Video Generation"
              description="Kling, WAN, and Veo video models"
              enabled={featureFlags.video_gen}
              onChange={(v) => toggleFeature('video_gen', v)}
            />
            <FeatureToggle
              icon={Wand2}
              label="Editing Tools"
              description="Background removal, eraser, inpainting, AI edit"
              enabled={featureFlags.editing}
              onChange={(v) => toggleFeature('editing', v)}
            />
            <FeatureToggle
              icon={MessageSquare}
              label="AI Chat"
              description="Chat with AI for captioning and creative assistance"
              enabled={featureFlags.chat}
              onChange={(v) => toggleFeature('chat', v)}
            />
          </div>
        </Card>

        {/* Credit Settings */}
        <Card>
          <h3 className="font-semibold text-text mb-4">Credit Settings</h3>
          <div className="space-y-4">
            <Input
              label="Default Credit Limit for New Users"
              type="number"
              value={defaultCreditLimit}
              onChange={(e) => { setDefaultCreditLimit(e.target.value); setSaved(false); }}
              placeholder="No limit (uses agency pool)"
            />
            <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-elevated">
              <Info className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
              <p className="text-xs text-text-muted">
                Per-user credit limits restrict how many credits each user can spend per billing cycle.
                Leave empty to let users draw from the shared agency pool without individual limits.
              </p>
            </div>
          </div>
        </Card>

        {/* Plan Info */}
        {agency?.plan && (
          <Card>
            <h3 className="font-semibold text-text mb-4">Current Plan</h3>
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated">
              <div>
                <p className="font-medium text-text">{agency.plan.name}</p>
                <p className="text-sm text-text-muted">
                  {agency.plan.max_users} users, {agency.plan.monthly_credits?.toLocaleString()} credits/month
                </p>
              </div>
              <Zap className="h-6 w-6 text-primary" />
            </div>
          </Card>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}
      </div>
    </Layout>
  );
}
