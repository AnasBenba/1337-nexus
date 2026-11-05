import React from 'react';

interface StreamingIndicatorProps {
  status: 'sending' | 'retrieving';
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({ status }) => {
  if (status === 'sending') {
    return (
      <div className="py-space-md">
        <div className="flex items-center gap-space-sm text-on-surface-variant font-label-md text-label-md">
          <span className="material-symbols-outlined text-primary text-[20px] animate-spin">progress_activity</span>
          <span>Submitting prompt to campus gateway node...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-space-xs">
      <div className="bg-surface-container-low p-space-md rounded-DEFAULT shadow-sm mb-space-md border border-surface-container-high/60">
        <div className="flex items-center justify-between mb-space-xs">
          <div className="flex items-center gap-space-xs font-label-code-tag text-label-code-tag text-primary font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container animate-ping" />
            <span>Retrieval-Augmented Campus Search</span>
          </div>
          <span className="font-label-code-tag text-[11px] text-outline font-mono">
            3 sources identified
          </span>
        </div>
        <div className="space-y-space-xs mt-space-sm">
          <div className="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">database</span>
            <span>
              Querying vector index <code className="font-mono bg-surface-container-highest px-1 rounded text-[11px]">campus_curriculum_common_core</code>
            </span>
          </div>
          <div className="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">fact_check</span>
            <span>Parsing curriculum documents & peer evaluation checklists...</span>
          </div>
          <div className="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">shield</span>
            <span>Validating compliance against 1337 cluster strict submission policies...</span>
          </div>
        </div>
        {/* Animated Skeleton Loading Shimmer */}
        <div className="mt-space-md space-y-2">
          <div className="h-3 w-4/5 rounded bg-surface-container-high animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-surface-container-high animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-surface-container-high animate-pulse" />
        </div>
      </div>
    </div>
  );
};
