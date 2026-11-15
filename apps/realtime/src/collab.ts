import type { IncomingMessage } from "node:http";
import { getAccess } from "@devsbucket/db/access";
import { getCollabState, saveCollabState } from "@devsbucket/db/collab";
import { getItem } from "@devsbucket/db/items";
import { isStorageFull } from "@devsbucket/db/usage";
import { saveVersion } from "@devsbucket/db/versions";
import {
  COLLAB_TEXT,
  type CollabRefusal,
  type CollabReply,
  collabRequestSchema,
  decodeEditableText,
} from "@devsbucket/shared/editing";
import { itemIdSchema } from "@devsbucket/shared/item";
import { getObject, itemKey, putObject } from "@devsbucket/storage/objects";
import { type Document, Hocuspocus } from "@hocuspocus/server";
import type { WebSocket } from "ws";
import * as Y from "yjs";
import { log } from "./log.ts";
import { collabMode } from "./mode.ts";

// Live editing (Phase 4, decision 0013): Hocuspocus keeps one Yjs document
// per open text file and syncs it between everyone editing it. It runs in
// this server, on /collab; index.ts has already checked the Origin and the
// session. The document's name is the file's id.

type Context = { userId: string };

// An error Hocuspocus turns into "permission denied" with this reason, so
// the browser can say why.
const refuse = (reason: CollabRefusal) => Object.assign(new Error(reason), { reason });

const modeFor = async (userId: string, itemId: string) => {
  if (!itemIdSchema.safeParse(itemId).success) {
    return null;
  }
  const [access, file] = await Promise.all([getAccess(userId, itemId), getItem(itemId)]);
  const full = file ? await isStorageFull(file.ownerId) : false;
  return collabMode(access, file, full);
};

// Who changed each open file in this editing session (until it unloads):
// the versions' authors and the "edited" activity.
const sessionAuthors = new Map<string, Set<string>>();

const reply = (message: CollabReply) => JSON.stringify(message);

// The file's text as it was before anyone edited it here: version 1.
const storedText = async (itemId: string) => {
  const file = await getItem(itemId);
  const bytes = file?.size ? await getObject(itemKey(itemId)) : new Uint8Array();
  return decodeEditableText(bytes) ?? "";
};

// Saves the live text as a version (decision 0015), then rewrites the file
// in storage so downloads and previews match it, and tells everyone with
// the file open. If storage fails, the version still holds the text and
// the next save writes the file again.
const saveFromDocument = async (
  documentName: string,
  document: Document,
  version: { kind: "auto" } | { kind: "named"; message: string; savedBy: string },
) => {
  const text = document.getText(COLLAB_TEXT).toString();
  const result = await saveVersion({
    itemId: documentName,
    text,
    firstText: () => storedText(documentName),
    authors: [...(sessionAuthors.get(documentName) ?? [])],
    ...version,
  });
  if (result.saved) {
    const file = await getItem(documentName);
    await putObject({
      key: itemKey(documentName),
      body: new TextEncoder().encode(text),
      contentType: file?.mimeType ?? "text/plain",
    }).catch((error) => log(`couldn't write ${documentName} to storage: ${error}`));
    document.broadcastStateless(reply({ type: "versions-changed" }));
  }
  return result;
};

export const hocuspocus = new Hocuspocus<Context>({
  quiet: true,
  // The live state is saved 2 s after the last change, at least every 10 s
  // while people type, and at once when the last person leaves.
  debounce: 2_000,
  maxDebounce: 10_000,
  unloadImmediately: true,

  // Before the document loads: refused, read-only or editable. The browser
  // sends a placeholder token; who it is comes from the session cookie.
  onAuthenticate: async ({ context, documentName, connectionConfig }) => {
    const mode = await modeFor(context.userId, documentName);
    if (!mode) {
      throw refuse("no-access");
    }
    connectionConfig.readOnly = mode === "read-only";
  },

  // The saved live state, or (first time) the file's text from storage.
  onLoadDocument: async ({ document, documentName }) => {
    const state = await getCollabState(documentName);
    if (state) {
      Y.applyUpdate(document, state);
      return;
    }
    const file = await getItem(documentName);
    const bytes = file?.size ? await getObject(itemKey(documentName)) : new Uint8Array();
    const text = decodeEditableText(bytes);
    if (text === null) {
      throw refuse("not-text");
    }
    document.getText(COLLAB_TEXT).insert(0, text);
  },

  onStoreDocument: async ({ document, documentName }) => {
    await saveCollabState(documentName, Y.encodeStateAsUpdate(document));
  },

  // A change from a connection (read-only ones can't change anything).
  onChange: async ({ documentName, context }) => {
    if (!context?.userId) return;
    const authors = sessionAuthors.get(documentName) ?? new Set();
    authors.add(context.userId);
    sessionAuthors.set(documentName, authors);
  },

  // The last person left (after the final save): an automatic version, if
  // anyone changed the text. Errors are caught: a throw here would keep the
  // document loaded.
  beforeUnloadDocument: async ({ documentName, document }) => {
    try {
      if (sessionAuthors.get(documentName)?.size) {
        await saveFromDocument(documentName, document, { kind: "auto" });
      }
    } catch (error) {
      log(`couldn't save a version of ${documentName}: ${error}`);
    } finally {
      sessionAuthors.delete(documentName);
    }
  },

  // "Save version" from the editor: checked like any action (decision 0013).
  onStateless: async ({ connection, documentName, document, payload }) => {
    let request: unknown;
    try {
      request = JSON.parse(payload);
    } catch {
      return;
    }
    const parsed = collabRequestSchema.safeParse(request);
    if (!parsed.success) {
      const error = parsed.error.issues[0]?.message ?? "Invalid request";
      connection.sendStateless(reply({ type: "version-error", error }));
      return;
    }
    const { userId } = connection.context as Context;
    if (connection.readOnly || (await modeFor(userId, documentName)) !== "edit") {
      const error = "You can't save versions of this file.";
      connection.sendStateless(reply({ type: "version-error", error }));
      return;
    }
    try {
      const result = await saveFromDocument(documentName, document, {
        kind: "named",
        message: parsed.data.message,
        savedBy: userId,
      });
      connection.sendStateless(
        reply(
          result.number === null
            ? { type: "version-error", error: "This file no longer exists." }
            : { type: result.saved ? "version-saved" : "version-unchanged", number: result.number },
        ),
      );
    } catch (error) {
      log(`couldn't save a version of ${documentName}: ${error}`);
      connection.sendStateless(
        reply({ type: "version-error", error: "Couldn't save. Try again." }),
      );
    }
  },
});

// Hands a /collab socket to Hocuspocus. Hocuspocus 4 doesn't listen on the
// socket itself: we pass every message and the close on.
export const handleCollab = (socket: WebSocket, request: IncomingMessage, userId: string) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(name, value);
  }
  const url = new URL(request.url ?? "/", "http://realtime");
  const connection = hocuspocus.handleConnection(socket, new Request(url, { headers }), {
    userId,
  });
  socket.on("message", (data: Buffer) => connection.handleMessage(new Uint8Array(data)));
  socket.on("close", (code, reason) => {
    connection.handleClose({ code, reason: reason.toString() });
  });
};

// Checks open connections again (all of them, or only these people's):
// one whose rights changed is closed, and the browser reconnects with the
// new ones (read-only, editable, or refused).
export const recheckCollab = async (userIds?: Set<string>) => {
  for (const [documentName, document] of hocuspocus.documents) {
    for (const connection of document.connections.keys()) {
      const { userId } = connection.context;
      if (userIds && !userIds.has(userId)) continue;
      const mode = await modeFor(userId, documentName);
      if (mode === null || (mode === "read-only") !== connection.readOnly) {
        log(`closing ${userId} on ${documentName}: access changed`);
        connection.webSocket.close(4000, "Access changed");
      }
    }
  }
};

// On shutdown: close everyone and wait (up to 5 s) until every document is
// saved and unloaded, like Hocuspocus's own Server.destroy().
export const stopCollab = async () => {
  hocuspocus.closeConnections();
  hocuspocus.flushPendingStores();
  for (let waited = 0; hocuspocus.getDocumentsCount() > 0 && waited < 5_000; waited += 100) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};
