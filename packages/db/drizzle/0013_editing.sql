CREATE TABLE "collab_states" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"state" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"content" text NOT NULL,
	"size" bigint NOT NULL,
	"authors" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"restored_from" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_versions_item_number_unique" UNIQUE("item_id","number"),
	CONSTRAINT "item_versions_kind_check" CHECK ("item_versions"."kind" in ('auto', 'named', 'restore')),
	CONSTRAINT "item_versions_message_check" CHECK ("item_versions"."message" is null or char_length("item_versions"."message") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_action_check";--> statement-breakpoint
ALTER TABLE "notification_prefs" DROP CONSTRAINT "notification_prefs_type_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "versions_size" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collab_states" ADD CONSTRAINT "collab_states_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_restored_from_item_versions_id_fk" FOREIGN KEY ("restored_from") REFERENCES "public"."item_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_versions_item_created_idx" ON "item_versions" USING btree ("item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_action_check" CHECK ("activities"."action" in ('created', 'uploaded', 'renamed', 'moved', 'trashed', 'restored', 'deleted_forever', 'downloaded', 'shared', 'access_changed', 'access_removed', 'link_created', 'link_disabled', 'link_changed', 'link_opened', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'settings_changed', 'edited', 'version_saved', 'version_restored'));--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_type_check" CHECK ("notification_prefs"."type" in ('shared', 'access_changed', 'access_removed', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'files_added', 'trashed', 'restored', 'file_edited', 'version_restored', 'storage_80', 'storage_95', 'storage_full', 'trash_emptying', 'invite_used', 'r2_ops_70', 'r2_ops_90'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" in ('shared', 'access_changed', 'access_removed', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'files_added', 'trashed', 'restored', 'file_edited', 'version_restored', 'storage_80', 'storage_95', 'storage_full', 'trash_emptying', 'invite_used', 'r2_ops_70', 'r2_ops_90'));