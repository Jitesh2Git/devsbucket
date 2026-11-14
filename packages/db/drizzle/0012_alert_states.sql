CREATE TABLE "alert_states" (
	"key" text PRIMARY KEY NOT NULL,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL
);
