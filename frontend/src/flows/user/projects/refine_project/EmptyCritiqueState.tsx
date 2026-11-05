import React from 'react';
import { StrengthsList } from './StrengthsList';

interface EmptyCritiqueStateProps {
  strengths?: string[];
  onDone?: () => void;
}

export const EmptyCritiqueState: React.FC<EmptyCritiqueStateProps> = ({
  strengths = [],
  onDone,
}) => {
  return (
    <section id="state-view-J" className="space-y-5">
      <div
        id="EmptyResults"
        className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-xl font-bold">celebration</span>
          </div>
          <div>
            <h4 className="font-display font-bold text-slate-900 text-base">
              No major issues found, your pitch looks solid
            </h4>
            <p className="text-xs text-slate-500">
              Your pitch satisfies all core rubrics for Circle 04 capstone evaluation.
            </p>
          </div>
        </div>

        {strengths.length > 0 ? (
          <StrengthsList strengths={strengths} />
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            All evaluated sections (Problem, Scope, Roles, Feasibility) are well articulated.
          </div>
        )}

        {onDone && (
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onDone}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
