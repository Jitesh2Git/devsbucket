ALTER TABLE "notification_prefs" DROP CONSTRAINT "notification_prefs_type_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "versions_size";--> statement-breakpoint
-- Decision 0015: no editing notifications. Rows of the removed types would
-- fail the new checks (a switch someone turned off is a row).
DELETE FROM "notification_prefs" WHERE "type" IN ('file_edited', 'version_restored');--> statement-breakpoint
DELETE FROM "notifications" WHERE "type" IN ('file_edited', 'version_restored');--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_type_check" CHECK ("notification_prefs"."type" in ('shared', 'access_changed', 'access_removed', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'files_added', 'trashed', 'restored', 'storage_80', 'storage_95', 'storage_full', 'trash_emptying', 'invite_used', 'r2_ops_70', 'r2_ops_90'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" in ('shared', 'access_changed', 'access_removed', 'access_requested', 'access_approved', 'access_denied', 'ownership_offered', 'ownership_transferred', 'files_added', 'trashed', 'restored', 'storage_80', 'storage_95', 'storage_full', 'trash_emptying', 'invite_used', 'r2_ops_70', 'r2_ops_90'));