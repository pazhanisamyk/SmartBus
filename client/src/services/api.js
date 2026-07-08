import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const busApi = {
  getAll: (params) => api.get('/buses', { params }),
  getById: (id) => api.get(`/buses/${id}`),
  create: (data) => api.post('/buses', data),
  update: (id, data) => api.patch(`/buses/${id}`, data),
  delete: (id) => api.delete(`/buses/${id}`),
};

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  updatePassword: (data) => api.post('/auth/update-password', data),
};

export default api;
