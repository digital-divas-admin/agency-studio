/**
 * Team Management Page (Admin only)
 * Enhanced with permissions, model assignments, and activity tracking
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  User,
  Trash2,
  Edit2,
  Settings,
  Clock,
  Mail,
  RefreshCw,
  XCircle,
  Zap,
  Search,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { api } from '../services/api';
import InviteModal from '../components/team/InviteModal';
import PermissionEditor from '../components/team/PermissionEditor';
import ModelAssignment from '../components/team/ModelAssignment';

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
// MAIN PAGE
// ============================================================================

export function TeamPage() {
  // State
  const [activeTab, setActiveTab] = useState('team'); // 'team', 'invites', 'activity'
  const [users, setUsers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [activities, setActivities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [assigningModels, setAssigningModels] = useState(null);

  // Fetch team members
  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTeam();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch team:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pending invites
  const fetchInvites = useCallback(async () => {
    try {
      setInvitesLoading(true);
      const data = await api.getPendingInvites();
      setPendingInvites(data.invites || []);
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  // Fetch activity log
  const fetchActivity = useCallback(async () => {
    try {
      setActivityLoading(true);
      const data = await api.getTeamActivity(50, 0);
      setActivities(data.activities || []);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    if (activeTab === 'invites' && pendingInvites.length === 0) {
      fetchInvites();
    }
  }, [activeTab, fetchInvites, pendingInvites.length]);

  useEffect(() => {
    if (activeTab === 'activity' && activities.length === 0) {
      fetchActivity();
    }
  }, [activeTab, fetchActivity, activities.length]);

  // Handlers
  const handleInvite = async (data) => {
    await api.inviteUser(data);
    await fetchTeam();
    if (activeTab === 'invites') {
      await fetchInvites();
    }
    setShowInviteModal(false);
  };

  const handleResendInvite = async (inviteId) => {
    try {
      await api.resendInvite(inviteId);
      alert('Invitation resent successfully');
      await fetchInvites();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    if (!confirm('Revoke this invitation?')) return;
    try {
      await api.revokeInvite(inviteId);
      await fetchInvites();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSavePermissions = async (permissions) => {
    if (!editingPermissions) return;
    try {
      await api.updateUserPermissions(editingPermissions.id, permissions);
      await fetchTeam();
      setEditingPermissions(null);
      alert('Permissions updated successfully');
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  const handleSaveModels = async (modelIds) => {
    if (!assigningModels) return;
    try {
      await api.assignModels(assigningModels.id, modelIds);
      await fetchTeam();
      setAssigningModels(null);
      alert('Creators assigned successfully');
    } catch (err) {
      alert(err.message);
      throw err;
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

  const handleRemove = async (userId) => {
    if (!confirm('Remove this user from the team?')) return;
    try {
      await api.removeUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get action label for activity
  const getActionLabel = (action) => {
    const labels = {
      invite_sent: 'Invitation Sent',
      invite_resent: 'Invitation Resent',
      invite_revoked: 'Invitation Revoked',
      user_joined: 'User Joined',
      user_removed: 'User Removed',
      user_suspended: 'User Suspended',
      user_activated: 'User Activated',
      role_changed: 'Role Changed',
      permissions_updated: 'Permissions Updated',
      models_assigned: 'Creators Assigned',
      models_unassigned: 'Creators Unassigned',
    };
    return labels[action] || action;
  };

  return (
    <Layout>
      <PageHeader
        title="Team Management"
        description="Manage your team members, permissions, and invitations"
        actions={
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Invite User
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'team'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Team ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'invites'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Mail className="h-4 w-4 inline mr-2" />
          Pending Invites ({pendingInvites.length})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'activity'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Clock className="h-4 w-4 inline mr-2" />
          Activity Log
        </button>
      </div>

      {/* Active Team Tab */}
      {activeTab === 'team' && (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-muted" />
              <Input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <Card>
              <LoadingSpinner label="Loading team..." showTimer={false} />
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Member</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Access</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Assigned Creators</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
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
                        <span className="text-sm text-text-muted">
                          {user.model_access === 'all' ? 'All Creators' : 'Assigned Only'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {user.model_access === 'all' ? (
                            <span className="text-sm text-text-muted">All</span>
                          ) : user.assigned_models?.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {user.assigned_models.slice(0, 3).map((model) => (
                                <img
                                  key={model.id}
                                  src={model.avatar_url}
                                  alt={model.name}
                                  className="w-6 h-6 rounded-full object-cover border border-border"
                                  title={model.name}
                                />
                              ))}
                              {user.assigned_models.length > 3 && (
                                <span className="text-xs text-text-muted">
                                  +{user.assigned_models.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-text-muted">None</span>
                          )}
                        </div>
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
                        {user.role !== 'owner' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingPermissions(user)}
                              className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text transition-colors"
                              title="Edit Permissions"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setAssigningModels(user)}
                              className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text transition-colors"
                              title="Assign Creators"
                            >
                              <Users className="h-4 w-4" />
                            </button>
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
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-text-muted mx-auto mb-3" />
                  <p className="text-text-muted">
                    {searchQuery ? 'No team members match your search' : 'No team members yet'}
                  </p>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Pending Invites Tab */}
      {activeTab === 'invites' && (
        <Card className="overflow-hidden p-0">
          {invitesLoading ? (
            <div className="p-12">
              <LoadingSpinner label="Loading invitations..." showTimer={false} />
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted">No pending invitations</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-elevated">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Invited By</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Expires</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => {
                  const isExpired = new Date(invite.expires_at) < new Date();
                  return (
                    <tr key={invite.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-text">{invite.email}</p>
                        {invite.custom_message && (
                          <p className="text-xs text-text-muted mt-1 truncate max-w-xs">
                            "{invite.custom_message}"
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={invite.role} />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-text-muted">
                          {invite.agency_users?.name || invite.agency_users?.email || 'Unknown'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${isExpired ? 'text-red-500' : 'text-text-muted'}`}>
                          {isExpired ? 'Expired' : formatDate(invite.expires_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleResendInvite(invite.id)}
                            className="p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text transition-colors"
                            title="Resend"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(invite.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                            title="Revoke"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <Card className="overflow-hidden p-0">
          {activityLoading ? (
            <div className="p-12">
              <LoadingSpinner label="Loading activity..." showTimer={false} />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted">No activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((activity) => (
                <div key={activity.id} className="px-6 py-4 hover:bg-surface-elevated/50">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center">
                      <Clock className="h-4 w-4 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">
                        {getActionLabel(activity.action)}
                      </p>
                      <p className="text-sm text-text-muted mt-1">
                        {activity.actor?.name || activity.actor?.email || 'System'}
                        {activity.target && (
                          <> → {activity.target.name || activity.target.email}</>
                        )}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteModal
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {editingPermissions && (
        <PermissionEditor
          user={editingPermissions}
          onSave={handleSavePermissions}
          onClose={() => setEditingPermissions(null)}
        />
      )}

      {assigningModels && (
        <ModelAssignment
          user={assigningModels}
          onSave={handleSaveModels}
          onClose={() => setAssigningModels(null)}
        />
      )}
    </Layout>
  );
}
