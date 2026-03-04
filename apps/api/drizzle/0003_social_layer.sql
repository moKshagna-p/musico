-- Social layer migration: profiles, follows, reviews, activity feed

CREATE TYPE "public"."activity_type" AS ENUM('rated', 'reviewed', 'listed', 'followed');--> statement-breakpoint

CREATE TABLE "user_profile" (
	"userId" text PRIMARY KEY NOT NULL,
	"username" text,
	"bio" text DEFAULT '' NOT NULL,
	"isPublic" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);--> statement-breakpoint

CREATE TABLE "user_follow" (
	"id" text PRIMARY KEY NOT NULL,
	"followerId" text NOT NULL,
	"followingId" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);--> statement-breakpoint

CREATE TABLE "user_review" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"albumId" text NOT NULL,
	"content" text NOT NULL,
	"albumName" text DEFAULT '' NOT NULL,
	"albumCover" text DEFAULT '' NOT NULL,
	"albumArtists" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);--> statement-breakpoint

CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"albumId" text,
	"albumName" text,
	"albumCover" text,
	"targetUserId" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);--> statement-breakpoint

ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_followerId_user_id_fk" FOREIGN KEY ("followerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_followingId_user_id_fk" FOREIGN KEY ("followingId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review" ADD CONSTRAINT "user_review_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_targetUserId_user_id_fk" FOREIGN KEY ("targetUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "user_profile_username_unique" ON "user_profile" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "user_follow_unique" ON "user_follow" USING btree ("followerId","followingId");--> statement-breakpoint
CREATE INDEX "user_follow_follower_idx" ON "user_follow" USING btree ("followerId");--> statement-breakpoint
CREATE INDEX "user_follow_following_idx" ON "user_follow" USING btree ("followingId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_review_user_album_unique" ON "user_review" USING btree ("userId","albumId");--> statement-breakpoint
CREATE INDEX "user_review_user_id_idx" ON "user_review" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_review_album_id_idx" ON "user_review" USING btree ("albumId");--> statement-breakpoint
CREATE INDEX "activity_user_id_created_at_idx" ON "activity" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "activity_created_at_idx" ON "activity" USING btree ("createdAt");
