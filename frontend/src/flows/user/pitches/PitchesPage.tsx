import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RefineProjectModal } from '@/flows/user/projects/refine_project/RefineProjectModal';

export interface PitchItem {
  id: string;
  title: string;
  description: string | null;
  content: string;
  rendered_content: string;
  category: string;
  status: string;
  author_id: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  my_vote: 'up' | 'down' | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Technology',
  'Education',
  'Health',
  'Environment',
  'Entertainment',
  'Finance',
  'Other',
];

export const PitchesPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [pitches, setPitches] = useState<PitchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'newest'>('score');
  const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null);

  // Create / Edit Pitch Composer State
  const [showComposer, setShowComposer] = useState<boolean>(false);
  const [editingPitchId, setEditingPitchId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('Technology');
  const [description, setDescription] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [savingMode, setSavingMode] = useState<'save' | 'refine' | null>(null);
  const [formFeedback, setFormFeedback] = useState<{ error?: string; success?: string } | null>(
    null
  );

  // Refine with AI Modal State
  const [refiningPitch, setRefiningPitch] = useState<{ id: string; title: string } | null>(null);

  const loadPitches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/user/pitches', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPitches(data);
        }
      }
    } catch (err) {
      console.error('Failed to load pitches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPitches();
  }, [loadPitches]);

  const resetForm = () => {
    setEditingPitchId(null);
    setTitle('');
    setCategory('Technology');
    setDescription('');
    setContent('');
    setFormFeedback(null);
  };

  const handleStartCreate = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    resetForm();
    setShowComposer(true);
  };

  const handleStartEdit = (pitch: PitchItem) => {
    setEditingPitchId(pitch.id);
    setTitle(pitch.title);
    setCategory(pitch.category || 'Technology');
    setDescription(pitch.description || '');
    setContent(pitch.content);
    setFormFeedback(null);
    setShowComposer(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePitchToBackend = async (openRefinerAfter: boolean) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!title.trim() || !content.trim()) {
      setFormFeedback({ error: 'Pitch title and content are required.' });
      return;
    }

    setSavingMode(openRefinerAfter ? 'refine' : 'save');
    setFormFeedback(null);

    try {
      const url = editingPitchId
        ? `/api/v1/user/pitches/${editingPitchId}`
        : '/api/v1/user/pitches';
      const method = editingPitchId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim() || null,
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormFeedback({ error: err.detail || 'Could not save pitch.' });
        return;
      }

      const saved: PitchItem = await res.json();
      await loadPitches();

      if (openRefinerAfter) {
        setShowComposer(false);
        resetForm();
        setRefiningPitch({ id: saved.id, title: saved.title });
      } else {
        setFormFeedback({
          success: editingPitchId
            ? 'Pitch updated in database!'
            : 'Pitch saved to database! You can publish it or refine it with AI anytime.',
        });
        setTimeout(() => {
          setShowComposer(false);
          resetForm();
        }, 1000);
      }
    } catch (err) {
      setFormFeedback({ error: err instanceof Error ? err.message : 'Network error.' });
    } finally {
      setSavingMode(null);
    }
  };

  const handlePublish = async (pitch: PitchItem) => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await fetch(`/api/v1/user/pitches/${pitch.id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await loadPitches();
      }
    } catch (err) {
      console.error('Failed to publish pitch:', err);
    }
  };

  const handleVote = async (pitch: PitchItem, direction: 'up' | 'down') => {
    if (!user) {
      openAuthModal();
      return;
    }

    try {
      let res: Response;
      if (pitch.my_vote === direction) {
        // Clicking the same vote toggles it off
        res = await fetch(`/api/v1/user/pitches/${pitch.id}/vote`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } else {
        res = await fetch(`/api/v1/user/pitches/${pitch.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ direction }),
        });
      }

      if (res.ok) {
        const voteData = (await res.json()) as {
          upvotes: number;
          downvotes: number;
          score: number;
          my_vote: 'up' | 'down' | null;
        };
        setPitches((prev) =>
          prev.map((p) =>
            p.id === pitch.id
              ? {
                  ...p,
                  upvotes: voteData.upvotes,
                  downvotes: voteData.downvotes,
                  score: voteData.score,
                  my_vote: voteData.my_vote,
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const filteredPitches = useMemo(() => {
    const list = pitches.filter((p) => {
      if (filterScope === 'mine' && (!user || p.author_id !== user.id)) {
        return false;
      }
      if (filterCategory !== 'all' && p.category.toLowerCase() !== filterCategory.toLowerCase()) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'score') {
        if (b.score !== a.score) return b.score - a.score;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [pitches, filterScope, filterCategory, sortBy, user]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">campaign</span>
            Project Pitches &amp; AI Refiner
          </h1>
          <p className="text-xs text-on-surface-variant">
            Share project ideas, upvote the best campus concepts, and refine your pitch with AI critique before publishing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showComposer) {
              setShowComposer(false);
              resetForm();
            } else {
              handleStartCreate();
            }
          }}
          className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showComposer ? 'close' : 'add'}
          </span>
          <span>{showComposer ? 'Close Composer' : 'New Pitch'}</span>
        </button>
      </div>

      {/* Create / Edit Pitch Composer Card */}
      {showComposer && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">
                edit_document
              </span>
              <h2 className="text-base font-bold text-on-surface">
                {editingPitchId ? 'Edit Project Pitch' : 'Create a New Project Pitch'}
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-semibold">
              Save or Refine with AI
            </span>
          </div>

          {formFeedback?.error && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
              {formFeedback.error}
            </div>
          )}
          {formFeedback?.success && (
            <div className="p-3 rounded-xl bg-green-100 text-green-800 text-xs font-semibold">
              {formFeedback.success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Pitch Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. PeerEval: Automated 42 Defense Scheduler"
                className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Short Tagline / Summary
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-sentence summary of the problem and solution..."
              className="w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Full Pitch Content (Problem, Solution, Target Users, Impact)
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                'Problem: Describe the pain point students or users face...\n\n' +
                'Solution: Explain your technical architecture and core features...\n\n' +
                'Impact: How will you measure success and what roles do you need?'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary font-sans leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-outline-variant">
            <button
              type="button"
              onClick={() => {
                setShowComposer(false);
                resetForm();
              }}
              className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container cursor-pointer"
            >
              Cancel
            </button>

            {/* Option 1: Save Pitch */}
            <button
              type="button"
              disabled={savingMode !== null}
              onClick={() => void savePitchToBackend(false)}
              className="px-4 py-2 rounded-xl border border-primary text-primary font-bold text-xs flex items-center gap-1.5 hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{savingMode === 'save' ? 'Saving...' : 'Save Pitch'}</span>
            </button>

            {/* Option 2: Save & Refine with AI */}
            <button
              type="button"
              disabled={savingMode !== null}
              onClick={() => void savePitchToBackend(true)}
              className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>
                {savingMode === 'refine' ? 'Saving & Opening AI...' : 'Save & Refine with AI'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter & Sort Controls */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setFilterScope('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              filterScope === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            All Pitches ({pitches.length})
          </button>
          {user && (
            <button
              type="button"
              onClick={() => setFilterScope('mine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterScope === 'mine'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              My Pitches ({pitches.filter((p) => p.author_id === user.id).length})
            </button>
          )}

          <div className="h-4 w-[1px] bg-outline-variant mx-1" />

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
            className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs text-on-surface"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs text-on-surface-variant font-semibold">Sort by:</span>
          <button
            type="button"
            onClick={() => setSortBy('score')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
              sortBy === 'score'
                ? 'bg-secondary-fixed text-on-secondary-fixed'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Top Upvoted
          </button>
          <button
            type="button"
            onClick={() => setSortBy('newest')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
              sortBy === 'newest'
                ? 'bg-secondary-fixed text-on-secondary-fixed'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Pitches Feed */}
      {loading ? (
        <div className="grid place-items-center py-16 text-on-surface-variant text-xs">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Loading pitches...</span>
        </div>
      ) : filteredPitches.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant text-center space-y-4">
          <span className="material-symbols-outlined text-[48px] text-outline">lightbulb</span>
          <div>
            <h2 className="text-base font-bold text-on-surface">No pitches yet</h2>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
              Create your first project idea, save it to the database, and use the AI Pitch Refiner to sharpen your proposal.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create First Pitch
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPitches.map((pitch) => {
            const isOwner = Boolean(user && pitch.author_id === user.id);
            const isExpanded = expandedPitchId === pitch.id;

            return (
              <div
                key={pitch.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-sm hover:shadow-md transition-shadow flex gap-4"
              >
                {/* Upvote / Downvote Column (No Comments) */}
                <div className="flex flex-col items-center justify-start pt-1 shrink-0 w-12 bg-surface-container-low rounded-xl py-2 px-1 border border-outline-variant/50 self-start">
                  <button
                    type="button"
                    onClick={() => void handleVote(pitch, 'up')}
                    aria-label="Upvote pitch"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      pitch.my_vote === 'up'
                        ? 'bg-primary text-on-primary font-bold'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                  </button>

                  <span
                    className={`text-sm font-extrabold font-mono my-1 ${
                      pitch.score > 0
                        ? 'text-primary'
                        : pitch.score < 0
                          ? 'text-error'
                          : 'text-on-surface'
                    }`}
                  >
                    {pitch.score}
                  </span>

                  <button
                    type="button"
                    onClick={() => void handleVote(pitch, 'down')}
                    aria-label="Downvote pitch"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      pitch.my_vote === 'down'
                        ? 'bg-error text-white font-bold'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-error'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
                  </button>
                </div>

                {/* Pitch Body */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-fixed text-on-secondary-fixed">
                        {pitch.category}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          pitch.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pitch.status}
                      </span>
                      {isOwner && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary-fixed text-on-primary-fixed">
                          Your Pitch
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-outline">
                      {new Date(pitch.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-on-surface">{pitch.title}</h3>
                    {pitch.description && (
                      <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                        {pitch.description}
                      </p>
                    )}
                  </div>

                  <div
                    className={`text-xs text-on-surface leading-relaxed whitespace-pre-line bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/50 ${
                      isExpanded ? '' : 'line-clamp-3'
                    }`}
                  >
                    {pitch.content}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                      <button
                        type="button"
                        onClick={() => setExpandedPitchId(isExpanded ? null : pitch.id)}
                        className="text-primary font-semibold hover:underline cursor-pointer"
                      >
                        {isExpanded ? 'Show less' : 'Read full pitch'}
                      </button>
                      <span>·</span>
                      <span>
                        ▲ {pitch.upvotes} &nbsp; ▼ {pitch.downvotes}
                      </span>
                    </div>

                    {/* Owner Controls: Refine with AI, Edit, Publish */}
                    {isOwner && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(pitch)}
                          className="px-3 py-1.5 rounded-xl border border-outline-variant text-on-surface text-xs font-semibold flex items-center gap-1 hover:bg-surface-container cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setRefiningPitch({ id: pitch.id, title: pitch.title })
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-bold flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            auto_awesome
                          </span>
                          <span>Refine with AI</span>
                        </button>

                        {pitch.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => void handlePublish(pitch)}
                            className="px-3.5 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-green-700 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">publish</span>
                            <span>Publish</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded AI Pitch Refiner Modal */}
      {refiningPitch && (
        <RefineProjectModal
          isOpen={true}
          onClose={() => {
            setRefiningPitch(null);
            void loadPitches();
          }}
          pitchId={refiningPitch.id}
          projectTitle={refiningPitch.title}
          currentUserId={user?.id}
          onPitchUpdated={() => {
            void loadPitches();
          }}
        />
      )}
    </div>
  );
};

