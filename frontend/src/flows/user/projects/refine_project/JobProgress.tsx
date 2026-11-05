import React from 'react';

interface JobProgressProps {
  jobId?: string;
  step?: 1 | 2 | 3;
  onClose?: () => void;
}

export const JobProgress: React.FC<JobProgressProps> = ({
  jobId = 'critique-task',
  step = 2,
  onClose,
}) => {
  return (
    <section id="state-view-C" className="space-y-6" aria-live="polite">
      <div className="text-center py-4">
        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">
          Critique in progress
        </h3>
        <p className="text-xs text-slate-500 font-mono">Job ID: #{jobId.slice(0, 16)}</p>
      </div>

      {/* 3-step progress tracker */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="space-y-6">
          {/* Step 1: Queued */}
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-base">check</span>
            </div>
            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">1. Queued</span>
                <span className="text-xs text-emerald-700 font-mono">Finished</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pitch ingested into critique pipeline.
              </p>
            </div>
          </div>

          {/* Connector Line */}
          <div
            className={`w-0.5 h-6 ml-4 -my-3 transition-colors ${
              step >= 2 ? 'bg-emerald-300' : 'bg-slate-200'
            }`}
          />

          {/* Step 2: Analyzing pitch */}
          <div className="flex items-start gap-4">
            {step === 2 ? (
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0 ring-4 ring-brand/20 animate-pulse">
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              </div>
            ) : step > 2 ? (
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-base">check</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-base">search</span>
              </div>
            )}
            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-semibold ${
                    step === 2 ? 'text-brand' : step > 2 ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  2. Analyzing your pitch
                </span>
                <span
                  className={`text-xs font-mono font-medium ${
                    step === 2 ? 'text-brand' : 'text-slate-400'
                  }`}
                >
                  {step === 2 ? 'In progress...' : step > 2 ? 'Finished' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Evaluating problem framing, clarity, and target metrics against rubric.
              </p>
            </div>
          </div>

          {/* Connector Line */}
          <div
            className={`w-0.5 h-6 ml-4 -my-3 transition-colors ${
              step >= 3 ? 'bg-emerald-300' : 'bg-slate-200'
            }`}
          />

          {/* Step 3: Writing feedback */}
          <div
            className={`flex items-start gap-4 ${
              step < 3 ? 'opacity-50' : 'opacity-100'
            }`}
          >
            {step === 3 ? (
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0 ring-4 ring-brand/20 animate-pulse">
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-base">edit_note</span>
              </div>
            )}
            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-semibold ${
                    step === 3 ? 'text-brand' : 'text-slate-600'
                  }`}
                >
                  3. Writing feedback
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {step === 3 ? 'In progress...' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Synthesizing constructive suggestions and diff comparisons.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Non-blocking background reminder banner */}
      <div className="p-3.5 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center gap-3">
        <span className="material-symbols-outlined text-slate-400 text-lg">info</span>
        <span>You can close this window, your critique will be waiting.</span>
      </div>

      {onClose && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      )}
    </section>
  );
};
