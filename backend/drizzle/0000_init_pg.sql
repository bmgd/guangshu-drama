CREATE TABLE "ai_service_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_type" text NOT NULL,
	"provider" text,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text NOT NULL,
	"model" text,
	"endpoint" text,
	"query_endpoint" text,
	"priority" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"settings" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_service_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"service_type" text NOT NULL,
	"provider" text NOT NULL,
	"default_url" text,
	"preset_models" text,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"drama_id" integer,
	"episode_id" integer,
	"storyboard_id" integer,
	"storyboard_num" integer,
	"name" text,
	"description" text,
	"type" text,
	"category" text,
	"url" text,
	"thumbnail_url" text,
	"local_path" text,
	"file_size" integer,
	"mime_type" text,
	"width" integer,
	"height" integer,
	"duration" integer,
	"format" text,
	"image_gen_id" integer,
	"video_gen_id" integer,
	"is_favorite" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"drama_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"description" text,
	"appearance" text,
	"styling" text,
	"final_prompt" text,
	"personality" text,
	"image_url" text,
	"reference_images" text,
	"seed_value" text,
	"sort_order" integer,
	"local_path" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "dramas" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"genre" text,
	"style" text DEFAULT '3d',
	"aspect_ratio" text DEFAULT '16:9',
	"total_episodes" integer DEFAULT 1,
	"total_duration" integer DEFAULT 0,
	"status" text DEFAULT 'draft' NOT NULL,
	"thumbnail" text,
	"tags" text,
	"metadata" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "episode_characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_props" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"prop_id" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_scenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"scene_id" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"drama_id" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"script_content" text,
	"description" text,
	"duration" integer DEFAULT 0,
	"status" text DEFAULT 'draft',
	"video_url" text,
	"thumbnail" text,
	"image_config_id" integer,
	"video_config_id" integer,
	"resolution" text DEFAULT '720p',
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "props" (
	"id" serial PRIMARY KEY NOT NULL,
	"drama_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"description" text,
	"prompt" text,
	"final_prompt" text,
	"image_url" text,
	"reference_images" text,
	"local_path" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"drama_id" integer NOT NULL,
	"episode_id" integer,
	"location" text NOT NULL,
	"time" text NOT NULL,
	"prompt" text NOT NULL,
	"lighting" text,
	"final_prompt" text,
	"storyboard_count" integer DEFAULT 1,
	"image_url" text,
	"status" text DEFAULT 'pending',
	"local_path" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "storyboard_characters" (
	"storyboard_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	CONSTRAINT "storyboard_characters_storyboard_id_character_id_pk" PRIMARY KEY("storyboard_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "storyboard_props" (
	"storyboard_id" integer NOT NULL,
	"prop_id" integer NOT NULL,
	CONSTRAINT "storyboard_props_storyboard_id_prop_id_pk" PRIMARY KEY("storyboard_id","prop_id")
);
--> statement-breakpoint
CREATE TABLE "storyboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"scene_id" integer,
	"storyboard_number" integer NOT NULL,
	"title" text,
	"location" text,
	"time" text,
	"shot_type" text,
	"angle" text,
	"movement" text,
	"result" text,
	"atmosphere" text,
	"image_prompt" text,
	"video_prompt" text,
	"bgm_prompt" text,
	"sound_effect" text,
	"description" text,
	"duration" integer DEFAULT 0,
	"composed_image" text,
	"first_frame_image" text,
	"last_frame_image" text,
	"reference_images" text,
	"video_url" text,
	"subtitle_url" text,
	"composed_video_url" text,
	"status" text DEFAULT 'pending',
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "style_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"prompt" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "style_presets_value_unique" UNIQUE("value")
);
--> statement-breakpoint
CREATE TABLE "sys_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"storyboard_id" integer,
	"drama_id" integer,
	"scene_id" integer,
	"character_id" integer,
	"prop_id" integer,
	"provider" text,
	"prompt" text,
	"model" text,
	"params" text,
	"task_id" text,
	"result_url" text,
	"local_path" text,
	"status" text DEFAULT 'processing',
	"error_msg" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "video_merges" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer,
	"drama_id" integer,
	"title" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'pending',
	"scenes" text,
	"merged_url" text,
	"duration" integer,
	"task_id" text,
	"error_msg" text,
	"created_at" text NOT NULL,
	"completed_at" text,
	"deleted_at" text
);
--> statement-breakpoint
CREATE INDEX "idx_episode_characters_episode" ON "episode_characters" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "idx_episode_characters_character" ON "episode_characters" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_episode_props_episode" ON "episode_props" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "idx_episode_props_prop" ON "episode_props" USING btree ("prop_id");--> statement-breakpoint
CREATE INDEX "idx_episode_scenes_episode" ON "episode_scenes" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "idx_episode_scenes_scene" ON "episode_scenes" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "idx_sb_characters_character" ON "storyboard_characters" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_sb_props_prop" ON "storyboard_props" USING btree ("prop_id");--> statement-breakpoint
CREATE INDEX "idx_sys_task_type" ON "sys_task" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_sys_task_drama" ON "sys_task" USING btree ("drama_id");--> statement-breakpoint
CREATE INDEX "idx_sys_task_storyboard" ON "sys_task" USING btree ("storyboard_id");