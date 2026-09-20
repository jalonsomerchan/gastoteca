const configuredBase = import.meta.env.VITE_API_BASE
const defaultBase =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? 'http://localhost/OV2/api'
    : 'https://alon.one/api'

export const API_BASE = (configuredBase || defaultBase).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0, code = '') {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE}/${path.replace(/^\//, '')}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload.message || `La API respondió con ${response.status}.`, response.status, payload.code)
  }
  return payload.data ?? payload
}

export const getJson = (path, token) => apiRequest(path, token)
export const postJson = (path, token, body) =>
  apiRequest(path, token, { method: 'POST', body: JSON.stringify(body) })
