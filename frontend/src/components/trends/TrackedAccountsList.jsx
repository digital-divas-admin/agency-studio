/**
 * TrackedAccountsList Component
 * Manage workspace tracked accounts
 */

import { useState } from 'react';
import {
  Plus,
  Trash2,
  User,
  AlertCircle,
  Check,
  Globe,
  Building2,
} from 'lucide-react';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function TrackedAccountsList({
  globalAccounts = [],
  workspaceAccounts = [],
  workspaceLimit = 20,
  loading = false,
  onAdd,
  onRemove,
  isAdmin = false,
}) {
  const [newHandle, setNewHandle] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHandle.trim() || !onAdd) return;

    setError(null);
    setAdding(true);

    try {
      await onAdd(newHandle.trim());
      setNewHandle('');
    } catch (err) {
      setError(err.message || 'Failed to add account');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id) => {
    if (!onRemove) return;
    try {
      await onRemove(id);
    } catch (err) {
      console.error('Failed to remove account:', err);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading accounts..." showTimer={false} />;
  }

  return (
    <div className="space-y-6">
      {/* Global Accounts (read-only) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-blue-400" />
          <h3 className="font-medium text-text">Global Accounts</h3>
          <span className="text-xs text-text-muted">({globalAccounts.length})</span>
        </div>
        <p className="text-sm text-text-muted mb-3">
          These accounts are available to all workspaces and managed by the platform.
        </p>
        {globalAccounts.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center bg-surface-elevated rounded-lg">
            No global accounts configured
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {globalAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-2 p-2 bg-surface-elevated rounded-lg"
              >
                {account.profile_pic_url ? (
                  <img
                    src={account.profile_pic_url}
                    alt={account.instagram_handle}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">
                    @{account.instagram_handle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Accounts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-text">Workspace Accounts</h3>
          <span className="text-xs text-text-muted">
            ({workspaceAccounts.length}/{workspaceLimit})
          </span>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Add Instagram accounts specific to your workspace to track their trending content.
        </p>

        {/* Add Form (Admin only) */}
        {isAdmin && (
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              placeholder="Instagram handle (e.g., instagram)"
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={adding || workspaceAccounts.length >= workspaceLimit}
            />
            <Button
              type="submit"
              disabled={!newHandle.trim() || adding || workspaceAccounts.length >= workspaceLimit}
            >
              {adding ? (
                'Adding...'
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </>
              )}
            </Button>
          </form>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {workspaceAccounts.length >= workspaceLimit && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Maximum of {workspaceLimit} workspace accounts reached
          </div>
        )}

        {workspaceAccounts.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center bg-surface-elevated rounded-lg">
            No workspace accounts yet. {isAdmin ? 'Add an Instagram handle above to get started.' : 'Ask an admin to add accounts.'}
          </p>
        ) : (
          <div className="space-y-2">
            {workspaceAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg"
              >
                {account.profile_pic_url ? (
                  <img
                    src={account.profile_pic_url}
                    alt={account.instagram_handle}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text">
                    @{account.instagram_handle}
                  </p>
                  {account.last_scraped_at && (
                    <p className="text-xs text-text-muted">
                      Last updated: {new Date(account.last_scraped_at).toLocaleDateString()}
                    </p>
                  )}
                  {account.scrape_error && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {account.scrape_error}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleRemove(account.id)}
                    className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Remove account"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
