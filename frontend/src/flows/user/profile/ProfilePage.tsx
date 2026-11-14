import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { UserProfile } from '@/app/authentication/login/Auth.api';
import { Avatar } from '@/components/Avatar';
import type { LayoutContext } from '@/components/Layout';
import { AdminUserActions } from '@/flows/admin/users';
import { FriendButton } from '@/flows/user/friends';
import { getFriendStatus, type FriendStatus } from '@/flows/user/friends/api';
import { can, Permission } from '@/lib/permissions';
import { onPresence } from '@/lib/presence';
import { getProfile, updateMyProfile } from './api';
import { AvatarUploader } from './AvatarUploader';
import { ProfileEditForm } from './ProfileEditForm';

const AVATAR_CLASS = 'h-24 w-24 text-[28px] ring-4 ring-surface-container-lowest';

export const ProfilePage: React.FC = () => {
  const { login = '' } = useParams();
  const { me, setMe } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const isMe = login === me.login;
  // What I can do here depends on my role's permissions (see lib/permissions.ts).
  const canEditMine = isMe && can(me, Permission.EDIT_OWN_PROFILE);

  // Other users' profiles are fetched; my own comes from the Layout.
  // undefined = loading, null = not found
  const [other, setOther] = useState<UserProfile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [friend, setFriend] = useState<{ status: FriendStatus; online: boolean } | null>(null);

  useEffect(() => {
    setEditing(false);
    setFriend(null);
    if (isMe) return;
    setOther(undefined);
    setLoadError(null);
    getProfile(login)
      .then((user) => {
        setOther(user);
        if (user) return getFriendStatus(login).then(setFriend);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, [login, isMe]);

  // Live online/offline updates while I'm looking at a friend's profile.
  const otherId = other?.id;
  useEffect(
    () =>
      onPresence(({ user_id, online }) => {
        if (String(user_id) === otherId) setFriend((f) => f && { ...f, online });
      }),
    [otherId],
  );

  const user = isMe ? me : other;
  // Online status is only shown for friends.
  const online = friend?.status === 'friends' ? friend.online : undefined;

  if (loadError) return <Notice icon="error" text={loadError} />;
  if (user === undefined) return <Notice icon="hourglass_empty" text="Loading profile…" />;
  if (user === null) return <Notice icon="person_off" text={`No user named @${login}.`} />;

  return (
    <div className="mx-auto max-w-3xl py-space-xl">
      <section className="overflow-hidden rounded bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-28 bg-gradient-to-r from-primary-container to-secondary-fixed" />
        <div className="px-space-xl pb-space-xl">
          <div className="flex items-start justify-between gap-space-md">
            <div className="-mt-12">
              {canEditMine ? (
                <AvatarUploader me={me} onChange={setMe} className={AVATAR_CLASS} />
              ) : (
                <Avatar name={user.fullname} src={user.avatar_url} online={online} className={AVATAR_CLASS} />
              )}
            </div>
            {!isMe && friend && can(me, Permission.MANAGE_FRIENDS) && (
              <div className="mt-space-md">
                {/* Refetch after a change so "online" is right as soon as we become friends. */}
                <FriendButton
                  login={user.login}
                  status={friend.status}
                  onChange={() => void getFriendStatus(login).then(setFriend)}
                />
              </div>
            )}
            {canEditMine && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-space-md flex items-center gap-1 rounded-full bg-surface-container px-space-md py-space-xs font-label-md text-label-md hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit profile
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-space-lg">
              <ProfileEditForm
                user={me}
                onCancel={() => setEditing(false)}
                save={async (changes) => {
                  setMe(await updateMyProfile(changes));
                  setEditing(false);
                }}
              />
            </div>
          ) : (
            <>
              <h1 className="mt-space-md font-headline-md text-headline-md font-bold">{user.fullname}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-space-sm text-on-surface-variant">
                <span className="font-label-code-tag text-label-code-tag">@{user.login}</span>
                {online !== undefined && (
                  <span className={`text-[13px] ${online ? 'text-green-700' : ''}`}>{online ? 'Online' : 'Offline'}</span>
                )}
                <span className="rounded-full bg-primary-fixed px-space-sm py-0.5 font-label-code-tag text-[11px] uppercase text-on-primary-fixed">
                  {user.role}
                </span>
              </div>
              <p className="mt-space-lg whitespace-pre-line text-on-surface">
                {user.bio || (
                  <span className="italic text-on-surface-variant">
                    {isMe ? 'You haven’t written a bio yet.' : 'No bio yet.'}
                  </span>
                )}
              </p>
            </>
          )}

          {/* Admin-only view: manage this user right from their profile. */}
          {!isMe && can(me, Permission.VIEW_USERS) && (
            <div className="mt-space-lg flex flex-wrap items-center justify-between gap-space-sm rounded bg-surface-container-low px-space-md py-space-sm">
              <span className="flex items-center gap-1 font-label-md text-label-md font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  admin_panel_settings
                </span>
                Admin
              </span>
              <AdminUserActions
                me={me}
                user={user}
                onChanged={setOther}
                onDeleted={() => navigate('/admin/users', { replace: true })}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const Notice: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div className="flex flex-col items-center gap-space-sm py-space-2xl text-on-surface-variant">
    <span className="material-symbols-outlined text-[40px]">{icon}</span>
    <p>{text}</p>
  </div>
);
