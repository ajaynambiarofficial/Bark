ALTER TABLE "services" ALTER COLUMN "duration_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "booking_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;