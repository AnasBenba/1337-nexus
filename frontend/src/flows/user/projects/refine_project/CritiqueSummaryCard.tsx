import React from 'react';

interface CritiqueSummaryCardProps {
  summary: string;
}

export const CritiqueSummaryCard: React.FC<CritiqueSummaryCardProps> = ({ summary }) => {
  return (
    <div
      id="CritiqueSummary"
      className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-brand text-lg">fact_check</span>
        <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">
          Executive Assessment
        </h3>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed font-sans">
        {summary}
      </p>
    </div>
  );
};
