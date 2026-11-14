CREATE TABLE "share_link_visits" (
	"link_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"first_opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_link_visits_link_id_user_id_pk" PRIMARY KEY("link_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token"),
	CONSTRAINT "share_links_role_check" CHECK ("share_links"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_action_check";--> statement-breakpoint
ALTER TABLE "share_link_visits" ADD CONSTRAINT "share_link_visits_link_id_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link_visits" ADD CONSTRAINT "share_link_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_link_visits_user_id_idx" ON "share_link_visits" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_active_item_idx" ON "share_links" USING btree ("item_id") WHERE "share_links"."disabled_at" is null;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_action_check" CHECK ("activities"."action" in ('created', 'uploaded', 'renamed', 'moved', 'trashed', 'restored', 'deleted_forever', 'downloaded', 'shared', 'access_changed', 'access_removed', 'link_created', 'link_disabled', 'link_changed', 'link_opened', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'settings_changed'));

--> statement-breakpoint
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
-- Otherwise the highest of their grants and their visits to active share
-- links (not disabled, not expired) on the item or a folder above it.
CREATE OR REPLACE FUNCTION item_access(p_user uuid, p_item uuid)
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
  -- Every role this user has on the chain: grants, and active link visits.
  roles AS (
    SELECT p.role
    FROM item_permissions p
    JOIN chain c ON c.id = p.item_id
    WHERE p.user_id = p_user
    UNION ALL
    SELECT l.role
    FROM share_link_visits v
    JOIN share_links l ON l.id = v.link_id
    JOIN chain c ON c.id = l.item_id
    WHERE v.user_id = p_user
      AND l.disabled_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
  ),
  -- 2 = editor, 1 = viewer, null = nothing on the chain.
  granted AS (
    SELECT max(CASE r.role WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 END) AS level
    FROM roles r
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