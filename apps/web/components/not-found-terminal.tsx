"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

// The 404 page's terminal: a curl to the address you tried, answered with
// "404 Not Found" and a small JSON body whose suggestions are links. It
// plays like a real terminal: the command typed a character at a time, a
// short wait, then the reply a line at a time (all at once with "reduce
// motion"). Screen readers get the page's heading and sentence instead
// (this is aria-hidden).
type Piece = {
  text: string;
  tone?: "prompt" | "error" | "muted" | "key" | "string";
  href?: string;
  // Typed a character at a time; everything else appears a line at a time.
  typed?: boolean;
};

const TONES = {
  prompt: "text-primary-text",
  error: "text-destructive",
  muted: "text-muted-foreground",
  key: "[color:oklch(from_var(--primary-text)_l_c_calc(h+130))]",
  string: "[color:oklch(from_var(--primary-text)_l_c_calc(h+60))]",
} as const;

// Milliseconds: before typing starts, per typed character, while "the
// server answers", and between reply lines.
const START_DELAY = 500;
const TYPE_DELAY = 55;
const SERVER_DELAY = 600;
const LINE_DELAY = 120;

const script = (address: string): Piece[] => [
  { text: "$ ", tone: "prompt" },
  { text: `curl -i ${address}`, typed: true },
  { text: "\n" },
  { text: "HTTP/1.1 404 Not Found\n", tone: "error" },
  { text: "content-type: application/json\n\n", tone: "muted" },
  { text: "{\n  " },
  { text: '"error"', tone: "key" },
  { text: ": " },
  { text: '"page not found"', tone: "string" },
  { text: ",\n  " },
  { text: '"try"', tone: "key" },
  { text: ": [" },
  { text: '"/drive"', href: "/drive" },
  { text: ", " },
  { text: '"/drive/recent"', href: "/drive/recent" },
  { text: "]\n}\n" },
  { text: "$ ", tone: "prompt" },
];

// The playback as steps: [characters shown, wait before showing them].
// Typed pieces add one character a step; the rest add a whole line.
const timeline = (pieces: Piece[]) => {
  const steps: [number, number][] = [];
  let count = 0;
  let wait = START_DELAY;
  for (const piece of pieces) {
    if (piece.typed) {
      for (let i = 0; i < piece.text.length; i++) {
        count += 1;
        steps.push([count, wait]);
        wait = TYPE_DELAY;
      }
      wait = SERVER_DELAY;
      continue;
    }
    for (const line of piece.text.split(/(?<=\n)/)) {
      count += line.length;
      steps.push([count, wait]);
      wait = line.endsWith("\n") ? LINE_DELAY : 0;
    }
  }
  return steps;
};

const NotFoundTerminal = () => {
  const pathname = usePathname();
  // The address needs the browser's host, so the text is built (and the
  // playback starts) after hydration.
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const all = script(`${window.location.host}${pathname}`);
    setPieces(all);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(all.reduce((sum, piece) => sum + piece.text.length, 0));
      return;
    }
    setShown(0);
    const steps = timeline(all);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const play = (index: number) => {
      const step = steps[index];
      if (!step) return;
      timer = setTimeout(() => {
        setShown(step[0]);
        play(index + 1);
      }, step[1]);
    };
    play(0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Each piece, cut to the characters shown so far.
  let left = shown;
  const out: ReactNode[] = [];
  pieces.forEach((piece, index) => {
    if (left <= 0) return;
    const text = piece.text.slice(0, left);
    left -= text.length;
    out.push(
      piece.href && text === piece.text ? (
        <Link
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed script
          key={index}
          href={piece.href}
          tabIndex={-1}
          className="underline decoration-border underline-offset-4 hover:text-primary-text hover:decoration-primary"
        >
          {text}
        </Link>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed script
        <span key={index} className={piece.tone ? TONES[piece.tone] : undefined}>
          {text}
        </span>
      ),
    );
  });
  const total = pieces.reduce((sum, piece) => sum + piece.text.length, 0);
  const done = total > 0 && shown >= total;

  return (
    <div
      aria-hidden
      className="w-full max-w-xl overflow-hidden rounded-xl border bg-card text-left font-mono text-[0.8rem] shadow-lg"
    >
      <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2">curl</span>
      </div>
      <pre className="min-h-56 overflow-x-auto p-4 leading-relaxed whitespace-pre-wrap">
        {out}
        {/* Steady while typing, blinking once it's done (like a real one). */}
        <span
          className={`inline-block h-4 w-2 translate-y-0.5 bg-primary ${done ? "animate-[terminal-blink_1s_steps(1)_infinite]" : ""}`}
        />
      </pre>
    </div>
  );
};

export default NotFoundTerminal;
