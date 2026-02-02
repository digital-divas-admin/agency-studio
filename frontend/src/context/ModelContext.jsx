/**
 * Model Context
 * Manages the selected agency model (creator/talent) for content scoping.
 * All generation, gallery, and editing operations reference the selected model.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const ModelContext = createContext(null);

const STORAGE_KEY = 'agency-studio.selectedModelId';

export function ModelProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch models when authenticated
  const fetchModels = useCallback(async () => {
    if (!isAuthenticated) {
      setModels([]);
      setSelectedModel(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getModels();
      const modelList = data.models || [];
      setModels(modelList);

      // Restore previously selected model from localStorage
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const saved = modelList.find((m) => m.id === savedId);
        if (saved) {
          setSelectedModel(saved);
        } else if (modelList.length > 0) {
          // Saved model no longer exists, select first
          setSelectedModel(modelList[0]);
          localStorage.setItem(STORAGE_KEY, modelList[0].id);
        }
      } else if (modelList.length > 0) {
        // No saved selection, select first model
        setSelectedModel(modelList[0]);
        localStorage.setItem(STORAGE_KEY, modelList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Select a model by ID or object
  const selectModel = useCallback((modelOrId) => {
    if (!modelOrId) {
      setSelectedModel(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const model = typeof modelOrId === 'string'
      ? models.find((m) => m.id === modelOrId)
      : modelOrId;

    if (model) {
      setSelectedModel(model);
      localStorage.setItem(STORAGE_KEY, model.id);
    }
  }, [models]);

  // Refresh models list (after create/update/delete)
  const refreshModels = useCallback(async () => {
    try {
      const data = await api.getModels();
      const modelList = data.models || [];
      setModels(modelList);

      // If selected model was deleted/archived, clear selection
      if (selectedModel && !modelList.find((m) => m.id === selectedModel.id)) {
        if (modelList.length > 0) {
          setSelectedModel(modelList[0]);
          localStorage.setItem(STORAGE_KEY, modelList[0].id);
        } else {
          setSelectedModel(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error('Failed to refresh models:', err);
    }
  }, [selectedModel]);

  const value = {
    models,
    selectedModel,
    selectModel,
    refreshModels,
    loading,
    hasModels: models.length > 0,
  };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
