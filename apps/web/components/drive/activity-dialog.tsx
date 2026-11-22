"use client";

import { activityText } from "@devsbucket/shared/activity-text";
import { timeAgo } from "@devsbucket/shared/time";
import { useInfiniteQuery } from "@tanstack/react-query";
import { loadActivity } from "@/app/drive/activity-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export type ActivityTarget = { id: string; name: string };

const exactTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

// The item's own log, newest first, 50 rows at a time. Fetched each time
// the dialog opens (mounted only while open), so it's never stale.
const ActivityLog = ({ item }: { item: ActivityTarget }) => {
  const query = useInfiniteQuery({
    queryKey: ["activity", item.id],
    queryFn: async ({ pageParam }) => {
      const result = await loadActivity({ itemId: item.id, cursor: pageParam });
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result;
    },
    initialPageParam: null as { at: string; id: string } | null,
    getNextPageParam: (last) => last.next,
    staleTime: 0,
  });

  if (query.isPending) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (query.isError) {
    return <p className="py-8 text-center text-muted-foreground">{query.error.message}</p>;
  }
  const pages = query.data.pages;
  if (pages[0]?.rows.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No activity yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Activity" className="flex max-h-[60vh] flex-col divide-y overflow-y-auto">
        {pages.flatMap((page) =>
          page.rows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <span className="min-w-0 break-words">
                <span className="font-medium">{row.actorName ?? "Someone"}</span>{" "}
                {activityText(row, page.names)}
              </span>
              <time
                dateTime={row.createdAt.toISOString()}
                title={exactTime.format(row.createdAt)}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {timeAgo(row.createdAt)}
              </time>
            </li>
          )),
        )}
      </ol>
      {query.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage && <Spinner />}
          Show more
        </Button>
      )}
      {query.isFetchNextPageError && (
        <p role="alert" className="text-center text-sm text-destructive">
          Couldn't load more. Try again.
        </p>
      )}
    </div>
  );
};

// The activity panel (Phase 5, decision 0017): for the Owner and Editors,
// from an item's menu or the file page.
const ActivityDialog = ({
  item,
  onClose,
}: {
  item: ActivityTarget | null;
  onClose: () => void;
}) => {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {item && (
          <>
            <DialogHeader className="min-w-0 pr-8">
              <DialogTitle className="truncate">Activity</DialogTitle>
              <DialogDescription className="truncate">{item.name}</DialogDescription>
            </DialogHeader>
            <ActivityLog item={item} />
            {/* Activity is a permanent log (LOCKED.md): nothing is dropped. */}
            <p className="text-xs text-muted-foreground">
              The whole history, newest first, kept for as long as the item exists.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ActivityDialog;
