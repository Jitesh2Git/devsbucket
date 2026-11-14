"use server";

import { getAccess } from "@devsbucket/db/access";
import {
  acceptTransfer,
  cancelTransfer,
  declineTransfer,
  offerTransfer,
} from "@devsbucket/db/transfers";
import { itemRefSchema } from "@devsbucket/shared/item";
import { quotaMessage } from "@devsbucket/shared/limits";
import { offerTransferSchema, transferRefSchema } from "@devsbucket/shared/transfers";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deniedMessage, resolveItem } from "@/lib/items";

const SIGNED_OUT = "You're signed out. Sign in again.";
const ITEM_GONE = "This item no longer exists.";
const INVALID = "Invalid request";
const OFFER_GONE = "This offer is no longer open.";

// Server actions are public endpoints: each one checks the session, the
// input and the permission itself (decision 0009).
const getSession = async () => auth.api.getSession({ headers: await headers() });

// The Owner (`transfer`) offers the item to someone who has access to it.
export const offerOwnership = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = offerTransferSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const { itemId, userId } = parsed.data;
  const found = await resolveItem(session.user, itemId, "transfer", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  const theirs = await getAccess(userId, itemId);
  if (!theirs?.role || theirs.role === "owner") {
    return { error: "Only someone who has access to it can become its owner." } as const;
  }
  const offered = await offerTransfer({ itemId, fromUserId: session.user.id, toUserId: userId });
  if (!offered) return { error: "There's already an offer waiting for an answer." } as const;
  return { error: null } as const;
};

export const cancelOwnershipOffer = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const found = await resolveItem(session.user, parsed.data.itemId, "transfer", { trashed: false });
  if (found.denied) return { error: deniedMessage(found.denied, ITEM_GONE) } as const;
  if (!(await cancelTransfer(parsed.data.itemId))) return { error: OFFER_GONE } as const;
  return { error: null } as const;
};

const ACCEPT_ERRORS = {
  gone: OFFER_GONE,
  upload: "An upload inside it is still in progress. Try again once it's done.",
  trashed:
    "Something inside it is in the trash. Its owner needs to restore it or delete it forever first.",
  "nested-offer":
    "Something inside it has its own ownership offer. That one needs an answer first.",
} as const;

// The recipient accepts: it must still be theirs to accept (they still have
// access), and their quota must take it.
export const acceptOwnership = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = transferRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const access = await getAccess(session.user.id, parsed.data.itemId);
  if (!access?.role) return { error: OFFER_GONE } as const;
  const result = await acceptTransfer({ ...parsed.data, userId: session.user.id });
  if (!result.ok) {
    return {
      error:
        result.reason === "quota"
          ? `${quotaMessage(result.used, result.quota)} Free up space to accept it.`
          : ACCEPT_ERRORS[result.reason],
    } as const;
  }
  return { error: null, itemId: result.itemId, name: result.name } as const;
};

export const declineOwnership = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = transferRefSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID } as const;
  const declined = await declineTransfer({
    transferId: parsed.data.transferId,
    userId: session.user.id,
  });
  if (!declined) return { error: OFFER_GONE } as const;
  return { error: null } as const;
};
