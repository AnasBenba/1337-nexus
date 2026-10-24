import React, { useState } from 'react';
import { Citation } from '@/lib/sse-client';
import { getIntraProjectUrl } from './intra-url';

export { getIntraProjectUrl };

interface CitationCardProps {
  citations: Citation[];
  openCardIds: number[];
  onToggleCard?: (index: number) => void;
  onToggleAll: () => void;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  citations,
  openCardIds,
  onToggleCard,
  onToggleAll,
}) => {
  const [expandedSnippets, setExpandedSnippets] = useState<Record<number, boolean>>({});

  if (!citations || citations.length === 0) {
    return null;
  }

  const toggleSnippet = (idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedSnippets((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const allCollapsed = openCardIds.length === 0;

  return (
    <div className="mt-space-lg flex flex-col gap-space-sm transition-all duration-300">
      <div className="flex items-center justify-between px-space-xs text-outline font-label-code-tag text-[11px]">
        <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-on-surface-variant font-mono">
          <span className="material-symbols-outlined text-[15px] text-primary">menu_book</span>
          Grounded Citations ({citations.length} verified sources)
        </span>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
        >
          <span>{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
          <span className="material-symbols-outlined text-[14px]">
            {allCollapsed ? 'unfold_more' : 'unfold_less'}
          </span>
        </button>
      </div>

      {citations.map((c, i) => {
        const citationNumber = i + 1;
        const isOpen = openCardIds.includes(citationNumber);
        const matchPercentage = Math.max(0, Math.min(100, Math.round((1 - c.distance) * 100)));
        const isSnippetExpanded = !!expandedSnippets[i];

        if (!isOpen) {
          return null;
        }

        // Color theme rotation
        const colorClass = i % 3 === 0 
          ? { bg: 'bg-primary', text: 'text-primary', badge: 'bg-primary text-on-primary', light: 'bg-primary/10' }
          : i % 3 === 1
          ? { bg: 'bg-secondary', text: 'text-secondary', badge: 'bg-secondary text-on-secondary', light: 'bg-secondary/10' }
          : { bg: 'bg-tertiary', text: 'text-tertiary', badge: 'bg-tertiary text-on-tertiary', light: 'bg-tertiary/10' };

        const defaultSnippet = c.snippet || 
          `Curriculum excerpt #${c.ordinal} for ${c.subject_slug}. Verified by 1337 Intra curriculum embeddings.`;

        const projectUrl = getIntraProjectUrl(c.subject_slug);

        return (
          <div
            key={c.chunk_id || i}
            onClick={() => onToggleCard?.(citationNumber)}
            className="p-space-md rounded-DEFAULT bg-surface-container-lowest border border-surface-container-high shadow-sm transition-all duration-200 cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm mb-space-xs">
              <div className="flex items-start gap-space-xs">
                <span className={`w-7 h-7 rounded-full ${colorClass.badge} flex items-center justify-center font-mono font-bold text-[12px] shrink-0 mt-0.5`}>
                  {citationNumber}
                </span>
                <div>
                  <div className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5 flex-wrap">
                    <a
                      href={projectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary hover:underline transition-colors flex items-center gap-1"
                      title={`Open official 42 intra project for ${c.subject_slug}`}
                    >
                      <span>{c.subject_slug} — Excerpt #{c.ordinal}</span>
                      <span className="material-symbols-outlined text-[13px] opacity-70">open_in_new</span>
                    </a>
                    <span className={`font-label-code-tag text-[10px] uppercase px-1.5 py-0.5 rounded ${colorClass.badge} font-mono`}>
                      Official Curriculum
                    </span>
                  </div>
                  <div className="font-label-code-tag text-[11px] text-on-surface-variant font-mono mt-0.5">
                    Subject: {c.subject_slug} • Chunk Ordinal #{c.ordinal}
                  </div>
                </div>
              </div>

              {/* Relevance Metric Indicator */}
              <div className="flex items-center gap-space-xs self-start sm:self-center bg-surface-container-low px-space-sm py-1 rounded-full shrink-0">
                <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden flex">
                  <div
                    className="bg-primary-container h-full rounded-full transition-all duration-500"
                    style={{ width: `${matchPercentage}%` }}
                  />
                </div>
                <span className={`font-label-code-tag text-[11px] font-bold ${colorClass.text} font-mono`}>
                  {matchPercentage}% match
                </span>
              </div>
            </div>

            {/* Truncated / Expanded Snippet */}
            <div className="p-space-sm rounded bg-surface-container-low/50 my-space-xs text-on-surface font-mono text-[12px] leading-relaxed relative border border-surface-container-high/40">
              <p className={`citation-snippet ${isSnippetExpanded ? '' : 'line-clamp-3'}`}>
                {defaultSnippet}
              </p>
              <button
                type="button"
                onClick={(e) => toggleSnippet(i, e)}
                className="mt-1 text-primary hover:underline font-label-code-tag text-[11px] font-semibold flex items-center gap-0.5 focus:outline-none cursor-pointer"
              >
                <span>{isSnippetExpanded ? 'Show less' : 'Show more'}</span>
                <span className="material-symbols-outlined text-[14px]">
                  {isSnippetExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-space-xs text-outline font-label-code-tag text-[11px]">
              <div className={`flex items-center gap-1 ${colorClass.text} font-semibold`}>
                <span className="material-symbols-outlined text-[15px]">verified</span>
                <span>Cosine distance {c.distance.toFixed(4)} • Strict syllabus rule</span>
              </div>
              <a
                href={projectUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-bold flex items-center gap-0.5 group"
              >
                <span>Open in 1337 Intra</span>
                <span className="material-symbols-outlined text-[13px] group-hover:translate-x-0.5 transition-transform">open_in_new</span>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};
