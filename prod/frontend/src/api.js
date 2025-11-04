// =====================
// frontend/src/api.js
// =====================
import axios from 'axios'

// IMPORTANT: keep calls same-origin via Vite proxy.
// Do NOT set VITE_API_BASE to a full https://api-... URL unless you want cross-site+CORS.
const BASE = import.meta.env.VITE_API_BASE || '/api'

// --- cookie helpers
function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift())
  return undefined
}

// --- axios instance
export const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
})

export async function whoami() {
  const r = await fetch('/api/whoami/', { credentials: 'include' });
  if (!r.ok) throw new Error('whoami failed');
  return r.json(); // { authenticated, username?, is_staff? }
}

// --- ensure csrftoken exists once, before first mutating call
let csrfPrimed = false
export async function primeCSRF() {
  if (csrfPrimed && getCookie('csrftoken')) return
  await api.get('/csrf/')
  csrfPrimed = true
}

// --- attach CSRF header on mutating requests
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    // ensure cookie exists
    if (!getCookie('csrftoken')) {
      await primeCSRF()
    }
    const token = getCookie('csrftoken')
    config.headers = config.headers || {}
    if (token) config.headers['X-CSRFToken'] = token // exact casing Django expects
  }
  return config
})

// --- retry once on CSRF failure
let retrying = false
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail || ''
    const looksLikeCsrf =
      status === 403 &&
      /csrf/i.test(detail || '') // "CSRF Failed" etc.

    if (looksLikeCsrf && !retrying) {
      retrying = true
      await primeCSRF()
      // retry original request with fresh cookie/header
      const cfg = err.config
      // (Header will be reattached by request interceptor)
      const res2 = await api.request(cfg)
      retrying = false
      return res2
    }
    retrying = false
    throw err
  }
)

// --- auth helpers
export async function login(username, password) {
  await primeCSRF()
  const { data } = await api.post('/auth/login/', { username, password })
  return data
}
export async function logout() {
  await primeCSRF()
  await api.post('/auth/logout/', {})
}

// --- data helpers
export const getSummary = () => api.get('/summary/')
export const listExpenses = () => api.get('/expenses/')
export const listSettlements = () => api.get('/settlements/')
export const addExpense = (payload) => api.post('/expenses/', payload)
export const addSettlement = (payload) => api.post('/settlements/', payload)

export const getExpense = (id) => api.get(`/expenses/${id}/`)
export const updateExpense = (id, payload, { partial = true } = {}) =>
  (partial ? api.patch(`/expenses/${id}/`, payload) : api.put(`/expenses/${id}/`, payload))
export const deleteExpense = (id) => api.delete(`/expenses/${id}/`)