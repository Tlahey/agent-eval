import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  className?: string;
}

export function Markdown({ content, className = "" }: Props) {
  return (
    <div className={`prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom styling for markdown elements to match the app theme
          h1: ({ children }) => (
            <h1 className="mb-4 text-lg font-bold text-txt-base">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 text-md font-bold text-txt-base border-b border pb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-sm font-bold text-txt-base">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-sm leading-relaxed text-txt-secondary">{children}</p>
          ),
          strong: ({ children }) => <strong className="font-bold text-txt-base">{children}</strong>,
          em: ({ children }) => <em className="italic text-txt-base">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-4 ml-4 list-disc space-y-1 text-txt-secondary">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-4 list-decimal space-y-1 text-txt-secondary">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm text-txt-secondary">{children}</li>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[13px] text-accent">
                {children}
              </code>
            ) : (
              <pre className="mb-4 overflow-x-auto rounded-lg bg-surface-0 p-3 font-mono text-xs text-txt-secondary">
                <code className={className}>{children}</code>
              </pre>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-txt-muted">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm text-txt-secondary">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border bg-surface-3 px-3 py-2 text-left font-bold">{children}</th>
          ),
          td: ({ children }) => <td className="border px-3 py-2">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
