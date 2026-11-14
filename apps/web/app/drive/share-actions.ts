"use server";

import { can } from "@devsbucket/authz/can";
import { listPendingRequests } from "@devsbucket/db/access-requests";
import { changeLink, createLink, disableLink, getActiveLink } from "@devsbucket/db/share-links";
import {
  changeGrant,
  listSharing,
  removeGrant,
  setSharingSetting,
  shareItem,
} from "@devsbucket/db/sharing";
import { getPendingTransfer } from "@devsbucket/db/transfers";
import { findUserByEmail } from "@devsbucket/db/users";
import { itemRefSchema } from "@devsbucket/shared/item";
import {
  changeLinkSchema,
  createLinkSchema,
  expiresAtFor,
  isLinkActive,
} from "@devsbucket/shared/share-links";
import {
  changeGrantSchema,
  grantRefSchema,
  shareSchema,
  sharingSettingSchema,
} from "@devsbucket/shared/sharing";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveItem } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";
const INVALID = "Invalid request";

// Server actions are public endpoints: each one checks the session, the
// input and `can(access, "share")` (or "change_settings") itself.
const getSession = async () => auth.api.getSession({ headers: await headers() });

// The Share dialog's contents: who has access and, for the Owner, the
// settings. Viewers (and Editors when sharing is off) get an error.
export const getSharing = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "share", { trashed: false });
  if (found.denied) {
    return {
      error:
        found.denied === "forbidden"
          ? "You can't share this. Ask its owner."
          : deniedMessage(found.denied, ITEM_GONE),
    } as const;
  }
  const [sharing, link, requests, transfer] = await Promise.all([
    listSharing(found.item.id),
    getActiveLink(found.item.id),
    listPendingRequests(found.item.id),
    getPendingTransfer(found.item.id),
  ]);
  if (!sharing) return { error: ITEM_GONE } as const;
  return {
    error: null,
    ...sharing,
    link: link && {
      token: link.token,
      role: link.role,
      expiresAt: link.expiresAt,
      expired: !isLinkActive({ disabledAt: null, expiresAt: link.expiresAt }),
      visitors: link.visitors,
    },
    requests,
    transfer,
    // Accepting moves a nested item out of its folder (decision 0009).
    nested: found.item.parentId !== null,
    me: session.user.id,
    canChangeSettings: can(found.access, "change_settings"),
    canTransfer: can(found.access, "transfer"),
  } as const;
};

export type SharingView = Extract<Awaited<ReturnType<typeof getSharing>>, { error: null }>;

export const shareWithPerson = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? INVALID } as const;
  const { itemId, email, role } = parsed.data;
  const found = await resolveItem(session.user, itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  // Only people who already have an account (no email to invite with).
  const person = await findUserByEmail(email);
  if (!person) return { error: "No DevsBucket account uses this email." } as const;
  if (person.id === found.item.ownerId) return { error: "They own it." } as const;
  if (person.id === session.user.id) return { error: "You already have access." } as const;
  const result = await shareItem({ itemId, userId: person.id, role, actorId: session.user.id });
  return { error: null, result, name: person.name } as const;
};

export const changeAccess = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = changeGrantSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  const changed = await changeGrant({ ...parsed.data, actorId: session.user.id });
  if (!changed) return { error: "They no longer have access here." } as const;
  return { error: null } as const;
};

export const removeAccess = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = grantRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  await removeGrant({ ...parsed.data, actorId: session.user.id });
  return { error: null } as const;
};

export const changeSharingSetting = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = sharingSettingSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "change_settings", {
    trashed: false,
  });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  await setSharingSetting({ ...parsed.data, actorId: session.user.id });
  return { error: null } as const;
};

// A new share link, or a reset: a new token (the old one stops working,
// and so does the access it gave). A reset keeps the old expiry unless it
// has passed.
export const createShareLink = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = createLinkSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const { itemId, role, expiry } = parsed.data;
  const found = await resolveItem(session.user, itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  const old = expiry === undefined ? await getActiveLink(itemId) : null;
  const kept = old?.expiresAt && old.expiresAt > new Date() ? old.expiresAt : null;
  await createLink({
    itemId,
    role,
    expiresAt: expiry === undefined ? kept : expiresAtFor(expiry),
    actorId: session.user.id,
  });
  return { error: null } as const;
};

// The link's role or expiry (counted from now); the token stays.
export const changeShareLink = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = changeLinkSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const { itemId, role, expiry } = parsed.data;
  const found = await resolveItem(session.user, itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  const changed = await changeLink({
    itemId,
    role,
    expiresAt: expiry === undefined ? undefined : expiresAtFor(expiry),
    actorId: session.user.id,
  });
  if (!changed) return { error: "This link no longer exists." } as const;
  return { error: null } as const;
};

export const disableShareLink = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "share", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  await disableLink({ itemId: parsed.data.itemId, actorId: session.user.id });
  return { error: null } as const;
};
