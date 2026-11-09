import React from 'react';

interface EmptyStateProps {
  onSelectPrompt: (promptText: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  const suggestions = [
    {
      circle: 'Circle 00 • Libft',
      circleClass: 'text-primary',
      hoverIcon: 'group-hover:text-primary',
      title: 'Libft Function Requirements',
      subtitle: 'Mandatory libc re-implementations, memory utilities, and file descriptor helpers.',
      prompt: 'How many functions should I make in libft and what are the mandatory libc functions?',
    },
    {
      circle: 'Circle 01 • Get Next Line',
      circleClass: 'text-secondary',
      hoverIcon: 'group-hover:text-secondary',
      title: 'GNL Static Variable & Buffer Rules',
      subtitle: 'BUFFER_SIZE handling, single static variable constraint, and newline delimiter logic.',
      prompt: 'What are the rules and constraints for static variables and BUFFER_SIZE in get_next_line?',
    },
    {
      circle: 'Circle 03 • Minishell',
      circleClass: 'text-tertiary',
      hoverIcon: 'group-hover:text-tertiary',
      title: 'Minishell Signals & Built-ins',
      subtitle: 'Signal handling (SIGINT, SIGQUIT, EOF), redirection pipelines, and mandatory built-ins.',
      prompt: 'What built-in commands and signal handling requirements are mandatory in Minishell?',
    },
    {
      circle: 'Evaluation Guide • 1337 Common Core',
      circleClass: 'text-primary-container',
      hoverIcon: 'group-hover:text-primary-container',
      title: 'Common Defense Traps',
      subtitle: 'Memory leaks, Norminette strict rules, forbidden functions, and Makefile relinking flags.',
      prompt: 'What are the common evaluation traps that cause immediate 0 in 42 peer defenses?',
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-space-xl">
      <div className="w-16 h-16 rounded-DEFAULT bg-primary-fixed flex items-center justify-center text-primary mb-space-md shadow-sm">
        <span className="material-symbols-outlined text-[34px]">auto_awesome</span>
      </div>

      <div className="text-center max-w-lg mb-space-xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-space-xs font-bold tracking-tight">
          Nexus Campus Co-Pilot
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Zero-hallucination peer engineering assistant. Grounded in 42 Common Core curriculums, evaluation checklists, Docker virtualization rules, and campus clusters.
        </p>
      </div>

      {/* Suggestion Cards Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-space-sm mb-space-xl">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="text-left p-space-md rounded-DEFAULT bg-surface-container-lowest hover:bg-surface-container-low shadow-sm transition-all group flex flex-col justify-between border border-transparent hover:border-surface-container-high cursor-pointer"
          >
            <div className="flex items-center justify-between mb-space-xs">
              <span className={`font-label-code-tag text-label-code-tag font-bold ${item.circleClass}`}>
                {item.circle}
              </span>
              <span className={`material-symbols-outlined text-[18px] text-outline ${item.hoverIcon} group-hover:translate-x-0.5 transition-all`}>
                arrow_forward
              </span>
            </div>
            <div className="font-label-md text-label-md text-on-surface group-hover:text-primary font-semibold">
              {item.title}
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {item.subtitle}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-space-sm text-outline font-label-code-tag text-label-code-tag text-center">
        <span className="material-symbols-outlined text-[16px]">verified_user</span>
        <span>Indexed with 42 Network Curriculum v4.2 & Peer Checklists (Synced Benguerir & Khouribga)</span>
      </div>
    </div>
  );
};
