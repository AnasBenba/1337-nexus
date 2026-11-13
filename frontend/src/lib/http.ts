/** Extract a human-readable error message from a FastAPI error response. */
export async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && typeof body.detail[0]?.msg === 'string') {
      return body.detail[0].msg;
    }
  } catch {
    // Non-JSON response: fall back to status text.
  }
  return `Request failed (${res.status})`;
}

/** fetch() wrapper that always includes credentials cleanly. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { credentials: 'include', ...init });
}

/** authFetch() + JSON parsing with descriptive errors on non-2xx responses. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

