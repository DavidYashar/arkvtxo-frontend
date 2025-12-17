/**
 * Authenticated API client for backend requests
 * Automatically adds API key to all requests
 */

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

/**
 * Make authenticated fetch request to backend API
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // Add API key header if configured
  if (API_KEY) {
    headers.set('X-API-Key', API_KEY);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make authenticated JSON request
 */
export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  if (API_KEY) {
    headers.set('X-API-Key', API_KEY);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get WebSocket auth token
 */
export function getWebSocketToken(): string {
  return API_KEY;
}
