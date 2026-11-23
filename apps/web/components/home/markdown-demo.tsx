import { Button } from "@/components/ui/button";

const SOURCE = `# api-server

Run it with \`pnpm dev\`.

- health check on /health
- rate limit (todo)`;

// A Markdown file in Split view (Editor / Split / Preview, as on the file
// page): the text on the left, the preview on the right.
const MarkdownDemo = () => {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
        README.md
        <span className="flex rounded-md border p-0.5">
          {["Editor", "Split", "Preview"].map((view) => (
            <Button
              key={view}
              variant={view === "Split" ? "secondary" : "ghost"}
              size="xs"
              className="h-5"
              tabIndex={-1}
            >
              {view}
            </Button>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-2">
        <pre className="overflow-hidden border-r p-3 font-mono text-[0.7rem] leading-[1.8] text-muted-foreground">
          {SOURCE}
        </pre>
        <div className="prose prose-sm prose-neutral max-w-none min-w-0 p-3 dark:prose-invert prose-headings:mt-0 prose-headings:mb-1.5 prose-p:my-1 prose-ul:my-1">
          <h3>api-server</h3>
          <p>
            Run it with <code>pnpm dev</code>.
          </p>
          <ul>
            <li>health check on /health</li>
            <li>rate limit (todo)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MarkdownDemo;
