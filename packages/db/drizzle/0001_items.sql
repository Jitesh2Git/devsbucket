CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"parent_id" uuid,
	"created_by" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size" bigint,
	"storage_key" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"upload_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trashed_at" timestamp with time zone,
	"trashed_by" uuid,
	"trash_root" boolean DEFAULT false NOT NULL,
	CONSTRAINT "items_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "items_type_check" CHECK ("items"."type" in ('folder', 'file', 'note')),
	CONSTRAINT "items_status_check" CHECK ("items"."status" in ('pending', 'ready')),
	CONSTRAINT "items_name_length_check" CHECK (char_length("items"."name") between 1 and 255),
	CONSTRAINT "items_not_own_parent_check" CHECK ("items"."parent_id" <> "items"."id")
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"month" text PRIMARY KEY NOT NULL,
	"class_a_ops" bigint DEFAULT 0 NOT NULL,
	"class_b_ops" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_month_check" CHECK ("usage_counters"."month" ~ '^[0-9]{4}-[0-9]{2}$')
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_parent_id_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_trashed_by_users_id_fk" FOREIGN KEY ("trashed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "items_unique_name_idx" ON "items" USING btree ("owner_id",coalesce("parent_id", "owner_id"),lower("name")) WHERE "items"."trashed_at" is null;--> statement-breakpoint
CREATE INDEX "items_parent_list_idx" ON "items" USING btree ("parent_id","type",lower("name"),"id");--> statement-breakpoint
CREATE INDEX "items_top_level_list_idx" ON "items" USING btree ("owner_id","type",lower("name"),"id") WHERE "items"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "items_trash_idx" ON "items" USING btree ("owner_id","trashed_at") WHERE "items"."trash_root";--> statement-breakpoint
CREATE INDEX "items_pending_idx" ON "items" USING btree ("status","created_at") WHERE "items"."status" = 'pending';