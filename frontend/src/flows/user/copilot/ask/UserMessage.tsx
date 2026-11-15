import React from 'react';

interface UserMessageProps {
  content: string;
  timestamp?: string;
  userName?: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  content,
  timestamp = '',
  userName,
}) => {
  return (
    <div className="flex justify-end w-full mb-space-lg">
      <div className="flex flex-col items-end max-w-[75%] md:max-w-[65%]">
        <div className="bg-surface-container-highest text-on-surface px-space-md py-space-sm rounded-t-xl rounded-bl-xl rounded-br-[2px] shadow-xs">
          <p className="font-body-md text-body-md whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
        <div className="flex items-center gap-space-xs mt-1 text-outline font-label-code-tag text-[11px]">
          {userName && (
            <>
              <span>{userName}</span>
              <span>•</span>
            </>
          )}
          <span>{timestamp}</span>
          <span className="material-symbols-outlined text-[14px] text-primary">done_all</span>
        </div>
      </div>
    </div>
  );
};
