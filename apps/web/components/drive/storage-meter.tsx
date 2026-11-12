import { formatBytes } from "@devsbucket/shared/bytes";
import { Progress } from "@/components/ui/progress";
import { requireSession } from "@/lib/session";

// Server component: reads the user's usage from the session (fresh from the
// database on each request), so it sits inside <Suspense> in the layout.
const StorageMeter = async () => {
  const { user } = await requireSession();
  const used = user.storageUsed ?? 0;
  const quota = user.storageQuota ?? 0;
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 px-3">
      <Progress value={percent} aria-label="Storage used" />
      <p className="text-xs text-muted-foreground">
        {formatBytes(used)} of {formatBytes(quota)} used
      </p>
    </div>
  );
};

export default StorageMeter;
