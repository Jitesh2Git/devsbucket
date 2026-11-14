import { z } from "zod";
import type { ActivityAction } from "./activity.ts";
import { roleLabel } from "./sharing.ts";

// Notifications (LOCKED.md "Notifications", decision 0010). Every type of
// Phase 3 is listed here, so the database check needs no new migration
// when step 13 starts writing the system ones.
export const notificationTypes = [
  // Sharing: to the person affected.
  "shared",
  "access_changed",
  "access_removed",
  "access_requested",
  "access_approved",
  "access_denied",
  "ownership_offered",
  "ownership_transferred",
  // Content: to the Owner, batched per folder, actor and hour.
  "files_added",
  "trashed",
  "restored",
  // System (step 13).
  "storage_80",
  "storage_95",
  "storage_full",
  "trash_emptying",
  "invite_used",
  "r2_ops_70",
  "r2_ops_90",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

// Content notifications are batched (decision 0010).
export const batchedTypes: readonly NotificationType[] = ["files_added", "trashed", "restored"];

// What a notification to be created looks like.
export type PlannedNotification = {
  recipientId: string;
  type: NotificationType;
  // What clicking it opens: the item, or for content the folder it's in.
  itemId: string;
  payload: Record<string, unknown>;
};

type Activity = {
  action: ActivityAction;
  actorId: string | null;
  itemId: string;
  metadata: Record<string, unknown>;
};

type Item = { id: string; name: string; ownerId: string; parentId: string | null };

// Who gets what for one activity row. `sharers`: the Owner and the Editors
// who may share the item (they answer access requests). Never the person
// who acted (decision 0010).
export const planNotifications = (
  activity: Activity,
  item: Item,
  sharers: string[] = [],
): PlannedNotification[] => {
  const m = activity.metadata as {
    userId?: string;
    role?: string;
    to?: string;
    toUserId?: string;
    fromUserId?: string;
  };
  const to = (recipientId: string | undefined, type: NotificationType, payload = {}) =>
    recipientId ? [{ recipientId, type, itemId: item.id, payload }] : [];
  // Content: the folder it's in (or the item, at the top of the drive).
  const content = (type: NotificationType) => [
    {
      recipientId: item.ownerId,
      type,
      itemId: item.parentId ?? item.id,
      payload: { name: item.name },
    },
  ];

  const planned: PlannedNotification[] = (() => {
    switch (activity.action) {
      case "shared":
        return to(m.userId, "shared", { role: m.role });
      case "access_changed":
        return to(m.userId, "access_changed", { role: m.to });
      case "access_removed":
        return to(m.userId, "access_removed");
      case "access_approved":
        return to(m.userId, "access_approved", { role: m.role });
      case "access_denied":
        return to(m.userId, "access_denied");
      case "access_requested":
        return sharers.flatMap((id) => to(id, "access_requested", { role: m.role }));
      case "ownership_offered":
        return to(m.toUserId, "ownership_offered");
      case "ownership_transferred":
        return to(m.fromUserId, "ownership_transferred");
      case "uploaded":
        return content("files_added");
      case "trashed":
        return content("trashed");
      case "restored":
        return content("restored");
      default:
        return [];
    }
  })();
  return planned.filter((notification) => notification.recipientId !== activity.actorId);
};

// The sentence shown for a notification.
export const notificationText = (n: {
  type: NotificationType;
  actorName: string | null;
  itemName: string | null;
  count: number;
  payload: Record<string, unknown>;
}) => {
  const actor = n.actorName ?? "Someone";
  const item = `"${n.itemName ?? "an item"}"`;
  const role = typeof n.payload.role === "string" ? n.payload.role : null;
  const asRole = role ? roleLabel(role as "editor" | "viewer").toLowerCase() : "";
  const name = typeof n.payload.name === "string" ? `"${n.payload.name}"` : "an item";
  const many = (one: string, several: string) => (n.count > 1 ? several : one);
  switch (n.type) {
    case "shared":
      return `${actor} shared ${item} with you as ${asRole}`;
    case "access_changed":
      return `${actor} made you ${asRole} on ${item}`;
    case "access_removed":
      return `${actor} removed your access to ${item}`;
    case "access_requested":
      return `${actor} asked for ${asRole} access to ${item}`;
    case "access_approved":
      return `${actor} gave you ${asRole} access to ${item}`;
    case "access_denied":
      return `${actor} denied your request for ${item}`;
    case "ownership_offered":
      return `${actor} wants to make you the owner of ${item}`;
    case "ownership_transferred":
      return `${actor} is now the owner of ${item}`;
    case "files_added":
      return many(
        `${actor} added ${name} to ${item}`,
        `${actor} added ${n.count} files to ${item}`,
      );
    case "trashed":
      return many(
        `${actor} moved ${name} to the trash, from ${item}`,
        `${actor} moved ${n.count} items to the trash, from ${item}`,
      );
    case "restored":
      return many(
        `${actor} restored ${name} in ${item}`,
        `${actor} restored ${n.count} items in ${item}`,
      );
    default:
      return "Something changed";
  }
};

// Mark one notification as read (opening it), or all of them.
export const markReadSchema = z.object({ id: z.union([z.uuid(), z.literal("all")]) });
