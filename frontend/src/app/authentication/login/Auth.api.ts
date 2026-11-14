import { authFetch, errorMessage } from '@/lib/http';

export function loginWith42(): void {
  window.location.assign('/api/v1/auth/oauth/42/login');
}

/** Any user's public profile (GET /users/{login}). */
export type UserProfile = {
  id: string;
  login: string;
  fullname: string;
  role: string;
  intra_id: number | null;
  bio: string | null;
  avatar_url: string | null;
};

/** Me = my profile + what my role allows (see lib/permissions.ts). */
export type Me = UserProfile & { permissions: string[] };

export type SignupData = { email: string; login: string; fullname: string; password: string };

// Same rules as backend/app/oauth/email_auth.py, checked here too for instant feedback.
export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9_-]{2,19}$/;
export const RESERVED_LOGINS = new Set(['me', 'admin', 'api', 'login', 'signup', 'friends', 'users']);
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

async function postAuth(path: string, body: unknown): Promise<Me> {
  // Plain fetch (not authFetch): a 401 here means wrong credentials, not an expired session.
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

/** Create an account; the backend also logs you in (sets the cookies). */
export const signupWithEmail = (data: SignupData) => postAuth('/api/v1/auth/signup', data);

export const loginWithEmail = (email: string, password: string) =>
  postAuth('/api/v1/auth/login', { email, password });

/**
 * Am I signed in? Uses /auth/session, which always answers 200 (no 401 in the console)
 * and quietly renews an expired access token from the refresh cookie.
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/session', { credentials: 'include' });
    return res.ok && (await res.json()).signed_in === true;
  } catch {
    return false;
  }
}

/** Ask the backend to clear the login cookie. */
export async function logout(): Promise<void> {
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
}

/** The logged-in user, or null when not signed in (no/expired cookie). */
export async function getMe(): Promise<Me | null> {
  const res = await authFetch('/api/v1/users/me');
  return res.ok ? res.json() : null;
}
