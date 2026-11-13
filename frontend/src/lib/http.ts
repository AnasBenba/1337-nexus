/** Turn a FastAPI error body (string detail or 422 list) into one readable message. */
export async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    // non-JSON body: fall through
  }
  return `Request failed (${res.status})`;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Get a new access token using the refresh cookie. Requests that hit a 401 at the
 * same time all wait on this one call instead of each refreshing.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** fetch() with the login cookie. On 401 (access token expired) refresh once and retry. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (res.status !== 401 || !(await refreshSession())) return res;
  return fetch(url, { credentials: 'include', ...init });
}

/** authFetch() + JSON parsing; throws a readable Error on failure. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
