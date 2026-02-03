import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '../common/Button';

/**
 * PermissionEditor Component
 * Modal for editing user permissions
 */
export default function PermissionEditor({ user, onSave, onClose }) {
  const [permissions, setPermissions] = useState(user.permissions || {
    scope: 'assigned',
    can_view_analytics: false,
    can_send_messages: true,
    can_upload_content: true,
    can_publish_content: false,
    can_view_subscribers: false,
    can_export_data: false,
    can_edit_profiles: false
  });
  const [saving, setSaving] = useState(false);

  const permissionDefinitions = [
    { key: 'can_view_analytics', label: 'View Analytics', description: 'Access performance metrics and reports' },
    { key: 'can_send_messages', label: 'Send Messages', description: 'Send messages to subscribers' },
    { key: 'can_upload_content', label: 'Upload Content', description: 'Upload images and videos' },
    { key: 'can_publish_content', label: 'Publish Content', description: 'Publish content without review' },
    { key: 'can_view_subscribers', label: 'View Subscribers', description: 'Access subscriber lists' },
    { key: 'can_export_data', label: 'Export Data', description: 'Export analytics and reports' },
    { key: 'can_edit_profiles', label: 'Edit Profiles', description: 'Modify creator profiles' }
  ];

  const handleToggle = (key) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleScopeChange = (scope) => {
    setPermissions(prev => ({
      ...prev,
      scope
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(permissions);
    } catch (error) {
      console.error('Failed to save permissions:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Permissions
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {user.name || user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Scope Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Creator Access
            </label>
            <div className="space-y-2">
              <label className="flex items-start p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={permissions.scope === 'all'}
                  onChange={() => handleScopeChange('all')}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">All Creators</div>
                  <div className="text-sm text-gray-500">Can access all creators in the agency</div>
                </div>
              </label>
              <label className="flex items-start p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="assigned"
                  checked={permissions.scope === 'assigned'}
                  onChange={() => handleScopeChange('assigned')}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">Assigned Creators Only</div>
                  <div className="text-sm text-gray-500">Can only access specifically assigned creators</div>
                </div>
              </label>
            </div>
          </div>

          {/* Individual Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions
            </label>
            <div className="space-y-1">
              {permissionDefinitions.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={() => handleToggle(key)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900">{label}</div>
                    <div className="text-sm text-gray-500">{description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
