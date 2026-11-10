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

export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function can(me: { permissions: string[] }, permission: PermissionName): boolean {
  return me.permissions.includes(permission);
}
