CREATE TABLE "stored_trending_album" (
	"mode" text NOT NULL,
	"albumId" text NOT NULL,
	"rank" integer NOT NULL,
	"name" text NOT NULL,
	"artists" jsonb NOT NULL,
	"releaseDate" text,
	"releaseYear" integer,
	"cover" text DEFAULT '' NOT NULL,
	"totalTracks" integer DEFAULT 0 NOT NULL,
	"albumType" text DEFAULT 'Release' NOT NULL,
	"label" text,
	"popularity" integer DEFAULT 0 NOT NULL,
	"externalUrls" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"communityRating" real DEFAULT 0 NOT NULL,
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"firstSeenAt" timestamp with time zone NOT NULL,
	"lastSeenAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "stored_trending_album_pk" PRIMARY KEY("mode","albumId")
);
--> statement-breakpoint
CREATE INDEX "stored_trending_album_mode_last_seen_idx" ON "stored_trending_album" USING btree ("mode","lastSeenAt");
--> statement-breakpoint
CREATE INDEX "stored_trending_album_mode_rank_idx" ON "stored_trending_album" USING btree ("mode","rank");
