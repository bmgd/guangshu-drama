CREATE TABLE "media_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"field" text NOT NULL,
	"url" text NOT NULL,
	"local_path" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"drama_id" integer,
	"episode_id" integer,
	"task_id" integer,
	"service_type" text NOT NULL,
	"provider" text,
	"model" text,
	"unit_type" text NOT NULL,
	"units" text NOT NULL,
	"estimated_cost" text,
	"actual_cost" text,
	"currency" text DEFAULT 'CNY',
	"meta" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dramas" ADD COLUMN "content_source" text DEFAULT 'novel';--> statement-breakpoint
ALTER TABLE "dramas" ADD COLUMN "creation_type" text DEFAULT 'drama';--> statement-breakpoint
ALTER TABLE "dramas" ADD COLUMN "generation_mode" text DEFAULT 'storyboard';--> statement-breakpoint
ALTER TABLE "storyboards" ADD COLUMN "narration_text" text;--> statement-breakpoint
ALTER TABLE "storyboards" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "storyboards" ADD COLUMN "input_fingerprint" text;--> statement-breakpoint
CREATE INDEX "idx_media_versions_entity" ON "media_versions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_usage_records_drama" ON "usage_records" USING btree ("drama_id");--> statement-breakpoint
CREATE INDEX "idx_usage_records_service" ON "usage_records" USING btree ("service_type");