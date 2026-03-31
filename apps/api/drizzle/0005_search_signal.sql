CREATE TABLE "user_search_trend" (
	"normalizedQuery" text PRIMARY KEY NOT NULL,
	"displayQuery" text NOT NULL,
	"searchCount" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"lastSearchedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_search_trend_last_searched_idx" ON "user_search_trend" USING btree ("lastSearchedAt");
--> statement-breakpoint
CREATE INDEX "user_search_trend_search_count_idx" ON "user_search_trend" USING btree ("searchCount");
