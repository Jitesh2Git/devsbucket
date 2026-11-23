import { cn } from "cn";
import { Button } from "@/components/ui/button";

const VERSIONS = [
  { name: "Add health check", by: "You", when: "now", named: true },
  { name: "Edited", by: "Ada, Grace", when: "1h", named: false },
  { name: "Release 1.2", by: "You", when: "2d", named: true },
];

// Added lines in the accent, removed ones in the theme's destructive colour.
const DIFF = [
  { n: 5, text: "const app = serve({ port });", kind: "same" },
  { n: 6, text: "app.listen(80);", kind: "removed" },
  { n: 6, text: 'app.get("/health", ok);', kind: "added" },
  { n: 7, text: "app.listen();", kind: "added" },
] as const;

// Version history (components/editor/version-history-dialog.tsx): the
// versions, and the change between two of them.
const VersionsDemo = () => {
  return (
    <div className="grid overflow-hidden rounded-xl border bg-background sm:grid-cols-[0.9fr_1.1fr]">
      <ul className="border-b text-sm sm:border-r sm:border-b-0">
        {VERSIONS.map((version, index) => (
          <li
            key={version.name}
            className={cn(
              "flex items-baseline justify-between gap-2 border-b px-3 py-2 last:border-b-0",
              index === 0 && "bg-primary/10",
            )}
          >
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate",
                  version.named && "font-medium",
                  index === 0 && "text-primary-text",
                )}
              >
                {version.name}
              </span>
              <span className="text-xs text-muted-foreground">{version.by}</span>
            </span>
            <span className="text-xs text-muted-foreground">{version.when}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
          Release 1.2 → Add health check
          <Button variant="outline" size="xs" tabIndex={-1}>
            Restore
          </Button>
        </div>
        <div className="py-1 font-mono text-[0.7rem] leading-[1.9]">
          {DIFF.map((line) => (
            <div
              key={`${line.kind}-${line.n}`}
              className={cn(
                "grid grid-cols-[2.5rem_1fr] whitespace-pre",
                line.kind === "added" && "bg-primary/10",
                line.kind === "removed" && "bg-destructive/10",
              )}
            >
              <span
                className={cn(
                  "pr-3 text-right text-muted-foreground/60",
                  line.kind === "added" && "text-primary-text",
                  line.kind === "removed" && "text-destructive",
                )}
              >
                {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : ""} {line.n}
              </span>
              <span className="truncate">{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VersionsDemo;
