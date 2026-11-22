import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getMe, isSignedIn, logout, type Me } from '@/app/authentication/login/Auth.api';
import { Avatar } from '@/components/Avatar';
import { RoleBadge } from '@/flows/admin/users';
import { refreshSession } from '@/lib/http';
import { can, Permission } from '@/lib/permissions';
import { connectPresence, disconnectPresence } from '@/lib/presence';

/** What pages get from useOutletContext(): the signed-in user and a way to update it. */
export type LayoutContext = { me: Me; setMe: (me: Me) => void };

export const Layout: React.FC = () => {
  // undefined = still checking, null = not signed in
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const location = useLocation();

  // Close mobile drawer on route navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Ask /auth/session first: it never answers 401, so a logged-out visitor's console stays
    // clean (and an expired access token is renewed there). Only then load my profile.
    isSignedIn()
      .then((signedIn) => (signedIn ? getMe() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // Keep a presence connection open while signed in, so friends see me online.
  // Closing the tab or logging out (me -> null) disconnects it.
  const signedInId = me?.id;
  useEffect(() => {
    if (!signedInId) return;
    connectPresence();
    return disconnectPresence;
  }, [signedInId]);

  useEffect(() => {
    if (!signedInId) return;
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/v1/messages/unread-count', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { unread_messages?: number };
          if (isMounted && typeof data.unread_messages === 'number') {
            setUnreadMessages(data.unread_messages);
          }
        }
      } catch {
        // Dev / offline fallback
      }
    };

    void fetchCounts();
    const handleUpdate = () => void fetchCounts();
    window.addEventListener('messages:unread-updated', handleUpdate);
    const interval = setInterval(fetchCounts, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener('messages:unread-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [signedInId]);

  // Renew the 15-minute access token before it runs out while the app is open, so
  // requests don't hit a 401 first (the 401 -> refresh -> retry path stays as a fallback).
  useEffect(() => {
    if (!signedInId) return;
    const timer = setInterval(() => void refreshSession(), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [signedInId]);

  if (me === undefined) return null;

  const profilePath = me ? `/users/${me.login}` : '/login';

  const handleLogout = async () => {
    await logout().catch(() => undefined); // even if the request fails, leave the app
    setMe(null);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-50 flex items-center justify-between px-4 sm:px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 sm:gap-space-sm md:w-64 shrink-0">
          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">
              {sidebarOpen ? 'close' : 'menu'}
            </span>
          </button>

          <Link to="/" className="flex items-center gap-2 sm:gap-space-sm" onClick={() => setSidebarOpen(false)}>
            <div className="w-9 h-9 rounded bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
              1337<span className="text-primary-container font-extrabold">.Nexus</span>
            </span>
          </Link>
        </div>

        {me ? (
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <Link
                to="/messages"
                aria-label="Direct Messages"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
              </Link>
            </div>

            <Link to={profilePath} aria-label="My profile" className="rounded-full shadow-sm">
              <Avatar name={me.fullname} src={me.avatar_url} />
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Log out"
              title="Log out"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-space-sm">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              <span>Sign In</span>
            </Link>
          </div>
        )}
      </header>

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-16 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Navigation Sidebar / Drawer */}
      <aside
        className={`fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest z-40 flex flex-col p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] overflow-y-auto transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {me ? (
          <div className="bg-surface-container-low rounded p-space-md mb-space-md relative overflow-hidden">
            <div className="h-12 -mx-space-md -mt-space-md bg-gradient-to-r from-primary-container to-secondary-fixed" />
            <div className="flex items-start gap-space-sm">
              <Link to={profilePath} aria-label="My profile" className="-mt-6 rounded-full">
                <Avatar
                  name={me.fullname}
                  src={me.avatar_url}
                  className="w-12 h-12 text-label-md ring-4 ring-surface-container-low"
                />
              </Link>
              <div className="overflow-hidden">
                <Link
                  to={profilePath}
                  className="block font-label-md text-label-md text-on-surface truncate font-bold hover:text-primary"
                >
                  {me.fullname}
                </Link>
                <div className="flex min-w-0 items-center gap-1 font-body-sm text-[11px] text-on-surface-variant">
                  <span className="truncate">@{me.login}</span>
                  <RoleBadge role={me.role} />
                </div>
                <div className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  <span className="text-[11px]">Benguerir</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded p-space-md mb-space-md text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </div>
            <p className="font-bold text-xs text-on-surface">1337 Nexus Guest</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5 mb-2.5">
              Sign in to pitch, vote, and collaborate with peers.
            </p>
            <Link
              to="/login"
              className="block w-full py-1.5 px-3 rounded-lg bg-primary text-on-primary font-bold text-xs text-center shadow-sm hover:opacity-90"
            >
              Sign In
            </Link>
          </div>
        )}

        <nav className="flex-1 flex flex-col gap-space-xs">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span className="font-label-md text-label-md">Home</span>
            </div>
          </NavLink>

          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">explore</span>
              <span className="font-label-md text-label-md">Discover</span>
            </div>
          </NavLink>

          <NavLink
            to={me ? "/friends" : "/login"}
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span className="font-label-md text-label-md">Friends</span>
            </div>
          </NavLink>

          <NavLink
            to="/opportunities"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">work</span>
              <span className="font-label-md text-label-md">Opportunities</span>
            </div>
          </NavLink>

          <NavLink
            to={me ? "/pitches" : "/login"}
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
              <span className="font-label-md text-label-md">Pitches</span>
            </div>
          </NavLink>

          <NavLink
            to={me ? "/messages" : "/login"}
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
              <span className="font-label-md text-label-md">Messages</span>
            </div>
            {me && (
              <span
                className={`px-2 py-0.5 rounded-full font-label-code-tag text-[10px] ${
                  unreadMessages > 0
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container text-outline'
                }`}
              >
                {unreadMessages}
              </span>
            )}
          </NavLink>

          <div className="my-space-sm h-[1px] bg-surface-container-high" />

          {/* AI Copilot Route */}
          <NavLink
            to={me ? "/copilot" : "/login"}
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all group ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-primary-container group-hover:rotate-12 transition-transform">
                auto_awesome
              </span>
              <span className="font-label-md text-label-md">AI-Copilot</span>
            </div>
            <span className="font-label-code-tag text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-bold">
              PROMPT
            </span>
          </NavLink>

          {/* Only shown to roles that can manage users (admins). */}
          {me && can(me, Permission.VIEW_USERS) && (
            <>
              <div className="my-space-sm h-[1px] bg-surface-container-high" />
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                    isActive
                      ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`
                }
              >
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                  <span className="font-label-md text-label-md">Users</span>
                </div>
                <RoleBadge role={me.role} />
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen w-full min-w-0">
        <main className="w-full flex-1 pt-16 bg-surface p-4 sm:p-margin">
          <Outlet context={{ me: me as Me, setMe: setMe as (me: Me) => void } satisfies LayoutContext} />
        </main>

        {/* Mandatory 42 Subject Footer (Privacy Policy & Terms of Service) */}
        <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-6 px-4 sm:px-margin text-xs text-on-surface-variant">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="italic">
              This project has been created as part of the 42 curriculum by the 1337 Nexus team.
            </p>
            <div className="flex items-center gap-6 font-medium">
              <Link to="/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <span className="text-outline">© 2026 1337 Nexus</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
