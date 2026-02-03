import { useState } from 'react';
import { RotateCcw, Info } from 'lucide-react';

const DEFAULT_PALETTE = {
  background: '#0a0a0a',
  surface: '#141414',
  'surface-elevated': '#1f1f1f',
  text: '#fafafa',
  'text-muted': '#a3a3a3',
  border: '#27272a',
  primary: '#6366f1',
  'primary-hover': '#4f46e5',
  'primary-light': '#818cf8',
  secondary: '#10b981',
  'secondary-hover': '#059669',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444'
};

export function ColorPaletteEditor({ value = {}, onChange, locked = false }) {
  const [palette, setPalette] = useState({ ...DEFAULT_PALETTE, ...value });
  const [showInfo, setShowInfo] = useState(false);

  const handleColorChange = (key, color) => {
    const newPalette = { ...palette, [key]: color };
    setPalette(newPalette);
    onChange(newPalette);
  };

  const handleReset = () => {
    setPalette(DEFAULT_PALETTE);
    onChange(DEFAULT_PALETTE);
  };

  if (locked) {
    return (
      <div className="opacity-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Full Color Palette</h3>
          <div className="px-3 py-1 bg-warning/10 border border-warning/20 rounded-full text-sm text-warning">
            Enterprise Only
          </div>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Upgrade to Enterprise tier to customize every color in your platform
        </p>
      </div>
    );
  }

  const colorGroups = [
    {
      title: 'Backgrounds',
      colors: [
        { key: 'background', label: 'Background', description: 'Main page background' },
        { key: 'surface', label: 'Surface', description: 'Cards and panels' },
        { key: 'surface-elevated', label: 'Surface Elevated', description: 'Hover states' }
      ]
    },
    {
      title: 'Text Colors',
      colors: [
        { key: 'text', label: 'Text', description: 'Primary text color' },
        { key: 'text-muted', label: 'Text Muted', description: 'Secondary text' }
      ]
    },
    {
      title: 'Brand Colors',
      colors: [
        { key: 'primary', label: 'Primary', description: 'Main brand color' },
        { key: 'primary-hover', label: 'Primary Hover', description: 'Hover state' },
        { key: 'primary-light', label: 'Primary Light', description: 'Light variant' },
        { key: 'secondary', label: 'Secondary', description: 'Accent color' },
        { key: 'secondary-hover', label: 'Secondary Hover', description: 'Hover state' }
      ]
    },
    {
      title: 'UI Colors',
      colors: [
        { key: 'border', label: 'Border', description: 'Border and dividers' },
        { key: 'success', label: 'Success', description: 'Success states' },
        { key: 'warning', label: 'Warning', description: 'Warning states' },
        { key: 'error', label: 'Error', description: 'Error states' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Full Color Palette</h3>
          <p className="text-sm text-text-muted mt-1">
            Customize every color used throughout the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Show help"
          >
            <Info className="h-5 w-5" />
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border
                     rounded-lg transition-colors flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset All
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-text-primary">Color Palette Tips</p>
              <ul className="list-disc list-inside space-y-1 text-text-muted">
                <li>Changes apply instantly and affect the entire platform</li>
                <li>Use contrasting colors for text and backgrounds for readability</li>
                <li>Hover states should be slightly darker than base colors</li>
                <li>Test your palette in both light areas and dark UI elements</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {colorGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
              {group.title}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.colors.map((color) => (
                <ColorInput
                  key={color.key}
                  label={color.label}
                  description={color.description}
                  value={palette[color.key]}
                  onChange={(val) => handleColorChange(color.key, val)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Section */}
      <div className="mt-8 p-6 border border-border rounded-lg space-y-4">
        <h4 className="text-sm font-semibold text-text-primary">Live Preview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(palette).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div
                className="h-16 rounded-lg border border-border"
                style={{ backgroundColor: value }}
              />
              <p className="text-xs text-text-muted truncate" title={key}>
                {key}
              </p>
              <p className="text-xs font-mono text-text-muted">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, description, value, onChange }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-text-primary">
          {label}
        </label>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 h-10 rounded border-2 border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg
                   text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
