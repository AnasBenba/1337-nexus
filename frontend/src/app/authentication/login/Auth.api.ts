// Must match backend/app/oauth/schemas.py so we fail before the round-trip when possible.
export const LOGIN_PATTERN = /^[a-z0-9_-]{3,32}$/;
export const RESERVED_LOGINS = new Set(['admin', 'moderator', 'root', 'system', 'support']);
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type UserProfile = {
  id: string;
  intra_id: number | null;
  login: string;
  fullname: string;
  email: string | null;
  bio?: string | null;
  avatar_url: string | null;
  role: string;
};

export type Me = UserProfile & {
  bio: string | null;
  permissions: string[];
};

export type SignupInput = {
  email: string;
  login: string;
  fullname: string;
  password: string;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const detail = payload?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? String(detail[0].msg)
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** Redirects the whole tab to the backend, which 302s to api.intra.42.fr. */
export function loginWith42(): void {
  window.location.href = '/auth/login';
}

export async function loginWithEmail(emailOrLogin: string, password: string): Promise<UserProfile> {
  const res = await postJson<{ user?: UserProfile } & UserProfile>('/api/v1/auth/login', {
    login_or_email: emailOrLogin,
    email: emailOrLogin,
    password,
  });
  return res.user ?? res;
}

export async function signupWithEmail(data: SignupInput): Promise<UserProfile> {
  const res = await postJson<{ user?: UserProfile } & UserProfile>('/api/v1/auth/signup', data);
  return res.user ?? res;
}

export async function isSignedIn(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/session', { credentials: 'include' });
    if (!res.ok) return false;
    const data = (await res.json()) as { signed_in?: boolean };
    return data.signed_in === true;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function getMe(): Promise<Me | null> {
  const res = await fetch('/api/v1/users/me', { credentials: 'include' });
  return res.ok ? ((await res.json()) as Me) : null;
}

