import React, { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';

export const Layout: React.FC = () => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
            <Link
              to="/messages"
              aria-label="Direct Messages"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
            </Link>
          </div>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm text-on-primary font-bold text-xs cursor-pointer overflow-hidden border border-primary-container"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.login} className="w-full h-full object-cover" />
                ) : (
                  user.fullname.slice(0, 2).toUpperCase()
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-outline-variant">
                    <p className="text-xs font-bold text-on-surface truncate">{user.fullname}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">@{user.login}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    <span>My Profile</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); void logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-error hover:bg-error-container/20 transition-colors cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
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
        <div className="bg-surface-container-low rounded-DEFAULT p-space-md mb-space-md relative overflow-hidden">
          <div className="h-10 -mx-space-md -mt-space-md bg-secondary-fixed mb-space-sm opacity-80" />
          <div className="flex items-center gap-space-sm">
            <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md text-label-md font-bold shrink-0">
              {user ? user.fullname.slice(0, 2).toUpperCase() : '13'}
            </div>
            <div className="overflow-hidden">
              <div className="font-label-md text-label-md text-on-surface truncate font-bold">
                {user ? user.fullname : 'Guest Student'}
              </div>
              <div className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span className="text-[11px]">{user ? `@${user.login}` : 'Benguerir'}</span>
              </div>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-tag text-label-code-tag">
            <span className="px-space-xs py-0.5 rounded bg-surface-container-highest text-on-primary-container font-semibold">
              {user ? user.role.toUpperCase() : 'VISITOR'}
            </span>
            <span className="text-outline text-[11px]">Circle 05</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-space-xs">
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

          <NavLink
            to="/refine-project"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all group ${
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

          {/* Collaborative Whiteboard [CV-403] */}
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
                auto_awesome
              </span>
              <span className="font-label-md text-label-md">AI-Copilot</span>
            </div>
            <span className="font-label-code-tag text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-bold">
              RAG
            </span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all ${
                isActive
                  ? 'bg-primary-fixed text-on-primary-fixed font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">person</span>
              <span className="font-label-md text-label-md">Profile</span>
            </div>
          </NavLink>
        </nav>

        <div className="pt-space-md border-t border-surface-container-high">
          <div className="flex items-center justify-between px-space-sm py-space-xs rounded-DEFAULT bg-surface-container-low">
            <div className="flex items-center gap-space-xs font-label-code-tag text-label-code-tag text-on-surface-variant">
              <span className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-secondary-container' : 'bg-outline'}`} />
              <span>{isAuthenticated ? 'Authenticated' : 'Guest Mode'}</span>
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
