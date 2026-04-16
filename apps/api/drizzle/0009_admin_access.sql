CREATE TABLE "admin_user" (
	"userId" text PRIMARY KEY NOT NULL,
	"grantedByUserId" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_grantedByUserId_user_id_fk" FOREIGN KEY ("grantedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "admin_user_granted_by_idx" ON "admin_user" USING btree ("grantedByUserId");
