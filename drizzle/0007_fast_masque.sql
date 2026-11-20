CREATE TABLE "notice_acknowledgements" (
	"notice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notice_acknowledgements_notice_id_user_id_pk" PRIMARY KEY("notice_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notice_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(24) DEFAULT 'general' NOT NULL,
	"cadence" varchar(16) DEFAULT 'once' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notice_acknowledgements" ADD CONSTRAINT "notice_acknowledgements_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_acknowledgements" ADD CONSTRAINT "notice_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_acknowledgements_user_idx" ON "notice_acknowledgements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notice_comments_notice_created_idx" ON "notice_comments" USING btree ("notice_id","created_at");--> statement-breakpoint
CREATE INDEX "notices_active_expiry_idx" ON "notices" USING btree ("archived_at","expires_at");--> statement-breakpoint
CREATE INDEX "notices_created_idx" ON "notices" USING btree ("created_at");