/**
 * API helpers.
 *
 * NOTE: The app no longer uses any browser-exposed API key.
 * All privileged writes should go through Next.js BFF route handlers
 * that attach an internal server-side key.
 */

/**
 * Make authenticated fetch request to backend API
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
  });
}

/**
 * Make authenticated JSON request
 */
export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
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

