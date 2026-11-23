import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authFetch } from '@/lib/http';

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

interface OpportunityTeamMember {
  user_id: string;
  login: string;
  fullname: string;
  role: string;
  is_founder: boolean;
}

export const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myPitches, setMyPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingOppId, setDeletingOppId] = useState<string | null>(null);

  // Team Members Modal state
  const [teamModalOpp, setTeamModalOpp] = useState<{ opp: Opportunity; isOwner: boolean } | null>(
    null,
  );
  const [teamMembers, setTeamMembers] = useState<OpportunityTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);

  // Opportunity form state
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [selectedPitchId, setSelectedPitchId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [savingOpportunity, setSavingOpportunity] = useState(false);
  const [opportunityFormError, setOpportunityFormError] = useState<string | null>(null);

  const publishedPitches = myPitches.filter(
    (p) => (p.state ?? p.status ?? '').toLowerCase() === 'published',
  );

  const availablePitches = publishedPitches.filter(
    (p) => !opportunities.some((opp) => opp.project_id === p.id),
  );

  const handleOpenCreateModal = () => {
    if (availablePitches.length > 0) {
      setSelectedPitchId(availablePitches[0].id);
    } else {
      setSelectedPitchId('');
    }
    setEditingOpportunity(null);
    setNewTitle('');
    setNewDesc('');
    setNewSkills('');
    setOpportunityFormError(null);
    setShowOpportunityForm(true);
  };

  const handleOpenEditModal = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
    setNewTitle(opportunity.title);
    setNewDesc(opportunity.description);
    setNewSkills(opportunity.required_skills?.join(', ') ?? '');
    setOpportunityFormError(null);
    setShowOpportunityForm(true);
  };

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

  const handleDeleteOpportunity = async (opportunityId: string, oppTitle?: string) => {
    const confirmMsg = `Are you sure you want to delete "${oppTitle || 'this opportunity'}"? This action cannot be undone and will remove associated applications and workspace team data.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingOppId(opportunityId);
    setError(null);
    try {
      const res = await authFetch(`/opportunities/${opportunityId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete opportunity');
      }
      setOpportunities((current) => current.filter((item) => item.id !== opportunityId));
      if (teamModalOpp?.opp.id === opportunityId) {
        setTeamModalOpp(null);
      }
    } catch (delError) {
      setError(delError instanceof Error ? delError.message : 'Could not delete opportunity');
    } finally {
      setDeletingOppId(null);
    }
  };

  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingOpportunity) return;
    if (!editingOpportunity && !selectedPitchId) {
      setOpportunityFormError('Please select one of your pitches first.');
      return;
    }
    setSavingOpportunity(true);
    setOpportunityFormError(null);

    const skillsArray = newSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingOpportunity) {
        const changes: Partial<Pick<Opportunity, 'title' | 'description' | 'required_skills'>> = {};
        if (newTitle !== editingOpportunity.title) changes.title = newTitle.trim();
        if (newDesc !== editingOpportunity.description) changes.description = newDesc.trim();
        if (newSkills !== (editingOpportunity.required_skills?.join(', ') ?? '')) {
          changes.required_skills = skillsArray;
        }

        if (Object.keys(changes).length > 0) {
          const updated = await api<Opportunity>(`/opportunities/${editingOpportunity.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes),
          });
          setOpportunities((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        }
        setShowOpportunityForm(false);
        return;
      }

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
        setOpportunityFormError(err.detail || 'Failed to create opportunity');
        return;
      }

      const created = (await res.json()) as Opportunity;
      // Publish immediately so peers can see it in Discover
      const pubRes = await authFetch(`/opportunities/${created.id}/publish`, {
        method: 'POST',
      });
      const finalOpp = pubRes.ok ? ((await pubRes.json()) as Opportunity) : created;

      setOpportunities((current) => [finalOpp, ...current.filter((item) => item.id !== finalOpp.id)]);
      setShowOpportunityForm(false);
      setNewTitle('');
      setNewDesc('');
      setNewSkills('');
    } catch (reason) {
      setOpportunityFormError(
        editingOpportunity && reason instanceof Error
          ? reason.message
          : 'Network error while creating opportunity',
      );
    } finally {
      setSavingOpportunity(false);
    }
  };

  const pitchTitleById = new Map(myPitches.map((p) => [p.id, p.title]));

  const openTeamModal = async (opp: Opportunity, isOwner: boolean) => {
    setTeamModalOpp({ opp, isOwner });
    setTeamMembers([]);
    setTeamError(null);
    setTeamLoading(true);
    try {
      const res = await authFetch(`/api/teams/opportunities/${opp.id}/members`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Could not load team members (${res.status})`);
      }
      const data = (await res.json()) as OpportunityTeamMember[];
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Could not load team members');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleKickMember = async (member: OpportunityTeamMember) => {
    if (!teamModalOpp) return;
    setKickingUserId(member.user_id);
    setTeamError(null);
    try {
      const res = await authFetch(
        `/api/teams/opportunities/${teamModalOpp.opp.id}/members/${member.user_id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to remove member (${res.status})`);
      }
      setTeamMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to kick member');
    } finally {
      setKickingUserId(null);
    }
  };

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
            onClick={handleOpenCreateModal}
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
            onClick={handleOpenCreateModal}
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

                  <button
                    type="button"
                    onClick={() => void openTeamModal(opp, isOwner)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface hover:border-primary hover:text-primary text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    <span>Details</span>
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      disabled={publishingId === opp.id || deletingOppId === opp.id}
                      onClick={() => handleOpenEditModal(opp)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant text-on-surface hover:border-primary hover:text-primary text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Edit Opportunity
                    </button>
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

      {/* Opportunity Form */}
      {showOpportunityForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="opportunity-form-title" className="bg-surface rounded-2xl border border-outline-variant/60 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 id="opportunity-form-title" className="text-lg font-bold text-on-surface">{editingOpportunity ? 'Edit Opportunity' : 'Create Opportunity from Pitch'}</h3>
              <button
                type="button"
                aria-label="Close opportunity form"
                disabled={savingOpportunity}
                onClick={() => setShowOpportunityForm(false)}
                className="text-outline hover:text-on-surface text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {opportunityFormError && (
              <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
                {opportunityFormError}
              </div>
            )}

            {!editingOpportunity && myPitches.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant space-y-3">
                <p>You need to create and publish a pitch first before creating an opportunity from it.</p>
                <Link
                  to="/pitches"
                  className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-semibold"
                >
                  Go to Pitches
                </Link>
              </div>
            ) : !editingOpportunity && publishedPitches.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant space-y-3">
                <p>You only have draft pitches right now. Please publish a pitch before creating an opportunity from it.</p>
                <Link
                  to="/pitches"
                  className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-semibold"
                >
                  Publish a Pitch
                </Link>
              </div>
            ) : !editingOpportunity && availablePitches.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant space-y-3">
                <p>All your published pitches already have an opportunity created. Only one opportunity can be created per pitch.</p>
                <Link
                  to="/pitches"
                  className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-semibold"
                >
                  Go to Pitches
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSaveOpportunity} className="space-y-4">
                {!editingOpportunity && (
                  <div>
                    <label
                      htmlFor="create-opp-pitch-select"
                      className="block text-xs font-semibold text-on-surface mb-1"
                    >
                      Select Your Published Pitch
                    </label>
                    <select
                      id="create-opp-pitch-select"
                      name="project_id"
                      value={selectedPitchId}
                      onChange={(e) => setSelectedPitchId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                    >
                      {availablePitches.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="create-opp-title-input"
                    className="block text-xs font-semibold text-on-surface mb-1"
                  >
                    Opportunity Title / Role
                  </label>
                  <input
                    id="create-opp-title-input"
                    name="title"
                    type="text"
                    placeholder="e.g. Backend Engineer (Python / FastAPI / PostgreSQL)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={255}
                    required
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="create-opp-skills-input"
                    className="block text-xs font-semibold text-on-surface mb-1"
                  >
                    Required Skills (comma separated)
                  </label>
                  <input
                    id="create-opp-skills-input"
                    name="required_skills"
                    type="text"
                    placeholder="e.g. Python, Docker, FastAPI, React"
                    value={newSkills}
                    onChange={(e) => setNewSkills(e.target.value)}
                    required={!editingOpportunity}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="create-opp-description-input"
                    className="block text-xs font-semibold text-on-surface mb-1"
                  >
                    Description &amp; Responsibilities
                  </label>
                  <textarea
                    id="create-opp-description-input"
                    name="description"
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
                    disabled={savingOpportunity}
                    onClick={() => setShowOpportunityForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOpportunity}
                    className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {savingOpportunity ? 'Saving...' : editingOpportunity ? 'Save Changes' : 'Create & Publish'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Opportunity Details & Accepted Users Modal */}
      {teamModalOpp && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTeamModalOpp(null)}
        >
          <div
            className="bg-surface rounded-2xl border border-outline-variant/60 max-w-xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/40 pb-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      teamModalOpp.opp.status === 'open'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/15 text-amber-700'
                    }`}
                  >
                    {teamModalOpp.opp.status}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      teamModalOpp.isOwner
                        ? 'bg-primary/10 text-primary'
                        : 'bg-emerald-500/15 text-emerald-700'
                    }`}
                  >
                    {teamModalOpp.isOwner ? 'Owner' : 'Accepted Member'}
                  </span>
                  {pitchTitleById.get(teamModalOpp.opp.project_id) && (
                    <span className="text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      Pitch: {pitchTitleById.get(teamModalOpp.opp.project_id)}
                    </span>
                  )}
                  {teamModalOpp.opp.created_at && (
                    <span className="text-[11px] text-on-surface-variant">
                      Created {new Date(teamModalOpp.opp.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-on-surface">
                  {teamModalOpp.opp.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTeamModalOpp(null)}
                className="text-outline hover:text-on-surface text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Full Description */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-outline">
                Description &amp; Responsibilities
              </h4>
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface whitespace-pre-wrap leading-relaxed">
                {teamModalOpp.opp.description}
              </div>
            </div>

            {/* Required Skills */}
            {teamModalOpp.opp.required_skills && teamModalOpp.opp.required_skills.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-outline">
                  Required Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {teamModalOpp.opp.required_skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-medium border border-outline-variant/40"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted Users List */}
            <div className="space-y-2.5 pt-2 border-t border-outline-variant/40">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">groups</span>
                  Accepted Users on Opportunity (
                  {teamMembers.filter((m) => !m.is_founder).length})
                </h4>
              </div>

              {teamError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs rounded-xl">
                  {teamError}
                </div>
              )}

              {teamLoading ? (
                <div className="py-6 text-center text-xs text-on-surface-variant">
                  Loading accepted users...
                </div>
              ) : teamMembers.filter((m) => !m.is_founder).length === 0 ? (
                <div className="py-6 text-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface-variant">
                  No users have been accepted on this opportunity yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {teamMembers
                    .filter((m) => !m.is_founder)
                    .map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-outline-variant/50 bg-surface-container-low"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {(member.fullname || member.login || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-on-surface truncate">
                                {member.fullname}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700">
                                Accepted
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-on-surface-variant truncate">
                              @{member.login}
                            </p>
                          </div>
                        </div>

                        {teamModalOpp.isOwner && (
                          <button
                            type="button"
                            disabled={kickingUserId === member.user_id}
                            onClick={() => void handleKickMember(member)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 hover:bg-red-500 hover:text-white text-xs font-bold transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              person_remove
                            </span>
                            <span>
                              {kickingUserId === member.user_id ? 'Kicking...' : 'Kick'}
                            </span>
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap justify-between items-center gap-2">
              <div>
                {teamModalOpp.isOwner && (
                  <button
                    type="button"
                    disabled={deletingOppId === teamModalOpp.opp.id}
                    onClick={() => void handleDeleteOpportunity(teamModalOpp.opp.id, teamModalOpp.opp.title)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>{deletingOppId === teamModalOpp.opp.id ? 'Deleting...' : 'Delete Opportunity'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {teamModalOpp.isOwner && (
                  <Link
                    to={`/opportunities/${teamModalOpp.opp.id}/applications`}
                    onClick={() => setTeamModalOpp(null)}
                    className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface hover:border-primary hover:text-primary text-xs font-semibold"
                  >
                    View Pending Applicants
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setTeamModalOpp(null)}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesPage;
