import { z } from "zod";
import type { ActivityMetadata, LoggedAction } from "./activity.ts";
import { itemIdSchema } from "./item.ts";
import { roleLabel } from "./sharing.ts";

// The activity panel (Phase 5, decision 0017): one line per activity row,
// after the actor's name ("Ada" + "renamed it from …"). Rows hold ids, not
// names, so the caller passes the names it looked up: people and folders.

// One row as the panel gets it: the action and its own metadata shape.
export type ActivityLine = {
  [A in LoggedAction]: { action: A; actorId: string | null; metadata: ActivityMetadata[A] };
}[LoggedAction];

const quoted = (name: string) => `"${name}"`;

export const activityText = (line: ActivityLine, names: Record<string, string>) => {
  const person = (id: string) => names[id] ?? "a removed account";
  const folder = (id: string | null) =>
    id === null ? "My Drive" : quoted(names[id] ?? "a folder");
  const as = (role: "editor" | "viewer") => roleLabel(role);
  const until = (expiresAt: string | null) =>
    expiresAt === null ? "" : `, until ${expiresAt.slice(0, 10)}`;
  switch (line.action) {
    case "created":
      return "created it";
    case "uploaded":
      return "uploaded it";
    case "renamed":
      return `renamed it from ${quoted(line.metadata.from)} to ${quoted(line.metadata.to)}`;
    case "moved":
      return `moved it from ${folder(line.metadata.from)} to ${folder(line.metadata.to)}`;
    case "trashed":
      return "moved it to the trash";
    case "restored":
      return line.metadata.movedToTop
        ? "restored it from the trash, to the top of My Drive"
        : "restored it from the trash";
    case "deleted_forever":
      return `deleted ${quoted(line.metadata.name)} forever`;
    case "downloaded":
      return "downloaded it";
    case "shared":
      return `shared it with ${person(line.metadata.userId)} as ${as(line.metadata.role)}`;
    case "access_changed":
      return `changed ${person(line.metadata.userId)}'s access from ${as(line.metadata.from)} to ${as(line.metadata.to)}`;
    case "access_removed":
      return line.metadata.userId === line.actorId
        ? "removed it from their Shared with me"
        : `removed ${person(line.metadata.userId)}'s access`;
    case "settings_changed":
      return line.metadata.value ? "let Editors share it" : "stopped Editors from sharing it";
    case "link_created":
      return `created a share link for ${as(line.metadata.role)}s${until(line.metadata.expiresAt)}`;
    case "link_changed":
      return `changed the share link to ${as(line.metadata.role)}s${until(line.metadata.expiresAt)}`;
    case "link_disabled":
      return "turned off the share link";
    case "link_opened":
      return `opened the share link (${as(line.metadata.role)})`;
    case "access_requested":
      return `asked for ${as(line.metadata.role)} access`;
    case "access_approved":
      return `gave ${person(line.metadata.userId)} ${as(line.metadata.role)} access (request approved)`;
    case "access_denied":
      return `denied ${person(line.metadata.userId)}'s access request`;
    case "ownership_offered":
      return `offered ownership to ${person(line.metadata.toUserId)}`;
    case "ownership_transferred":
      return `became the owner, from ${person(line.metadata.fromUserId)}`;
    case "edited":
      return line.metadata.versionNumber === null
        ? "edited it"
        : `edited it (version ${line.metadata.versionNumber})`;
    case "version_saved":
      return `saved version ${line.metadata.versionNumber}: ${quoted(line.metadata.message)}`;
    case "version_restored":
      return `restored version ${line.metadata.from} (now version ${line.metadata.versionNumber})`;
    default: {
      // A new action without a line here fails the typecheck.
      const unknown: never = line;
      return String(unknown);
    }
  }
};

// The ids in a row's metadata whose names the line needs: people, and
// folders for moves.
export const activityNameIds = (line: ActivityLine) => {
  const people: string[] = [];
  const folders: string[] = [];
  const metadata = line.metadata as Record<string, unknown>;
  for (const key of ["userId", "toUserId", "fromUserId"]) {
    if (typeof metadata[key] === "string") people.push(metadata[key]);
  }
  if (line.action === "moved") {
    for (const id of [line.metadata.from, line.metadata.to]) {
      if (id !== null) folders.push(id);
    }
  }
  return { people, folders };
};

// "Show more": the last row's time (Postgres's own text, to the
// microsecond, so no row is skipped or shown twice) and id.
export const activityCursorSchema = z.object({
  at: z.string().regex(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d{1,6})?[+-]\d\d(:\d\d)?$/),
  id: itemIdSchema,
});

export type ActivityCursor = z.infer<typeof activityCursorSchema>;

export const activityPageSchema = z.object({
  itemId: itemIdSchema,
  cursor: activityCursorSchema.nullable(),
});
