import React, { useState, useRef } from 'react';
import { streamCopilotAnswer } from '@/lib/sse-client';
import { ChatMessage, CopilotStatus } from './types';
import { EmptyState } from './EmptyState';
import { ThreadView } from './ThreadView';
import { Composer } from './Composer';

export const CopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [status, setStatus] = useState<CopilotStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIndexRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const question = (textToSend || input).trim();
    if (!question || status === 'sending' || status === 'streaming') {
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp,
      status: 'completed',
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp,
      status: 'retrieving',
      citations: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStatus('retrieving');
    setErrorMessage('');

    const assistantIndex = messages.length + 1;
    currentAssistantIndexRef.current = assistantIndex;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamCopilotAnswer({
        body: {
          question,
          k: 8,
        },
        signal: controller.signal,
        callbacks: {
          onMeta: (meta) => {
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              const target = updated[idx];
              if (target && target.role === 'assistant') {
                updated[idx] = {
                  ...target,
                  citations: meta.citations,
                  id: meta.message_id || target.id,
                };
              }
              return updated;
            });
          },
          onDelta: (delta) => {
            setStatus('streaming');
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              const target = updated[idx];
              if (target && target.role === 'assistant') {
                updated[idx] = {
                  ...target,
                  content: target.content + delta.content,
                  status: 'streaming',
                };
              }
              return updated;
            });
          },
          onDone: (done) => {
            setStatus('completed');
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              const target = updated[idx];
              if (target && target.role === 'assistant') {
                updated[idx] = {
                  ...target,
                  status: 'completed',
                  tokens: done.tokens,
                };
              }
              return updated;
            });
            showToast(`Response completed (${done.tokens} tokens)`);
          },
          onError: (err) => {
            setStatus('error');
            setErrorMessage(err.message);
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              const target = updated[idx];
              if (target && target.role === 'assistant') {
                updated[idx] = {
                  ...target,
                  status: 'error',
                };
              }
              return updated;
            });
          },
          onAbort: () => {
            setStatus('completed');
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              const target = updated[idx];
              if (target && target.role === 'assistant') {
                updated[idx] = {
                  ...target,
                  status: 'completed',
                };
              }
              return updated;
            });
            showToast('Generation stopped');
          },
        },
      });
    } catch {
      // Error handled by onError callback
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove trailing failed assistant message
      setMessages((prev) => prev.slice(0, prev.length - 1));
      handleSendPrompt(lastUserMsg.content);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="w-full flex justify-center transition-all duration-300">
      <div className="w-full max-w-3xl flex flex-col min-h-[calc(100vh-13rem)] transition-all duration-300">
        {isEmpty ? (
          <EmptyState onSelectPrompt={(prompt) => {
            setInput(prompt);
            handleSendPrompt(prompt);
          }} />
        ) : (
          <ThreadView
            messages={messages}
            currentStatus={status}
            errorMessage={errorMessage}
            onRetry={handleRetry}
          />
        )}

        <Composer
          status={status}
          input={input}
          onChangeInput={setInput}
          onSend={() => handleSendPrompt()}
          onStop={handleStop}
          onAttachClick={() => showToast('File attachments available in next sprint')}
        />

        {/* Toast Notification Pill */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-space-md py-space-xs rounded-full font-label-sm text-label-sm shadow-xl flex items-center gap-space-xs transition-opacity duration-300 z-50">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">info</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
