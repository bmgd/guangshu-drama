CREATE TABLE "produce_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"step" text NOT NULL,
	"payload" text,
	"updated_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "produce_checkpoints_episode_id_unique" UNIQUE("episode_id")
);
--> statement-breakpoint
CREATE INDEX "idx_produce_checkpoints_episode" ON "produce_checkpoints" USING btree ("episode_id");
