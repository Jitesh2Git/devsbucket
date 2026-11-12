"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { cancelUpload, completeUpload, requestUpload } from "@/app/drive/upload-actions";
import { putFile } from "@/lib/put-file";
import { itemsQueryKey } from "@/lib/query-keys";

export type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled";

// One row in the uploads panel.
export type Upload = {
  id: string;
  name: string;
  // The name it was saved under, when that name was taken (decision 0007).
  savedAs: string | null;
  progress: number;
  status: UploadStatus;
  error: string | null;
};

type Job = { id: string; file: File; parentId: string | null };

type UploadsContextValue = {
  uploads: Upload[];
  startUploads: (files: File[], parentId: string | null) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
};

const UploadsContext = createContext<UploadsContextValue | null>(null);

// Up to 3 files at once; the rest wait their turn.
const MAX_PARALLEL = 3;

export const savedAsNote = ({ name, savedAs }: Pick<Upload, "name" | "savedAs">) =>
  savedAs ? `Saved as ${savedAs}: ${name} already exists here` : null;

// Holds the uploads for the whole drive (it sits in the drive layout), so
// they keep going while the user moves between folders.
const UploadsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);

  // Not state: the queue and the running uploads change outside rendering.
  const queue = useRef<Job[]>([]);
  const active = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  // What happened since the panel was last idle, for one toast per batch.
  const batch = useRef({ done: 0, failed: 0, notes: [] as string[] });

  const update = useCallback((id: string, change: Partial<Upload>) => {
    setUploads((current) => current.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }, []);

  const finishBatch = useCallback(() => {
    const { done, failed, notes } = batch.current;
    batch.current = { done: 0, failed: 0, notes: [] };
    if (done > 0) {
      toast.success(done === 1 ? "1 file uploaded" : `${done} files uploaded`, {
        description: notes.length > 0 ? notes.join("\n") : undefined,
      });
      // The storage meter is rendered on the server.
      router.refresh();
    }
    if (failed > 0) {
      toast.error(failed === 1 ? "1 upload failed" : `${failed} uploads failed`);
    }
  }, [router]);

  const run = useCallback(
    async ({ id, file, parentId }: Job, signal: AbortSignal) => {
      update(id, { status: "uploading" });
      const request = await requestUpload({
        parentId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });
      if (request.error !== null) {
        update(id, { status: "error", error: request.error });
        batch.current.failed += 1;
        return;
      }
      const savedAs = request.renamed ? request.name : null;
      update(id, { savedAs });
      try {
        signal.throwIfAborted();
        await putFile({
          url: request.url,
          file,
          contentType: request.contentType,
          onProgress: (progress) => update(id, { progress }),
          signal,
        });
      } catch {
        await cancelUpload({ itemId: request.itemId });
        if (signal.aborted) {
          update(id, { status: "cancelled" });
        } else {
          update(id, { status: "error", error: "Upload failed. Try again." });
          batch.current.failed += 1;
        }
        return;
      }
      const complete = await completeUpload({ itemId: request.itemId });
      if (complete.error !== null) {
        update(id, { status: "error", error: complete.error });
        batch.current.failed += 1;
        return;
      }
      update(id, { status: "done", progress: 1 });
      batch.current.done += 1;
      const note = savedAsNote({ name: file.name, savedAs });
      if (note) {
        batch.current.notes.push(note);
      }
      await queryClient.invalidateQueries({ queryKey: itemsQueryKey(parentId) });
    },
    [queryClient, update],
  );

  const pump = useCallback(() => {
    while (active.current < MAX_PARALLEL && queue.current.length > 0) {
      const job = queue.current.shift();
      if (!job) break;
      const controller = new AbortController();
      controllers.current.set(job.id, controller);
      active.current += 1;
      run(job, controller.signal)
        .catch(() => {
          // A server action threw (server down, bug): show it on the row.
          update(job.id, { status: "error", error: "Something went wrong. Try again." });
          batch.current.failed += 1;
        })
        .finally(() => {
          controllers.current.delete(job.id);
          active.current -= 1;
          pump();
          if (active.current === 0 && queue.current.length === 0) {
            finishBatch();
          }
        });
    }
  }, [run, update, finishBatch]);

  const startUploads = useCallback(
    (files: File[], parentId: string | null) => {
      const jobs = files.map((file) => ({ id: crypto.randomUUID(), file, parentId }));
      setUploads((current) => [
        ...current,
        ...jobs.map(({ id, file }) => ({
          id,
          name: file.name,
          savedAs: null,
          progress: 0,
          status: "queued" as const,
          error: null,
        })),
      ]);
      queue.current.push(...jobs);
      pump();
    },
    [pump],
  );

  const cancel = useCallback(
    (id: string) => {
      const waiting = queue.current.findIndex((job) => job.id === id);
      if (waiting !== -1) {
        queue.current.splice(waiting, 1);
        update(id, { status: "cancelled" });
        return;
      }
      controllers.current.get(id)?.abort(new DOMException("Upload cancelled", "AbortError"));
    },
    [update],
  );

  const clearFinished = useCallback(() => {
    setUploads((current) =>
      current.filter((u) => u.status === "queued" || u.status === "uploading"),
    );
  }, []);

  // Leaving the page would stop the uploads: ask first. (A closed tab
  // leaves a pending upload behind; the worker cleans it up, step 11.)
  const busy = uploads.some((u) => u.status === "queued" || u.status === "uploading");
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const value = useMemo(
    () => ({ uploads, startUploads, cancel, clearFinished }),
    [uploads, startUploads, cancel, clearFinished],
  );

  return <UploadsContext value={value}>{children}</UploadsContext>;
};

export const useUploads = () => {
  const context = useContext(UploadsContext);
  if (!context) {
    throw new Error("useUploads must be used inside <UploadsProvider>");
  }
  return context;
};

export default UploadsProvider;
