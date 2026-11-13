CREATE TABLE "item_permissions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_permissions_item_id_user_id_unique" UNIQUE("item_id","user_id"),
	CONSTRAINT "item_permissions_role_check" CHECK ("item_permissions"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "editors_can_share" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "viewers_can_download" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "item_permissions" ADD CONSTRAINT "item_permissions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_permissions" ADD CONSTRAINT "item_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_permissions" ADD CONSTRAINT "item_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_permissions_user_id_idx" ON "item_permissions" USING btree ("user_id");