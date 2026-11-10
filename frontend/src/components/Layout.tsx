import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { authFetch, setAuthToken, clearAuthToken } from '@/lib/auth';

interface CurrentUser {
  id: string;
  login: string;
  fullname: string;
  campus?: string;
  avatar_url?: string;
}

export const Layout: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    authFetch('/api/v1/profile/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.login) setCurrentUser(data);
      })
      .catch(() => {});
  }, []);

  const handleSwitchUser = async (targetLogin: string) => {
    try {
      const res = await fetch(`/api/v1/auth/dev-token?login=${targetLogin}`);
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setAuthToken(data.token);
          window.location.reload();
          return;
        }
      }
    } catch {
      // Fallback
    }
    window.location.href = `/api/v1/auth/dev-login?login=${targetLogin}`;
  };

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = '/api/v1/auth/logout';
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-50 flex items-center justify-between px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-space-sm w-64 shrink-0">
          <div className="w-9 h-9 rounded-DEFAULT bg-primary flex items-center justify-center text-on-primary shadow-sm">
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
              <span>{currentUser?.campus ? currentUser.campus.replace('1337 ', '') : 'Benguerir'}</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-space-md">
          {currentUser ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full border border-outline-variant/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-on-surface">@{currentUser.login}</span>
              <span className="text-outline">|</span>
              <button
                type="button"
                onClick={() => void handleSwitchUser(currentUser.login === 'anas' ? 'yassine' : 'anas')}
                className="text-primary font-medium hover:underline cursor-pointer"
                title="Switch test account for this tab"
              >
                Switch to @{currentUser.login === 'anas' ? 'yassine' : 'anas'}
              </button>
              <span className="text-outline">|</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-on-surface-variant hover:text-error cursor-pointer font-medium"
                title="Log out"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-xs">
              <span className="font-bold text-primary">Sign in:</span>
              <button
                type="button"
                onClick={() => void handleSwitchUser('anas')}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                @anas
              </button>
              <span className="text-outline">/</span>
              <button
                type="button"
                onClick={() => void handleSwitchUser('yassine')}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                @yassine
              </button>
            </div>
          )}

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
            <NavLink
              to="/messages"
              aria-label="Direct Messages"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
            </NavLink>
          </div>

          <NavLink
            to="/profile"
            aria-label="My Profile"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm text-on-primary hover:opacity-90 transition-opacity overflow-hidden"
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt={currentUser.login} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">person</span>
            )}
          </NavLink>
        </div>
      </header>

      {/* Left Navigation Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest z-40 flex flex-col p-space-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] overflow-y-auto">
        <div className="bg-surface-container-low rounded-DEFAULT p-space-md mb-space-md relative overflow-hidden">
          <div className="h-10 -mx-space-md -mt-space-md bg-secondary-fixed mb-space-sm opacity-80" />
          <div className="flex items-center gap-space-sm">
            <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md text-label-md font-bold shrink-0 overflow-hidden">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.login} className="w-full h-full object-cover" />
              ) : (
                (currentUser?.login || '42').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <div className="font-label-md text-label-md text-on-surface truncate font-bold">
                {currentUser?.fullname || 'Guest Student'}
              </div>
              <div className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span className="text-[11px]">{currentUser?.campus || '1337 Coding School'}</span>
              </div>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-code-tag text-label-code-tag">
            <span className="px-space-xs py-0.5 rounded bg-surface-container-highest text-on-primary-container font-semibold">
              {currentUser ? `@${currentUser.login}` : 'Not logged in'}
            </span>
            <span className="text-outline text-[11px]">Circle 05</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-space-xs">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all ${
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
            to="/projects"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all ${
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
            <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-code-tag text-[10px]">
              4
            </span>
          </NavLink>

          <NavLink
            to="/friends"
            className={({ isActive }) =>
              `flex items-center justify-between px-space-md py-space-sm rounded-DEFAULT transition-all ${
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
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
              <span className="font-label-md text-label-md">Profile</span>
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

          <div className="my-space-sm h-[1px] bg-surface-container-high" />

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
              PROMPT
            </span>
          </NavLink>
        </nav>

        <div className="pt-space-md border-t border-surface-container-high">
          <div className="flex items-center justify-between px-space-sm py-space-xs rounded-DEFAULT bg-surface-container-low">
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};
