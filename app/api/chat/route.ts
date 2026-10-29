import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none text-inherit prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-code:rounded prose-code:bg-slate-950 prose-code:px-1 prose-code:py-0.5 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-slate-950 prose-pre:p-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-cyan-300 prose-a:underline">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="text-cyan-300 underline" />
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className?.includes("language-");
            return isInline ? (
              <code className={className} {...props}>{children}</code>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
