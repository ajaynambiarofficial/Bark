CREATE TABLE "customer_health_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"record_type" varchar(60) NOT NULL,
	"title" varchar(180) NOT NULL,
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_number" varchar(80) NOT NULL,
	"title" varchar(180) NOT NULL,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(40) DEFAULT 'placed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "customer_pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"species" varchar(80) NOT NULL,
	"breed" varchar(120),
	"birth_date" timestamp with time zone,
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_health_records" ADD CONSTRAINT "customer_health_records_pet_id_customer_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."customer_pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD CONSTRAINT "customer_pets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_health_pet_idx" ON "customer_health_records" USING btree ("pet_id","recorded_at");--> statement-breakpoint
CREATE INDEX "customer_orders_customer_idx" ON "customer_orders" USING btree ("customer_id","ordered_at");--> statement-breakpoint
CREATE INDEX "customer_pets_customer_idx" ON "customer_pets" USING btree ("customer_id");