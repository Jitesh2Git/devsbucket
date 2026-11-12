DROP INDEX "items_parent_list_idx";--> statement-breakpoint
DROP INDEX "items_top_level_list_idx";--> statement-breakpoint
CREATE INDEX "items_parent_list_idx" ON "items" USING btree ("parent_id",("type" <> 'folder'),lower("name"),"id") WHERE "items"."trashed_at" is null;--> statement-breakpoint
CREATE INDEX "items_top_level_list_idx" ON "items" USING btree ("owner_id",("type" <> 'folder'),lower("name"),"id") WHERE "items"."parent_id" is null and "items"."trashed_at" is null;