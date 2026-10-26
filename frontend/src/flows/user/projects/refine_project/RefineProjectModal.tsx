import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  applySuggestion,
  dismissSuggestion,
  getRefineStatus,
  requestRefine,
} from './api';
import { CritiqueErrorState } from './CritiqueErrorState';
import { CritiqueSummaryCard } from './CritiqueSummaryCard';
import { EmptyCritiqueState } from './EmptyCritiqueState';
import { JobProgress } from './JobProgress';
import { StrengthsList } from './StrengthsList';
import { SuggestionCard } from './SuggestionCard';
import {
  CritiqueSummary,
  ModalState,
  Suggestion,
} from './types';

export interface RefineProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  pitchId: string;
  projectTitle?: string;
  currentUserId?: string | number;
  initialState?: ModalState;
  onPitchUpdated?: (newVersionToken: string) => void;
}

export const RefineProjectModal: React.FC<RefineProjectModalProps> = ({
  isOpen,
  onClose,
  pitchId,
  projectTitle = 'Project Pitch',
  currentUserId,
  initialState,
  onPitchUpdated,
}) => {
  const [modalState, setModalState] = useState<ModalState>(initialState || 'A');
  const [jobId, setJobId] = useState<string | null>(null);
  const [versionToken, setVersionToken] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [summary, setSummary] = useState<CritiqueSummary | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [conflictErrors, setConflictErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const titleId = useId();

  // Clean polling timer
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Poll critique status until finished
  const startPolling = useCallback(
    (targetPitchId: string) => {
      stopPolling();

      const poll = async () => {
        try {
          const data = await getRefineStatus(targetPitchId, currentUserId);
          setJobId(data.job_id);

          if (data.status === 'succeeded') {
            stopPolling();
            setSummary(data.summary || null);
            setSuggestions(data.suggestions || []);
            setVersionToken(data.version_token || null);
            setIsStale(data.is_stale);

            if (!data.suggestions || data.suggestions.length === 0) {
              setModalState('J'); // Empty results
            } else if (data.is_stale) {
              setModalState('G'); // Stale
            } else {
              setModalState('D'); // Results
            }
          } else if (data.status === 'failed') {
            stopPolling();
            setGeneralError(data.error_message || 'Critique execution failed');
            setModalState('I'); // Error
          } else {
            // Still pending/running
            setModalState('C');
          }
        } catch (err: any) {
          // If 404, prompt to start
          if (err?.status === 404) {
            stopPolling();
            setModalState('A');
          }
        }
      };

      // Execute immediately and then on interval
      poll();
      pollTimerRef.current = window.setInterval(poll, 1500);
    },
    [currentUserId, stopPolling]
  );

  // Initialize status on modal open
  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      return;
    }

    if (initialState) {
      setModalState(initialState);
      return;
    }

    // Check existing status
    let isCancelled = false;
    getRefineStatus(pitchId, currentUserId)
      .then((data) => {
        if (isCancelled) return;
        setJobId(data.job_id);
        if (data.status === 'pending' || data.status === 'queued' || data.status === 'running') {
          setModalState('C');
          startPolling(pitchId);
        } else if (data.status === 'succeeded') {
          setSummary(data.summary || null);
          setSuggestions(data.suggestions || []);
          setVersionToken(data.version_token || null);
          setIsStale(data.is_stale);
          if (!data.suggestions || data.suggestions.length === 0) {
            setModalState('J');
          } else if (data.is_stale) {
            setModalState('G');
          } else {
            setModalState('D');
          }
        } else if (data.status === 'failed') {
          setGeneralError(data.error_message || 'Critique generation failed');
          setModalState('I');
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setModalState('A');
        }
      });

    return () => {
      isCancelled = true;
      stopPolling();
    };
  }, [isOpen, pitchId, currentUserId, initialState, startPolling, stopPolling]);

  // Keyboard accessibility: Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState !== 'B' && !applyingSuggestionId) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, modalState, applyingSuggestionId, onClose]);

  // Focus trap on modal open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // Request critique handler (State A -> B -> C)
  const handleRequestCritique = async () => {
    try {
      setModalState('B');
      const res = await requestRefine(pitchId, currentUserId);
      setJobId(res.job_id);
      setModalState('C');
      startPolling(pitchId);
    } catch (err: any) {
      setGeneralError(err?.detail || err?.message || 'Failed to submit critique request');
      setModalState('I');
    }
  };

  // Apply suggestion handler (Version-guarded with conflict detection)
  const handleApplySuggestion = async (suggestion: Suggestion) => {
    if (!versionToken) {
      setGeneralError('Missing version token. Please refresh critique.');
      return;
    }

    setApplyingSuggestionId(suggestion.id);
    try {
      const res = await applySuggestion(
        pitchId,
        suggestion.id,
        versionToken,
        currentUserId
      );

      // Advance version token
      setVersionToken(res.new_version_token);

      // Update suggestion status in local list
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestion.id
            ? { ...s, status: 'applied', applied_at: new Date().toISOString() }
            : s
        )
      );

      // Clear any previous conflict for this suggestion
      setConflictErrors((prev) => {
        const next = { ...prev };
        delete next[suggestion.id];
        return next;
      });

      // Notify parent/dashboard
      onPitchUpdated?.(res.new_version_token);
    } catch (err: any) {
      if (err?.isConflict || err?.status === 409) {
        // State H: Inline conflict error under this card
        setConflictErrors((prev) => ({
          ...prev,
          [suggestion.id]:
            err.detail || 'This text no longer matches your pitch. Run a new critique.',
        }));
      } else {
        setGeneralError(err?.detail || 'Failed to apply suggestion');
      }
    } finally {
      setApplyingSuggestionId(null);
    }
  };

  // Dismiss suggestion handler
  const handleDismissSuggestion = async (suggestion: Suggestion) => {
    try {
      await dismissSuggestion(pitchId, suggestion.id, currentUserId);
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'dismissed' } : s))
      );
    } catch (err: any) {
      // Local optimistic hide
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'dismissed' } : s))
      );
    }
  };

  if (!isOpen) return null;

  const appliedCount = suggestions.filter((s) => s.status === 'applied').length;
  const remainingCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          modalState !== 'B' &&
          !applyingSuggestionId
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-surface rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden focus:outline-none animate-scale-up"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
            </div>
            <div>
              <h2
                id={titleId}
                className="font-display font-bold text-slate-900 text-sm md:text-base leading-tight"
              >
                Pitch Refiner AI Critique
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                {projectTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stale Warning Badge in Header if pitch modified */}
            {isStale && modalState === 'D' && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                Stale
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={modalState === 'B' || !!applyingSuggestionId}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Close critique modal"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STATE A: START */}
          {modalState === 'A' && (
            <section id="state-view-A" className="space-y-6">
              <div className="text-center py-6 px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl">rate_review</span>
                </div>
                <div className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-mono font-medium mb-3">
                  Project: {projectTitle}
                </div>
                <h3 className="font-display font-bold text-xl text-slate-900 mb-2">
                  Request AI Peer Critique
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We&apos;ll review your pitch and suggest improvements. This runs in
                  the background; you can close this window.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs text-slate-600 shadow-sm">
                <div className="font-semibold text-slate-800 text-sm">
                  What gets analyzed:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">
                      check_circle
                    </span>
                    <span>Problem statement precision</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">
                      check_circle
                    </span>
                    <span>Quantifiable impact &amp; metrics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">
                      check_circle
                    </span>
                    <span>Target user specificity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">
                      check_circle
                    </span>
                    <span>Team role clarity &amp; feasibility</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestCritique}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg shadow-sm shadow-brand/30 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>Request critique</span>
                </button>
              </div>
            </section>
          )}

          {/* STATE B: SUBMITTING */}
          {modalState === 'B' && (
            <section id="state-view-B" className="space-y-6">
              <div className="text-center py-6 px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl animate-spin">
                    progress_activity
                  </span>
                </div>
                <div className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-mono font-medium mb-3">
                  Project: {projectTitle}
                </div>
                <h3 className="font-display font-bold text-xl text-slate-900 mb-2">
                  Submitting your pitch...
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We&apos;ll review your pitch and suggest improvements. This runs in
                  the background; you can close this window.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  disabled
                  className="px-4 py-2.5 text-sm font-medium text-slate-400 bg-transparent rounded-lg cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  disabled
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-brand/70 rounded-lg cursor-not-allowed flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm animate-spin">
                    progress_activity
                  </span>
                  <span>Submitting...</span>
                </button>
              </div>
            </section>
          )}

          {/* STATE C: QUEUED / PROCESSING */}
          {modalState === 'C' && (
            <JobProgress
              jobId={jobId || 'critique-task'}
              step={2}
              onClose={onClose}
            />
          )}

          {/* STATE G: STALE BANNER (Overlayed on top of Results) */}
          {(modalState === 'G' || (modalState === 'D' && isStale)) && (
            <section id="state-view-G" className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-xl flex-shrink-0 mt-0.5">
                    warning
                  </span>
                  <div>
                    <h5 className="text-xs font-bold font-display uppercase tracking-wide text-amber-800">
                      Critique Stale
                    </h5>
                    <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                      Your pitch changed after this critique was generated.
                      Suggestions can no longer be applied.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRequestCritique}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>Run new critique</span>
                </button>
              </div>
            </section>
          )}

          {/* STATE D: RESULTS (Summary, Strengths, SuggestionCards) */}
          {(modalState === 'D' || modalState === 'G') && (
            <section id="state-view-D" className="space-y-5">
              {summary?.executive_assessment && (
                <CritiqueSummaryCard summary={summary.executive_assessment} />
              )}

              {summary?.strengths && summary.strengths.length > 0 && (
                <StrengthsList strengths={summary.strengths} />
              )}

              {/* Suggestions Group Heading */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                    Structured Suggestions ({suggestions.length} items)
                  </h4>
                  <span
                    id="suggestions-status-pill"
                    className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200"
                  >
                    {appliedCount} applied · {remainingCount} remaining
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Independent apply actions
                </span>
              </div>

              {/* Suggestions Cards List */}
              <div className="space-y-3">
                {suggestions.map((sug) => (
                  <SuggestionCard
                    key={sug.id}
                    suggestion={sug}
                    isApplying={applyingSuggestionId === sug.id}
                    isStale={isStale}
                    conflictError={conflictErrors[sug.id] || null}
                    onApply={handleApplySuggestion}
                    onDismiss={handleDismissSuggestion}
                    onRunNewCritique={handleRequestCritique}
                  />
                ))}
              </div>
            </section>
          )}

          {/* STATE I: FAILED */}
          {modalState === 'I' && (
            <CritiqueErrorState
              errorMessage={generalError}
              onRetry={handleRequestCritique}
              onClose={onClose}
            />
          )}

          {/* STATE J: EMPTY RESULTS */}
          {modalState === 'J' && (
            <EmptyCritiqueState
              strengths={summary?.strengths || []}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};
