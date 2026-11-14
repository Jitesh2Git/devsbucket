"use server";

import {
  approveRequest,
  denyRequest,
  requestAccess as insertRequest,
} from "@devsbucket/db/access-requests";
import {
  approveRequestSchema,
  denyRequestSchema,
  requestAccessSchema,
} from "@devsbucket/shared/access-requests";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveItem } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";
const INVALID = "Invalid request";
const DECIDED = "This request was already answered.";

// Server actions are public endpoints: each one checks the session, the
// input and the permission itself.
const getSession = async () => auth.api.getSession({ headers: await headers() });

// "You need access" → Request access. Only for someone signed in with no
// role on the item (`can(access, "request_access")`): resolveItem reports
// exactly that as "no-access", so that's the one answer that lets it go on.
export const requestAccess = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = requestAccessSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? INVALID } as const;
  const { itemId, role, message } = parsed.data;
  const found = await resolveItem(session.user, itemId, "view", { trashed: false });
  if (found.denied === null) {
    return { error: "You already have access. Reload the page." } as const;
  }
  if (found.denied !== "no-access") return { error: ITEM_GONE } as const;
  const result = await insertRequest({
    itemId,
    userId: session.user.id,
    role,
    message: message || null,
  });
  return { error: null, result } as const;
};

// The Share dialog's Approve: whoever may share the item decides.
export const approveAccessRequest = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = approveRequestSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  const approved = await approveRequest({ ...parsed.data, actorId: session.user.id });
  if (!approved) return { error: DECIDED } as const;
  return { error: null } as const;
};

export const denyAccessRequest = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = denyRequestSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  const denied = await denyRequest({ ...parsed.data, actorId: session.user.id });
  if (!denied) return { error: DECIDED } as const;
  return { error: null } as const;
};
