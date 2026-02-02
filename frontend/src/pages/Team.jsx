/**
 * Team Management Page (Admin only)
 * List, invite, edit, and remove team members
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  User,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  Zap,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { api } from '../services/api';

// ============================================================================
// ROLE BADGE
// ============================================================================

function RoleBadge({ role }) {
  const styles = {
    owner: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    member: 'bg-surface-elevated text-text-muted border-border',
  };
  const icons = { owner: Crown, admin: Shield, member: User };
  const Icon = icons[role] || User;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[role] || styles.member}`}>
      <Icon className="h-3 w-3" />
      {role}
    </span>
  );
}

// ============================================================================
// INVITE MODAL
// ============================================================================

function InviteModal({ onClose, onInvite }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('member');
  const [creditLimit, setCreditLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Email is required'); return; }

    setError('');
    setLoading(true);
    try {
      await onInvite({
        email,
        name: name || undefined,
        role,
        credit_limit: creditLimit ? parseInt(creditLimit) : null,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-text">Invite Team Member</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-elevated">
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
          <Input
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Input
            label="Credit Limit (optional)"
            type="number"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="No limit"
          />

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={loading}>Send Invite</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.getTeam();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch team:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleInvite = async (data) => {
    await api.inviteUser(data);
    await fetchTeam();
  };

  const handleRemove = async (userId) => {
    if (!confirm('Remove this user from the team?')) return;
    try {
      await api.removeUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.updateUser(userId, { status: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Team Management"
        description="Manage your team members and permissions"
        actions={
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Invite User
          </Button>
        }
      />

      {loading ? (
        <Card>
          <LoadingSpinner label="Loading team..." showTimer={false} />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-elevated">
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Credits Used</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Limit</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-text">{user.name}</p>
                      <p className="text-sm text-text-muted">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-green-500/10 text-green-500'
                        : user.status === 'invited'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-text">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      {user.credits_used_this_cycle?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted">
                    {user.credit_limit ? user.credit_limit.toLocaleString() : 'No limit'}
                  </td>
                  <td className="px-6 py-4">
                    {user.role !== 'owner' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleStatus(user.id, user.status)}
                          className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text transition-colors"
                          title={user.status === 'active' ? 'Suspend' : 'Activate'}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(user.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />
      )}
    </Layout>
  );
}
