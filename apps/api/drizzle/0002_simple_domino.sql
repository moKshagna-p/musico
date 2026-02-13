CREATE TABLE "user_list" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_list_album" (
	"id" text PRIMARY KEY NOT NULL,
	"listId" text NOT NULL,
	"albumId" text NOT NULL,
	"name" text NOT NULL,
	"cover" text DEFAULT '' NOT NULL,
	"artists" jsonb NOT NULL,
	"releaseYear" integer,
	"addedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_rating" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"albumId" text NOT NULL,
	"rating" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_list" ADD CONSTRAINT "user_list_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_list_album" ADD CONSTRAINT "user_list_album_listId_user_list_id_fk" FOREIGN KEY ("listId") REFERENCES "public"."user_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rating" ADD CONSTRAINT "user_rating_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_list_user_id_idx" ON "user_list" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_list_user_name_unique" ON "user_list" USING btree ("userId","name");--> statement-breakpoint
CREATE INDEX "user_list_album_list_id_idx" ON "user_list_album" USING btree ("listId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_list_album_unique" ON "user_list_album" USING btree ("listId","albumId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_rating_user_album_unique" ON "user_rating" USING btree ("userId","albumId");--> statement-breakpoint
CREATE INDEX "user_rating_user_id_idx" ON "user_rating" USING btree ("userId");