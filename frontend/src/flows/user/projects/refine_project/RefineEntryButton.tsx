import React from 'react';

interface RefineEntryButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const RefineEntryButton: React.FC<RefineEntryButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      id="refine-entry-button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
        disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          : 'bg-brand hover:bg-brand-hover text-white shadow-sm shadow-brand/30'
      } ${className}`}
    >
      <span
        className={`material-symbols-outlined text-base ${
          isLoading ? 'animate-spin' : ''
        }`}
      >
        {isLoading ? 'progress_activity' : 'auto_awesome'}
      </span>
      <span>{isLoading ? 'Analyzing...' : 'Refine with AI'}</span>
    </button>
  );
};
