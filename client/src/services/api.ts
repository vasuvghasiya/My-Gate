import axios from 'axios'
import { auth } from '../config/firebase'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken()
        config.headers.Authorization = `Bearer ${token}`
      } catch (error) {
        console.error('Error getting auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      toast.error('Session expired. Please login again.')
      auth.signOut()
    } else if (error.response?.status === 403) {
      toast.error('Access denied. Insufficient permissions.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }
    
    return Promise.reject(error)
  }
)

// API endpoints
export const authAPI = {
  verify: () => api.post('/auth/verify'),
  createProfile: (data: any) => api.post('/auth/create-profile', data),
  updateProfile: (data: any) => api.put('/auth/profile', data),
}

export const visitorAPI = {
  create: (data: any) => api.post('/api/visitors', data),
  getAll: (params?: any) => api.get('/api/visitors', { params }),
  getById: (id: string) => api.get(`/api/visitors/${id}`),
  approve: (id: string) => api.put(`/api/visitors/${id}/approve`),
  deny: (id: string, reason?: string) => api.put(`/api/visitors/${id}/deny`, { reason }),
  checkin: (id: string) => api.put(`/api/visitors/${id}/checkin`),
  checkout: (id: string) => api.put(`/api/visitors/${id}/checkout`),
}

export const chatAPI = {
  sendMessage: (message: string) => api.post('/api/chat', { message }),
  getHistory: (limit?: number) => api.get('/api/chat/history', { params: { limit } }),
  saveMessage: (data: any) => api.post('/api/chat/save', data),
}

export const notificationAPI = {
  send: (data: any) => api.post('/api/notify', data),
  getAll: (params?: any) => api.get('/api/notify', { params }),
  markAsRead: (id: string) => api.put(`/api/notify/${id}/read`),
  registerToken: (token: string, deviceType?: string) => 
    api.post('/api/notify/register-token', { token, deviceType }),
  unregisterToken: (token: string) => 
    api.delete('/api/notify/unregister-token', { data: { token } }),
  getSettings: () => api.get('/api/notify/settings'),
  updateSettings: (settings: any) => api.put('/api/notify/settings', { notificationSettings: settings }),
}

export const adminAPI = {
  getUsers: () => api.get('/api/admin/users'),
  updateUser: (id: string, data: any) => api.put(`/api/admin/users/${id}`, data),
  getAuditEvents: (params?: any) => api.get('/api/admin/audit', { params }),
  getStats: () => api.get('/api/admin/stats'),
  createHousehold: (data: { id: string; flatNo: string; name: string }) =>
    api.post('/api/admin/households', data),
  createAmenity: (data: any) => api.post('/api/admin/amenities', data),
  approveAudit: (id: string) => api.put(`/api/admin/audit/${id}/approve`),
  denyAudit: (id: string) => api.put(`/api/admin/audit/${id}/deny`),
}

export const publicAPI = {
  amenities: () => api.get('/api/public/amenities'),
}

export const auditAPI = {
  list: (params?: any) => api.get('/api/audit', { params }),
  create: (data: any) => api.post('/api/audit', data),
}

export default api
