import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import type { LayoutContext } from '@/components/Layout';
import {
  getFriends,
  searchUsers,
  statusFromOverview,
  type FriendsOverview,
  type UserSummary,
} from './api';
import { FriendButton } from './FriendButton';
import { onPresence } from '@/lib/presence';

export const FriendsPage: React.FC = () => {
  const { me } = useOutletContext<LayoutContext>();
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getFriends()
      .then(setOverview)
      .catch((err: Error) => setLoadError(err.message));
  }, []);
  useEffect(reload, [reload]);

  // Live online/offline updates for my friends (no polling).
  useEffect(
    () =>
      onPresence(({ user_id, online }) =>
        setOverview((o) => o && { ...o, friends: o.friends.map((f) => (f.id === user_id ? { ...f, online } : f)) }),
      ),
    [],
  );

  // Search, debounced so we don't send a request on every keystroke.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) return setResults(null);
    let stale = false;
    const timer = setTimeout(() => {
      searchUsers(q)
        .then((users) => !stale && setResults(users.filter((u) => u.login !== me.login)))
        .catch(() => !stale && setResults([]));
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, me.login]);

  if (loadError) return <p className="py-space-2xl text-center text-error">{loadError}</p>;
  if (!overview) return <p className="py-space-2xl text-center text-on-surface-variant">Loading friends…</p>;

  const row = (user: UserSummary) => {
    const status = statusFromOverview(overview, user.login);
    const online = status === 'friends' ? overview.friends.find((f) => f.id === user.id)?.online : undefined;
    return (
      <UserRow key={user.id} user={user} online={online}>
        <FriendButton login={user.login} status={status} onChange={reload} />
      </UserRow>
    );
  };
  const friendsOnlineFirst = [...overview.friends].sort((a, b) => Number(b.online) - Number(a.online));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-space-lg py-space-xl">
      <h1 className="font-headline-md text-headline-md font-bold">Friends</h1>

      <Section title="Find people">
        <label htmlFor="friend-search" className="sr-only">
          Search users by login or name
        </label>
        <div className="flex items-center gap-space-sm rounded-full bg-surface-container-low px-space-md py-space-sm">
          <span className="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">
            search
          </span>
          <input
            id="friend-search"
            type="search"
            value={query}
            maxLength={50}
            placeholder="Search by login or name…"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-outline"
          />
        </div>
        {results && (results.length ? results.map(row) : <Empty text="No users match that search." />)}
      </Section>

      {overview.incoming.length > 0 && (
        <Section title={`Friend requests (${overview.incoming.length})`}>{overview.incoming.map(row)}</Section>
      )}

      {overview.outgoing.length > 0 && (
        <Section title={`Sent requests (${overview.outgoing.length})`}>{overview.outgoing.map(row)}</Section>
      )}

      <Section title={`Your friends (${overview.friends.length})`}>
        {overview.friends.length ? (
          friendsOnlineFirst.map(row)
        ) : (
          <Empty text="No friends yet. Search for someone above to send a request." />
        )}
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-space-sm rounded bg-surface-container-lowest p-space-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
    <h2 className="font-label-md text-label-md font-bold uppercase tracking-wide text-on-surface-variant">
      {title}
    </h2>
    {children}
  </section>
);

type UserRowProps = { user: UserSummary; online?: boolean; children: React.ReactNode };

const UserRow: React.FC<UserRowProps> = ({ user, online, children }) => (
  <div className="flex items-center justify-between gap-space-md rounded px-space-sm py-space-xs hover:bg-surface-container-low">
    <Link to={`/users/${user.login}`} className="flex min-w-0 items-center gap-space-sm">
      <Avatar name={user.fullname} src={user.avatar_url} online={online} className="h-10 w-10 text-[13px]" />
      <div className="min-w-0">
        <div className="truncate font-bold">{user.fullname}</div>
        <div className="truncate font-label-code-tag text-[12px] text-on-surface-variant">
          @{user.login}
          {online !== undefined && (
            <span className={online ? 'text-green-700' : ''} aria-hidden="true">
              {' · '}
              {online ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
      </div>
    </Link>
    {children}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="px-space-sm py-space-xs text-[14px] italic text-on-surface-variant">{text}</p>
);
