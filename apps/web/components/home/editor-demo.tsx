import { ChevronRight, History, Save } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PEOPLE } from "@/components/home/demo-people";
import { Button } from "@/components/ui/button";

// Code colours from the theme's accent (like the 404 terminal), so they
// follow the visitor's theme.
const TONES = {
  keyword: "text-primary-text",
  string: "[color:oklch(from_var(--primary-text)_l_c_calc(h+60))]",
  number: "[color:oklch(from_var(--primary-text)_l_c_calc(h+130))]",
  comment: "text-muted-foreground italic",
} as const;

const Tone = ({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) => (
  <span className={TONES[tone]}>{children}</span>
);

// Someone's cursor: a thin bar in their colour with their name above it.
const Cursor = ({ name, color }: { name: string; color: string }) => (
  <span
    className="relative inline-block h-[1.25em] w-0.5 align-[-0.25em]"
    style={{ backgroundColor: color }}
  >
    <span
      className="absolute bottom-full left-0 rounded-sm rounded-bl-none px-1 font-sans text-[0.6rem] leading-normal font-semibold whitespace-nowrap text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  </span>
);

const Line = ({
  n,
  children,
  highlight,
}: {
  n: number;
  children?: ReactNode;
  highlight?: string;
}) => (
  <div
    className="grid grid-cols-[2.5rem_1fr] whitespace-pre"
    style={
      highlight
        ? { backgroundColor: `color-mix(in oklch, ${highlight} 12%, transparent)` }
        : undefined
    }
  >
    <span className="pr-4 text-right text-muted-foreground/60">{n}</span>
    <span>{children ?? " "}</span>
  </div>
);

// The live editor's page: its status line, who's here, History and Save
// version (the real ones are in components/editor/live-editor.tsx), and a
// file with three people's cursors, one of them typing.
const EditorDemo = () => {
  const typing = { "--chars": 24 } as CSSProperties;
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          api-server <ChevronRight className="size-3" />
          <span className="text-foreground">server.ts</span>
          <span className="ml-2">All changes saved</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {[PEOPLE.ada, PEOPLE.grace].map((person) => (
            <span
              key={person.name}
              className="flex items-center gap-1 rounded-full border px-2 py-0.5"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: person.color }} />
              {person.name}
            </span>
          ))}
          <Button variant="outline" size="xs" tabIndex={-1}>
            <History />
            History
          </Button>
          <Button variant="outline" size="xs" tabIndex={-1}>
            <Save />
            Save version
          </Button>
        </span>
      </div>
      <div className="overflow-hidden py-2 font-mono text-xs leading-[1.9]">
        <Line n={1}>
          <Tone tone="keyword">import</Tone> {"{ serve }"} <Tone tone="keyword">from</Tone>{" "}
          <Tone tone="string">"./http"</Tone>
          {";"}
        </Line>
        <Line n={2}>
          <Tone tone="keyword">import</Tone> {"{ routes }"} <Tone tone="keyword">from</Tone>{" "}
          <Tone tone="string">"./routes"</Tone>
          {";"}
        </Line>
        <Line n={3} />
        <Line n={4} highlight={PEOPLE.ada.color}>
          <Tone tone="keyword">const</Tone> port = <Tone tone="number">3000</Tone>
          {";"}
          <Cursor name={PEOPLE.ada.name} color={PEOPLE.ada.color} />
        </Line>
        <Line n={5}>
          <Tone tone="keyword">const</Tone> app = serve({"{ port, routes }"});
        </Line>
        <Line n={6} />
        <Line n={7}>
          <span className="home-typing" style={typing}>
            app.get(<Tone tone="string">"/health"</Tone>, ok);
          </span>
          <Cursor name={PEOPLE.you.name} color={PEOPLE.you.color} />
        </Line>
        <Line n={8} />
        <Line n={9}>
          <Tone tone="comment">{"// TODO: rate limit"}</Tone>
          <Cursor name={PEOPLE.grace.name} color={PEOPLE.grace.color} />
        </Line>
        <Line n={10}>app.listen();</Line>
      </div>
    </div>
  );
};

export default EditorDemo;
