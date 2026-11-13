import type { Me, UserProfile } from '@/app/authentication/login/Auth.api';
import { authFetch, errorMessage } from '@/lib/http';

export type ProfileUpdate = { fullname: string; bio: string };

export async function getMyProfile(): Promise<Me> {
  const res = await authFetch('/api/v1/users/me');
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as Me;
}

export async function getProfile(login: string): Promise<UserProfile | null> {
  const res = await authFetch(`/api/v1/users/${encodeURIComponent(login)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as UserProfile;
}

export async function uploadAvatar(file: File): Promise<Me> {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch('/api/v1/users/me/avatar', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as Me;
}

export async function deleteAvatar(): Promise<Me> {
  const res = await authFetch('/api/v1/users/me/avatar', { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as Me;
}

export async function updateMyProfile(data: ProfileUpdate): Promise<Me> {
  const res = await authFetch('/api/v1/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as Me;
}

