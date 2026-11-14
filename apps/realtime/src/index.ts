import { createServer } from "node:http";
import { getAccess } from "@devsbucket/db/access";
import { pool } from "@devsbucket/db/client";
import { itemPlace, linkVisitors, listenForEvents } from "@devsbucket/db/events";
import {
  type ActivityEvent,
  accessChangedFor,
  changedFolders,
  clientMessageSchema,
  type ServerMessage,
} from "@devsbucket/shared/realtime";
import { type WebSocket, WebSocketServer } from "ws";
import { log } from "./log.ts";

// The live-events server (decision 0010): browsers keep one WebSocket open;
// Postgres tells this server about every change (LISTEN); it tells the
// browsers that care. Phase 4 adds Hocuspocus (live editing) here.

const port = Number(process.env.PORT ?? 3001);
const webUrl = process.env.WEB_URL;
if (!webUrl) {
  throw new Error("WEB_URL is not set (apps/realtime/.env)");
}
// Only pages of our own web app may connect. Browsers send the Origin
// header on every WebSocket handshake and pages can't change it.
const allowedOrigin = new URL(webUrl).origin;

type Client = { socket: WebSocket; userId: string; folders: Set<string>; alive: boolean };

// The top of someone's My Drive has no folder id.
const rootKey = (ownerId: string) => `root:${ownerId}`;

const byUser = new Map<string, Set<Client>>();
const byFolder = new Map<string, Set<Client>>();

const add = <K>(map: Map<K, Set<Client>>, key: K, client: Client) => {
  const set = map.get(key) ?? new Set();
  set.add(client);
  map.set(key, set);
};
const remove = <K>(map: Map<K, Set<Client>>, key: K, client: Client) => {
  const set = map.get(key);
  set?.delete(client);
  if (set?.size === 0) map.delete(key);
};

const send = (client: Client, message: ServerMessage) => {
  client.socket.send(JSON.stringify(message));
};

// Who's connecting: the web app answers from the browser's own cookie
// (Better Auth); realtime never reads the auth tables itself.
const sessionUserId = async (cookie: string | undefined) => {
  if (!cookie) return null;
  const response = await fetch(`${webUrl}/api/auth/get-session`, { headers: { cookie } });
  if (!response.ok) return null;
  const session = (await response.json()) as { user?: { id: string } } | null;
  return session?.user?.id ?? null;
};

const unsubscribe = (client: Client, key: string) => {
  client.folders.delete(key);
  remove(byFolder, key, client);
};

// Folders need a role on them (item_access); the top of your own drive is
// always yours.
const subscribe = async (client: Client, folderId: string | null) => {
  if (folderId !== null) {
    const access = await getAccess(client.userId, folderId);
    if (!access?.role) return;
  }
  const key = folderId ?? rootKey(client.userId);
  client.folders.add(key);
  add(byFolder, key, client);
};

const connected = (socket: WebSocket, userId: string) => {
  const client: Client = { socket, userId, folders: new Set(), alive: true };
  add(byUser, userId, client);
  socket.on("pong", () => {
    client.alive = true;
  });
  socket.on("message", (data) => {
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    const parsed = clientMessageSchema.safeParse(message);
    if (!parsed.success) return;
    const { type, folderId } = parsed.data;
    if (type === "subscribe") {
      void subscribe(client, folderId).catch((error) => log(`subscribe failed: ${error}`));
    } else {
      unsubscribe(client, folderId ?? rootKey(userId));
    }
  });
  socket.on("close", () => {
    for (const key of client.folders) remove(byFolder, key, client);
    remove(byUser, userId, client);
  });
};

// A change: the folders whose listing changed, and the people whose access
// did. Someone who lost access to a folder stops getting its events.
const onEvent = async (event: ActivityEvent) => {
  const folders = changedFolders(event);
  if (folders) {
    const place = await itemPlace(event.itemId);
    if (place) {
      const ids = folders === "parent" ? [place.parentId] : folders;
      for (const id of new Set(ids)) {
        const key = id ?? rootKey(place.ownerId);
        for (const client of byFolder.get(key) ?? []) {
          send(client, { type: "folder-changed", folderId: id });
        }
      }
    }
  }
  const people = new Set<string>();
  for (const target of accessChangedFor(event)) {
    if (target === "link-visitors") {
      for (const userId of await linkVisitors(event.itemId)) people.add(userId);
    } else {
      people.add(target);
    }
  }
  for (const userId of people) {
    for (const client of byUser.get(userId) ?? []) {
      for (const key of client.folders) {
        if (key.startsWith("root:")) continue;
        const access = await getAccess(userId, key);
        if (!access?.role) unsubscribe(client, key);
      }
      send(client, { type: "access-changed" });
    }
  }
};

const server = createServer((request, response) => {
  // For health checks (Playwright waits for it, and so will Docker).
  if (request.url === "/health") {
    response.writeHead(200).end("ok");
    return;
  }
  response.writeHead(426, { "content-type": "text/plain" }).end("WebSockets only");
});
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (request, socket, head) => {
  const refuse = (status: string) => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  };
  if (request.headers.origin !== allowedOrigin) {
    refuse("403 Forbidden");
    return;
  }
  const userId = await sessionUserId(request.headers.cookie).catch(() => null);
  if (!userId) {
    refuse("401 Unauthorized");
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => connected(ws, userId));
});

// A browser that vanished (sleep, lost network) never says goodbye: ping
// every 30 seconds and drop the ones that didn't answer the last ping.
const heartbeat = setInterval(() => {
  for (const clients of byUser.values()) {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }
}, 30_000);

// The LISTEN connection. If the database isn't up yet (or goes away), try
// again every second instead of crashing: events while it's down are lost,
// so browsers refetch when their socket reconnects.
let listener: Awaited<ReturnType<typeof listenForEvents>> | null = null;
let stopping = false;
const startListening = async () => {
  try {
    const started = await listenForEvents((event) => {
      void onEvent(event).catch((error) => log(`event failed: ${error}`));
    });
    started.client.on("error", (error) => {
      log(`lost the database connection: ${error.message}`);
      started.stop(error);
      listener = null;
      if (!stopping) setTimeout(startListening, 1000);
    });
    listener = started;
    log("listening for database events");
  } catch (error) {
    log(`database not ready (${(error as Error).message}), trying again`);
    if (!stopping) setTimeout(startListening, 1000);
  }
};

server.listen(port, () => log(`listening on ${port}, for ${allowedOrigin}`));
void startListening();

const shutdown = async () => {
  log("stopping");
  stopping = true;
  clearInterval(heartbeat);
  for (const client of wss.clients) client.close(1001, "Server stopping");
  server.close();
  listener?.stop();
  await pool.end();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
