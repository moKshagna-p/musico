CREATE INDEX IF NOT EXISTS "user_rating_user_updated_at_idx"
ON "user_rating" ("userId", "updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_list_user_updated_at_idx"
ON "user_list" ("userId", "updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_list_album_list_added_at_idx"
ON "user_list_album" ("listId", "addedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_review_user_updated_at_idx"
ON "user_review" ("userId", "updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_user_type_created_at_idx"
ON "activity" ("userId", "type", "createdAt");
