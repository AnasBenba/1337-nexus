import React, { useRef, useEffect } from 'react';
import { ChatMessage, CopilotStatus } from './types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

interface ThreadViewProps {
  messages: ChatMessage[];
  currentStatus: CopilotStatus;
  errorMessage?: string;
  onRetry?: () => void;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  messages,
  currentStatus,
  errorMessage,
  onRetry,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStatus]);

  return (
    <div className="flex-1 flex flex-col gap-space-lg pb-space-2xl">
      {messages.map((msg, index) => {
        if (msg.role === 'user') {
          return (
            <UserMessage
              key={msg.id || index}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          );
        }

        return (
          <AssistantMessage
            key={msg.id || index}
            content={msg.content}
            status={msg.status || currentStatus}
            citations={msg.citations || []}
            errorMessage={errorMessage}
            onRetry={onRetry}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
