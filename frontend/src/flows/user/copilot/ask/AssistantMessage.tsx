import React, { useState } from 'react';
import { Citation } from '@/lib/sse-client';
import { CopilotStatus } from './types';
import { MarkdownBody } from './MarkdownBody';
import { StreamingIndicator } from './StreamingIndicator';
import { SourcesRow } from './SourcesRow';
import { CitationCard } from './CitationCard';
import { ErrorBlock } from './ErrorBlock';

interface AssistantMessageProps {
  content: string;
  status: CopilotStatus;
  citations: Citation[];
  errorMessage?: string;
  onRetry?: () => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content,
  status,
  citations,
  errorMessage,
  onRetry,
}) => {
  const [openCardIds, setOpenCardIds] = useState<number[]>([1]);

  const toggleCitation = (citationNumber: number) => {
    setOpenCardIds((prev) =>
      prev.includes(citationNumber)
        ? prev.filter((id) => id !== citationNumber)
        : [...prev, citationNumber]
    );
  };

  const toggleAllCitations = () => {
    if (openCardIds.length === citations.length) {
      setOpenCardIds([]);
    } else {
      setOpenCardIds(citations.map((_, i) => i + 1));
    }
  };

  const isStreaming = status === 'streaming';
  const isThinking = status === 'sending' || status === 'retrieving';
  const isDone = status === 'completed';
  const isError = status === 'error';

  return (
    <div className="flex gap-space-md w-full items-start mb-space-lg">
      <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center shrink-0 shadow-sm mt-1">
        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Header Info */}
        <div className="flex items-center gap-space-xs mb-space-xs">
          <span className="font-label-md text-label-md text-on-surface font-bold">Nexus Co-Pilot</span>
          <span className="font-label-code-tag text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
            RAG v2.4
          </span>
          <span className="text-outline text-[12px] font-mono">• 42 Curriculum</span>
        </div>

        {/* Sending / Retrieving Spinners */}
        {isThinking && (
          <StreamingIndicator status={status === 'sending' ? 'sending' : 'retrieving'} />
        )}

        {/* Sources Row */}
        {(isStreaming || isDone) && (
          <SourcesRow
            isLoading={isStreaming && citations.length === 0}
            citations={citations}
            openCardIds={openCardIds}
            onToggleCitation={toggleCitation}
          />
        )}

        {/* Content Body */}
        {(content || isStreaming) && (
          <MarkdownBody
            content={content}
            isStreaming={isStreaming}
            onCitationClick={toggleCitation}
          />
        )}

        {/* Citations Accordion */}
        {isDone && citations.length > 0 && (
          <CitationCard
            citations={citations}
            openCardIds={openCardIds}
            onToggleCard={toggleCitation}
            onToggleAll={toggleAllCitations}
          />
        )}

        {/* Error Block */}
        {isError && (
          <ErrorBlock
            partialContent={content}
            errorMessage={errorMessage}
            onRetry={onRetry || (() => {})}
          />
        )}
      </div>
    </div>
  );
};
