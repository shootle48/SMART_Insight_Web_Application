CREATE TABLE "devices" (
	"device_id" text PRIMARY KEY NOT NULL,
	"label" text,
	"status" text DEFAULT 'OFFLINE' NOT NULL,
	"status_changed_at" timestamp with time zone,
	"ai_service_status" text,
	"storage_usage_percent" integer,
	"software_version" text,
	"model_version" text,
	"last_heartbeat_at" timestamp with time zone,
	"last_frame_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points" (
	"point_id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"camera_id" text NOT NULL,
	"label" text,
	"unit" text,
	"kind" text NOT NULL,
	"fixture" jsonb,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"point_id" text NOT NULL,
	"device_id" text NOT NULL,
	"frame_id" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value_num" double precision,
	"value_text" text,
	"unit" text,
	"confidence" real,
	"quality" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "points" ADD CONSTRAINT "points_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_point_id_points_point_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("point_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_device_idx" ON "points" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "readings_point_time_idx" ON "readings" USING btree ("point_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "readings_captured_brin" ON "readings" USING brin ("captured_at");