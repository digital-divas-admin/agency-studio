/**
 * TrendsFilters Component
 * Filter controls for the trends feed
 */

import { Globe, Building2, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';

const sourceOptions = [
  { id: 'all', label: 'All', icon: null },
  { id: 'global', label: 'Global', icon: Globe },
  { id: 'workspace', label: 'Workspace', icon: Building2 },
];

export function TrendsFilters({ source, onSourceChange }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex gap-1 bg-surface rounded-lg border border-border p-1">
        {sourceOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onSourceChange(option.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
              source === option.id
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            )}
          >
            {option.icon && <option.icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
