CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"storage_key" text NOT NULL,
	"public_url" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_dim" integer NOT NULL,
	"status" text NOT NULL,
	"embedding" vector(3072),
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "images_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_embedding_hnsw_idx" ON "images" USING hnsw ("embedding" vector_cosine_ops) WHERE "embedding" IS NOT NULL;
