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

let offlineClient = null
export function setOfflineClient(client) { offlineClient = client }

export async function networkRequest(path, token, options = {}) {
  const controller = new AbortController()
  const timeout = options.timeoutMs ?? (/send_backup|send_summary/.test(path) ? 60000 : 12000)
  let timer
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new ApiError('El servidor no responde. Inténtalo de nuevo.', 0, 'TIMEOUT')) }, timeout)
  })
  try {
    const response = await Promise.race([fetch(`${API_BASE}/${path.replace(/^\//, '')}`, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    }), deadline])
    const payload = await Promise.race([response.json().catch(() => { throw new ApiError('El servidor no devolvió una respuesta válida.', response.ok ? 0 : response.status, 'INVALID_RESPONSE') }), deadline])
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.keys(payload).length) throw new ApiError('El servidor no devolvió una respuesta válida.', response.ok ? 0 : response.status, 'INVALID_RESPONSE')
    if (!response.ok || payload.ok === false) {
      throw new ApiError(payload.message || `La API respondió con ${response.status}.`, response.status, payload.code)
    }
    return payload.data ?? payload
  } catch (reason) {
    if (reason instanceof ApiError) throw reason
    throw new ApiError('No se pudo conectar con el servidor.', 0, 'NETWORK_ERROR')
  } finally { clearTimeout(timer) }
}

export const apiRequest = (path, token, options = {}) => offlineClient
  ? offlineClient.request(path, token, options)
  : networkRequest(path, token, options)

export const getJson = (path, token) => apiRequest(path, token)
export const postJson = (path, token, body) =>
  apiRequest(path, token, { method: 'POST', body: JSON.stringify(body) })
