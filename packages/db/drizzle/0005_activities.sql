CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_action_check" CHECK ("activities"."action" in ('created', 'uploaded', 'renamed', 'moved', 'trashed', 'restored', 'deleted_forever', 'downloaded', 'shared', 'access_changed', 'access_removed', 'link_created', 'link_disabled', 'link_opened', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'settings_changed'))
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_item_id_created_at_idx" ON "activities" USING btree ("item_id","created_at" DESC NULLS LAST);