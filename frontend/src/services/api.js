/**
 * API Service
 * Centralized API client for backend communication
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make an authenticated API request
 */
async function request(endpoint, options = {}) {
  const { headers = {}, ...rest } = options;

  // Get auth token from localStorage
  const token = localStorage.getItem('supabase.auth.token');
  const parsedToken = token ? JSON.parse(token) : null;
  const accessToken = parsedToken?.access_token;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
  });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(
      data?.error || data?.message || 'An error occurred',
      response.status,
      data
    );
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
    const token = localStorage.getItem('supabase.auth.token');
    const parsedToken = token ? JSON.parse(token) : null;
    const accessToken = parsedToken?.access_token;

    const response = await fetch(`${API_BASE}/api/models/upload-avatar`, {
      method: 'POST',
      headers: {
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
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
};

export { ApiError };
