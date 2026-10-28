CREATE TABLE "review_media" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"reviewId" text,
	"kind" text NOT NULL,
	"key" text,
	"url" text,
	"size" integer DEFAULT 0 NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_reviewId_user_review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."user_review"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_media_review_id_idx" ON "review_media" USING btree ("reviewId");--> statement-breakpoint
CREATE INDEX "review_media_user_created_at_idx" ON "review_media" USING btree ("userId","createdAt");