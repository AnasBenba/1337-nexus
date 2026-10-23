import React, { useRef, useEffect } from 'react';
import { CopilotStatus } from './types';

interface ComposerProps {
  status: CopilotStatus;
  input: string;
  onChangeInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onAttachClick?: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  status,
  input,
  onChangeInput,
  onSend,
  onStop,
  onAttachClick,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSending = status === 'sending';
  const isStreaming = status === 'streaming';
  const isBusy = isSending || isStreaming;

  // Auto-resize textarea based on input content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isBusy && input.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="sticky bottom-4 z-20 w-full mt-auto">
      <div className="bg-surface-container-lowest rounded-2xl shadow-lg p-space-sm flex flex-col gap-space-xs transition-all border border-surface-container-high/60">
        {/* Context Attachment Pill Bar */}
        <div className="flex items-center justify-between px-space-xs pt-1">
          <div className="flex items-center gap-space-xs overflow-x-auto">
            {/* Model Switcher Selector */}
            <div className="relative inline-block">
              <button
                type="button"
                className="flex items-center gap-1 px-space-sm py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-code-tag text-[11px] transition-colors"
              >
                <span className="material-symbols-outlined text-[15px] text-primary">psychology</span>
                <span className="font-semibold text-on-surface">Nexus Core v2.4 (RAG)</span>
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
              </button>
            </div>

            {/* Attached Workspace Context Badge */}
            <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-code-tag text-[10px] shrink-0 font-mono">
              <span className="material-symbols-outlined text-[12px]">folder</span> 1337 Curriculum
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-outline font-label-code-tag text-[11px]">
            <span className="bg-surface-container px-1 py-0.5 rounded font-mono">↵ Send</span>
            <span>•</span>
            <span className="bg-surface-container px-1 py-0.5 rounded font-mono">Shift+↵ Newline</span>
          </div>
        </div>

        {/* Multi-line Text Input */}
        <div className="relative flex items-end gap-space-xs px-space-xs">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            rows={2}
            placeholder="Ask Nexus Co-Pilot about 42 intra subjects, evaluation traps, code bugs, or cluster rules..."
            className="w-full bg-transparent resize-none border-0 outline-none font-body-md text-body-md text-on-surface placeholder:text-outline py-space-xs leading-relaxed max-h-36 overflow-y-auto"
          />

          {/* Dynamic Action Button: Send or Stop Generating */}
          <div className="shrink-0 flex items-center gap-1 pb-1">
            <button
              type="button"
              onClick={onAttachClick}
              title="Attach file or code snippet"
              className="w-9 h-9 rounded-full hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="h-10 px-space-md rounded-xl bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-bold flex items-center gap-1.5 shadow-sm transition-all animate-pulse cursor-pointer"
              >
                <span>Stop</span>
                <span className="material-symbols-outlined text-[18px]">stop_circle</span>
              </button>
            ) : isSending ? (
              <button
                type="button"
                disabled
                className="h-10 px-space-md rounded-xl bg-surface-container-high text-outline font-label-md text-label-md font-bold flex items-center gap-1.5 cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                <span>Sending</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim()}
                className={`h-10 px-space-md rounded-xl font-label-md text-label-md font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                  input.trim()
                    ? 'bg-primary hover:bg-primary/90 text-on-primary cursor-pointer'
                    : 'bg-surface-container-high text-outline cursor-not-allowed'
                }`}
              >
                <span>Send</span>
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            )}
          </div>
        </div>

        {/* Disclaimer / Legal Footer */}
        <div className="flex items-center justify-center pt-1 text-center">
          <span className="text-outline font-label-sm text-[11px]">
            Co-Pilot answers are grounded in 42 peer-evaluation guides. Always verify with official intra PDFs before final push.
          </span>
        </div>
      </div>
    </div>
  );
};
