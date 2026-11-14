import { z } from "zod";
import type { ActivityAction } from "./activity.ts";
import { itemIdSchema } from "./item.ts";

// Live events (decision 0010): every activity row is also sent on one
// Postgres channel when its transaction commits; apps/realtime turns it
// into "this folder changed" or "your access changed" for the browsers
// that care. Messages carry no data: the page refetches through the
// normal, permission-checked actions.

export const EVENTS_CHANNEL = "devsbucket_events";

// What logActivity sends on the channel.
export type ActivityEvent = {
  itemId: string;
  action: ActivityAction;
  actorId: string | null;
  metadata: Record<string, unknown>;
};

// Browser → realtime: follow a folder (null = the top of your own My
// Drive), or stop following it.
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), folderId: itemIdSchema.nullable() }),
  z.object({ type: z.literal("unsubscribe"), folderId: itemIdSchema.nullable() }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// Realtime → browser.
export type ServerMessage =
  | { type: "folder-changed"; folderId: string | null }
  | { type: "access-changed" };

// Which folder listings an action changes:
// - "parent": the folder the item is in now (or the top of its owner's drive)
// - a list of folder ids, where null is the top of the item owner's drive
// - nothing
export const changedFolders = (event: ActivityEvent): "parent" | (string | null)[] | null => {
  switch (event.action) {
    case "created":
    case "uploaded":
    case "renamed":
    case "trashed":
    case "restored":
      return "parent";
    case "moved": {
      const { from, to } = event.metadata as { from: string | null; to: string | null };
      return [from, to];
    }
    // Logged on the folder the item was in.
    case "deleted_forever":
      return [event.itemId];
    default:
      return null;
  }
};

// Whose access to the item an action changed: their pages check again.
// "link-visitors": everyone who opened one of the item's share links.
export const accessChangedFor = (event: ActivityEvent): (string | "link-visitors")[] => {
  const metadata = event.metadata as { userId?: string; fromUserId?: string; toUserId?: string };
  switch (event.action) {
    case "shared":
    case "access_changed":
    case "access_removed":
    case "access_approved":
      return metadata.userId ? [metadata.userId] : [];
    case "ownership_transferred":
      return [metadata.fromUserId, metadata.toUserId].filter((id) => id !== undefined);
    case "link_changed":
    case "link_disabled":
    case "link_created":
      return ["link-visitors"];
    default:
      return [];
  }
};
