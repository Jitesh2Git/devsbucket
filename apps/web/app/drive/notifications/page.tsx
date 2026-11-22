import type { Metadata } from "next";
import { Suspense } from "react";
import { loadNotifications } from "@/app/drive/notification-actions";
import NotificationList from "@/components/drive/notification-list";

export const metadata: Metadata = { title: "Notifications" };

const NotificationsContent = async () => {
  const result = await loadNotifications();
  return <NotificationList initial={result.error === null ? result.notifications : []} />;
};

const NotificationsPage = () => {
  return (
    // From md up the page fills the drive column and only the list scrolls.
    <div className="flex flex-col gap-4 md:h-full">
      <h1 className="shrink-0 text-2xl font-semibold tracking-tight">Notifications</h1>
      <Suspense>
        <NotificationsContent />
      </Suspense>
    </div>
  );
};

export default NotificationsPage;
