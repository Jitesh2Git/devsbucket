"use client";

import type { ClientMessage, ServerMessage } from "@devsbucket/shared/realtime";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, use, useCallback, useEffect, useRef } from "react";

type Listener = () => void;
type Subscribe = (folderId: string | null, onChange: Listener) => () => void;

const RealtimeContext = createContext<Subscribe | null>(null);

// The top of your own My Drive has no folder id.
const keyOf = (folderId: string | null) => folderId ?? "root";

// One WebSocket per tab to apps/realtime (decision 0010). Components follow
// a folder with useFolderEvents; "your access changed" refreshes the page
// (a folder you lost shows "You need access") and the cached lists. After
// a dropped connection it reconnects with backoff, follows the same
// folders again, and refetches, since it may have missed events.
const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const listeners = useRef(new Map<string, Set<Listener>>());
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!url) return;
    let stopped = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        if (retries > 0) {
          void queryClient.invalidateQueries();
          router.refresh();
        }
        retries = 0;
        for (const key of listeners.current.keys()) {
          ws.send(JSON.stringify({ type: "subscribe", folderId: key === "root" ? null : key }));
        }
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === "folder-changed") {
          for (const listener of listeners.current.get(keyOf(message.folderId)) ?? []) {
            listener();
          }
        } else if (message.type === "access-changed") {
          void queryClient.invalidateQueries();
          router.refresh();
        }
      };
      ws.onclose = () => {
        // A socket closed by the cleanup (React runs effects twice in dev)
        // can close after the next one opened: leave that one alone.
        if (socket.current === ws) socket.current = null;
        if (stopped) return;
        // 1 s, 2 s, 4 s … up to 30 s.
        const delay = Math.min(30_000, 1000 * 2 ** retries);
        retries += 1;
        timer = setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [queryClient, router]);

  // Stable, so components don't resubscribe on every render.
  const subscribe: Subscribe = useCallback((folderId, onChange) => {
    const sendMessage = (message: ClientMessage) => {
      if (socket.current?.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify(message));
      }
    };
    const key = keyOf(folderId);
    const set = listeners.current.get(key) ?? new Set();
    if (set.size === 0) sendMessage({ type: "subscribe", folderId });
    set.add(onChange);
    listeners.current.set(key, set);
    return () => {
      set.delete(onChange);
      if (set.size === 0) {
        listeners.current.delete(key);
        sendMessage({ type: "unsubscribe", folderId });
      }
    };
  }, []);

  return <RealtimeContext value={subscribe}>{children}</RealtimeContext>;
};

// Calls onChange whenever the folder's contents change (null = the top of
// your own My Drive), from any browser.
export const useFolderEvents = (folderId: string | null, onChange: Listener) => {
  const subscribe = use(RealtimeContext);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!subscribe) return;
    return subscribe(folderId, () => latest.current());
  }, [subscribe, folderId]);
};

export default RealtimeProvider;
