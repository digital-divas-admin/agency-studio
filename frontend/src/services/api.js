/**
 * API Service
 * Centralized API client for backend communication
 */

import { cookieStorage } from './cookieStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Agency slug storage for dev mode
const AGENCY_SLUG_KEY = 'agency_slug';

export function setAgencySlug(slug) {
  if (slug) {
    localStorage.setItem(AGENCY_SLUG_KEY, slug);
  }
}

export function getAgencySlug() {
  return localStorage.getItem(AGENCY_SLUG_KEY);
}

export function clearAgencySlug() {
  localStorage.removeItem(AGENCY_SLUG_KEY);
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Get auth token from cookies (primary) with localStorage fallback
 */
function getAuthToken() {
  // Primary: Read from cookies (where Supabase stores it)
  const cookieToken = cookieStorage.getItem('supabase.auth.token');

  if (cookieToken) {
    try {
      const parsed = JSON.parse(cookieToken);
      return parsed?.access_token || null;
    } catch (e) {
      console.error('Failed to parse auth token from cookies:', e);
      return null;
    }
  }

  // Fallback: Check localStorage for backward compatibility
  const localToken = localStorage.getItem('supabase.auth.token');
  if (localToken) {
    console.warn('Auth token found in localStorage (deprecated location)');
    try {
      const parsed = JSON.parse(localToken);
      return parsed?.access_token || null;
    } catch (e) {
      console.error('Failed to parse token from localStorage:', e);
      return null;
    }
  }

  return null;
}

/**
 * Make an authenticated API request
 */
async function request(endpoint, options = {}) {
  const { headers = {}, ...rest } = options;

  const accessToken = getAuthToken();

  // Get agency slug for dev mode (in production, subdomain determines agency)
  const agencySlug = import.meta.env.DEV ? getAgencySlug() : null;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...(agencySlug && { 'X-Agency-Slug': agencySlug }),
      ...headers,
    },
  });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMessage = data?.error || data?.message || 'An error occurred';

    // Enhanced 401 errors
    if (response.status === 401) {
      if (!accessToken) {
        errorMessage = 'Authentication required. Please log in again.';
      } else {
        errorMessage = 'Your session has expired. Please log in again.';
      }
    }

    // Add config check hint in development
    if ((response.status === 401 || response.status === 403) && import.meta.env.DEV) {
      console.error('Auth error - check configuration:', {
        hasToken: !!accessToken,
        apiBaseUrl: API_BASE,
        endpoint,
        status: response.status,
      });
    }

    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

/**
 * API methods
 */
export const api = {
  // Agency
  getAgencyConfig: () => request('/api/agency/config'),
  getMe: () => request('/api/agency/me'),
  updateAgencySettings: (settings) =>
    request('/api/agency/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  getUsage: () => request('/api/agency/usage'),
  getDashboard: () => request('/api/agency/dashboard'),
  completeOnboarding: () =>
    request('/api/agency/onboarding/complete', { method: 'PUT' }),

  // Team
  getTeam: () => request('/api/team'),
  inviteUser: (data) =>
    request('/api/team/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (userId, data) =>
    request(`/api/team/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  removeUser: (userId) =>
    request(`/api/team/${userId}`, {
      method: 'DELETE',
    }),

  // Team - Pending Invites
  getPendingInvites: () => request('/api/team/pending-invites'),
  resendInvite: (inviteId) =>
    request(`/api/team/invite/${inviteId}/resend`, { method: 'POST' }),
  revokeInvite: (inviteId) =>
    request(`/api/team/invite/${inviteId}`, { method: 'DELETE' }),

  // Team - Permissions
  updateUserPermissions: (userId, permissions) =>
    request(`/api/team/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),

  // Team - Model Assignment
  assignModels: (userId, modelIds) =>
    request(`/api/team/${userId}/models`, {
      method: 'PUT',
      body: JSON.stringify({ modelIds }),
    }),
  getUserModels: (userId) => request(`/api/team/${userId}/models`),

  // Team - Activity
  getTeamActivity: (limit = 50, offset = 0) =>
    request(`/api/team/activity?limit=${limit}&offset=${offset}`),

  // Image Generation
  generateSeedream: (data) =>
    request('/api/generate/seedream', { method: 'POST', body: JSON.stringify(data) }),
  generateNanoBanana: (data) =>
    request('/api/generate/nano-banana', { method: 'POST', body: JSON.stringify(data) }),
  generateQwen: (data) =>
    request('/api/generate/qwen', { method: 'POST', body: JSON.stringify(data) }),

  // Video Generation
  generateKling: (data) =>
    request('/api/generate/kling', { method: 'POST', body: JSON.stringify(data) }),
  generateWan: (data) =>
    request('/api/generate/wan', { method: 'POST', body: JSON.stringify(data) }),
  generateVeo: (data) =>
    request('/api/generate/veo', { method: 'POST', body: JSON.stringify(data) }),

  // Editing Tools
  removeBg: (data) =>
    request('/api/edit/bg-remover', { method: 'POST', body: JSON.stringify(data) }),
  eraseObject: (data) =>
    request('/api/edit/eraser', { method: 'POST', body: JSON.stringify(data) }),
  qwenEdit: (data) =>
    request('/api/edit/qwen-edit', { method: 'POST', body: JSON.stringify(data) }),
  inpaint: (data) =>
    request('/api/edit/inpaint', { method: 'POST', body: JSON.stringify(data) }),

  // Chat
  sendChat: (data) =>
    request('/api/chat', { method: 'POST', body: JSON.stringify(data) }),

  // Models (agency creators/talent)
  getModels: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/models${query ? `?${query}` : ''}`);
  },
  getModel: (id) => request(`/api/models/${id}`),
  createModel: (data) =>
    request('/api/models', { method: 'POST', body: JSON.stringify(data) }),
  updateModel: (id, data) =>
    request(`/api/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteModel: (id) =>
    request(`/api/models/${id}`, { method: 'DELETE' }),
  uploadModelAvatar: async (formData) => {
    const accessToken = getAuthToken();
    const agencySlug = import.meta.env.DEV ? getAgencySlug() : null;

    const response = await fetch(`${API_BASE}/api/models/upload-avatar`, {
      method: 'POST',
      headers: {
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...(agencySlug && { 'X-Agency-Slug': agencySlug }),
      },
      body: formData, // Don't set Content-Type - browser will set it with boundary
    });

    if (!response.ok) {
      const data = await response.json();
      throw new ApiError(data?.error || 'Upload failed', response.status, data);
    }

    return response.json();
  },

  // Gallery
  uploadToGallery: (data) =>
    request('/api/gallery/upload', { method: 'POST', body: JSON.stringify(data) }),
  getGallery: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/gallery${query ? `?${query}` : ''}`);
  },
  deleteGalleryItem: (id) =>
    request(`/api/gallery/${id}`, { method: 'DELETE' }),
  deleteAllGallery: () =>
    request('/api/gallery', { method: 'DELETE' }),
  toggleFavorite: (id) =>
    request(`/api/gallery/${id}/favorite`, { method: 'PUT' }),

  // Status
  getGenerationStatus: () => request('/api/generate/status'),
  getEditingStatus: () => request('/api/edit/status'),

  // Workflows
  getWorkflows: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/workflows${query ? `?${query}` : ''}`);
  },
  getWorkflow: (id) => request(`/api/workflows/${id}`),
  createWorkflow: (data) =>
    request('/api/workflows', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflow: (id, data) =>
    request(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkflow: (id) =>
    request(`/api/workflows/${id}`, { method: 'DELETE' }),
  saveWorkflowGraph: (id, data) =>
    request(`/api/workflows/${id}/graph`, { method: 'PUT', body: JSON.stringify(data) }),
  cloneWorkflow: (id, data) =>
    request(`/api/workflows/${id}/clone`, { method: 'POST', body: JSON.stringify(data) }),
  getNodeTypes: () => request('/api/workflows/node-types'),
  startWorkflowRun: (id) =>
    request(`/api/workflows/${id}/run`, { method: 'POST' }),
  getWorkflowRun: (runId) => request(`/api/workflows/runs/${runId}`),
  approveWorkflowNode: (runId, nodeId, data = {}) =>
    request(`/api/workflows/runs/${runId}/nodes/${nodeId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelWorkflowRun: (runId) =>
    request(`/api/workflows/runs/${runId}/cancel`, { method: 'POST' }),

  // Workflow Triggers
  getWorkflowTriggers: (workflowId) =>
    request(`/api/workflows/${workflowId}/triggers`),
  createWorkflowTrigger: (workflowId, data) =>
    request(`/api/workflows/${workflowId}/triggers`, { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflowTrigger: (triggerId, data) =>
    request(`/api/workflows/triggers/${triggerId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkflowTrigger: (triggerId) =>
    request(`/api/workflows/triggers/${triggerId}`, { method: 'DELETE' }),

  // Content Requests
  getContentRequests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/content-requests${query ? `?${query}` : ''}`);
  },
  getContentRequest: (id) => request(`/api/content-requests/${id}`),
  createContentRequest: (data) =>
    request('/api/content-requests', { method: 'POST', body: JSON.stringify(data) }),
  updateContentRequest: (id, data) =>
    request(`/api/content-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContentRequest: (id) =>
    request(`/api/content-requests/${id}`, { method: 'DELETE' }),
  reviewContentUpload: (uploadId, data) =>
    request(`/api/content-requests/uploads/${uploadId}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  bulkReviewUploads: (data) =>
    request('/api/content-requests/uploads/bulk-review', { method: 'POST', body: JSON.stringify(data) }),
  getPendingUploads: () => request('/api/content-requests/uploads/pending'),

  // Model Invitations
  inviteModel: (data) =>
    request('/api/model-invitations', { method: 'POST', body: JSON.stringify(data) }),
  getModelInvitations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/model-invitations${query ? `?${query}` : ''}`);
  },
  cancelModelInvitation: (id) =>
    request(`/api/model-invitations/${id}`, { method: 'DELETE' }),

  // Public model invitation endpoints (no auth required)
  validateModelInvitation: (token) =>
    fetch(`${API_BASE}/api/model-invitations/validate/${token}`)
      .then(res => res.json()),
  acceptModelInvitation: (token, data) =>
    fetch(`${API_BASE}/api/model-invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()),

  // Health
  healthCheck: () => request('/health'),

  // Auth - Agency auto-detection (no agency context required)
  // Optional accessToken param to avoid cookie timing issues during auth state changes
  getMyAgencies: async (accessToken = null) => {
    const token = accessToken || getAuthToken();
    if (!token) {
      throw new ApiError('No auth token available', 401);
    }
    const response = await fetch(`${API_BASE}/api/auth/my-agencies`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data?.error || 'Failed to get agencies', response.status, data);
    }
    return response.json();
  },

  // getMe with explicit token (for use during auth state changes)
  getMeWithToken: async (accessToken, agencySlugOverride = null) => {
    const agencySlug = agencySlugOverride || (import.meta.env.DEV ? getAgencySlug() : null);
    const response = await fetch(`${API_BASE}/api/agency/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(agencySlug && { 'X-Agency-Slug': agencySlug }),
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data?.error || 'Failed to load profile', response.status, data);
    }
    return response.json();
  },

  // Trends
  getTrends: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/trends${query ? `?${query}` : ''}`);
  },
  getTrend: (id) => request(`/api/trends/${id}`),
  saveTrend: (id, notes) =>
    request(`/api/trends/${id}/save`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  unsaveTrend: (id) =>
    request(`/api/trends/${id}/save`, { method: 'DELETE' }),
  getSavedTrends: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/trends/saved${query ? `?${query}` : ''}`);
  },
  updateSavedTrendNotes: (savedId, notes) =>
    request(`/api/trends/saved/${savedId}`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),
  removeSavedTrend: (savedId) =>
    request(`/api/trends/saved/${savedId}`, { method: 'DELETE' }),

  // Trends - Tracked Accounts
  getTrendAccounts: () => request('/api/trends/accounts'),
  addTrendAccount: (data) =>
    request('/api/trends/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeTrendAccount: (id) =>
    request(`/api/trends/accounts/${id}`, { method: 'DELETE' }),

  // Branding & White-Label
  getBranding: () => request('/api/admin/branding'),
  updateBranding: (data) =>
    request('/api/admin/branding', { method: 'PUT', body: JSON.stringify(data) }),
  resetBranding: () =>
    request('/api/admin/branding/reset', { method: 'POST' }),

  // Asset Management
  uploadAsset: async (formData) => {
    const token = getAuthToken();
    const agencySlug = import.meta.env.DEV ? getAgencySlug() : null;
    const response = await fetch(`${API_BASE}/api/admin/assets/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(agencySlug && { 'X-Agency-Slug': agencySlug })
      },
      body: formData // Don't set Content-Type, browser will set it with boundary
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.error || 'Upload failed', response.status, error);
    }

    return response.json();
  },
  deleteAsset: (type) =>
    request(`/api/admin/assets/${type}`, { method: 'DELETE' }),
  getAsset: (type) =>
    request(`/api/admin/assets/${type}`),
};

export { ApiError };
