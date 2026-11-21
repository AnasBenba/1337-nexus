import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { authFetch } from '@/lib/http';
import type { LayoutContext } from '@/components/Layout';

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
}

export const DiscoverPage: React.FC = () => {
  const navigate = useNavigate();
  const outletCtx = useOutletContext<LayoutContext | undefined>();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myPitchIds, setMyPitchIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Apply Modal state
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [applySkills, setApplySkills] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, [outletCtx?.me?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oppRes, myPitchesRes] = await Promise.allSettled([
        fetch('/opportunities/?limit=50&exclude_mine=true', { credentials: 'include' }).then((r) =>
          r.ok ? r.json() : [],
        ),
        outletCtx?.me
          ? authFetch('/api/v1/user/pitches/me').then((r) => (r.ok ? r.json() : []))
          : Promise.resolve([]),
      ]);

      const ownIds = new Set<string>();
      if (myPitchesRes.status === 'fulfilled' && Array.isArray(myPitchesRes.value)) {
        for (const p of myPitchesRes.value as Pitch[]) {
          ownIds.add(p.id);
        }
      }
      setMyPitchIds(ownIds);

      if (oppRes.status === 'fulfilled' && Array.isArray(oppRes.value)) {
        const list = (oppRes.value as Opportunity[]).filter((opp) => !ownIds.has(opp.project_id));
        setOpportunities(list);
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
        setApplySuccess('Application submitted successfully to the pitch team!');
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

  const filteredOpps = opportunities.filter((o) => {
    if (myPitchIds.has(o.project_id)) return false;
    const q = searchQuery.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      o.description.toLowerCase().includes(q) ||
      o.required_skills?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">explore</span>
            Discover Opportunities
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Browse open opportunities posted by fellow 1337 students and apply to join their teams.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
            search
          </span>
          <input
            id="discover-search"
            name="discover-search"
            type="text"
            placeholder="Search opportunities or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline border border-outline-variant/50 focus:border-primary outline-none transition-colors"
          />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-20 text-center text-on-surface-variant text-sm">
          Loading opportunities from other students...
        </div>
      ) : filteredOpps.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">search_off</span>
          <p className="text-sm font-semibold text-on-surface">
            No opportunities from other students found right now.
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Check back soon or try another search keyword.
          </p>
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
                    if (!outletCtx?.me) {
                      navigate('/login');
                      return;
                    }
                    setSelectedOpp(opp);
                    setApplySkills(opp.required_skills?.slice(0, 2).join(', ') || '');
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>Apply</span>
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </div>
            </div>
          ))}
        </div>
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
                className="text-outline hover:text-on-surface text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-surface-container-low rounded-xl">
              <div className="font-bold text-sm text-on-surface">{selectedOpp.title}</div>
              <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                {selectedOpp.description}
              </div>
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
                <label
                  htmlFor="apply-skills"
                  className="block text-xs font-semibold text-on-surface mb-1"
                >
                  Your Candidate Skills (comma separated)
                </label>
                <input
                  id="apply-skills"
                  name="apply-skills"
                  type="text"
                  placeholder="e.g. Python, Docker, FastAPI, React"
                  value={applySkills}
                  onChange={(e) => setApplySkills(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:border-primary outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="apply-message"
                  className="block text-xs font-semibold text-on-surface mb-1"
                >
                  Message / Introduction to the team
                </label>
                <textarea
                  id="apply-message"
                  name="apply-message"
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
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {applyLoading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
