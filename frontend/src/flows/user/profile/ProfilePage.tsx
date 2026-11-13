import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Me, UserProfile } from '@/app/authentication/login/Auth.api';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { can, Permission } from '@/lib/permissions';
import { getMyProfile, getProfile, updateMyProfile } from './api';
import { AvatarUploader } from './AvatarUploader';
import { ProfileEditForm } from './ProfileEditForm';

const AVATAR_CLASS = 'h-24 w-24 text-[28px] ring-4 ring-surface-container-lowest';

export const ProfilePage: React.FC = () => {
  const { login: routeLogin } = useParams();
  const navigate = useNavigate();
  const { user: authUser, setUser: setAuthUser, isAuthenticated, isLoading, logout } = useAuth();

  const isMe = !routeLogin || (authUser !== null && routeLogin === authUser.login);

  const [me, setMe] = useState<Me | null>(null);
  const [other, setOther] = useState<UserProfile | null | undefined>(undefined);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEditing(false);
    setLoadError(null);

    if (isLoading) return undefined;

    if (!isAuthenticated) {
      setLoadingProfile(false);
      setMe(null);
      setOther(null);
      return undefined;
    }

    setLoadingProfile(true);
    if (isMe) {
      getMyProfile()
        .then((profile) => {
          if (cancelled) return;
          setMe(profile);
          setAuthUser(profile);
        })
        .catch((err: Error) => {
          if (!cancelled) setLoadError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoadingProfile(false);
        });
    } else if (routeLogin) {
      setOther(undefined);
      getProfile(routeLogin)
        .then((profile) => {
          if (!cancelled) setOther(profile);
        })
        .catch((err: Error) => {
          if (!cancelled) setLoadError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoadingProfile(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, isMe, routeLogin, setAuthUser]);

  const handleMeChanged = (updated: Me) => {
    setMe(updated);
    setAuthUser(updated);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (isLoading || loadingProfile) {
    return <Notice icon="hourglass_empty" text="Loading profile…" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-space-2xl text-center">
        <div className="rounded-2xl bg-surface-container-lowest p-8 shadow-sm border border-outline-variant/40">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[28px]">person</span>
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            Sign in to view profiles
          </h1>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Sign in with your 42 Intra account or student credentials to manage your profile and avatar.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm hover:opacity-95 transition-opacity"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) return <Notice icon="error" text={loadError} />;

  const displayedUser = isMe ? me : other;
  if (displayedUser === undefined) return <Notice icon="hourglass_empty" text="Loading profile…" />;
  if (displayedUser === null) {
    return <Notice icon="person_off" text={`No user named @${routeLogin ?? ''}.`} />;
  }

  const canEditMine = isMe && me !== null && can(me, Permission.EDIT_OWN_PROFILE);

  return (
    <div className="mx-auto max-w-3xl py-space-lg">
      <section className="overflow-hidden rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-28 bg-gradient-to-r from-primary-container to-secondary-fixed" />
        <div className="px-space-xl pb-space-xl">
          <div className="flex flex-wrap items-start justify-between gap-space-md">
            <div className="-mt-12">
              {canEditMine && me ? (
                <AvatarUploader me={me} onChange={handleMeChanged} className={AVATAR_CLASS} />
              ) : (
                <Avatar
                  name={displayedUser.fullname}
                  src={displayedUser.avatar_url}
                  className={AVATAR_CLASS}
                />
              )}
            </div>

            {isMe && (
              <div className="mt-space-md flex items-center gap-2">
                {canEditMine && !editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 rounded-full bg-surface-container px-space-md py-space-xs font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    <span>Edit profile</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-space-md py-space-xs font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>

          {editing && me ? (
            <div className="mt-space-lg">
              <ProfileEditForm
                user={me}
                onCancel={() => setEditing(false)}
                save={async (changes) => {
                  handleMeChanged(await updateMyProfile(changes));
                  setEditing(false);
                }}
              />
            </div>
          ) : (
            <>
              <h1 className="mt-space-md font-headline-md text-headline-md font-bold text-on-surface">
                {displayedUser.fullname}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-space-sm text-on-surface-variant">
                <span className="font-label-code-tag text-label-code-tag">
                  @{displayedUser.login}
                </span>
                <span className="rounded-full bg-primary-fixed px-space-sm py-0.5 font-label-code-tag text-[11px] uppercase text-on-primary-fixed">
                  {displayedUser.role}
                </span>
                {displayedUser.intra_id !== null && (
                  <span className="rounded-full bg-surface-container px-space-sm py-0.5 font-label-code-tag text-[11px] text-on-surface-variant">
                    42 Intra
                  </span>
                )}
              </div>

              {displayedUser.email && (
                <p className="mt-2 text-body-sm text-on-surface-variant">{displayedUser.email}</p>
              )}

              <p className="mt-space-lg whitespace-pre-line text-on-surface">
                {displayedUser.bio || (
                  <span className="italic text-on-surface-variant">
                    {isMe ? 'You haven’t written a bio yet.' : 'No bio yet.'}
                  </span>
                )}
              </p>
            </>
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
