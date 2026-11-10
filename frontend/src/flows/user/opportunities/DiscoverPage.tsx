import React, { useEffect, useState, useMemo } from 'react';
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [oppRes, pitchRes] = await Promise.all([
          fetch('/opportunities/', { credentials: 'include' }),
          fetch('/api/v1/user/pitches', { credentials: 'include' }),
        ]);

        if (oppRes.ok) {
          const oppData = await oppRes.json();
          setOpportunities(oppData);
        }
        if (pitchRes.ok) {
          const pitchData = await pitchRes.json();
          setPitches(pitchData);
        }
      } catch (err) {
        console.error('Failed to load discover data', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const allSkills = useMemo(() => {
    const skillSet = new Set<string>();
    opportunities.forEach((o) => o.required_skills.forEach((s) => skillSet.add(s)));
    return ['all', ...Array.from(skillSet)];
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((o) => {
      const matchesSearch =
        o.title.toLowerCase().includes(search.toLowerCase()) ||
        o.description.toLowerCase().includes(search.toLowerCase()) ||
        o.required_skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

      const matchesSkill =
        selectedSkill === 'all' ||
        o.required_skills.some((s) => s.toLowerCase() === selectedSkill.toLowerCase());

      return matchesSearch && matchesSkill;
    });
  }, [opportunities, search, selectedSkill]);

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
      const res = await fetch(`/opportunities/${applyingTo.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          message: applicantMessage,
          candidate_skills: skillsArray,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setApplyStatus({ error: err.detail || 'Application failed to submit.' });
      } else {
        setApplyStatus({ success: 'Application submitted successfully! The project founder will review your match score.' });
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed">
            {opportunities.length} Open Roles
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed">
            {pitches.length} Pitches
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role title, project, or required skill (e.g. ROS2, Python, Docker)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-on-surface-variant font-semibold shrink-0">Filter:</span>
          {allSkills.slice(0, 6).map((skill) => (
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
        </div>
      </div>

      {/* Grid of Opportunities */}
      {loading ? (
        <div className="grid place-items-center py-16 text-on-surface-variant text-xs">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Loading opportunities...</span>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant text-center space-y-3">
          <span className="material-symbols-outlined text-[44px] text-outline">work_off</span>
          <h2 className="text-base font-bold text-on-surface">No opportunities found</h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            Try adjusting your search query or skill filter. New project founder roles appear here as pitches are published.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOpportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-on-surface line-clamp-1">{opp.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-800 shrink-0">
                    {opp.status}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                  {opp.description}
                </p>

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
          ))}
        </div>
      )}

      {/* Apply Modal */}
      {applyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-xl">
            <button
              onClick={() => { setApplyingTo(null); setApplyStatus(null); }}
              type="button"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <h2 className="text-lg font-bold text-on-surface mb-1">Apply for: {applyingTo.title}</h2>
            <p className="text-xs text-on-surface-variant mb-5">
              Submit your candidate skills. Our ML Recommendation engine evaluates candidate-to-opportunity cosine match scores.
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
                  onClick={() => { setApplyingTo(null); setApplyStatus(null); }}
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
    </div>
  );
};
