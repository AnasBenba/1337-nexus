import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { UserProfile } from '@/app/authentication/login/Auth.api';
import { Avatar } from '@/components/Avatar';
import type { LayoutContext } from '@/components/Layout';
import { ProfileEditForm } from '@/flows/user/profile/ProfileEditForm';
import { can, Permission, ROLES, type Role } from '@/lib/permissions';
import { AdminUserActions } from './AdminUserActions';
import { listUsers, updateUser, type AdminUserPage } from './api';

const PAGE_SIZE = 20;

export const AdminUsersPage: React.FC = () => {
  const { me } = useOutletContext<LayoutContext>();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const allowed = can(me, Permission.VIEW_USERS);

  const load = useCallback(() => {
    if (!allowed) return;
    listUsers({ q: query, role, page, pageSize: PAGE_SIZE })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [allowed, query, role, page]);

  // Debounce typing; filters and paging apply right away.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // A new search or filter starts again from page 1.
  useEffect(() => setPage(1), [query, role]);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center gap-space-sm py-space-2xl text-on-surface-variant">
        <span className="material-symbols-outlined text-[40px]" aria-hidden="true">
          lock
        </span>
        <p>Only admins can manage users.</p>
      </div>
    );
  }

  const replace = (updated: UserProfile) =>
    setData((d) => d && { ...d, items: d.items.map((u) => (u.id === updated.id ? updated : u)) });

  const first = data && data.total ? (data.page - 1) * data.page_size + 1 : 0;
  const last = data ? Math.min(data.page * data.page_size, data.total) : 0;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-space-lg py-space-xl">
      <div className="flex items-center gap-space-sm">
        <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">
          admin_panel_settings
        </span>
        <h1 className="font-headline-md text-headline-md font-bold">Users</h1>
      </div>

      <section className="flex flex-col gap-space-md rounded bg-surface-container-lowest p-space-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-space-sm">
          <label htmlFor="admin-user-search" className="sr-only">
            Search users by login or name
          </label>
          <div className="flex min-w-[14rem] flex-1 items-center gap-space-sm rounded-full bg-surface-container-low px-space-md py-space-sm">
            <span className="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">
              search
            </span>
            <input
              id="admin-user-search"
              type="search"
              value={query}
              maxLength={50}
              placeholder="Search by login or name…"
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-outline"
            />
          </div>
          <label htmlFor="admin-role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="admin-role-filter"
            value={role}
            onChange={(e) => setRole(e.target.value as Role | '')}
            className="rounded-full bg-surface-container-low px-space-md py-space-sm"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded bg-error-container px-space-md py-space-sm text-on-error-container">
            {error}
          </p>
        )}
        {!data && !error && <p className="text-on-surface-variant">Loading users…</p>}
        {data && data.items.length === 0 && <p className="italic text-on-surface-variant">No users match.</p>}

        <ul className="flex flex-col divide-y divide-surface-container">
          {data?.items.map((user) => (
            <li key={user.id} className="flex flex-col gap-space-sm py-space-sm">
              <div className="flex flex-wrap items-center justify-between gap-space-md">
                <Link to={`/users/${user.login}`} className="flex min-w-0 items-center gap-space-sm">
                  <Avatar name={user.fullname} src={user.avatar_url} className="h-10 w-10 text-[13px]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="truncate font-bold">{user.fullname}</span>
                      <RoleBadge role={user.role} />
                      {user.id === me.id && <span className="text-[12px] text-on-surface-variant">(you)</span>}
                    </div>
                    <div className="truncate font-label-code-tag text-[12px] text-on-surface-variant">@{user.login}</div>
                  </div>
                </Link>
                <AdminUserActions
                  me={me}
                  user={user}
                  onChanged={replace}
                  onDeleted={load}
                  onEdit={() => setEditingId(editingId === user.id ? null : user.id)}
                />
              </div>
              {editingId === user.id && (
                <div className="rounded border border-surface-container-high bg-surface-container-lowest p-space-md">
                  <ProfileEditForm
                    idPrefix={`admin-edit-${user.id}`}
                    user={user}
                    onCancel={() => setEditingId(null)}
                    save={async (changes) => {
                      replace(await updateUser(user.id, changes));
                      setEditingId(null);
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>

        {data && data.total > 0 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-[13px] text-on-surface-variant">
            <span>
              {first}–{last} of {data.total}
            </span>
            <div className="flex gap-space-xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-full px-space-md py-1 hover:bg-surface-container disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= lastPage}
                onClick={() => setPage(page + 1)}
                className="rounded-full px-space-md py-1 hover:bg-surface-container disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
};

/** "admin" / "superadmin" badge; nothing for regular users. */
export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  if (role !== 'admin' && role !== 'superadmin') return null;
  const color = role === 'superadmin' ? 'bg-on-surface text-surface' : 'bg-primary text-on-primary';
  return (
    <span className={`shrink-0 rounded-full px-space-sm py-0.5 font-label-code-tag text-[10px] font-bold uppercase ${color}`}>
      {role}
    </span>
  );
};
