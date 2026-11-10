import React, { useState } from 'react';
import type { Me, UserProfile } from '@/app/authentication/login/Auth.api';
import { can, Permission, ROLES, type Role } from '@/lib/permissions';
import { deleteUser, removeUserAvatar, updateUser } from './api';

type Props = {
  me: Me;
  user: UserProfile;
  onChanged: (user: UserProfile) => void;
  onDeleted: () => void;
  /** If given, an "Edit" button is shown (the parent opens the edit form). */
  onEdit?: () => void;
};

const button =
  'flex items-center gap-1 rounded-full px-space-sm py-1 text-[13px] disabled:cursor-not-allowed disabled:opacity-40';

/** Admin controls for one user. Each control only appears if my role has that permission. */
export const AdminUserActions: React.FC<Props> = ({ me, user, onChanged, onDeleted, onEdit }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSelf = user.id === me.id;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = (role: Role) => {
    const verb = role === 'admin' ? 'Make' : 'Remove admin from';
    if (!window.confirm(`${verb} @${user.login}${role === 'admin' ? ' an admin' : ''}?`)) return;
    void run(async () => onChanged(await updateUser(user.id, { role })));
  };

  const remove = () => {
    if (!window.confirm(`Delete @${user.login}? This removes their account, friends and sessions.`)) return;
    void run(async () => {
      await deleteUser(user.id);
      onDeleted();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-space-xs">
        {can(me, Permission.MANAGE_ROLES) && (
          <select
            aria-label={`Role of @${user.login}`}
            title={isSelf ? "You can't change your own role" : 'Change role'}
            value={user.role}
            disabled={busy || isSelf}
            onChange={(e) => changeRole(e.target.value as Role)}
            className="rounded-full bg-surface-container px-space-sm py-1 text-[13px] disabled:opacity-40"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        )}
        {onEdit && can(me, Permission.EDIT_USERS) && (
          <button type="button" disabled={busy} onClick={onEdit} className={`${button} hover:bg-surface-container`}>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              edit
            </span>
            Edit
          </button>
        )}
        {user.avatar_url && can(me, Permission.EDIT_USERS) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(async () => onChanged(await removeUserAvatar(user.id)))}
            className={`${button} hover:bg-surface-container`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              hide_image
            </span>
            Remove photo
          </button>
        )}
        {can(me, Permission.DELETE_USERS) && (
          <button
            type="button"
            disabled={busy || isSelf}
            title={isSelf ? "You can't delete your own account here" : `Delete @${user.login}`}
            onClick={remove}
            className={`${button} text-error hover:bg-error-container`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              delete
            </span>
            Delete
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
};
