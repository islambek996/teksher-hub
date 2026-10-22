const TOKEN_KEY = 'teksher-hub-access-token'

export const API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
export const API_ENABLED = Boolean(API_BASE)

export function getStoredToken() {
  try { return window.localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

export function storeToken(token) {
  try { window.localStorage.setItem(TOKEN_KEY, token) } catch { /* storage unavailable */ }
}

export function clearStoredToken() {
  try { window.localStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ }
}

export async function apiRequest(path, options = {}) {
  if (!API_BASE) throw new Error('API не настроен. Задайте VITE_API_URL в окружении frontend.')
  const { token = getStoredToken(), auth = true, responseType = 'json', body, headers: customHeaders = {}, ...rest } = options
  const headers = new Headers(customHeaders)
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  let requestBody = body
  if (body !== undefined && body !== null && !isForm && typeof body !== 'string' && !(body instanceof Blob)) {
    headers.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }
  if (auth && token) headers.set('Authorization', 'Bearer ' + token)
  const response = await fetch(API_BASE + path, { ...rest, headers, body: requestBody })
  if (response.status === 204) return null
  if (!response.ok) {
    let message = 'Ошибка сервера (' + response.status + ')'
    try {
      const data = await response.clone().json()
      message = data.error || data.message || message
    } catch {
      try { message = (await response.text()) || message } catch { /* keep fallback */ }
    }
    if (response.status === 401 && auth) clearStoredToken()
    throw new Error(message)
  }
  if (responseType === 'blob') return response.blob()
  if (response.status === 205) return null
  const type = response.headers.get('content-type') || ''
  if (type.includes('application/json')) return response.json()
  return response.text()
}
