import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Opportunity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  required_skills: string[];
  status: string;
  created_at: string;
}

interface Pitch {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  author_id: string | null;
}

export const DiscoverPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');

  // Application Modal state
  const [applyingTo, setApplyingTo] = useState<Opportunity | null>(null);
  const [applicantSkills, setApplicantSkills] = useState<string>('');
  const [applicantMessage, setApplicantMessage] = useState<string>('');
  const [applyStatus, setApplyStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [submittingApply, setSubmittingApply] = useState<boolean>(false);

  // Post Opportunity Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createProjectId, setCreateProjectId] = useState<string>('');
  const [createRoleTitle, setCreateRoleTitle] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createSkills, setCreateSkills] = useState<string>('');
  const [createAutoPublish, setCreateAutoPublish] = useState<boolean>(true);
  const [createQuickPitchTitle, setCreateQuickPitchTitle] = useState<string>('');
  const [createQuickPitchCategory, setCreateQuickPitchCategory] = useState<string>('Technology');
  const [createStatus, setCreateStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Opportunities (try /api/v1/opportunities, fallback to /opportunities/)
      let oppData: Opportunity[] = [];
      const oppRes = await fetch('/api/v1/opportunities', { credentials: 'include' })
        .catch(() => fetch('/opportunities/', { credentials: 'include' }));

      if (oppRes && oppRes.ok) {
        const parsed = await oppRes.json();
        if (Array.isArray(parsed)) {
          oppData = parsed;
        }
      }
      setOpportunities(oppData);

      // 2. Fetch Pitches
      const pitchRes = await fetch('/api/v1/user/pitches', { credentials: 'include' })
        .catch(() => fetch('/api/v1/pitches', { credentials: 'include' }));

      if (pitchRes && pitchRes.ok) {
        const pitchData = await pitchRes.json();
        if (Array.isArray(pitchData)) {
          setPitches(pitchData);
          if (pitchData.length > 0 && !createProjectId) {
            setCreateProjectId(pitchData[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load discover data', err);
    } finally {
      setLoading(false);
    }
  }, [createProjectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const allSkills = useMemo(() => {
    const skillSet = new Set<string>();
    opportunities.forEach((o) => {
      if (Array.isArray(o.required_skills)) {
        o.required_skills.forEach((s) => skillSet.add(s));
      }
    });
    return ['all', ...Array.from(skillSet)];
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((o) => {
      const titleMatch = (o.title || '').toLowerCase().includes(search.toLowerCase());
      const descMatch = (o.description || '').toLowerCase().includes(search.toLowerCase());
      const skillsMatch = Array.isArray(o.required_skills) &&
        o.required_skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

      const linkedPitch = pitches.find((p) => p.id === o.project_id);
      const pitchMatch = linkedPitch
        ? (linkedPitch.title || '').toLowerCase().includes(search.toLowerCase())
        : false;

      const matchesSearch = titleMatch || descMatch || skillsMatch || pitchMatch;

      const matchesSkill =
        selectedSkill === 'all' ||
        (Array.isArray(o.required_skills) &&
          o.required_skills.some((s) => s.toLowerCase() === selectedSkill.toLowerCase()));

      return matchesSearch && matchesSkill;
    });
  }, [opportunities, pitches, search, selectedSkill]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingTo) return;
    if (!user) {
      openAuthModal();
      return;
    }

    setSubmittingApply(true);
    setApplyStatus(null);

    const skillsArray = applicantSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      // Try /api/v1/opportunities/{id}/apply, fallback to /opportunities/{id}/apply
      let res = await fetch(`/api/v1/opportunities/${applyingTo.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          message: applicantMessage,
          candidate_skills: skillsArray,
        }),
      });

      if (res.status === 404) {
        res = await fetch(`/opportunities/${applyingTo.id}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            user_id: user.id,
            message: applicantMessage,
            candidate_skills: skillsArray,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setApplyStatus({ error: err.detail || 'Application failed to submit.' });
      } else {
        setApplyStatus({
          success: 'Application submitted successfully! The project founder will review your match score.',
        });
        setTimeout(() => {
          setApplyingTo(null);
          setApplyStatus(null);
          setApplicantMessage('');
          setApplicantSkills('');
        }, 2000);
      }
    } catch (err) {
      setApplyStatus({ error: err instanceof Error ? err.message : 'Network error.' });
    } finally {
      setSubmittingApply(false);
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }

    setSubmittingCreate(true);
    setCreateStatus(null);

    let targetProjectId = createProjectId;

    try {
      // 1. If user chose to create a new pitch first
      if (createProjectId === 'NEW_PITCH' || pitches.length === 0) {
        if (!createQuickPitchTitle.trim()) {
          setCreateStatus({ error: 'Please enter a pitch project title.' });
          setSubmittingCreate(false);
          return;
        }

        const pitchRes = await fetch('/api/v1/user/pitches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: createQuickPitchTitle.trim(),
            description: createDescription.slice(0, 150) || 'Collaborative 42 project pitch',
            content: `# ${createQuickPitchTitle.trim()}\n\nPeer collaborative project formed on 1337 Nexus.`,
            category: createQuickPitchCategory,
          }),
        });

        if (!pitchRes.ok) {
          const err = await pitchRes.json().catch(() => ({}));
          setCreateStatus({ error: err.detail || 'Failed to create pitch.' });
          setSubmittingCreate(false);
          return;
        }

        const newPitch = await pitchRes.json();
        targetProjectId = newPitch.id;
      }

      const skillsArray = createSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // 2. Create the opportunity
      const oppRes = await fetch('/api/v1/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          project_id: targetProjectId,
          title: createRoleTitle.trim(),
          description: createDescription.trim(),
          required_skills: skillsArray,
        }),
      });

      if (!oppRes.ok) {
        const err = await oppRes.json().catch(() => ({}));
        setCreateStatus({ error: err.detail || 'Failed to create opportunity.' });
        setSubmittingCreate(false);
        return;
      }

      const newOpp = await oppRes.json();

      // 3. Publish it so it shows in Discover
      if (createAutoPublish) {
        await fetch(`/api/v1/opportunities/${newOpp.id}/publish`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() =>
          fetch(`/opportunities/${newOpp.id}/publish`, {
            method: 'POST',
            credentials: 'include',
          })
        );
      }

      setCreateStatus({
        success: 'Opportunity posted successfully! It is now live on the Discover board.',
      });

      // 4. Refresh data & reset form
      await fetchData();

      setTimeout(() => {
        setShowCreateModal(false);
        setCreateStatus(null);
        setCreateRoleTitle('');
        setCreateDescription('');
        setCreateSkills('');
        setCreateQuickPitchTitle('');
      }, 1500);
    } catch (err) {
      setCreateStatus({ error: err instanceof Error ? err.message : 'Network error.' });
    } finally {
      setSubmittingCreate(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">explore</span>
            Discover Projects & Opportunities
          </h1>
          <p className="text-xs text-on-surface-variant">
            Explore active peer pitches, recruit teammates, and join open 42 project opportunities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed">
              {opportunities.length} Open Roles
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed">
              {pitches.length} Pitches
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                openAuthModal();
                return;
              }
              setShowCreateModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Post Role
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role title, project, or required skill (e.g. ROS2, Python, Docker, C++)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-on-surface-variant font-semibold shrink-0">Filter:</span>
          {allSkills.slice(0, 8).map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => setSelectedSkill(skill)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                selectedSkill === skill
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {skill}
            </button>
          ))}
          {selectedSkill !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedSkill('all')}
              className="text-xs text-primary font-semibold hover:underline shrink-0 ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid of Opportunities */}
      {loading ? (
        <div className="grid place-items-center py-16 text-on-surface-variant text-xs">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Loading opportunities...</span>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant text-center space-y-4">
          <span className="material-symbols-outlined text-[48px] text-outline">work_off</span>
          <div>
            <h2 className="text-base font-bold text-on-surface">No opportunities found</h2>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
              Try adjusting your search query or skill filter, or be the first founder to post a role for your project.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                openAuthModal();
                return;
              }
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Post an Opportunity
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOpportunities.map((opp) => {
            const linkedPitch = pitches.find((p) => p.id === opp.project_id);
            return (
              <div
                key={opp.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Linked Pitch Tag */}
                  {linkedPitch && (
                    <div className="flex items-center justify-between text-xs text-primary font-semibold border-b border-outline-variant/60 pb-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-[16px] shrink-0">campaign</span>
                        <span className="truncate">{linkedPitch.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-secondary-fixed text-on-secondary-fixed shrink-0 font-medium">
                        {linkedPitch.category}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <h3 className="text-base font-bold text-on-surface line-clamp-1">{opp.title}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-800 shrink-0">
                      {opp.status}
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                    {opp.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.isArray(opp.required_skills) &&
                      opp.required_skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[11px] font-mono"
                        >
                          {skill}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-outline-variant flex items-center justify-between">
                  <span className="text-[11px] text-outline">
                    {new Date(opp.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApplyingTo(opp)}
                    className="px-4 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Apply Role
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Modal */}
      {applyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-xl">
            <button
              onClick={() => {
                setApplyingTo(null);
                setApplyStatus(null);
              }}
              type="button"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <h2 className="text-lg font-bold text-on-surface mb-1">Apply for: {applyingTo.title}</h2>
            <p className="text-xs text-on-surface-variant mb-5">
              Submit your candidate skills. Our ML Recommendation engine evaluates candidate-to-opportunity match scores.
            </p>

            {applyStatus?.error && (
              <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs">
                {applyStatus.error}
              </div>
            )}
            {applyStatus?.success && (
              <div className="mb-4 p-3 rounded-xl bg-green-100 text-green-800 text-xs font-semibold">
                {applyStatus.success}
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Your Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={applicantSkills}
                  onChange={(e) => setApplicantSkills(e.target.value)}
                  placeholder="e.g. ROS2, Python, C++, Docker, Git"
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Introduction / Motivation
                </label>
                <textarea
                  rows={3}
                  required
                  value={applicantMessage}
                  onChange={(e) => setApplicantMessage(e.target.value)}
                  placeholder="Explain why you want to contribute to this project..."
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setApplyingTo(null);
                    setApplyStatus(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApply}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {submittingApply ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Opportunity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setCreateStatus(null);
              }}
              type="button"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <h2 className="text-lg font-bold text-on-surface mb-1">Post a Team Opportunity</h2>
            <p className="text-xs text-on-surface-variant mb-5">
              Recruit fellow 1337 students for your project pitch. Define the required skills and description.
            </p>

            {createStatus?.error && (
              <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs">
                {createStatus.error}
              </div>
            )}
            {createStatus?.success && (
              <div className="mb-4 p-3 rounded-xl bg-green-100 text-green-800 text-xs font-semibold">
                {createStatus.success}
              </div>
            )}

            <form onSubmit={handleCreateOpportunity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Associated Project Pitch
                </label>
                {pitches.length > 0 ? (
                  <select
                    value={createProjectId}
                    onChange={(e) => setCreateProjectId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    {pitches.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.category})
                      </option>
                    ))}
                    <option value="NEW_PITCH">+ Create New Project Pitch...</option>
                  </select>
                ) : (
                  <div className="text-xs text-outline mb-2">
                    No pitches found yet. Enter your project details below to create both:
                  </div>
                )}
              </div>

              {(createProjectId === 'NEW_PITCH' || pitches.length === 0) && (
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                      New Project Title
                    </label>
                    <input
                      type="text"
                      required
                      value={createQuickPitchTitle}
                      onChange={(e) => setCreateQuickPitchTitle(e.target.value)}
                      placeholder="e.g. ft_transcendence: Pong Platform"
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                      Project Category
                    </label>
                    <select
                      value={createQuickPitchCategory}
                      onChange={(e) => setCreateQuickPitchCategory(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="Technology">Technology</option>
                      <option value="Education">Education</option>
                      <option value="Health">Health</option>
                      <option value="Environment">Environment</option>
                      <option value="Entertainment">Entertainment</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Role Title
                </label>
                <input
                  type="text"
                  required
                  value={createRoleTitle}
                  onChange={(e) => setCreateRoleTitle(e.target.value)}
                  placeholder="e.g. Frontend Developer (React / Three.js)"
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Required Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={createSkills}
                  onChange={(e) => setCreateSkills(e.target.value)}
                  placeholder="e.g. React, TypeScript, Three.js, Docker"
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Role Responsibilities & Overview
                </label>
                <textarea
                  rows={3}
                  required
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Describe what the team member will work on and what progression you are aiming for..."
                  className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoPublish"
                  checked={createAutoPublish}
                  onChange={(e) => setCreateAutoPublish(e.target.checked)}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                <label htmlFor="autoPublish" className="text-xs text-on-surface-variant cursor-pointer">
                  Publish immediately (status: <span className="font-semibold text-green-700">open</span>)
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateStatus(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {submittingCreate ? 'Posting...' : 'Post Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
