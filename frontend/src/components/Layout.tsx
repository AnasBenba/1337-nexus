import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';

export const Layout: React.FC = () => {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-50 flex items-center justify-between px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-space-sm w-64 shrink-0">
          <Link to="/" className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-DEFAULT bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
              1337<span className="text-primary-container font-extrabold">.Nexus</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-space-sm">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <span
                title={`${user.fullname} (@${user.login})`}
                className="rounded-full ring-2 ring-primary/15"
              >
                <Avatar
                  name={user.fullname || user.login}
                  src={user.avatar_url}
                  className="w-9 h-9 text-xs"
                />
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[19px]">logout</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Left Navigation Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest z-40 flex flex-col p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] overflow-y-auto">
        <button
          type="button"
          onClick={() => { if (!isAuthenticated) openAuthModal(); }}
          className="w-full text-left bg-surface-container-low rounded-DEFAULT p-space-md mb-space-md relative overflow-hidden hover:bg-surface-container transition-colors cursor-pointer"
        >
          <div className="h-10 -mx-space-md -mt-space-md bg-secondary-fixed mb-space-sm opacity-80" />
          <div className="flex items-center gap-space-sm">
            <Avatar
              name={user ? user.fullname || user.login : '1337 Nexus'}
              src={user?.avatar_url}
              className="w-11 h-11 text-sm"
            />
            <div className="overflow-hidden">
              <div className="font-label-md text-label-md text-on-surface truncate font-bold">
                {user ? user.fullname : 'Sign in'}
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant truncate text-[11px]">
                {user ? `@${user.login}` : '42 Intra or Email'}
              </div>
            </div>
          </div>
          {user ? (
            <div className="mt-space-sm flex items-center justify-between font-label-code-tag text-label-code-tag">
              <span className="px-space-xs py-0.5 rounded bg-surface-container-highest text-on-primary-container font-semibold uppercase">
                {user.role}
              </span>
              <span className="text-secondary font-mono text-[10px]">Verified</span>
            </div>
          ) : null}
        </button>

        <nav className="flex-1 space-y-space-xs">
          {/* Collaborative Whiteboard */}
          <NavLink
            to="/whiteboard"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all group ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-primary">
                draw
              </span>
              <span className="font-label-md text-label-md">Whiteboard</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-code-tag text-[9px] font-bold">
              CRDT
            </span>
          </NavLink>

          {/* Pitches & AI Refiner */}
          <NavLink
            to="/pitches"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all group ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-primary">
                campaign
              </span>
              <span className="font-label-md text-label-md">Pitches</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand font-label-code-tag text-[10px] font-bold">
              + AI
            </span>
          </NavLink>

          {/* AI Copilot Route */}
          <NavLink
            to="/copilot"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all group ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-primary-container group-hover:rotate-12 transition-transform">
                smart_toy
              </span>
              <span className="font-label-md text-label-md">AI-Copilot</span>
            </div>
            <span className="font-label-code-tag text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-bold">
              RAG
            </span>
          </NavLink>
        </nav>

        <div className="pt-space-md border-t border-surface-container-high">
          <div className="flex items-center justify-between px-space-sm py-space-xs rounded-DEFAULT bg-surface-container-low">
            <div className="flex items-center gap-space-xs font-label-code-tag text-label-code-tag text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-secondary-container" />
              <span>42 Network</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="w-full flex-1 pt-16 bg-surface p-margin">
          <Outlet />
        </main>

        <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-6 px-margin text-xs text-on-surface-variant">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="italic">
              *This project has been created as part of the 42 curriculum by 1337 Nexus team.*
            </p>
            <div className="flex items-center gap-6 font-medium">
              <span className="text-outline">© 2026 1337 Nexus</span>
            </div>
          </div>
        </footer>
      </div>

      <AuthModal />
    </div>
  );
};
