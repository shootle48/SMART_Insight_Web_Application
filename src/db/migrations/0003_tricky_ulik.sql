ALTER TABLE "points" ADD COLUMN "alarm_low" double precision;--> statement-breakpoint
ALTER TABLE "points" ADD COLUMN "alarm_high" double precision;--> statement-breakpoint
ALTER TABLE "points" ADD COLUMN "alarm_state" text;--> statement-breakpoint
ALTER TABLE "points" ADD COLUMN "alarm_since" timestamp with time zone;