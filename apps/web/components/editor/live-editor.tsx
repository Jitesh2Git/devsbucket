"use client";

import { formatBytes } from "@devsbucket/shared/bytes";
import {
  COLLAB_TEXT,
  type CollabRefusal,
  type CollabReply,
  type CollabRequest,
  cursorColor,
  editorPath,
  LARGE_EDIT_BYTES,
} from "@devsbucket/shared/editing";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, FileX, RotateCw, SquarePen } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { versionsQueryKey } from "@/lib/query-keys";
import monaco from "./monaco";
import SaveVersionDialog from "./save-version-dialog";
import VersionHistoryDialog from "./version-history-dialog";

type LiveEditorProps = {
  file: { id: string; name: string; size: number };
  user: { id: string; name: string };
  // From the page: may this person edit (Owner or Editor)? Read-only with
  // canEdit means the owner's drive is full.
  canEdit: boolean;
};

type Peer = { clientId: number; name: string; color: string };

type State =
  | { kind: "connecting" }
  | { kind: "live"; readOnly: boolean; online: boolean; saving: boolean }
  | { kind: "refused"; reason: CollabRefusal };

// Realtime closes a connection with this code when the person's rights on
// the file changed (apps/realtime/src/collab.ts).
const ACCESS_CHANGED = 4000;

// A remote person's cursor and selection: y-monaco tags them with
// yRemoteSelection(-Head)-<client id>, and we color them per person.
const peerCss = (peers: Peer[]) =>
  peers
    .map(
      ({ clientId, name, color }) => `
.yRemoteSelection-${clientId} { background-color: ${color}33; }
.yRemoteSelectionHead-${clientId} {
  position: absolute; height: 100%; box-sizing: border-box;
  border-left: 2px solid ${color};
}
.yRemoteSelectionHead-${clientId}::after {
  content: ${JSON.stringify(name.slice(0, 40))};
  position: absolute; top: -1.3em; left: -2px; z-index: 10;
  padding: 0 4px; border-radius: 3px 3px 3px 0;
  background: ${color}; color: #fff; font-size: 11px; line-height: 1.3em;
  white-space: nowrap; pointer-events: none;
}`,
    )
    .join("\n");

const REFUSALS: Record<CollabRefusal, { title: string; description: string }> = {
  "no-access": {
    title: "This file isn't available",
    description: "Your access changed, or it was moved to the trash. Reload to see where it is.",
  },
  "not-text": {
    title: "Can't open this file here",
    description: "This file isn't UTF-8 text, so it can't be edited. Download it to open it.",
  },
};

// One connection to the file's live document. Everything lives exactly as
// long as the effect: Next hides pages you leave, which runs the cleanup,
// so a hidden page closes its connection.
const LiveSession = ({
  file,
  user,
  canEdit,
  onAccessChanged,
}: LiveEditorProps & { onAccessChanged: () => void }) => {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "vs-dark" : "vs";
  const [state, setState] = useState<State>({ kind: "connecting" });
  const [peers, setPeers] = useState<Peer[]>([]);
  // The latest callback, without reconnecting when the parent re-renders.
  const accessChanged = useRef(onAccessChanged);
  accessChanged.current = onAccessChanged;

  const queryClient = useQueryClient();
  // For "Save version" and "Restore": the connection, the live text, and
  // the request waiting for its answer.
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const pendingSave = useRef<((answer: CollabReply) => void) | null>(null);

  const ask = (request: CollabRequest) =>
    new Promise<CollabReply>((resolve) => {
      const provider = providerRef.current;
      if (!provider) {
        resolve({ type: "version-error", error: "Not connected. Try again." });
        return;
      }
      // No answer (the connection dropped): say so instead of waiting forever.
      const timer = setTimeout(() => {
        pendingSave.current = null;
        resolve({ type: "version-error", error: "No answer from the server. Try again." });
      }, 10_000);
      pendingSave.current = (answer) => {
        clearTimeout(timer);
        resolve(answer);
      };
      provider.sendStateless(JSON.stringify(request));
    });
  const saveVersion = (message: string) => ask({ type: "save-version", message });
  const restoreVersion = (versionId: string) => ask({ type: "restore-version", versionId });
  const currentText = () => docRef.current?.getText(COLLAB_TEXT).toString() ?? "";

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!container.current || !url) {
      return;
    }
    const doc = new Y.Doc();
    // Read-only until realtime says this connection may write.
    const model = monaco.editor.createModel(
      "",
      undefined,
      monaco.Uri.file(editorPath(file.id, file.name)),
    );
    const editor = monaco.editor.create(container.current, {
      model,
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 13,
      // Room for a name label above a cursor on the first line.
      padding: { top: 18 },
    });
    let readOnly = true;
    const live = (changes: Partial<Extract<State, { kind: "live" }>>) =>
      setState((current) => ({
        kind: "live",
        readOnly,
        online: true,
        saving: false,
        ...(current.kind === "live" ? current : {}),
        ...changes,
      }));

    const provider = new HocuspocusProvider({
      url: `${url}/collab`,
      name: file.id,
      document: doc,
      // Who you are comes from your session cookie; Hocuspocus only needs
      // a token to run its authentication step.
      token: "session",
      onAuthenticated: ({ scope }) => {
        readOnly = scope !== "read-write";
        editor.updateOptions({ readOnly });
      },
      onSynced: () => live({ readOnly, online: true }),
      onAuthenticationFailed: ({ reason }) =>
        setState({ kind: "refused", reason: reason === "not-text" ? "not-text" : "no-access" }),
      onStatus: ({ status }) => {
        if (status === "disconnected") live({ online: false });
      },
      onUnsyncedChanges: ({ number }) => live({ saving: number > 0 }),
      onClose: ({ event }) => {
        if (event.code === ACCESS_CHANGED) accessChanged.current();
      },
      // Realtime's answer to "Save version" or "Restore", or "the versions
      // changed" (someone saved one): the history refetches.
      onStateless: ({ payload }) => {
        const answer = JSON.parse(payload) as CollabReply;
        if (answer.type === "versions-changed") {
          void queryClient.invalidateQueries({ queryKey: versionsQueryKey(file.id) });
        } else {
          pendingSave.current?.(answer);
          pendingSave.current = null;
        }
      },
      onAwarenessChange: ({ states }) =>
        setPeers(
          states
            .filter((peer) => peer.clientId !== doc.clientID && peer.user)
            .map((peer) => ({
              clientId: peer.clientId,
              name: String(peer.user.name),
              color: String(peer.user.color),
            })),
        ),
    });
    providerRef.current = provider;
    docRef.current = doc;
    provider.awareness?.setLocalStateField("user", {
      name: user.name,
      color: cursorColor(user.id),
    });
    const binding = new MonacoBinding(
      doc.getText(COLLAB_TEXT),
      model,
      new Set([editor]),
      provider.awareness,
    );

    return () => {
      providerRef.current = null;
      docRef.current = null;
      binding.destroy();
      provider.destroy();
      editor.dispose();
      model.dispose();
      doc.destroy();
    };
  }, [file.id, file.name, user.id, user.name, queryClient]);

  // The theme is global to Monaco, so it changes without a new editor.
  useEffect(() => {
    monaco.editor.setTheme(theme);
  }, [theme]);

  if (state.kind === "refused") {
    const { title, description } = REFUSALS[state.reason];
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileX />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {state.reason === "no-access" && (
          <EmptyContent>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RotateCw />
              Reload
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span role="status">
          {state.kind === "connecting"
            ? "Connecting…"
            : !state.online
              ? "Offline, reconnecting…"
              : state.readOnly
                ? canEdit
                  ? "Read-only: the owner's storage is full"
                  : "Read-only: you can view this file"
                : state.saving
                  ? "Saving…"
                  : "All changes saved"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {peers.length > 0 && (
            <ul aria-label="Also here" className="flex flex-wrap gap-1.5">
              {peers.map((peer) => (
                <li
                  key={peer.clientId}
                  className="flex items-center gap-1 rounded-full border px-2 py-0.5"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: peer.color }}
                  />
                  {peer.name}
                </li>
              ))}
            </ul>
          )}
          {state.kind === "live" && !state.readOnly && (
            <>
              <VersionHistoryDialog
                file={file}
                currentText={currentText}
                restore={restoreVersion}
              />
              <SaveVersionDialog save={saveVersion} />
            </>
          )}
        </div>
      </div>
      <div className="relative h-[calc(100vh-14rem)] min-h-80 overflow-hidden rounded-md border">
        <div ref={container} className="h-full" />
        {state.kind === "connecting" && (
          // Visual only: the status line above already says "Connecting…".
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground"
          >
            <Spinner />
            {file.size > LARGE_EDIT_BYTES && (
              <p>Loading a large file ({formatBytes(file.size)}). This can take a while.</p>
            )}
          </div>
        )}
      </div>
      <style>{peerCss(peers)}</style>
    </div>
  );
};

// A text file, live (Phase 4): the editor is bound to the file's Yjs
// document on realtime (/collab), so everyone with it open sees the same
// text and each other's cursors. Viewers watch; their editor is read-only.
// When realtime closes the connection because rights changed, a new
// session starts with a fresh document (the key), so nothing typed under
// the old rights comes back.
//
// A large file (over LARGE_EDIT_BYTES) asks first: it's slow to open and
// heavy in the browser.
const LiveEditor = (props: LiveEditorProps) => {
  const [generation, setGeneration] = useState(0);
  const [confirmed, setConfirmed] = useState(props.file.size <= LARGE_EDIT_BYTES);
  if (!confirmed) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>This is a large file ({formatBytes(props.file.size)})</EmptyTitle>
          <EmptyDescription>
            Opening it in the editor can take a while and use a lot of memory. You can also download
            it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setConfirmed(true)}>
            <SquarePen />
            Open in editor
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <LiveSession key={generation} {...props} onAccessChanged={() => setGeneration((n) => n + 1)} />
  );
};

export default LiveEditor;
