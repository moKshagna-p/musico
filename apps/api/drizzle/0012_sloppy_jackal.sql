CREATE TABLE "user_avatar" (
	"userId" text PRIMARY KEY NOT NULL,
	"contentType" text NOT NULL,
	"data" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;