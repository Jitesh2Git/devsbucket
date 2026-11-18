"use server";

import { listRecent } from "@devsbucket/db/recent";
import { searchItems } from "@devsbucket/db/search";
import { searchSchema } from "@devsbucket/shared/search";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const SIGNED_OUT = "You're signed out. Sign in again.";

// Cmd+K search (Phase 5, decision 0017): names of what the user can open.
// searchItems checks each result with item_access(), like everything else.
export const searchDrive = async (input: unknown) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: null, results: [] } as const;
  }
  const results = await searchItems(session.user.id, parsed.data.query);
  return { error: null, results } as const;
};

// What the palette shows before anything is typed: the last few files the
// user opened (Recent, step 1).
export const loadRecentForSearch = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: SIGNED_OUT } as const;
  }
  const recent = await listRecent(session.user.id);
  return { error: null, recent: recent.slice(0, 5) } as const;
};
