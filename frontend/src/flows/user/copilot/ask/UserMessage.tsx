import React from 'react';

interface UserMessageProps {
  content: string;
  timestamp?: string;
  userName?: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  content,
  timestamp = '11:42 AM',
  userName = 'Soufiane El B.',
}) => {
  return (
    <div className="flex justify-end w-full mb-space-lg">
      <div className="flex flex-col items-end max-w-[85%] md:max-w-xl">
        <div className="bg-primary text-on-primary rounded-2xl rounded-tr-sm px-space-lg py-space-md shadow-sm">
          <p className="font-body-md text-body-md leading-relaxed text-on-primary font-medium whitespace-pre-wrap">
            {content}
          </p>
        </div>
        <div className="flex items-center gap-space-xs mt-1 text-outline font-label-code-tag text-[11px]">
          <span>{userName}</span>
          <span>•</span>
          <span>{timestamp}</span>
          <span className="material-symbols-outlined text-[14px] text-primary">done_all</span>
        </div>
      </div>
    </div>
  );
};
