import React from 'react';
import { Citation } from '@/lib/sse-client';

interface SourcesRowProps {
  isLoading: boolean;
  citations: Citation[];
  openCardIds: number[];
  onToggleCitation: (citationNumber: number) => void;
}

export const SourcesRow: React.FC<SourcesRowProps> = ({
  isLoading,
  citations,
  openCardIds,
  onToggleCitation,
}) => {
  // 1. Loading skeleton pill state
  if (isLoading) {
    return (
      <div className="mb-space-md">
        <div className="flex items-center gap-space-xs flex-wrap mb-space-xs">
          <div className="inline-flex items-center gap-1.5 px-space-xs py-0.5 rounded-full bg-primary-fixed/60 text-primary font-label-code-tag text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="animate-pulse">Resolving citation vectors...</span>
          </div>
          <div className="h-7 w-32 rounded-full bg-surface-container-high animate-pulse" />
          <div className="h-7 w-44 rounded-full bg-surface-container-high animate-pulse" />
          <div className="h-7 w-28 rounded-full bg-surface-container-high animate-pulse" />
        </div>
        <div className="flex items-center gap-space-sm px-space-sm py-2 rounded-DEFAULT bg-surface-container-low border border-surface-container-high text-on-surface-variant font-label-code-tag text-[11px] mt-space-xs">
          <span className="material-symbols-outlined text-[18px] text-primary animate-spin">sync</span>
          <span className="flex-1">
            Generating grounded paragraph cross-references and similarity scoring against 42 Intra PDFs...
          </span>
          <span className="font-mono text-outline text-[10px]">async vector search</span>
        </div>
      </div>
    );
  }

  // 2. Zero citations found banner
  if (!citations || citations.length === 0) {
    return (
      <div className="p-space-md rounded-DEFAULT bg-surface-container-lowest border border-outline-variant/60 shadow-sm mb-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div className="flex items-start gap-space-sm">
            <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[20px]">search_off</span>
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5 flex-wrap">
                <span>No sources grounded in 42 Intra curriculum or peer checklists</span>
                <span className="font-label-code-tag text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
                  General Query
                </span>
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Direct LLM response without RAG grounding. No specific 42 curriculum chunks matched this query.
              </div>
            </div>
          </div>
          <a
            className="inline-flex items-center gap-1 font-label-code-tag text-[12px] font-bold text-primary hover:underline shrink-0 sm:self-center"
            href="https://intra.42.fr"
            target="_blank"
            rel="noreferrer"
          >
            <span>Search Intra manually</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>
    );
  }

  // 3. Validated sources pill row
  return (
    <div className="flex items-center gap-space-xs flex-wrap mb-space-md">
      <span className="font-label-code-tag text-[11px] text-outline uppercase font-mono mr-1">
        Validated Sources:
      </span>
      {citations.map((c, idx) => {
        const citationNumber = idx + 1;
        const isSelected = openCardIds.includes(citationNumber);

        const colorClasses = idx % 3 === 0
          ? 'text-primary'
          : idx % 3 === 1
          ? 'text-secondary'
          : 'text-tertiary';

        return (
          <button
            key={c.chunk_id || idx}
            type="button"
            onClick={() => onToggleCitation(citationNumber)}
            className={`inline-flex items-center gap-1 px-space-sm py-1 rounded-full font-label-code-tag text-[11px] transition-all cursor-pointer shadow-sm border ${
              isSelected
                ? 'bg-primary-fixed text-on-primary-fixed border-primary font-bold'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest border-transparent'
            }`}
          >
            <span className={`material-symbols-outlined text-[14px] ${colorClasses}`}>
              picture_as_pdf
            </span>
            <span>[{citationNumber}] {c.subject_slug}</span>
            <span className="bg-primary/10 text-primary px-1 rounded font-mono font-bold">
              #{c.ordinal}
            </span>
          </button>
        );
      })}
    </div>
  );
};
