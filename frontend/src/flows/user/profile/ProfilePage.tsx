import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface UserPitch {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at?: string;
}

export const ProfilePage: React.FC = () => {
  const { user, openAuthModal, logout } = useAuth();
  const [pitches, setPitches] = useState<UserPitch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPitches = async () => {
      try {
        const res = await fetch('/api/v1/user/pitches', { credentials: 'include' });
        if (res.ok) {
          const data: UserPitch[] = await res.json();
          // Filter to user's pitches if author_id is set or show all active
          setPitches(data);
        }
      } catch (err) {
        console.error('Failed to load user pitches', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchPitches();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant">
          <span className="material-symbols-outlined text-[32px]">account_circle</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface">Sign In to View Profile</h2>
        <p className="text-xs text-on-surface-variant">
          Access your created project pitches, recruitment applications, and workspace memberships.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-opacity"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-on-primary text-2xl font-bold shadow-md">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.login} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              user.fullname.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold text-on-surface">{user.fullname}</h1>
                <p className="text-xs font-mono text-on-surface-variant">@{user.login}</p>
              </div>

              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold capitalize">
                  {user.role}
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
                  Circle 05
                </span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant">
              {user.email || '42 Campus Intra Student'} • Campus 1337 Benguerir
            </p>

            <div className="pt-3 flex flex-wrap gap-4 text-xs font-mono text-outline">
              <span>UUID: {user.id}</span>
              {user.intra_id && <span>Intra ID: {user.intra_id}</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-outline-variant flex justify-end">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-error-container text-on-error-container text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* User's Project Pitches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
            My Authored Pitches ({pitches.length})
          </h2>
          <a
            href="/refine-project"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Open Refiner</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </a>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-on-surface-variant">Loading pitches...</div>
        ) : pitches.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant text-center text-xs text-on-surface-variant">
            You haven&apos;t created any project pitches yet. Go to Pitch Refiner to create your first pitch with AI critique!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pitches.map((p) => (
              <div
                key={p.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-on-surface line-clamp-1">{p.title}</h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">Category: {p.category}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

