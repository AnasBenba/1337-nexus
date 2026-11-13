/** Permission names aligned with backend/app/oauth/permissions.py. */
export const Permission = {
  EDIT_OWN_PROFILE: 'profile:edit_own',
  MANAGE_FRIENDS: 'friends:manage',
  VIEW_USERS: 'users:view',
  EDIT_USERS: 'users:edit',
  MANAGE_ROLES: 'users:manage_roles',
  DELETE_USERS: 'users:delete',
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

export const ROLES = ['user', 'admin', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

export const ASSIGNABLE_ROLES = ['user', 'admin'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };

export function can(me: { permissions?: string[] } | null | undefined, permission: PermissionName): boolean {
  if (!me || !Array.isArray(me.permissions)) return false;
  return me.permissions.includes(permission);
}

export function canManage(
  me: { id: string; role: string },
  user: { id: string; role: string },
): boolean {
  return me.id !== user.id && (RANK[me.role] ?? -1) > (RANK[user.role] ?? 99);
}

