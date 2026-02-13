CREATE TABLE "featured_cache" (
	"mode" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"refreshedAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"queryHash" text PRIMARY KEY NOT NULL,
	"normalizedQuery" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"refreshedAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "featured_cache_expires_at_idx" ON "featured_cache" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "search_cache_expires_at_idx" ON "search_cache" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "search_cache_normalized_query_idx" ON "search_cache" USING btree ("normalizedQuery");