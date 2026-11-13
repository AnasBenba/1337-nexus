import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authFetch } from '@/lib/auth';

interface Project {
  id: string;
  title: string;
}

interface Opportunity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  required_skills: string[];
}

interface Application {
  id: string;
  opportunity_id: string;
  user_id: string;
  status: 'pending' | 'under_review' | 'accepted' | 'rejected' | string;
  message: string | null;
  candidate_skills: string[];
  match_score: number;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<string, string> = {
  pending: 'New',
  under_review: 'In review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const nextStatuses: Record<string, string[]> = {
  pending: ['under_review', 'accepted', 'rejected'],
  under_review: ['accepted', 'rejected'],
};

export const RecruitmentReviewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId);
  const pendingCount = useMemo(
    () => applications.filter((application) => ['pending', 'under_review'].includes(application.status)).length,
    [applications],
  );

  const loadQueue = async (opportunityId: string) => {
    setQueueLoading(true);
    setErrorMsg(null);
    try {
      const response = await authFetch(`/opportunities/${opportunityId}/applications`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Could not load applications');
      }
      const data = await response.json();
      setApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      setApplications([]);
      setErrorMsg(error instanceof Error ? error.message : 'Could not load applications');
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    const loadPage = async () => {
      if (!projectId) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const [projectsResponse, opportunitiesResponse] = await Promise.all([
          authFetch('/projects/mine'),
          authFetch('/opportunities/?limit=100'),
        ]);
        const projects = projectsResponse.ok ? await projectsResponse.json() : [];
        const allOpportunities = opportunitiesResponse.ok ? await opportunitiesResponse.json() : [];
        const ownProject = (Array.isArray(projects) ? projects : []).find((item: Project) => item.id === projectId);
        const ownOpportunities = (Array.isArray(allOpportunities) ? allOpportunities : []).filter(
          (item: Opportunity) => item.project_id === projectId,
        );

        setProject(ownProject || null);
        setOpportunities(ownOpportunities);
        setSelectedOpportunityId((current) => current || ownOpportunities[0]?.id || '');
      } catch {
        setErrorMsg('Could not load recruitment review.');
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [projectId]);

  useEffect(() => {
    if (selectedOpportunityId) void loadQueue(selectedOpportunityId);
    else setApplications([]);
  }, [selectedOpportunityId]);

  const updateStatus = async (applicationId: string, status: string) => {
    const previousApplications = applications;
    setUpdatingId(applicationId);
    setErrorMsg(null);
    setApplications((current) =>
      current.map((application) =>
        application.id === applicationId ? { ...application, status } : application,
      ),
    );

    try {
      const response = await authFetch(`/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Could not update application');
      }
      const updatedApplication = await response.json();
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId ? updatedApplication : application,
        ),
      );
    } catch (error) {
      setApplications(previousApplications);
      setErrorMsg(error instanceof Error ? error.message : 'Could not update application');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-on-surface-variant text-sm">Loading recruitment queue...</div>;
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-outline">group_search</span>
        <h1 className="text-xl font-bold text-on-surface">Project not found</h1>
        <Link to="/projects" className="inline-flex px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link to="/projects" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            My projects
          </Link>
          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">group_search</span>
            Recruitment review
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{project.title} · {pendingCount} active candidate{pendingCount === 1 ? '' : 's'}</p>
        </div>
        <div className="w-full md:w-80">
          <label htmlFor="opportunity" className="block text-[11px] font-semibold text-on-surface mb-1">Recruitment role</label>
          <select
            id="opportunity"
            value={selectedOpportunityId}
            onChange={(event) => setSelectedOpportunityId(event.target.value)}
            className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
          >
            {opportunities.length === 0 && <option value="">No open roles found</option>}
            {opportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>
            ))}
          </select>
        </div>
      </header>

      {errorMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs">{errorMsg}</div>}

      {opportunities.length === 0 ? (
        <div className="py-20 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8">
          <span className="material-symbols-outlined text-5xl text-outline mb-3">person_add</span>
          <h2 className="text-base font-bold text-on-surface">No recruitment roles yet</h2>
          <p className="text-xs text-on-surface-variant mt-1">Create and publish a role in Discover to start receiving applications.</p>
          <Link to="/discover" className="mt-4 inline-flex px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Open Discover</Link>
        </div>
      ) : (
        <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-outline-variant/40">
            <h2 className="font-bold text-on-surface">Candidate queue</h2>
            <p className="text-xs text-on-surface-variant mt-1">Applications are ranked by skill match. Move candidates through review as you decide.</p>
            {selectedOpportunity && <p className="text-[11px] text-outline mt-2">Looking for: {selectedOpportunity.required_skills.join(', ') || 'No required skills listed'}</p>}
          </div>

          {queueLoading ? (
            <div className="py-16 text-center text-sm text-on-surface-variant">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="py-16 text-center text-sm text-on-surface-variant">No applications for this role yet.</div>
          ) : (
            <div className="divide-y divide-outline-variant/30">
              {applications.map((application) => (
                <article key={application.id} className="p-5 flex flex-col lg:flex-row lg:items-start gap-5">
                  <div className="w-11 h-11 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold shrink-0">
                    {Math.round(application.match_score * 100)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-on-surface">Candidate {application.user_id.slice(0, 8)}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant">
                        {statusLabels[application.status] || application.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">{application.message || 'No message included.'}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {application.candidate_skills.map((skill) => (
                        <span key={skill} className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 lg:justify-end max-w-xs">
                    {(nextStatuses[application.status] || []).map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={updatingId === application.id}
                        onClick={() => void updateStatus(application.id, status)}
                        className={`px-3 py-2 rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                          status === 'accepted' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                            status === 'rejected' ? 'bg-red-50 text-red-700 hover:bg-red-100' :
                              'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {status === 'under_review' ? 'Review' : status === 'accepted' ? 'Accept' : 'Decline'}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default RecruitmentReviewPage;
