"use server";

import { listNotifications, markRead, unreadCount } from "@devsbucket/db/notifications";
import { markReadSchema, notificationText } from "@devsbucket/shared/notifications";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const SIGNED_OUT = "You're signed out. Sign in again.";

// Server actions are public endpoints: each one checks the session, and only
// ever reads or changes the caller's own notifications.
const getSession = async () => auth.api.getSession({ headers: await headers() });

// Where a notification leads: a folder opens in the drive, a file in the
// preview on Shared with me. Opening it checks access again, as always.
// System ones have no item: the trash warning opens the Trash.
const hrefFor = (item: { id: string | null; type: string | null }, kind: string) => {
  if (kind === "trash_emptying") return "/drive/trash";
  if (!item.id) return null;
  return item.type === "folder" ? `/drive/folders/${item.id}` : `/drive/shared?file=${item.id}`;
};

export const loadNotifications = async () => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const rows = await listNotifications(session.user.id);
  return {
    error: null,
    notifications: rows.map((row) => ({
      id: row.id,
      text: notificationText(row),
      href: hrefFor({ id: row.itemId, type: row.itemType }, row.type),
      read: row.readAt !== null,
      createdAt: row.createdAt,
    })),
  } as const;
};

export type NotificationView = Extract<
  Awaited<ReturnType<typeof loadNotifications>>,
  { error: null }
>["notifications"][number];

export const getUnreadCount = async () => {
  const session = await getSession();
  if (!session) return 0;
  return unreadCount(session.user.id);
};

// One notification (opening it) or "all" (Mark all as read).
export const markNotificationsRead = async (input: unknown) => {
  const session = await getSession();
  if (!session) return { error: SIGNED_OUT } as const;
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request" } as const;
  await markRead(session.user.id, parsed.data.id);
  return { error: null } as const;
};
