import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authFetch } from '@/lib/http';

interface Opportunity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  required_skills: string[];
}

interface ApplicationItem {
  id: string;
  opportunity_id: string;
  user_id: string;
  applicant_login?: string | null;
  applicant_name?: string | null;
  status: 'pending' | 'under_review' | 'accepted' | 'rejected' | string;
  message: string | null;
  candidate_skills: string[];
  match_score: number;
  created_at: string;
  updated_at: string;
}

export const OpportunityApplicantsPage: React.FC = () => {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!opportunityId) return;
    setLoading(true);
    setError(null);
    try {
      const [oppRes, appsRes] = await Promise.allSettled([
        authFetch(`/opportunities/${opportunityId}`),
        authFetch(`/opportunities/${opportunityId}/applications`),
      ]);

      if (oppRes.status === 'fulfilled' && oppRes.value.ok) {
        setOpportunity((await oppRes.value.json()) as Opportunity);
      }

      if (appsRes.status === 'fulfilled') {
        if (!appsRes.value.ok) {
          const err = await appsRes.value.json().catch(() => ({}));
          throw new Error(err.detail || 'Could not load applications for this opportunity');
        }
        const data = await appsRes.value.json();
        setApplications(Array.isArray(data) ? (data as ApplicationItem[]) : []);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [opportunityId]);

  const handleDecision = async (applicationId: string, newStatus: 'accepted' | 'rejected') => {
    setUpdatingId(applicationId);
    setError(null);
    try {
      const res = await authFetch(`/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not update application status');
      }

      const updated = (await res.json()) as ApplicationItem;
      setApplications((current) =>
        current.map((app) => (app.id === updated.id ? { ...app, ...updated } : app)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update application status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
      case 'rejected':
        return 'bg-red-500/15 text-red-600 border-red-500/30';
      default:
        return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-outline-variant/70 bg-surface-container-lowest text-xs font-bold text-on-surface hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to My Opportunities</span>
        </Link>

        {opportunity && (
          <Link
            to={`/boards/${opportunity.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">view_kanban</span>
            <span>Open Kanban Board</span>
          </Link>
        )}
      </div>

      <header className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-2 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Opportunity Applicants
        </p>
        <h1 className="text-2xl font-extrabold text-on-surface">
          {opportunity ? opportunity.title : 'Applicants Review'}
        </h1>
        {opportunity && (
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {opportunity.description}
          </p>
        )}
      </header>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-on-surface-variant">
          Loading applicants...
        </div>
      ) : applications.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-outline-variant rounded-2xl bg-surface-container-lowest p-8 space-y-2">
          <span className="material-symbols-outlined text-4xl text-outline">group_off</span>
          <h2 className="font-bold text-on-surface">No applications yet</h2>
          <p className="text-xs text-on-surface-variant">
            When students apply to this opportunity from Discover, their applications and messages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const isFinal = app.status === 'accepted' || app.status === 'rejected';
            const displayName =
              app.applicant_name || app.applicant_login || `User ${app.user_id.slice(0, 8)}`;

            return (
              <article
                key={app.id}
                className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed font-bold flex items-center justify-center text-sm">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-on-surface">{displayName}</h3>
                        {app.applicant_login && (
                          <Link
                            to={`/users/${app.applicant_login}`}
                            className="text-xs font-mono text-primary hover:underline"
                          >
                            @{app.applicant_login}
                          </Link>
                        )}
                      </div>
                      <p className="text-[11px] text-outline">
                        Applied {new Date(app.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      Match: {Math.round(app.match_score)}%
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${getStatusBadge(
                        app.status,
                      )}`}
                    >
                      {app.status === 'rejected' ? 'declined' : app.status}
                    </span>
                  </div>
                </div>

                {/* What the applicant said */}
                <div className="rounded-xl bg-surface-container-low p-4 border border-outline-variant/40">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1">
                    Applicant Message
                  </div>
                  <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                    {app.message || 'No message provided.'}
                  </p>
                </div>

                {/* Candidate Skills */}
                {app.candidate_skills && app.candidate_skills.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1.5">
                      Candidate Skills
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {app.candidate_skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accept / Decline Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/40">
                  {isFinal ? (
                    <span className="text-xs font-semibold text-on-surface-variant">
                      Decision recorded:{' '}
                      <strong className="uppercase">
                        {app.status === 'accepted' ? 'Accepted' : 'Declined'}
                      </strong>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={updatingId === app.id}
                        onClick={() => void handleDecision(app.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-400 text-red-600 hover:bg-red-500/10 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                        <span>Decline</span>
                      </button>

                      <button
                        type="button"
                        disabled={updatingId === app.id}
                        onClick={() => void handleDecision(app.id, 'accepted')}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Accept</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OpportunityApplicantsPage;
