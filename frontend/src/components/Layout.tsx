import React, { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
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
    if (signedInId === undefined) return;
    connectPresence();
    return disconnectPresence;
  }, [signedInId]);

  // Renew the 15-minute access token before it runs out while the app is open, so
  // requests don't hit a 401 first (the 401 -> refresh -> retry path stays as a fallback).
  useEffect(() => {
    if (signedInId === undefined) return;
    const timer = setInterval(() => void refreshSession(), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [signedInId]);

  if (me === undefined) return null;
  if (me === null) return <Navigate to="/login" replace />;

  const profilePath = `/users/${me.login}`;

  const handleLogout = async () => {
    await logout().catch(() => undefined); // even if the request fails, leave the app
    setMe(null); // the check above then redirects to /login
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-50 flex items-center justify-between px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-space-sm w-64 shrink-0">
          <div className="w-9 h-9 rounded bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
            1337<span className="text-primary-container font-extrabold">.Nexus</span>
          </span>
        </div>

        <div className="hidden md:flex items-center flex-1 max-w-2xl mx-space-lg">
          <div className="flex items-center w-full bg-surface-container-low px-space-md py-space-xs rounded-full gap-space-sm">
            <span className="material-symbols-outlined text-outline text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search projects, people, stack, or campus..."
              className="w-full bg-transparent border-0 outline-none font-body-sm text-body-sm text-on-surface placeholder:text-outline"
            />
            <span className="font-label-code-tag text-label-code-tag bg-surface-container px-space-xs py-0.5 rounded text-on-surface-variant font-mono">
              ⌘K
            </span>
            <div className="h-4 w-[1px] bg-surface-container-highest" />
            <button
              type="button"
              className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant shrink-0 hover:text-on-surface transition-colors cursor-pointer"
            >
              <span>Benguerir</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-space-md">
          <div className="hidden lg:flex items-center gap-space-xs font-label-code-tag text-label-code-tag px-space-sm py-1 rounded-full bg-primary-fixed text-on-primary-fixed">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
            <span>1337 Benguerir</span>
          </div>

          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <button
              type="button"
              aria-label="Theme Switcher"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">dark_mode</span>
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-error text-on-error font-label-code-tag text-[10px] flex items-center justify-center font-bold">
                3
              </span>
            </button>
            <button
              type="button"
              aria-label="Direct Messages"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
            </button>
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
      </header>

      {/* Left Navigation Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest z-40 flex flex-col p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] overflow-y-auto">
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
          <div className="mt-space-sm flex items-center justify-between font-label-code-tag text-label-code-tag">
            <span className="px-space-xs py-0.5 rounded bg-surface-container-highest text-on-primary-container font-semibold">
              Lvl 9.42
            </span>
            <span className="text-outline text-[11px]">Circle 05</span>
          </div>
        </div>

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
            to="/friends"
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
            to="/projects"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">folder_open</span>
              <span className="font-label-md text-label-md">My Projects</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-code-tag text-[10px]">
              2
            </span>
          </NavLink>

          <NavLink
            to="/messages"
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
            <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-code-tag text-[10px] font-bold">
              4
            </span>
          </NavLink>

          <NavLink
            to="/refine-project"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded transition-all group ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-primary-container">
                auto_awesome
              </span>
              <span className="font-label-md text-label-md">Pitch Refiner</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand font-label-code-tag text-[10px] font-bold">
              AI
            </span>
          </NavLink>

          <div className="my-space-sm h-[1px] bg-surface-container-high" />

          {/* AI Copilot Route */}
          <NavLink
            to="/copilot"
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
          {can(me, Permission.VIEW_USERS) && (
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

        <div className="pt-space-md border-t border-surface-container-high">
          <div className="flex items-center justify-between px-space-sm py-space-xs rounded bg-surface-container-low">
            <div className="flex items-center gap-space-xs font-label-code-tag text-label-code-tag text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-secondary-container" />
              <span>Intra Connected</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64">
        <main className="w-full min-h-screen pt-16 bg-surface p-margin">
          <Outlet context={{ me, setMe } satisfies LayoutContext} />
        </main>
      </div>
    </div>
  );
};
