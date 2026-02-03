/**
 * Branding Page (Admin only)
 * Customize agency appearance — logo, name, colors
 */

import { useState, useEffect } from 'react';
import { Palette, Save, Eye } from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAgency } from '../context/AgencyContext';
import { api } from '../services/api';

// ============================================================================
// COLOR PICKER
// ============================================================================

function ColorPicker({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text-muted">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-text text-sm font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ============================================================================
// PREVIEW
// ============================================================================

function BrandingPreview({ settings }) {
  return (
    <div
      className="rounded-xl border border-border overflow-hidden"
      style={{ '--preview-primary': settings.primary_color }}
    >
      <div className="bg-surface p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="" className="h-8 w-8 object-contain rounded" />
          ) : (
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: settings.primary_color }}
            >
              {settings.app_name?.charAt(0) || 'A'}
            </div>
          )}
          <span className="font-semibold text-text">{settings.app_name || 'Agency Studio'}</span>
        </div>
      </div>
      <div className="p-4 bg-background">
        <div className="space-y-2">
          <div
            className="h-8 rounded-lg text-white text-sm flex items-center justify-center"
            style={{ backgroundColor: settings.primary_color }}
          >
            Primary Button
          </div>
          <div
            className="h-8 rounded-lg text-white text-sm flex items-center justify-center"
            style={{ backgroundColor: settings.secondary_color }}
          >
            Secondary Button
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function BrandingPage() {
  const { branding, refreshAgency } = useAgency();

  const [settings, setSettings] = useState({
    app_name: '',
    logo_url: '',
    primary_color: '#ff2ebb',
    secondary_color: '#00b2ff',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Initialize from current branding
  useEffect(() => {
    if (branding) {
      setSettings({
        app_name: branding.app_name || '',
        logo_url: branding.logo_url || '',
        primary_color: branding.primary_color || '#ff2ebb',
        secondary_color: branding.secondary_color || '#00b2ff',
      });
    }
  }, [branding]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      await api.updateAgencySettings({ branding: settings });
      setSaved(true);
      refreshAgency();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <Layout>
      <PageHeader
        title="Branding"
        description="Customize your studio's appearance"
        actions={
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-text mb-4">General</h3>
            <div className="space-y-4">
              <Input
                label="Studio Name"
                value={settings.app_name}
                onChange={(e) => updateSetting('app_name', e.target.value)}
                placeholder="My Studio"
              />
              <Input
                label="Logo URL"
                value={settings.logo_url}
                onChange={(e) => updateSetting('logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-text mb-4">Colors</h3>
            <div className="space-y-4">
              <ColorPicker
                label="Primary Color"
                value={settings.primary_color}
                onChange={(val) => updateSetting('primary_color', val)}
              />
              <ColorPicker
                label="Secondary Color"
                value={settings.secondary_color}
                onChange={(val) => updateSetting('secondary_color', val)}
              />
            </div>
          </Card>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-5 w-5 text-text-muted" />
              <h3 className="font-semibold text-text">Preview</h3>
            </div>
            <BrandingPreview settings={settings} />
          </Card>
        </div>
      </div>
    </Layout>
  );
}
