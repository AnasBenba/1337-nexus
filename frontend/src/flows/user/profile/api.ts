import type { Me, UserProfile } from '@/app/authentication/login/Auth.api';
import { authFetch, errorMessage } from '@/lib/http';

export type ProfileUpdate = { fullname: string; bio: string };

/** A user's profile by login, or null if that user doesn't exist. */
export async function getProfile(login: string): Promise<UserProfile | null> {
  const res = await authFetch(`/api/v1/users/${encodeURIComponent(login)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function uploadAvatar(file: File): Promise<Me> {
  const form = new FormData();
  form.append('file', file);
  // No Content-Type header: the browser sets multipart/form-data with the boundary.
  const res = await authFetch('/api/v1/users/me/avatar', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function deleteAvatar(): Promise<Me> {
  const res = await authFetch('/api/v1/users/me/avatar', { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function updateMyProfile(data: ProfileUpdate): Promise<Me> {
  const res = await authFetch('/api/v1/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
