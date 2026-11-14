"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  loadNotifications,
  markNotificationsRead,
  type NotificationView,
} from "@/app/drive/notification-actions";
import LocalDate from "@/components/local-date";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { notificationsQueryKey } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

// The Notifications page: newest first, unread ones in bold. Opening one
// marks it read; realtime brings new ones in as they happen.
const NotificationList = ({ initial }: { initial: NotificationView[] }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: notifications } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: async () => {
      const result = await loadNotifications();
      if (result.error !== null) throw new Error(result.error);
      return result.notifications;
    },
    initialData: initial,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey });

  const open = async (notification: NotificationView) => {
    if (!notification.read) {
      await markNotificationsRead({ id: notification.id });
      await refresh();
    }
    if (notification.href) router.push(notification.href);
  };

  if (notifications.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Bell />
          </EmptyMedia>
          <EmptyTitle>No notifications</EmptyTitle>
          <EmptyDescription>
            When someone shares with you, or works in your folders, it shows up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const unread = notifications.some((notification) => !notification.read);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Kept for 90 days.</p>
        <Button
          variant="outline"
          size="sm"
          disabled={!unread}
          onClick={async () => {
            await markNotificationsRead({ id: "all" });
            await refresh();
          }}
        >
          Mark all as read
        </Button>
      </div>
      <ul aria-label="Notifications" className="flex flex-col divide-y rounded-lg border">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => open(notification)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  notification.read ? "bg-transparent" : "bg-primary",
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("text-sm", !notification.read && "font-medium")}>
                  {notification.text}
                  {!notification.read && <span className="sr-only"> (unread)</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  <LocalDate value={notification.createdAt} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationList;
