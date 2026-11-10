import { authFetch } from '@/lib/http';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function loginWith42(): void {
  window.location.assign(`${API_URL}/auth/login`);
}

/** Any user's public profile (GET /users/{login}). */
export type UserProfile = {
  id: number;
  login: string;
  fullname: string;
  role: string;
  intra_id: number | null;
  bio: string | null;
  avatar_url: string | null;
};

/** Me = my profile + what my role allows (see lib/permissions.ts). */
export type Me = UserProfile & { permissions: string[] };

/** Ask the backend to clear the login cookie. */
export async function logout(): Promise<void> {
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
}

/** The logged-in user, or null when not signed in (no/expired cookie). */
export async function getMe(): Promise<Me | null> {
  const res = await authFetch('/api/v1/users/me');
  return res.ok ? res.json() : null;
}
