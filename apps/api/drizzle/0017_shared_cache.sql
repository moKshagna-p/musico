CREATE TABLE "shared_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "shared_cache_expires_at_idx" ON "shared_cache" USING btree ("expiresAt");