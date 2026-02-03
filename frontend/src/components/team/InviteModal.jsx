import { useState, useEffect } from 'react';
import { X, Send, Users } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { api } from '../../services/api';

/**
 * InviteModal Component
 * Modal for inviting new team members with enhanced options
 */
export default function InviteModal({ onInvite, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedModels, setSelectedModels] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoadingModels(true);
      const response = await api.getModels();
      // Handle both array and object responses
      const allModels = Array.isArray(response) ? response : (response?.models || []);
      setModels(allModels);
    } catch (err) {
      console.error('Failed to load models:', err);
      setModels([]); // Set empty array on error
    } finally {
      setLoadingModels(false);
    }
  };

  const handleToggleModel = (modelId) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      } else {
        return [...prev, modelId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Email is required');
      return;
    }

    if (customMessage.length > 500) {
      setError('Custom message must be 500 characters or less');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onInvite({
        email,
        role,
        customMessage: customMessage.trim() || undefined,
        assignedModels: role === 'member' ? selectedModels : []
      });
      // Close modal on success
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const charCount = customMessage.length;
  const charLimit = 500;
  const isOverLimit = charCount > charLimit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Invite Team Member
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                autoFocus
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {role === 'admin'
                  ? 'Admins can manage team members and access all creators'
                  : 'Members have limited access based on assigned creators and permissions'
                }
              </p>
            </div>

            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Message (Optional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a personal message to the invitation email..."
                rows={4}
                className={`w-full px-3 py-2 border ${isOverLimit ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${isOverLimit ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500">
                  This message will be included in the invitation email
                </p>
                <p className={`text-sm ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
                  {charCount}/{charLimit}
                </p>
              </div>
            </div>

            {/* Model Assignment (only for members) */}
            {role === 'member' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Creators (Optional)
                </label>
                {loadingModels ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : models.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No creators available</p>
                    <p className="text-xs text-gray-500 mt-1">Add creators before inviting members</p>
                  </div>
                ) : (
                  <>
                    <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                      {models.map((model) => (
                        <label
                          key={model.id}
                          className="flex items-center p-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-200 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedModels.includes(model.id)}
                            onChange={() => handleToggleModel(model.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex items-center flex-1">
                            {model.avatar_url && (
                              <img
                                src={model.avatar_url}
                                alt={model.name}
                                className="w-8 h-8 rounded-full object-cover mr-3"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {model.name}
                              </div>
                              {model.slug && (
                                <div className="text-xs text-gray-500">
                                  @{model.slug}
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {selectedModels.length > 0
                        ? `${selectedModels.length} creator${selectedModels.length !== 1 ? 's' : ''} selected`
                        : 'No creators selected - member will have no access until assigned'
                      }
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || isOverLimit}
            >
              <Send className="w-4 h-4 mr-2" />
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
