import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';

export const Layout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

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
          <Link
            to="/messages"
            aria-label="Direct Messages"
            title="Messages"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </Link>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                aria-label="My Profile"
                title={`${user.fullname} (@${user.login})`}
                className="rounded-full ring-2 ring-primary/15 hover:ring-primary/50 transition-all"
              >
                <Avatar
                  name={user.fullname || user.login}
                  src={user.avatar_url}
                  className="w-9 h-9 text-xs"
                />
              </Link>
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
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* Left Navigation Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest z-40 flex flex-col p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] overflow-y-auto">
        <Link
          to={isAuthenticated && user ? '/profile' : '/login'}
          className="block bg-surface-container-low rounded-DEFAULT p-space-md mb-space-md relative overflow-hidden hover:bg-surface-container transition-colors"
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
          {user && (
            <div className="mt-space-sm flex items-center justify-between font-label-code-tag text-label-code-tag">
              <span className="px-space-xs py-0.5 rounded bg-surface-container-highest text-on-primary-container font-semibold uppercase">
                {user.role}
              </span>
              {user.intra_id !== null && (
                <span className="text-outline text-[11px]">42 Intra</span>
              )}
            </div>
          )}
        </Link>

        <nav className="flex-1 flex flex-col gap-space-xs">
          {/* 1. Discover Opportunities */}
          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all ${
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

          {/* 2. Pitches (Create, Upvote/Downvote, & Save + Refine with AI) */}
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

          {/* 3. My Projects (Authorized Opportunities -> Show Details or Split-Screen Workspace) */}
          <NavLink
            to="/my-projects"
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
                workspaces
              </span>
              <span className="font-label-md text-label-md">My Projects</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-code-tag text-[9px] font-bold">
              TEAM
            </span>
          </NavLink>

          {/* 4. Direct Peer Messages */}
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all ${
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
          </NavLink>

          {/* 5. AI Copilot */}
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
                auto_awesome
              </span>
              <span className="font-label-md text-label-md">AI-Copilot</span>
            </div>
            <span className="font-label-code-tag text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-bold">
              RAG
            </span>
          </NavLink>

          {/* 6. Collaborative Whiteboard */}
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
            <span className="font-label-code-tag text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-bold">
              CRDT
            </span>
          </NavLink>


        </nav>

        {isAuthenticated && user && (
          <div className="pt-space-md border-t border-surface-container-high">
            <Link
              to="/profile"
              className="flex items-center justify-between px-space-sm py-space-xs rounded-DEFAULT bg-surface-container-low hover:bg-surface-container transition-colors"
            >
              <div className="flex items-center gap-space-xs font-label-code-tag text-label-code-tag text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-secondary-container" />
                <span>@{user.login}</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
            </Link>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="w-full flex-1 pt-16 bg-surface p-margin">
          <Outlet />
        </main>

        {/* Mandatory 42 Subject Footer (Chapter III.2: Terms of Service & Privacy Policy) */}
        <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-6 px-margin text-xs text-on-surface-variant">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="italic">
              *This project has been created as part of the 42 curriculum by 1337 Nexus team.*
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

      <AuthModal />
    </div>
  );
};
