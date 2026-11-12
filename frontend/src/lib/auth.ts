const TOKEN_STORAGE_KEY = 'nexus_tab_token';

/**
 * Retrieves the active JWT for the CURRENT browser tab.
 * 1. Checks if ?dev_token=... or ?token=... is present in the current URL query params.
 *    If present, stores it in sessionStorage (which is scoped exclusively to this tab)
 *    and removes it from the URL address bar so it stays clean.
 * 2. Returns the tab's token from sessionStorage.
 * 3. Fallback: checks for access_token cookie if sessionStorage is empty.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('dev_token') || params.get('token');
    if (urlToken) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
      params.delete('dev_token');
      params.delete('token');
      params.delete('login');
      const cleanQuery = params.toString();
      const cleanUrl =
        window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
      return urlToken;
    }

    const sessionToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (sessionToken) {
      return sessionToken;
    }

    // Fallback: check cookie
    const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match && match[1]) {
      const cookieToken = decodeURIComponent(match[1]);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, cookieToken);
      return cookieToken;
    }
  } catch {
    // In case storage access is restricted
  }

  return null;
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignored
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignored
  }
}

/**
 * Tab-scoped fetch wrapper that guarantees the tab's active token is sent
 * via the `Authorization: Bearer <token>` header, preventing other tabs
 * from hijacking the authenticated user.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  const requestInput =
    typeof input === 'string' && /^\/(projects|opportunities)(?:\/|$)/.test(input)
      ? `/api${input}`
      : input;

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(requestInput, {
    ...init,
    headers,
    credentials: 'include',
  });
}
