import { cacheResponse, cachedResponse, accountId } from '../utils/offlineStore.js';
const BASE_URL = import.meta.env?.VITE_API_URL || 'https://byd-panel.omnisuiteai.com';
export const DELIVERY_CENTRE_URL = import.meta.env?.VITE_DELIVERY_CENTRE_URL || 'https://deliverycentre.goodshowroom.com';

// ---- Auth helpers ----
export const getToken = () => localStorage.getItem('byd_token');
export const setToken = (t) => localStorage.setItem('byd_token', t);
export const removeToken = () => { localStorage.removeItem('byd_token'); localStorage.removeItem('byd_user'); };

// ---- Core fetch wrapper ----
async function request(method, path, body, isFormData = false) {
  const token = getToken();
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const owner = accountId();
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method, headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (method === 'GET' && owner === accountId()) {
      const cached = await cachedResponse(path, owner).catch(() => undefined);
      if (cached !== undefined) return cached;
    }
    throw error;
  }
  if (owner !== accountId()) throw new Error('Account changed. Reload this page.');

  if (res.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Session expired. Sign in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }

  if (res.status === 204) return null;
  const data = await res.json();
  if (method === 'GET') await cacheResponse(path, data, owner).catch(() => {});
  return data;
}

// Convenience wrappers
const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  postForm: (path, formData) => request('POST', path, formData, true),
};

// ============================================================
// Auth
// ============================================================
export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),
  me: () => api.get('/api/auth/me'),
  changePassword: (current_password, new_password) =>
    api.post('/api/auth/change-password', { current_password, new_password }),
};

// ============================================================
// Contractor — Jobs
// ============================================================
export const jobsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/api/contractor/jobs?${q.toString()}`);
  },
  listAll: async (params = {}) => {
    const all = [];
    for (let skip = 0; ; skip += 1000) {
      const page = await jobsApi.list({ ...params, limit: 1000, skip });
      all.push(...page);
      if (page.length < 1000) return all;
    }
  },
  get: (id) => api.get(`/api/contractor/jobs/${id}`),
  create: (data) => api.post('/api/contractor/jobs', data),
  update: (id, data) => api.patch(`/api/contractor/jobs/${id}`, data),
  delete: (id) => api.delete(`/api/contractor/jobs/${id}`),
  updateStatus: (id, status, notes) =>
    api.patch(`/api/contractor/jobs/${id}/status`, { status, notes }),
  fromTemplate: (data) =>
    api.post('/api/contractor/jobs/from-template', data),
  bulkImport: (jobs) =>
    api.post('/api/contractor/jobs/bulk-import', { jobs }),
};

// ============================================================
// Tasks / Checklist
// ============================================================
export const tasksApi = {
  update: (jobId, taskId, data) =>
    api.patch(`/api/contractor/jobs/${jobId}/tasks/${taskId}`, data),
  add: (jobId, title, notes) =>
    api.post(`/api/contractor/jobs/${jobId}/tasks`, { title, notes }),
};

// ============================================================
// Time Tracking
// ============================================================
export const timeApi = {
  clockIn: (jobId, taskId, notes) =>
    api.post(`/api/contractor/jobs/${jobId}/clock-in`, { task_id: taskId, notes }),
  clockOut: (jobId, notes) =>
    api.post(`/api/contractor/jobs/${jobId}/clock-out`, { notes }),
  getLogs: (jobId) =>
    api.get(`/api/contractor/jobs/${jobId}/time-logs`),
  list: async (params = {}) => {
    const all = [];
    for (let skip = 0; ; skip += 1000) {
      const page = await api.get(`/api/contractor/time-logs?${new URLSearchParams({ ...params, skip, limit: 1000 })}`);
      all.push(...page);
      if (page.length < 1000) return all;
    }
  },
  getActive: () =>
    api.get('/api/contractor/time-logs/active'),
};

// ============================================================
// Evidence (Photos/Videos)
// ============================================================
export const evidenceApi = {
  upload: (jobId, file, stage, caption, actionId, capturedAt) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('stage', stage);
    if (actionId) fd.append('client_action_id', actionId);
    if (capturedAt) fd.append('captured_at', capturedAt);
    if (caption) fd.append('caption', caption);
    return api.postForm(`/api/contractor/jobs/${jobId}/evidence`, fd);
  },
  list: (jobId) =>
    api.get(`/api/contractor/jobs/${jobId}/evidence`),
  downloadUrl: (jobId, evidenceId) =>
    `${BASE_URL}/api/contractor/jobs/${jobId}/evidence/${evidenceId}/download?token=${getToken()}`,
};

// ============================================================
// Location
// ============================================================
export const locationApi = {
  checkIn: (jobId, data) =>
    api.post(`/api/contractor/jobs/${jobId}/location`, data),
  history: (jobId) =>
    api.get(`/api/contractor/jobs/${jobId}/location-history`),
};

// ============================================================
// Activity & Comments
// ============================================================
export const activityApi = {
  list: (jobId) =>
    api.get(`/api/contractor/jobs/${jobId}/activity`),
  addComment: (jobId, message) =>
    api.post(`/api/contractor/jobs/${jobId}/comments`, { message }),
  flagIssue: (jobId, description, is_urgent, photos) =>
    api.post(`/api/contractor/jobs/${jobId}/flag-issue`, { description, is_urgent, photos }),
  resolveIssue: (jobId, notes) =>
    api.post(`/api/contractor/jobs/${jobId}/resolve-issue`, { notes }),
};

// ============================================================
// Templates
// ============================================================
export const templatesApi = {
  list: () => api.get('/api/contractor/templates'),
  create: (data) => api.post('/api/contractor/templates', data),
  update: (id, data) => api.patch(`/api/contractor/templates/${id}`, data),
  delete: (id) => api.delete(`/api/contractor/templates/${id}`),
};

// ============================================================
// Analytics & Dashboard
// ============================================================
export const analyticsApi = {
  dashboard: () => api.get('/api/contractor/dashboard'),
  analytics: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    return api.get(`/api/contractor/analytics?${q.toString()}`);
  },
  export: (format = 'csv', params = {}) => {
    const q = new URLSearchParams(params);
    return api.get(`/api/contractor/export${format !== 'csv' ? `/${format}` : ''}?${q.toString()}`);
  },
};

// ============================================================
// Integration Sync
// ============================================================
export const integrationApi = {
  fromClient: (clientId, data) =>
    api.post(`/api/contractor/integrations/from-client/${clientId}`, data),
  syncToClient: (jobId) =>
    api.post(`/api/contractor/integrations/sync-to-client/${jobId}`),
  syncStatus: () =>
    api.get('/api/contractor/integrations/sync-status'),
  poll: () =>
    api.post('/api/contractor/integrations/poll'),
  getConfig: () =>
    api.get('/api/contractor/integrations/config'),
  saveConfig: (data) =>
    api.post('/api/contractor/integrations/config', data),
};

// ============================================================
// Admin
// ============================================================
export const adminApi = {
  listUsers: (role, active_only) => {
    const q = new URLSearchParams();
    if (role) q.set('role', role);
    if (active_only) q.set('active_only', 'true');
    return api.get(`/api/contractor/users?${q.toString()}`);
  },
  createUser: (data) => api.post('/api/contractor/users', data),
  updateUser: (uid, data) => api.patch(`/api/contractor/users/${uid}`, data),
  resetPassword: (uid) => api.post(`/api/contractor/users/${uid}/reset-password`),
  deactivateUser: (uid) => api.delete(`/api/contractor/users/${uid}`),
  auditLog: (limit = 100) => api.get(`/api/admin/audit?limit=${limit}`),
};

// ============================================================
// Contractors list (for assignment)
// ============================================================
export const contractorsApi = {
  list: () => api.get('/api/contractor/contractors'),
};

// ============================================================
// Offline Batch Sync
// ============================================================
export const offlineApi = {
  sync: (actions) =>
    api.post('/api/contractor/sync/offline-batch', { actions }),
};

// ============================================================
// Push notifications
// ============================================================
export const pushApi = {
  getVapidKey: () => api.get('/api/contractor/push/vapid-public-key'),
  subscribe: (subscription, device_info) =>
    api.post('/api/contractor/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys?.p256dh, auth: subscription.keys?.auth },
      device_info,
    }),
  sendTest: (data) => api.post('/api/contractor/push/send-test', data),
};

export default api;