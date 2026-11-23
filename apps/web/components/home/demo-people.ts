import { CURSOR_COLORS } from "@devsbucket/shared/editing";

// The made-up people in the homepage's demos. Their colours are the live
// editor's cursor colours, so they look like real people in the app.
export const PEOPLE = {
  you: { name: "You", handle: "you@example.com", color: CURSOR_COLORS[5] },
  ada: { name: "Ada", handle: "@ada", color: CURSOR_COLORS[3] },
  grace: { name: "Grace", handle: "@grace", color: CURSOR_COLORS[7] },
  linus: { name: "Linus", handle: "@linus", color: CURSOR_COLORS[1] },
} as const;

export type DemoPerson = (typeof PEOPLE)[keyof typeof PEOPLE];
