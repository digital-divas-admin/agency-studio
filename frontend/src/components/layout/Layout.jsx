/**
 * Layout Component
 * Main application layout with sidebar
 */

import { Sidebar } from './Sidebar';
import { clsx } from 'clsx';

export function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

/**
 * Page Header Component
 * Consistent header for pages
 */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        {description && (
          <p className="mt-1 text-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

/**
 * Card Component
 * Container for content sections with multiple variant options
 */
const CARD_VARIANTS = {
  default: 'bg-surface/80 backdrop-blur-sm border border-border/40 shadow-lg shadow-black/10',
  elevated: 'bg-surface-elevated/90 backdrop-blur-sm border border-border/30 shadow-xl shadow-black/20',
  interactive: 'bg-surface/80 backdrop-blur-sm border border-border/40 shadow-lg shadow-black/10 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow/30 cursor-pointer',
  glass: 'bg-surface/40 backdrop-blur-md border border-white/5 shadow-lg',
};

export function Card({ children, className, variant = 'default', ...props }) {
  return (
    <div
      className={clsx('rounded-xl p-6', CARD_VARIANTS[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
