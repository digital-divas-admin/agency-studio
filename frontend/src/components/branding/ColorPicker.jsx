import { useState } from 'react';
import { Lock } from 'lucide-react';

export function ColorPicker({
  label,
  value,
  onChange,
  locked = false,
  helpText = null
}) {
  const [localValue, setLocalValue] = useState(value || '#6366f1');

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  if (locked) {
    return (
      <div className="space-y-2 opacity-50">
        <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
          {label}
          <Lock className="h-4 w-4 text-text-muted" />
        </label>
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <div
            className="w-12 h-12 rounded-lg border-2 border-border bg-gray-200"
            title="Upgrade to unlock"
          />
          <div className="flex-1">
            <p className="text-sm text-text-muted">Upgrade to customize</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-primary">
        {label}
      </label>

      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={localValue}
            onChange={handleChange}
            className="w-12 h-12 rounded-lg border-2 border-border cursor-pointer"
          />
        </div>

        <div className="flex-1">
          <input
            type="text"
            value={localValue}
            onChange={handleChange}
            placeholder="#6366f1"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg
                     text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {helpText && (
        <p className="text-xs text-text-muted">{helpText}</p>
      )}
    </div>
  );
}
