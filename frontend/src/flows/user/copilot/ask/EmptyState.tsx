import React from 'react';

interface EmptyStateProps {
  onSelectPrompt?: (promptText: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = () => {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-space-xl text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-space-md shadow-sm">
        <span className="material-symbols-outlined text-[34px]">auto_awesome</span>
      </div>

      <div className="max-w-md mb-space-lg">
        <h1 className="font-headline-lg text-2xl font-bold text-on-surface mb-2 tracking-tight">
          Nexus Campus Co-Pilot
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
          Zero-hallucination peer engineering assistant. Grounded in 42 Common Core curriculums, evaluation checklists, Docker virtualization rules, and campus clusters.
        </p>
      </div>

      <div className="flex items-center gap-2 text-outline font-label-code-tag text-xs">
        <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
        <span>Indexed with 42 Network Curriculum &amp; Peer Checklists</span>
      </div>
    </div>
  );
};
