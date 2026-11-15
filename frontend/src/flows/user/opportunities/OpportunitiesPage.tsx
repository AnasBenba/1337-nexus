import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '@/lib/http';

interface Opportunity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  required_skills: string[];
  created_at?: string;
}

interface Pitch {
  id: string;
  title: string;
  category: string;
  status?: string;
  state?: string;
}

export const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myPitches, setMyPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Create Opportunity Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPitchId, setSelectedPitchId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [oppRes, pitchRes] = await Promise.allSettled([
        authFetch('/opportunities/mine').then((r) => (r.ok ? r.json() : [])),
        authFetch('/api/v1/user/pitches/me').then((r) => (r.ok ? r.json() : [])),
      ]);

      if (oppRes.status === 'fulfilled' && Array.isArray(oppRes.value)) {
        setOpportunities(oppRes.value as Opportunity[]);
      }
      if (pitchRes.status === 'fulfilled' && Array.isArray(pitchRes.value)) {
        const pitches = pitchRes.value as Pitch[];
        setMyPitches(pitches);
        if (pitches.length > 0 && !selectedPitchId) {
          setSelectedPitchId(pitches[0].id);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handlePublish = async (opportunityId: string) => {
    setPublishingId(opportunityId);
    setError(null);
    try {
      const res = await authFetch(`/opportunities/${opportunityId}/publish`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to publish opportunity');
      }
      const updated = (await res.json()) as Opportunity;
      setOpportunities((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to publish opportunity');
    } finally {
      setPublishingId(null);
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPitchId) {
      setCreateError('Please select one of your pitches first.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);

    const skillsArray = newSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await authFetch('/opportunities/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedPitchId,
          title: newTitle,
          description: newDesc,
          required_skills: skillsArray,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.detail || 'Failed to create opportunity');
        return;
      }

      const created = (await res.json()) as Opportunity;
      // Publish immediately so peers can see it in Discover
      const pubRes = await authFetch(`/opportunities/${created.id}/publish`, {
        method: 'POST',
      });
      const finalOpp = pubRes.ok ? ((await pubRes.json()) as Opportunity) : created;

      setOpportunities((current) => [finalOpp, ...current.filter((item) => item.id !== finalOpp.id)]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewSkills('');
    } catch {
      setCreateError('Network error while creating opportunity');
    } finally {
      setCreateLoading(false);
    }
  };

  const pitchTitleById = new Map(myPitches.map((p) => [p.id, p.title]));

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Recruitment &amp; Collaboration
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface mt-1">
            My Opportunities
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage the team opportunities you have created from your pitches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/pitches"
            className="px-4 py-2.5 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:border-primary flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            My Pitches
          </Link>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Create Opportunity
          </button>
        </div>
      </header>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-on-surface-variant">
          Loading your opportunities...
        </div>
      ) : opportunities.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-outline-variant rounded-2xl bg-surface-container-lowest p-8 space-y-3">
          <span className="material-symbols-outlined text-4xl text-outline">work</span>
          <h2 className="font-bold text-on-surface">You haven&apos;t created any opportunities yet</h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            Create an opportunity directly from one of your pitches to recruit teammates and collaborate on a Kanban board.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Create Opportunity from Pitch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map((opp) => {
            const pitchTitle = pitchTitleById.get(opp.project_id);
            const isOwner = pitchTitleById.has(opp.project_id);
            return (
              <article
                key={opp.id}
                className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          opp.status === 'open'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/15 text-amber-700'
                        }`}
                      >
                        {opp.status}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isOwner
                            ? 'bg-primary/10 text-primary'
                            : 'bg-emerald-500/15 text-emerald-700'
                        }`}
                      >
                        {isOwner ? 'Owner' : 'Accepted Member'}
                      </span>
                    </div>
                    {pitchTitle && (
                      <span className="text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full truncate max-w-[160px]">
                        Pitch: {pitchTitle}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-on-surface mt-3">{opp.title}</h2>
                  <p className="text-xs text-on-surface-variant mt-2 line-clamp-3 leading-relaxed">
                    {opp.description}
                  </p>

                  {opp.required_skills && opp.required_skills.length > 0 && (
                    <div className="mt-4">
                      <div className="text-[10px] font-semibold text-outline uppercase tracking-wider mb-1.5">
                        Required Skills
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {opp.required_skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[11px] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-outline-variant/40">
                  <Link
                    to={`/opportunities/${opp.id}/workspace`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest text-xs font-semibold transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">workspaces</span>
                    <span>View Workspace</span>
                  </Link>

                  <Link
                    to={`/boards/${opp.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white hover:opacity-90 text-xs font-semibold transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">view_kanban</span>
                    <span>View Board</span>
                  </Link>

                  {isOwner && (
                    <Link
                      to={`/opportunities/${opp.id}/applications`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface hover:border-primary hover:text-primary text-xs font-semibold transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      <span>View Applicants</span>
                    </Link>
                  )}

                  {isOwner && opp.status === 'draft' && (
                    <button
                      type="button"
                      disabled={publishingId === opp.id}
                      onClick={() => void handlePublish(opp.id)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-primary text-primary hover:bg-primary/5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {publishingId === opp.id ? 'Publishing...' : 'Publish to Discover'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Opportunity from Pitch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Create Opportunity from Pitch</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-outline hover:text-on-surface text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
                {createError}
              </div>
            )}

            {myPitches.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant space-y-3">
                <p>You need to create a pitch first before creating an opportunity from it.</p>
                <Link
                  to="/pitches"
                  className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-semibold"
                >
                  Go to Pitches
                </Link>
              </div>
            ) : (
              <form onSubmit={handleCreateOpportunity} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Select Your Pitch
                  </label>
                  <select
                    value={selectedPitchId}
                    onChange={(e) => setSelectedPitchId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                  >
                    {myPitches.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Opportunity Title / Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Backend Engineer (Python / FastAPI / PostgreSQL)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Required Skills (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Python, Docker, FastAPI, React"
                    value={newSkills}
                    onChange={(e) => setNewSkills(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Description &amp; Responsibilities
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe what the teammate will work on, timeline, and expectations..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {createLoading ? 'Creating...' : 'Create & Publish'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesPage;
