CREATE TABLE "item_mutes" (
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_mutes_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "notification_prefs_user_id_type_pk" PRIMARY KEY("user_id","type"),
	CONSTRAINT "notification_prefs_type_check" CHECK ("notification_prefs"."type" in ('shared', 'access_changed', 'access_removed', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'files_added', 'trashed', 'restored', 'storage_80', 'storage_95', 'storage_full', 'trash_emptying', 'invite_used', 'r2_ops_70', 'r2_ops_90'))
);
--> statement-breakpoint
ALTER TABLE "item_mutes" ADD CONSTRAINT "item_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_mutes" ADD CONSTRAINT "item_mutes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;