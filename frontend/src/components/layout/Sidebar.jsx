/**
 * Sidebar Component
 * Main navigation sidebar
 */

import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Image,
  Video,
  Wand2,
  MessageSquare,
  FolderOpen,
  GitBranch,
  Send,
  Users,
  BarChart3,
  Palette,
  Settings,
  LogOut,
  ChevronDown,
  UserCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAgency } from '../../context/AgencyContext';
import { useModel } from '../../context/ModelContext';

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/generate/image', icon: Image, label: 'Image Generation' },
  { to: '/generate/video', icon: Video, label: 'Video Generation' },
  { to: '/edit', icon: Wand2, label: 'Edit Tools' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/gallery', icon: FolderOpen, label: 'Gallery' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/content-requests', icon: Send, label: 'Content Requests' },
];

const adminNavItems = [
  { to: '/admin/models', icon: UserCircle, label: 'Models' },
  { to: '/admin/team', icon: Users, label: 'Team' },
  { to: '/admin/usage', icon: BarChart3, label: 'Usage' },
  { to: '/admin/branding', icon: Palette, label: 'Branding' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out',
          isActive
            ? 'bg-gradient-to-r from-primary to-primary-light text-white shadow-glow/50'
            : 'text-text-muted hover:text-text hover:bg-surface-elevated hover:translate-x-0.5'
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}

function ModelSwitcher() {
  const { models, selectedModel, selectModel, hasModels } = useModel();
  const { isAdmin } = useAuth();

  if (!hasModels) {
    return (
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-text-muted mb-1.5">Active Model</p>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <UserCircle className="h-4 w-4" />
          <span>No models yet</span>
        </div>
        {isAdmin && (
          <NavLink
            to="/admin/models"
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            + Add a model
          </NavLink>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <p className="text-xs text-text-muted mb-1.5">Active Model</p>
      <div className="relative">
        <select
          value={selectedModel?.id || ''}
          onChange={(e) => selectModel(e.target.value)}
          className="w-full appearance-none bg-surface-elevated border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { agencyUser, signOut, credits, isAdmin } = useAuth();
  const { branding, features } = useAgency();

  // Filter nav items based on enabled features
  const filteredMainNav = mainNavItems.filter((item) => {
    if (item.to === '/generate/image' && !features.image_gen) return false;
    if (item.to === '/generate/video' && !features.video_gen) return false;
    if (item.to === '/edit' && !features.editing) return false;
    if (item.to === '/chat' && !features.chat) return false;
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.app_name}
              className="h-8 w-8 object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">
              {branding.app_name?.charAt(0) || 'A'}
            </div>
          )}
          <span className="font-semibold text-text">{branding.app_name}</span>
        </div>
      </div>

      {/* Model Switcher */}
      <ModelSwitcher />

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredMainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Admin
              </p>
            </div>
            {adminNavItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* Credits Display */}
      {credits && (
        <div className="p-4 border-t border-border">
          <div className="bg-surface-elevated rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Credits Remaining</p>
            <p className="text-lg font-semibold text-text">
              {credits.agencyPool?.toLocaleString() || 0}
            </p>
            {credits.userLimit !== null && (
              <p className="text-xs text-text-muted mt-1">
                Your limit: {(credits.userLimit - credits.userUsedThisCycle).toLocaleString()} left
              </p>
            )}
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
              {agencyUser?.name?.charAt(0) || agencyUser?.email?.charAt(0) || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">
                {agencyUser?.name || 'User'}
              </p>
              <p className="text-xs text-text-muted truncate">
                {agencyUser?.role}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
