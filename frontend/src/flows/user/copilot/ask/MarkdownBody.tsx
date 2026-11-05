import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getIntraProjectUrl } from './intra-url';

interface MarkdownBodyProps {
  content: string;
  isStreaming?: boolean;
  onCitationClick?: (index: number) => void;
}

export const MarkdownBody: React.FC<MarkdownBodyProps> = ({
  content,
  isStreaming = false,
  onCitationClick,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderWithCitations = (children: React.ReactNode): React.ReactNode => {
    if (!onCitationClick) return children;

    const processText = (text: string): React.ReactNode => {
      const parts = text.split(/(\[\d+\])/g);
      if (parts.length === 1) return text;
      return parts.map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (match) {
          const num = parseInt(match[1], 10);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCitationClick(num)}
              className="inline-flex items-center font-label-code-tag text-[11px] font-bold text-primary bg-primary-fixed/80 hover:bg-primary-fixed hover:underline px-1.5 py-0.5 rounded mx-0.5 align-baseline cursor-pointer transition-all shadow-2xs"
              title={`View grounded citation [${num}]`}
            >
              [{num}]
            </button>
          );
        }
        return part;
      });
    };

    if (typeof children === 'string') {
      return processText(children);
    }

    if (Array.isArray(children)) {
      return React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return processText(child);
        }
        return child;
      });
    }

    return children;
  };

  return (
    <div className="prose max-w-none text-on-surface space-y-space-md font-body-md text-body-md leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mt-space-lg mb-space-sm">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight mt-space-md mb-space-xs">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight mt-space-md mb-space-xs">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-space-sm leading-relaxed">{renderWithCitations(children)}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-space-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-space-sm">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{renderWithCitations(children)}</li>,
          strong: ({ children }) => <strong className="font-bold text-on-surface">{children}</strong>,
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === 'string' && !children.includes('\n');
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code
                  className="font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-[12px] text-on-surface-variant font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Extract file or lang label if present
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';

            return (
              <div className="relative bg-inverse-surface text-inverse-on-surface rounded-DEFAULT p-space-md font-mono text-[13px] overflow-hidden shadow-md my-space-sm">
                <div className="flex items-center justify-between pb-space-xs mb-space-xs text-outline-variant font-label-code-tag text-[11px] border-b border-outline/20">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                    {lang ? `snippet (${lang})` : 'source code'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(codeString)}
                    className="flex items-center gap-1 text-primary-fixed-dim hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedCode === codeString ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedCode === codeString ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="overflow-x-auto text-primary-fixed font-mono p-1">
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-space-md overflow-x-auto rounded-DEFAULT bg-surface-container-lowest shadow-sm border border-surface-container-high">
              <table className="w-full text-left font-body-sm text-body-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-container-low text-on-surface-variant font-label-code-tag text-[11px] uppercase border-b border-surface-container-high">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="p-space-sm font-semibold">{children}</th>,
          tbody: ({ children }) => <tbody className="divide-y divide-surface-container-high/40 text-on-surface">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-surface-container-low/50 transition-colors">{children}</tr>,
          td: ({ children }) => <td className="p-space-sm">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-space-md my-space-sm italic text-on-surface-variant">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            // Check if link is a citation badge like [1]
            const text = String(children);
            const citationMatch = /^\[(\d+)\]$/.exec(text.trim());
            if (citationMatch && onCitationClick) {
              const num = parseInt(citationMatch[1], 10);
              return (
                <button
                  type="button"
                  onClick={() => onCitationClick(num)}
                  className="inline-flex items-center font-label-code-tag text-[11px] font-bold text-primary bg-primary-fixed px-1.5 py-0.2 rounded hover:underline ml-0.5 align-baseline cursor-pointer"
                >
                  {text}
                </button>
              );
            }

            let targetUrl = href || '';
            // Auto-correct any legacy 42 intra project URLs
            const intraMatch = targetUrl.match(/https?:\/\/(?:profile|projects)?\.?intra\.42\.fr\/projects\/([a-zA-Z0-9_-]+)/);
            if (intraMatch && intraMatch[1]) {
              targetUrl = getIntraProjectUrl(intraMatch[1]);
            }

            return (
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Blinking cursor during streaming without layout shift */}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-primary-container text-primary-container animate-pulse align-middle ml-0.5">
          &#x258C;
        </span>
      )}
    </div>
  );
};
