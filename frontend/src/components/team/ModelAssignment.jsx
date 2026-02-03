import { useState, useEffect } from 'react';
import { X, Save, Users } from 'lucide-react';
import { Button } from '../common/Button';
import { api } from '../../services/api';

/**
 * ModelAssignment Component
 * Modal for assigning creators to a user
 */
export default function ModelAssignment({ user, onSave, onClose }) {
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all agency models
      const response = await api.getModels();
      const allModels = Array.isArray(response) ? response : (response?.models || []);

      // Load user's current assignments
      const userModelsRes = await api.getUserModels(user.id);
      const userModelIds = Array.isArray(userModelsRes?.models) ? userModelsRes.models.map(m => m.id) : [];

      setModels(allModels);
      setSelectedModels(userModelIds);
    } catch (err) {
      console.error('Failed to load models:', err);
      setError('Failed to load creators');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (modelId) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      } else {
        return [...prev, modelId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedModels.length === models.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(models.map(m => m.id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedModels);
    } catch (error) {
      console.error('Failed to assign models:', error);
      setError('Failed to save assignments');
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
              Assign Creators
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <Button onClick={loadData} variant="secondary" className="mt-4">
                Try Again
              </Button>
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No creators found</p>
              <p className="text-sm text-gray-500 mt-1">
                Add creators first before assigning them to team members
              </p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedModels.length === models.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    Select All ({models.length})
                  </span>
                </label>
              </div>

              {/* Model List */}
              <div className="space-y-1">
                {models.map((model) => (
                  <label
                    key={model.id}
                    className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => handleToggle(model.id)}
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

              {/* Selection Count */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {selectedModels.length} of {models.length} creator{models.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </>
          )}
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
            disabled={saving || loading || error}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Assignments'}
          </Button>
        </div>
      </div>
    </div>
  );
}
