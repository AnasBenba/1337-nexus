/**
 * Same names as backend/app/oauth/permissions.py. The UI checks permissions (from
 * GET /users/me), never role names, so it follows whatever the backend allows.
 * The backend still enforces every rule; hiding a button is only for the view.
 */
export const Permission = {
  EDIT_OWN_PROFILE: 'profile:edit_own',
  MANAGE_FRIENDS: 'friends:manage',
  VIEW_USERS: 'users:view',
  EDIT_USERS: 'users:edit',
  MANAGE_ROLES: 'users:manage_roles',
  DELETE_USERS: 'users:delete',
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

/** Every role (for filters/badges). */
export const ROLES = ['user', 'admin', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];
/** Roles the API can hand out: "superadmin" is only created by the startup script. */
export const ASSIGNABLE_ROLES = ['user', 'admin'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };

export function can(me: { permissions: string[] }, permission: PermissionName): boolean {
  return me.permissions.includes(permission);
}

/**
 * Same rule as can_manage() in the backend: you can manage only accounts with a lower
 * role than yours, never yourself. So admins manage users, the superadmin manages
 * admins and users, and nobody manages the superadmin.
 */
export function canManage(me: { id: string; role: string }, user: { id: string; role: string }): boolean {
  return me.id !== user.id && (RANK[me.role] ?? -1) > (RANK[user.role] ?? 99);
}
