"use client";

import type { VersionSummary } from "@devsbucket/db/versions";
import { type CollabReply, editorPath, MAX_AUTO_VERSIONS } from "@devsbucket/shared/editing";
import { useQuery } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { loadVersions, loadVersionText } from "@/app/drive/version-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { versionsQueryKey, versionTextQueryKey } from "@/lib/query-keys";
import VersionDiff from "./version-diff";

type VersionHistoryDialogProps = {
  file: { id: string; name: string };
  // The live text right now (the editor's document).
  currentText: () => string;
  // Asks realtime to bring a version back for everyone.
  restore: (versionId: string) => Promise<CollabReply>;
};

const CURRENT = "current";

const title = (version: VersionSummary) => {
  if (version.kind === "named") return version.message ?? "Named version";
  if (version.kind === "restore")
    return `Restored from version ${version.restoredFromNumber ?? "?"}`;
  return version.number === 1 ? "Original" : "Saved when everyone left";
};

const people = (version: VersionSummary) =>
  version.kind === "auto" ? version.authors.join(", ") : (version.savedBy ?? "Deleted user");

// The browser's own time zone and language (this dialog only renders there).
const when = (date: Date) =>
  new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// One version's text, read on demand.
const useVersionText = (fileId: string, versionId: string | null) =>
  useQuery({
    queryKey: versionTextQueryKey(fileId, versionId ?? ""),
    enabled: versionId !== null && versionId !== CURRENT,
    // A version never changes, so its text is fetched once.
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const result = await loadVersionText({ itemId: fileId, versionId });
      if (result.error !== null) throw new Error(result.error);
      return result.content;
    },
  });

// Version history (decision 0015): every kept version, a diff of the chosen
// one against the current text (or any other version), and Restore.
// Editors and Owners only (the page shows the button to them).
const VersionHistoryDialog = ({ file, currentText, restore }: VersionHistoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState(CURRENT);
  const [current, setCurrent] = useState("");
  const [restoring, setRestoring] = useState(false);

  const list = useQuery({
    queryKey: versionsQueryKey(file.id),
    enabled: open,
    queryFn: async () => {
      const result = await loadVersions({ itemId: file.id });
      if (result.error !== null) throw new Error(result.error);
      return result.versions;
    },
  });
  const versions = list.data ?? [];
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;
  const other = versions.find((v) => v.id === compareWith) ?? null;
  const selectedText = useVersionText(file.id, selected?.id ?? null);
  const otherText = useVersionText(file.id, other?.id ?? null);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setCurrent(currentText());
    } else {
      setSelectedId(null);
      setCompareWith(CURRENT);
    }
  };
  // Leaving the page only hides it (Next's Activity): close the dialog.
  useLayoutEffect(() => () => setOpen(false), []);

  const onRestore = async () => {
    if (!selected) return;
    setRestoring(true);
    const answer = await restore(selected.id);
    setRestoring(false);
    if (answer.type === "version-restored") {
      toast.success(`Restored version ${answer.from} as version ${answer.number}`);
      onOpenChange(false);
    } else if (answer.type === "version-unchanged") {
      toast.info(`The text is already the same as version ${selected.number}`);
    } else if (answer.type === "version-error") {
      toast.error(answer.error);
    }
  };

  const original = selectedText.data;
  const modified = other ? otherText.data : current;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[85vh] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Pick a version to see what changed since, and restore it if you need to.
            <br />
            Kept: version 1, every named or restored version, and the newest {MAX_AUTO_VERSIONS}{" "}
            saved when everyone leaves the file.
          </DialogDescription>
        </DialogHeader>
        {list.isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : list.isError ? (
          <p className="text-sm text-destructive">{list.error.message}</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No versions yet. One is saved when everyone leaves the file, or with Save version.
          </p>
        ) : (
          // On a phone the list is a short scrolling strip and the comparison
          // takes the rest; from md up they sit side by side.
          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 md:grid-cols-[16rem_1fr] md:grid-rows-1">
            <ul
              aria-label="Versions"
              className="flex min-h-0 flex-col gap-1 overflow-y-auto max-md:max-h-36"
            >
              {versions.map((version) => (
                <li key={version.id}>
                  <button
                    type="button"
                    aria-pressed={version.id === selected?.id}
                    onClick={() => setSelectedId(version.id)}
                    className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
                  >
                    <span className="block font-medium">Version {version.number}</span>
                    <span className="block truncate">{title(version)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[people(version), when(version.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>Version {selected.number} compared with</span>
                    <Select
                      value={other ? other.id : CURRENT}
                      onValueChange={(value) => {
                        setCompareWith(value);
                        if (value === CURRENT) setCurrent(currentText());
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Compare with">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CURRENT}>the current text</SelectItem>
                        {versions
                          .filter((v) => v.id !== selected.id)
                          .map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              version {v.number}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={restoring}>
                        {restoring ? <Spinner /> : <RotateCcw />}
                        Restore version {selected.number}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore version {selected.number}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Everyone with the file open will see its text. The current text stays in
                          the history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onRestore}>Restore</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                  {original === undefined || modified === undefined ? (
                    <div className="flex h-full items-center justify-center">
                      <Spinner />
                    </div>
                  ) : (
                    <VersionDiff
                      path={editorPath(file.id, file.name)}
                      original={original}
                      modified={modified}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VersionHistoryDialog;
