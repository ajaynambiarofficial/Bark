CREATE TABLE "application_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"secret" boolean DEFAULT false NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" varchar(80) NOT NULL,
	"clinic_id" uuid,
	"owner_id" uuid,
	"team" varchar(120),
	"priority" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(64) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"request_id" uuid,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authentication_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" varchar(60) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"assigned_staff_id" uuid,
	"status" varchar(40) DEFAULT 'confirmed' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"source" varchar(60) DEFAULT 'bark' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"cancellation_reason" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"cancelled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(160) NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"description" text DEFAULT '' NOT NULL,
	"clinic_id" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinic_services" (
	"clinic_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"price" numeric(12, 2),
	"duration_minutes" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "clinic_services_clinic_id_service_id_pk" PRIMARY KEY("clinic_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(160) NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Asia/Calcutta' NOT NULL,
	"phone" varchar(30),
	"email" varchar(254),
	"operating_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_ref" varchar(100),
	"name" varchar(160) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"email" varchar(254),
	"pet_name" varchar(120),
	"pet_species" varchar(80),
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escalation_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escalation_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"visibility" varchar(30) DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_ownership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escalation_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(40) NOT NULL,
	"issue_type" varchar(40) NOT NULL,
	"reference_type" varchar(40) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(80) NOT NULL,
	"module" varchar(100),
	"channel" varchar(100),
	"service" varchar(160),
	"issue_subtype" varchar(180) NOT NULL,
	"custom_issue" text,
	"linked_ticket_id" varchar(80),
	"customer_phone_masked" varchar(30),
	"appointment_id" varchar(80),
	"clinic_id" uuid,
	"reporter_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"originating_department" varchar(120) NOT NULL,
	"responsible_department" varchar(120) NOT NULL,
	"assigned_team" varchar(120) NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"priority" varchar(20) NOT NULL,
	"status" varchar(40) DEFAULT 'Assigned' NOT NULL,
	"sla_policy_id" uuid,
	"sla_due_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escalations_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"channel" varchar(30) NOT NULL,
	"subject" varchar(240),
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" varchar(30) NOT NULL,
	"template_key" varchar(80) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"module" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"clearance_level" integer DEFAULT 10 NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(80) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"issue_type" varchar(40) NOT NULL,
	"category" varchar(80),
	"priority" varchar(20) NOT NULL,
	"target_minutes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_clinics" (
	"user_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"access_level" varchar(30) DEFAULT 'read' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_clinics_user_id_clinic_id_pk" PRIMARY KEY("user_id","clinic_id")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_id_pk" PRIMARY KEY("user_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" varchar(80) NOT NULL,
	"email" varchar(254) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" uuid NOT NULL,
	"department" varchar(120) NOT NULL,
	"assignment" varchar(160) NOT NULL,
	"account_status" varchar(30) DEFAULT 'active' NOT NULL,
	"clearance_level" integer DEFAULT 10 NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_services" ADD CONSTRAINT "clinic_services_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_services" ADD CONSTRAINT "clinic_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_activity" ADD CONSTRAINT "escalation_activity_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_activity" ADD CONSTRAINT "escalation_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_comments" ADD CONSTRAINT "escalation_comments_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_comments" ADD CONSTRAINT "escalation_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_ownership_history" ADD CONSTRAINT "escalation_ownership_history_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_ownership_history" ADD CONSTRAINT "escalation_ownership_history_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_ownership_history" ADD CONSTRAINT "escalation_ownership_history_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_clinics" ADD CONSTRAINT "user_clinics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_clinics" ADD CONSTRAINT "user_clinics_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "auth_attempt_lookup_idx" ON "authentication_attempts" USING btree ("email","ip_address","attempted_at");--> statement-breakpoint
CREATE INDEX "booking_history_booking_idx" ON "booking_history" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_clinic_time_idx" ON "bookings" USING btree ("clinic_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_staff_time_idx" ON "bookings" USING btree ("assigned_staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "calendar_start_idx" ON "calendar_events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "calendar_clinic_idx" ON "calendar_events" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_external_ref_idx" ON "customers" USING btree ("external_ref");--> statement-breakpoint
CREATE INDEX "escalation_activity_idx" ON "escalation_activity" USING btree ("escalation_id","created_at");--> statement-breakpoint
CREATE INDEX "escalation_comments_idx" ON "escalation_comments" USING btree ("escalation_id","created_at");--> statement-breakpoint
CREATE INDEX "escalation_ownership_idx" ON "escalation_ownership_history" USING btree ("escalation_id","assigned_at");--> statement-breakpoint
CREATE INDEX "escalations_owner_status_idx" ON "escalations" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "escalations_clinic_idx" ON "escalations" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "escalations_sla_idx" ON "escalations" USING btree ("sla_due_at");--> statement-breakpoint
CREATE INDEX "notifications_delivery_idx" ON "notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("account_status");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_time" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_no_overlap" EXCLUDE USING gist (
  "assigned_staff_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("assigned_staff_id" IS NOT NULL AND "deleted_at" IS NULL AND "status" IN ('confirmed', 'rescheduled'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
