ALTER TABLE "bookings" ADD COLUMN "pet_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "size" varchar(30);--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "coat_type" varchar(30);--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "sex" varchar(20);--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "reproductive_status" varchar(30);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pet_id_customer_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."customer_pets"("id") ON DELETE no action ON UPDATE no action;