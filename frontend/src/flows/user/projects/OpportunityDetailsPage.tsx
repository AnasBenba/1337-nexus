import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export interface WorkspaceMember {
  id: string;
  login: string;
  fullname: string;
  email: string | null;
  avatar_url: string | null;
  role: 'owner' | 'member';
  skills: string[];
}

export interface OpportunityWorkspaceBundle {
  opportunity: {
    id: string;
    project_id: string;
    title: string;
    description: string;
    required_skills: string[];
    status: string;
    owner_id: string;
    my_role: 'owner' | 'member';
    created_at: string | null;
    updated_at: string | null;
  };
  pitch: {
    id: string;
    title: string;
    description: string | null;
    content: string;
    category: string;
    status: string;
    author_id: string | null;
  } | null;
  workspace: {
    team_id: string;
    board_id: string;
    canvas_document_id: string;
    channel_id: string;
  };
  members: WorkspaceMember[];
}

interface ReviewedApplication {
  id: string;
  opportunity_id: string;
  user_id: string;
  user_login?: string | null;
  user_fullname?: string | null;
  status: string;
  message: string | null;
  candidate_skills: string[];
  match_score: number;
  created_at: string;
}

export const OpportunityDetailsPage: React.FC = () => {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<OpportunityWorkspaceBundle | null>(null);
  const [applications, setApplications] = useState<ReviewedApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!opportunityId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/opportunities/${opportunityId}/workspace`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Unable to load opportunity details.');
        setLoading(false);
        return;
      }

      const data: OpportunityWorkspaceBundle = await res.json();
      setBundle(data);

      // If owner, also load applications review queue
      if (data.opportunity.my_role === 'owner') {
        const appsRes = await fetch(
          `/api/v1/opportunities/${opportunityId}/applications`,
          { credentials: 'include' }
        );
        if (appsRes.ok) {
          const appsData = await appsRes.json();
          if (Array.isArray(appsData)) {
            setApplications(appsData);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const handleApplicationDecision = async (
    applicationId: string,
    newStatus: 'accepted' | 'rejected'
  ) => {
    setUpdatingAppId(applicationId);
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadDetails();
      }
    } catch (err) {
      console.error('Failed to update application status:', err);
    } finally {
      setUpdatingAppId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-on-surface-variant text-xs">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span>Loading opportunity details &amp; participating teammates...</span>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-4">
        <div className="p-6 rounded-2xl bg-error-container text-on-error-container text-xs font-semibold">
          {error || 'Opportunity not found.'}
        </div>
        <Link
          to="/my-projects"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to My Projects
        </Link>
      </div>
    );
  }

  const { opportunity, pitch, members } = bundle;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/my-projects"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to My Projects</span>
        </Link>

        <button
          type="button"
          onClick={() => navigate(`/my-projects/${opportunity.id}/workspace`)}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
          <span>Enter Workspace (Whiteboard &amp; Group Chat)</span>
        </button>
      </div>

      {/* Main Opportunity Overview Card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary text-on-primary">
                {opportunity.my_role === 'owner' ? 'Project Owner' : 'Accepted Teammate'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-green-100 text-green-800">
                Status: {opportunity.status}
              </span>
              {pitch && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-fixed text-on-secondary-fixed">
                  {pitch.category}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-on-surface">{opportunity.title}</h1>
            {opportunity.created_at && (
              <p className="text-xs text-outline">
                Created on {new Date(opportunity.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Full Opportunity Description */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">
            Opportunity Overview &amp; Role Responsibilities
          </h2>
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
            {opportunity.description}
          </p>
        </div>

        {/* Required Skills */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">
            Required Stack &amp; Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {opportunity.required_skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-mono font-semibold"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Linked Project Pitch */}
        {pitch && (
          <div className="space-y-2 pt-2 border-t border-outline-variant">
            <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">
              Associated Project Pitch: {pitch.title}
            </h2>
            <div className="text-xs text-on-surface leading-relaxed whitespace-pre-line bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
              {pitch.content}
            </div>
          </div>
        )}
      </div>

      {/* Participating Teammates Roster */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">groups</span>
            <h2 className="text-base font-bold text-on-surface">
              Participating Teammates ({members.length})
            </h2>
          </div>
          <span className="text-xs text-on-surface-variant">
            Authorized to access the Whiteboard &amp; Group Chat
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-xl border border-outline-variant bg-surface flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-bold text-xs flex items-center justify-center shrink-0">
                {member.fullname.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-on-surface truncate">
                    {member.fullname}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      member.role === 'owner'
                        ? 'bg-primary-fixed text-on-primary-fixed'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant truncate">
                  @{member.login}
                </p>
                {member.skills && member.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {member.skills.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-mono text-on-surface-variant"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Owner-Only Applications Review Section */}
      {opportunity.my_role === 'owner' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">
                fact_check
              </span>
              <h2 className="text-base font-bold text-on-surface">
                Candidate Applications ({applications.length})
              </h2>
            </div>
            <span className="text-xs text-on-surface-variant">
              Accepting a candidate automatically grants them Workspace access
            </span>
          </div>

          {applications.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-4">
              No applications received yet for this opportunity.
            </p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-xl border border-outline-variant bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">
                        {app.user_fullname || `Candidate ${app.user_id.slice(0, 8)}`}
                      </span>
                      {app.user_login && (
                        <span className="text-xs text-on-surface-variant font-mono">
                          (@{app.user_login})
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-fixed text-on-primary-fixed">
                        Match Score: {Math.round(app.match_score * 100)}%
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          app.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : app.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    {app.message && (
                      <p className="text-xs text-on-surface-variant">{app.message}</p>
                    )}

                    {app.candidate_skills && app.candidate_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {app.candidate_skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-mono text-on-surface-variant"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {(app.status === 'pending' || app.status === 'under_review') && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={updatingAppId === app.id}
                        onClick={() => void handleApplicationDecision(app.id, 'rejected')}
                        className="px-3.5 py-1.5 rounded-xl border border-error text-error text-xs font-bold hover:bg-error/5 disabled:opacity-50 cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={updatingAppId === app.id}
                        onClick={() => void handleApplicationDecision(app.id, 'accepted')}
                        className="px-4 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                      >
                        {updatingAppId === app.id ? 'Updating...' : 'Accept to Team'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

