import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isUserBubble?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isUserBubble = false,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const segments = content.split(/(```[\s\S]*?```)/g);

  const renderInline = (line: string) => {
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className={`px-1.5 py-0.5 rounded text-[13px] font-mono ${
              isUserBubble
                ? 'bg-black/20 text-current'
                : 'bg-[var(--bg-page)] kavach-accent-text border kavach-divider'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const lines = segment.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim() || '';
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={index}
              className="rounded-xl overflow-hidden border kavach-divider bg-[var(--secondary-solid)] text-[var(--secondary-text)] my-2.5"
            >
              <div className="flex items-center justify-between px-3.5 py-2 border-b kavach-divider text-xs font-mono">
                <span className="uppercase tracking-wider opacity-75">{lang}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeBody, index)}
                  className="flex items-center gap-1.5 opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = segment
          .split('\n\n')
          .map((p) => p.trim())
          .filter(Boolean);

        return (
          <React.Fragment key={index}>
            {paragraphs.map((para, pIdx) => {
              const lines = para.split('\n');
              const isBulletList = lines.every(
                (l) => l.trim().startsWith('- ') || l.trim().startsWith('* ')
              );
              const isBlockquote = lines.every((l) => l.trim().startsWith('>'));

              if (isBulletList) {
                return (
                  <ul key={pIdx} className="list-disc pl-5 space-y-1">
                    {lines.map((item, lIdx) => (
                      <li key={lIdx}>{renderInline(item.replace(/^[-*]\s+/, ''))}</li>
                    ))}
                  </ul>
                );
              }

              if (isBlockquote) {
                return (
                  <blockquote
                    key={pIdx}
                    className="pl-3.5 py-1 border-l-2 border-[var(--accent-primary)] italic opacity-90 space-y-1"
                  >
                    {lines.map((item, lIdx) => (
                      <p key={lIdx}>{renderInline(item.replace(/^>\s?/, ''))}</p>
                    ))}
                  </blockquote>
                );
              }

              return (
                <p key={pIdx} className="whitespace-pre-line">
                  {renderInline(para)}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
