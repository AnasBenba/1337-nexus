import type { UserProfile } from '@/app/authentication/login/Auth.api';
import { api, authFetch, errorMessage } from '@/lib/http';
import type { AssignableRole, Role } from '@/lib/permissions';

export type AdminUserPage = { items: UserProfile[]; total: number; page: number; page_size: number };

export type AdminUserChanges = { fullname?: string; bio?: string; role?: AssignableRole };

const base = '/api/v1/admin/users';
const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function listUsers(params: { q: string; role: Role | ''; page: number; pageSize: number }) {
  const search = new URLSearchParams({ page: String(params.page), page_size: String(params.pageSize) });
  if (params.q.trim()) search.set('q', params.q.trim());
  if (params.role) search.set('role', params.role);
  return api<AdminUserPage>(`${base}?${search}`);
}

export const updateUser = (id: string, changes: AdminUserChanges) =>
  api<UserProfile>(`${base}/${id}`, { method: 'PATCH', ...json(changes) });

export const removeUserAvatar = (id: string) => api<UserProfile>(`${base}/${id}/avatar`, { method: 'DELETE' });

/** 204 No Content on success, so no JSON to parse. */
export async function deleteUser(id: string): Promise<void> {
  const res = await authFetch(`${base}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res));
}
