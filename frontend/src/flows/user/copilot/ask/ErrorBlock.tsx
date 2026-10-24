import React from 'react';

interface ErrorBlockProps {
  partialContent?: string;
  errorMessage?: string;
  onRetry: () => void;
}

export const ErrorBlock: React.FC<ErrorBlockProps> = ({
  partialContent,
  errorMessage,
  onRetry,
}) => {
  return (
    <div className="my-space-md">
      {partialContent && (
        <div className="prose max-w-none text-on-surface font-body-md text-body-md opacity-80 mb-space-md">
          <p>{partialContent}</p>
        </div>
      )}

      <div className="bg-error-container text-on-error-container p-space-md rounded-DEFAULT shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm border border-error/20">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[24px] text-error">wifi_off</span>
          <div>
            <div className="font-label-md text-label-md font-bold">Campus Gateway Stream Interrupted</div>
            <div className="font-body-sm text-body-sm text-on-error-container/80">
              {errorMessage || 'Connection to 1337 cluster node timed out. Your partial transcript was preserved.'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-xs shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="px-space-md py-1.5 rounded-full bg-error text-on-error font-label-md text-label-md font-bold flex items-center gap-1 hover:opacity-90 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Retry Stream</span>
          </button>
        </div>
      </div>
    </div>
  );
};
