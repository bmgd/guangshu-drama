ALTER TABLE "sys_task" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "sys_task" ADD COLUMN "progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sys_task" ADD COLUMN "config_snapshot" text;--> statement-breakpoint
CREATE INDEX "idx_sys_task_idempotency" ON "sys_task" USING btree ("idempotency_key");--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"event" text NOT NULL,
	"message" text,
	"progress" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_task_events_task" ON "task_events" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "review_status" text DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "review_status" text DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "props" ADD COLUMN "review_status" text DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "storyboards" ADD COLUMN "locked" boolean DEFAULT false;
