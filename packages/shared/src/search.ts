import { z } from "zod";

// Cmd+K search (Phase 5, decision 0017): names only. Two characters at
// least (one matches nearly everything), 100 at most.
export const SEARCH_MIN = 2;
export const SEARCH_LIMIT = 20;

export const searchSchema = z.object({
  query: z.string().trim().min(SEARCH_MIN).max(100),
});

// The query as a `like` pattern that finds it anywhere in a name: `%`,
// `_` and `\` in what the user typed are matched as themselves.
export const containsPattern = (query: string) =>
  `%${query.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
