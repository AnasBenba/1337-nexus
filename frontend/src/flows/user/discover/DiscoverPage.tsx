iimport React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '@/lib/auth';

interface Opportunity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  required_skills: string[];
}

interface Pitch {
  id: string;
  title: string;
  content: string;
  rendered_content?: string;
  category: string;
  status: string;
  description?: string;
}

interface Project {
  id: string;
  title: string;
}

export const DiscoverPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'pitches'>('opportunities');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Apply Modal state
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [applySkills, setApplySkills] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Create Opportunity Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdOpportunity, setCreatedOpportunity] = useState<Opportunity | null>(null);
  const [publishingOpportunity, setPublishingOpportunity] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oppRes, pitchRes, projRes] = await Promise.allSettled([
        authFetch('/opportunities/?limit=50').then((r) => (r.ok ? r.json() : [])),
        authFetch('/api/v1/user/pitches').then((r) => (r.ok ? r.json() : [])),
        authFetch('/projects/mine').then((r) => (r.ok ? r.json() : [])),
      ]);

      if (oppRes.status === 'fulfilled' && Array.isArray(oppRes.value)) setOpportunities(oppRes.value);
      if (pitchRes.status === 'fulfilled' && Array.isArray(pitchRes.value)) setPitches(pitchRes.value);
      if (projRes.status === 'fulfilled' && Array.isArray(projRes.value)) {
        setMyProjects(projRes.value);
        if (projRes.value.length > 0) setSelectedProject(projRes.value[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplySuccess(null);

    const skillsArray = applySkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await authFetch(`/opportunities/${selectedOpp.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: applyMessage,
          candidate_skills: skillsArray,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setApplyError(err.detail || 'Failed to submit application');
      } else {
        setApplySuccess('Application submitted successfully to the project team!');
        setTimeout(() => {
          setSelectedOpp(null);
          setApplySkills('');
          setApplyMessage('');
          setApplySuccess(null);
        }, 1800);
      }
    } catch {
      setApplyError('Network error while applying');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setCreateError('Please select or create a project first.');
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
          project_id: selectedProject,
          title: newTitle,
          description: newDesc,
          required_skills: skillsArray,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.detail || 'Failed to create opportunity');
      } else {
        const created = (await res.json()) as Opportunity;
        setCreatedOpportunity(created);
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewSkills('');
        void fetchData();
      }
    } catch {
      setCreateError('Network error while creating opportunity');
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePublishOpportunity = async () => {
    if (!createdOpportunity) return;
    setPublishingOpportunity(true);
    setCreateError(null);
    try {
      const res = await authFetch(`/opportunities/${createdOpportunity.id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to publish opportunity');
      }
      const published = (await res.json()) as Opportunity;
      setCreatedOpportunity(published);
      setOpportunities((current) => [published, ...current.filter((item) => item.id !== published.id)]);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : 'Failed to publish opportunity');
    } finally {
      setPublishingOpportunity(false);
    }
  };

  const filteredOpps = opportunities.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      o.description.toLowerCase().includes(q) ||
      o.required_skills?.some((s) => s.toLowerCase().includes(q))
    );
  });

  const filteredPitches = pitches.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">explore</span>
            Discover Campus Innovation
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Browse student teams recruiting peers, view innovative pitches, and join groundbreaking projects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Post Opportunity
          </button>
          <Link
            to="/refine-project"
            className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-medium text-sm flex items-center gap-2 hover:bg-surface-container-highest transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            AI Pitch Refiner
          </Link>
        </div>
      </div>

      {createdOpportunity && (
        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-on-surface">{createdOpportunity.title} is saved as a draft.</p>
            <p className="text-xs text-on-surface-variant mt-1">Publish it now so students can discover and apply.</p>
          </div>
          {createdOpportunity.status === 'draft' ? (
            <button type="button" onClick={() => void handlePublishOpportunity()} disabled={publishingOpportunity} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-50">
              {publishingOpportunity ? 'Publishing...' : 'Publish opportunity'}
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">Published</span>
          )}
        </div>
      )}

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('opportunities')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'opportunities'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Team Opportunities ({opportunities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pitches')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'pitches'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Project Pitches ({pitches.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search keywords or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline border border-outline-variant/50 focus:border-primary outline-none transition-colors"
          />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-20 text-center text-on-surface-variant text-sm">Loading discover feed...</div>
      ) : activeTab === 'opportunities' ? (
        filteredOpps.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">search_off</span>
            <p className="text-sm font-semibold text-on-surface">No opportunities match your filter.</p>
            <p className="text-xs text-on-surface-variant mt-1">Try another search keyword or create an opportunity.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOpps.map((opp) => (
              <div
                key={opp.id}
                className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                      {opp.status}
                    </span>
                    <span className="text-[11px] font-mono text-outline">Campus Benguerir</span>
                  </div>
                  <h3 className="font-bold text-base text-on-surface">{opp.title}</h3>
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                    {opp.description}
                  </p>

                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-2">
                      Required Skills
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {opp.required_skills?.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-outline-variant/40 flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">groups</span>
                    Team Opening
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOpp(opp);
                      setApplySkills(opp.required_skills?.slice(0, 2).join(', ') || '');
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Apply</span>
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Pitches Tab */
        filteredPitches.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">lightbulb</span>
            <p className="text-sm font-semibold text-on-surface">No project pitches found.</p>
            <p className="text-xs text-on-surface-variant mt-1">Submit your idea to get AI critique and find peers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPitches.map((pitch) => (
              <div
                key={pitch.id}
                className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600">
                      {pitch.category}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-on-surface-variant uppercase">
                      {pitch.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-on-surface">{pitch.title}</h3>
                  <p className="text-xs text-on-surface-variant mt-2 line-clamp-3 leading-relaxed">
                    {pitch.description || pitch.content}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-outline-variant/40 flex items-center justify-between">
                  <span className="text-xs text-outline font-mono">Peer Pitch</span>
                  <Link
                    to="/refine-project"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-semibold hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    Critique / Refine
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Apply to Opportunity Modal */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Apply to Opportunity</h3>
              <button
                type="button"
                onClick={() => setSelectedOpp(null)}
                className="text-outline hover:text-on-surface text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-surface-container-low rounded-xl">
              <div className="font-bold text-sm text-on-surface">{selectedOpp.title}</div>
              <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">{selectedOpp.description}</div>
            </div>

            {applyError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
                {applyError}
              </div>
            )}

            {applySuccess && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs rounded-xl font-medium">
                {applySuccess}
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Your Candidate Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Python, Docker, FastApi, React"
                  value={applySkills}
                  onChange={(e) => setApplySkills(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Message / Introduction to the team
                </label>
                <textarea
                  rows={4}
                  placeholder="Introduce yourself, your experience with this tech stack, and why you want to collaborate..."
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOpp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {applyLoading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Opportunity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/60 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">Post an Opportunity</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-outline hover:text-on-surface text-sm"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
                {createError}
              </div>
            )}

            {myProjects.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant">
                <p>You need to create a project before posting an opportunity for teammates.</p>
                <Link
                  to="/projects"
                  className="mt-3 inline-block px-4 py-2 bg-primary text-white rounded-xl font-medium"
                >
                  Create a Project
                </Link>
              </div>
            ) : (
              <form onSubmit={handleCreateOpportunity} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Select Your Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                  >
                    {myProjects.map((p) => (
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
                    placeholder="e.g. Backend Engineer (Python / Docker / PostgreSQL)"
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
                    placeholder="e.g. Python, Docker, FastApi, PostgreSQL"
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
                    className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
                  >
                    {createLoading ? 'Publishing...' : 'Publish Opportunity'}
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

export default DiscoverPage;
