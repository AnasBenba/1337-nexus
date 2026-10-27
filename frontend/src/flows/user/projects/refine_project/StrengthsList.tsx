import React from 'react';

interface StrengthsListProps {
  strengths: string[];
}

export const StrengthsList: React.FC<StrengthsListProps> = ({ strengths }) => {
  if (!strengths || strengths.length === 0) return null;

  return (
    <div
      id="StrengthsList"
      className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-emerald-600 text-sm">verified</span>
          Key Strengths ({strengths.length} Verified)
        </h4>
        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-medium">
          Ready for pitch
        </span>
      </div>

      <ul className="space-y-2 text-xs text-slate-700">
        {strengths.map((strength, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-xs font-bold">check</span>
            </span>
            <span className="leading-relaxed">{strength}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
