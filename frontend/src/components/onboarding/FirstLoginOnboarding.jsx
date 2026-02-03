import { useNavigate } from 'react-router-dom';
import { Check, X, Users, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';

/**
 * FirstLoginOnboarding Component
 * Welcome screen shown to new users on their first login
 */
export default function FirstLoginOnboarding({ user, assignedModels = [] }) {
  const navigate = useNavigate();

  const permissions = user?.permissions || {};
  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'owner' ? 'Owner' : 'Member';

  const permissionsList = [
    { key: 'can_view_analytics', label: 'View Analytics', enabled: permissions.can_view_analytics },
    { key: 'can_send_messages', label: 'Send Messages', enabled: permissions.can_send_messages },
    { key: 'can_upload_content', label: 'Upload Content', enabled: permissions.can_upload_content },
    { key: 'can_publish_content', label: 'Publish Content', enabled: permissions.can_publish_content },
    { key: 'can_view_subscribers', label: 'View Subscribers', enabled: permissions.can_view_subscribers },
    { key: 'can_export_data', label: 'Export Data', enabled: permissions.can_export_data },
    { key: 'can_edit_profiles', label: 'Edit Profiles', enabled: permissions.can_edit_profiles }
  ];

  const handleContinue = () => {
    // Clear the onboarding flag so it doesn't show again
    localStorage.removeItem('show_team_onboarding');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to the Team!
            </h1>
            <p className="text-blue-100 text-lg">
              {user?.name || user?.email}
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {/* Role Info */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Your Role & Access
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                    {roleLabel}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {permissions.scope === 'all'
                    ? 'You have access to all creators in the agency'
                    : 'You have access to specifically assigned creators'
                  }
                </p>
              </div>
            </div>

            {/* Assigned Creators */}
            {permissions.scope !== 'all' && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Assigned Creators
                </h2>
                {assignedModels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assignedModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        {model.avatar_url && (
                          <img
                            src={model.avatar_url}
                            alt={model.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {model.name}
                          </p>
                          {model.slug && (
                            <p className="text-sm text-gray-500 truncate">
                              @{model.slug}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Users className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                    <p className="text-gray-700 font-medium mb-1">
                      No Creators Assigned Yet
                    </p>
                    <p className="text-sm text-gray-600">
                      Contact your admin to get assigned to creators
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Permissions */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Your Permissions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {permissionsList.map(({ key, label, enabled }) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      enabled
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}>
                      {enabled ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <X className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      enabled ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Need help?</strong> If you need additional access or have questions about your permissions,
                reach out to your agency admin.
              </p>
            </div>

            {/* CTA Button */}
            <div className="text-center">
              <Button
                onClick={handleContinue}
                variant="primary"
                className="w-full sm:w-auto px-8"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500 mt-6">
          You can always view this information in your profile settings
        </p>
      </div>
    </div>
  );
}
