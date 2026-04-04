CREATE TABLE "release_cache" (
	"releaseId" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"refreshedAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "release_cache_expires_at_idx" ON "release_cache" USING btree ("expiresAt");--> statement-breakpoint
