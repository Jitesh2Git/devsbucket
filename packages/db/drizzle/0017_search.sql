-- Added by hand before applying: the index below needs the pg_trgm extension
-- (a trusted extension, so the database owner may create it).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "items_name_trgm_idx" ON "items" USING gin (lower("name") gin_trgm_ops);