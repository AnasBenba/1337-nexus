import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export interface MyProjectOpportunity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  required_skills: string[];
  status: string;
  my_role: 'owner' | 'member';
  owner_id: string | null;
  pitch_title: string | null;
  pitch_category: string | null;
  member_count: number;
  pending_applications_count: number;
  created_at: string;
  updated_at: string;
}

export const MyProjectsPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MyProjectOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadMyProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/opportunities/my-projects', {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Could not load your projects.');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMyProjects();
  }, [loadMyProjects]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-16">
        <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant text-center space-y-4 shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-primary">lock</span>
          <div>
            <h1 className="text-lg font-bold text-on-surface">Sign in to view My Projects</h1>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
              Opportunities you own or have been accepted into appear here with full details and your team workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">folder_Copy</span>
            My Projects &amp; Authorized Opportunities
          </h1>
          <p className="text-xs text-on-surface-variant">
            Opportunities where you are the founder or an accepted teammate. Inspect full details or launch the collaborative workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/discover"
            className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-xs font-bold flex items-center gap-1.5 hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[16px]">explore</span>
            <span>Browse &amp; Post Opportunities</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-on-surface-variant text-xs">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Loading your authorized opportunities...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant text-center space-y-4">
          <span className="material-symbols-outlined text-[48px] text-outline">
            workspaces
          </span>
          <div>
            <h2 className="text-base font-bold text-on-surface">
              No authorized opportunities yet
            </h2>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
              Post a role for one of your pitches or get accepted into an opportunity on the Discover page to unlock its team workspace.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link
              to="/pitches"
              className="px-4 py-2 rounded-xl border border-primary text-primary text-xs font-bold hover:bg-primary/5"
            >
              Create a Pitch
            </Link>
            <Link
              to="/discover"
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90"
            >
              Explore Opportunities
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((opp) => (
            <div
              key={opp.id}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Role & Pitch Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-outline-variant/60">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        opp.my_role === 'owner'
                          ? 'bg-primary text-on-primary'
                          : 'bg-secondary-fixed text-on-secondary-fixed'
                      }`}
                    >
                      {opp.my_role === 'owner' ? 'Owner / Founder' : 'Accepted Member'}
                    </span>

                    {opp.my_role === 'owner' && opp.pending_applications_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {opp.pending_applications_count} Pending Applicant
                        {opp.pending_applications_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      group
                    </span>
                    <span>
                      {opp.member_count} Teammate{opp.member_count > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Title & Linked Pitch */}
                <div>
                  {opp.pitch_title && (
                    <div className="text-[11px] font-semibold text-primary flex items-center gap-1 mb-0.5">
                      <span className="material-symbols-outlined text-[14px]">campaign</span>
                      <span>{opp.pitch_title}</span>
                      {opp.pitch_category && (
                        <span className="text-outline">· {opp.pitch_category}</span>
                      )}
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-on-surface">{opp.title}</h3>
                </div>

                {/* Short Description */}
                <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                  {opp.description}
                </p>

                {/* Skills */}
                {Array.isArray(opp.required_skills) && opp.required_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {opp.required_skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[11px] font-mono"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Two SPA Action Options: 1) Show Details, 2) Workspace */}
              <div className="pt-4 border-t border-outline-variant flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/my-projects/${opp.id}`)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-primary">
                    info
                  </span>
                  <span>Show Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/my-projects/${opp.id}/workspace`)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    space_dashboard
                  </span>
                  <span>Open Workspace</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

