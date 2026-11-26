CREATE TABLE "team_email_mailbox" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'shared' NOT NULL,
	"connected_email" varchar(254),
	"encrypted_refresh_token" text,
	"oauth_state_hash" varchar(64),
	"oauth_state_expires_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_email_mailbox" ADD CONSTRAINT "team_email_mailbox_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;