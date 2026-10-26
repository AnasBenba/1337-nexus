import React from 'react';
import { Suggestion } from './types';

interface SuggestionCardProps {
  suggestion: Suggestion;
  isApplying?: boolean;
  isStale?: boolean;
  conflictError?: string | null;
  onApply: (suggestion: Suggestion) => void;
  onDismiss: (suggestion: Suggestion) => void;
  onRunNewCritique?: () => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isApplying = false,
  isStale = false,
  conflictError = null,
  onApply,
  onDismiss,
  onRunNewCritique,
}) => {
  const isApplied = suggestion.status === 'applied';
  const isDismissed = suggestion.status === 'dismissed';

  if (isDismissed) {
    return null;
  }

  // State F: Applied - Collapses to compact row
  if (isApplied) {
    return (
      <div className="SuggestionCard applied-card bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-sm font-bold">check</span>
          </span>
          <div>
            <span className="text-xs font-semibold text-emerald-950 font-display">
              {suggestion.section_label || suggestion.field}: {suggestion.title}
            </span>
            <span className="text-[11px] text-emerald-700 block font-mono">
              Updated in draft pitch
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full text-xs font-medium font-mono">
          <span className="material-symbols-outlined text-sm">done_all</span>
          <span>Applied</span>
        </div>
      </div>
    );
  }

  // Severity badge color styling
  const severityLower = (suggestion.severity || 'medium').toLowerCase();
  let badgeColor = 'bg-slate-100 text-slate-700';
  if (severityLower.includes('high') || severityLower.includes('critical')) {
    badgeColor = 'bg-rose-100 text-rose-800';
  } else if (severityLower.includes('medium') || severityLower.includes('major')) {
    badgeColor = 'bg-amber-100 text-amber-800';
  } else if (severityLower.includes('minor') || severityLower.includes('low')) {
    badgeColor = 'bg-sky-100 text-sky-800';
  }

  // State H: Conflict detected
  if (conflictError) {
    return (
      <div className="SuggestionCard bg-white rounded-xl border border-rose-300 p-5 shadow-sm space-y-3.5 ring-2 ring-rose-100 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            {suggestion.section_label} ({suggestion.severity})
          </span>
          <span className="text-xs font-mono font-semibold text-rose-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span>
            Conflict detected
          </span>
        </div>

        <h5 className="font-display font-bold text-slate-900 text-sm">
          {suggestion.title}
        </h5>

        <div className="p-3 bg-rose-50/40 rounded-lg text-xs text-slate-700 border border-rose-100">
          Target diff: &ldquo;{suggestion.original_excerpt}&rdquo;
        </div>

        {/* Required inline error under card */}
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-rose-600 text-base mt-0.5 flex-shrink-0">
            sync_problem
          </span>
          <div>
            <p className="font-semibold">
              This text no longer matches your pitch. Run a new critique.
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              {conflictError ||
                'The underlying section was modified in another tab or by a teammate.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onDismiss(suggestion)}
            className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            Dismiss
          </button>
          {onRunNewCritique && (
            <button
              type="button"
              onClick={onRunNewCritique}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Run new critique</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // State E: Applying state
  if (isApplying) {
    return (
      <div className="SuggestionCard bg-white rounded-xl border border-brand/40 p-5 shadow-sm space-y-3 ring-2 ring-brand/10 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">
            {suggestion.section_label} ({suggestion.severity})
          </span>
          <span className="text-xs text-brand font-mono animate-pulse">
            Applying update...
          </span>
        </div>

        <h5 className="font-display font-bold text-slate-900 text-sm">
          {suggestion.title}
        </h5>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600">
          Patching diff into section &ldquo;{suggestion.section_label}&rdquo;...
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            disabled
            className="px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
          >
            Dismiss
          </button>
          <button
            disabled
            className="px-4 py-1.5 text-xs font-semibold text-white bg-brand rounded-lg flex items-center gap-2 cursor-wait opacity-90"
          >
            <span className="material-symbols-outlined text-sm animate-spin">
              progress_activity
            </span>
            <span>Applying suggestion...</span>
          </button>
        </div>
      </div>
    );
  }

  // State G: Stale state
  if (isStale) {
    return (
      <div className="SuggestionCard bg-white/80 rounded-xl border border-slate-200 p-5 space-y-3 opacity-75 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {suggestion.section_label} ({suggestion.severity})
          </span>
          <span className="text-xs font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
            Pitch Outdated
          </span>
        </div>

        <h5 className="font-display font-bold text-slate-800 text-sm">
          {suggestion.title}
        </h5>

        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Suggested:</span> &ldquo;
          {suggestion.suggested_text}&rdquo;
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 italic">
            Target pitch was modified. Run a new critique to re-align.
          </span>
          <div className="relative group">
            <button
              disabled
              className="px-4 py-1.5 text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">lock</span>
              <span>Apply suggestion</span>
            </button>
            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[11px] rounded shadow-lg z-20 pointer-events-none">
              Disabled because pitch content was edited after this critique was
              generated. Run a new critique.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State D: Normal interactive card with side-by-side / stacked diff
  return (
    <div className="SuggestionCard bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-3.5 hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {suggestion.section_label || suggestion.field}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {suggestion.severity}
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-600 font-medium">
          Ready to apply
        </span>
      </div>

      <div>
        <h5 className="font-display font-bold text-slate-900 text-sm md:text-base">
          {suggestion.title}
        </h5>
        {suggestion.rationale && (
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {suggestion.rationale}
          </p>
        )}
      </div>

      {/* Diff View Comparison */}
      <div className="space-y-2 text-xs rounded-lg overflow-hidden border border-slate-100">
        {suggestion.original_excerpt && (
          <div className="p-2.5 bg-rose-50/70 text-rose-950 flex items-start gap-2 border-b border-rose-100/50">
            <span className="text-rose-500 font-mono font-bold select-none">-</span>
            <div className="flex-1">
              <span className="text-[10px] uppercase font-mono font-semibold text-rose-700 tracking-wider block mb-0.5">
                Current draft:
              </span>
              <span className="line-through opacity-85 leading-relaxed">
                {suggestion.original_excerpt}
              </span>
            </div>
          </div>
        )}

        <div className="p-2.5 bg-emerald-50/80 text-emerald-950 flex items-start gap-2">
          <span className="text-emerald-600 font-mono font-bold select-none">+</span>
          <div className="flex-1">
            <span className="text-[10px] uppercase font-mono font-semibold text-emerald-700 tracking-wider block mb-0.5">
              Suggested replacement:
            </span>
            <span className="font-medium leading-relaxed">
              {suggestion.suggested_text}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onDismiss(suggestion)}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => onApply(suggestion)}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg flex items-center gap-1.5 shadow-sm shadow-brand/20 transition-all"
        >
          <span className="material-symbols-outlined text-sm">auto_fix_high</span>
          <span>Apply suggestion</span>
        </button>
      </div>
    </div>
  );
};
