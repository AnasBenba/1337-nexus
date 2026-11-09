import React from 'react';

interface CritiqueErrorStateProps {
  errorMessage?: string | null;
  onRetry: () => void;
  onClose?: () => void;
}

export const CritiqueErrorState: React.FC<CritiqueErrorStateProps> = ({
  errorMessage,
  onRetry,
  onClose,
}) => {
  return (
    <section id="state-view-I" className="space-y-5">
      <div
        id="ErrorBlock"
        className="bg-white rounded-xl border border-rose-200 p-6 shadow-sm text-center max-w-md mx-auto space-y-4"
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">cloud_off</span>
        </div>
        <div>
          <h4 className="font-display font-bold text-slate-900 text-base">
            Critique generation failed
          </h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            We couldn&apos;t connect to the campus critique engine to analyze your pitch.
            Your current draft is completely safe.
          </p>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-rose-50 rounded-lg text-[11px] font-mono text-rose-700 text-left overflow-x-auto">
            Error: {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Retry</span>
          </button>
        </div>
      </div>
    </section>
  );
};
