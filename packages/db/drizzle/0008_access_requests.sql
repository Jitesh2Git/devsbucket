CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"role" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_requests_role_check" CHECK ("access_requests"."role" in ('editor', 'viewer')),
	CONSTRAINT "access_requests_status_check" CHECK ("access_requests"."status" in ('pending', 'approved', 'denied')),
	CONSTRAINT "access_requests_message_length_check" CHECK (char_length("access_requests"."message") <= 500)
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_pending_idx" ON "access_requests" USING btree ("item_id","requester_id") WHERE "access_requests"."status" = 'pending';