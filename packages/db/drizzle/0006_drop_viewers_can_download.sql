-- "Viewers can download" is gone (decision 0012): a preview sends the bytes
-- to the browser anyway, so every role can download.
-- item_access() returns one column less, and Postgres can't change a
-- function's result columns in place: drop it, then create it again.
DROP FUNCTION item_access(uuid, uuid);--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "viewers_can_download";--> statement-breakpoint
-- item_access(user, item): the one place roles are resolved (decisions 0002
-- and 0008). Web, worker and realtime all call it, through
-- packages/db/src/access.ts.
--
-- One row when the item exists, none when it doesn't:
--   role                 'owner', 'editor', 'viewer', or null (no access)
--   editors_can_share    false if the item or any folder above it says so
--   trashed              the item is in the trash
--
-- Owner: the tree is theirs (everything in a tree has the same owner).
-- Otherwise the highest grant they have on the item or a folder above it.
-- Share links join this in step 7 (CREATE OR REPLACE in a new migration).
CREATE FUNCTION item_access(p_user uuid, p_item uuid)
RETURNS TABLE (
  role text,
  editors_can_share boolean,
  trashed boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE chain AS (
    SELECT id, parent_id, owner_id, editors_can_share, trashed_at, 0 AS depth
    FROM items
    WHERE id = p_item
    UNION ALL
    SELECT i.id, i.parent_id, i.owner_id, i.editors_can_share, i.trashed_at, c.depth + 1
    FROM items i
    JOIN chain c ON i.id = c.parent_id
    -- A guard: moves never create cycles, but a loop must never hang a query.
    WHERE c.depth < 100
  ),
  item AS (
    SELECT owner_id, trashed_at FROM chain WHERE depth = 0
  ),
  -- 2 = editor, 1 = viewer, null = no grant on the chain.
  granted AS (
    SELECT max(CASE p.role WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 END) AS level
    FROM item_permissions p
    JOIN chain c ON c.id = p.item_id
    WHERE p.user_id = p_user
  )
  SELECT
    CASE
      WHEN item.owner_id = p_user THEN 'owner'
      WHEN granted.level = 2 THEN 'editor'
      WHEN granted.level = 1 THEN 'viewer'
    END,
    (SELECT bool_and(c.editors_can_share) FROM chain c),
    item.trashed_at IS NOT NULL
  FROM item, granted
$$;