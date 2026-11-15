"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// A Markdown file, rendered (decision 0003), with GitHub's extras (tables,
// task lists, strikethrough). Safe for anyone's text: react-markdown never
// renders raw HTML (`<script>` shows as text), links open in a new tab
// without access to this page, and images load only over https.
const MarkdownPreview = ({ text }: { text: string }) => (
  <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert">
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        img: ({ node: _node, src, alt }) =>
          typeof src === "string" && src.startsWith("https://") ? (
            // biome-ignore lint/performance/noImgElement: outside images; Next's <Image> needs each host listed
            <img src={src} alt={alt ?? ""} loading="lazy" />
          ) : (
            <span>[image: {alt || "not shown"}]</span>
          ),
      }}
    >
      {text}
    </Markdown>
  </div>
);

export default MarkdownPreview;
