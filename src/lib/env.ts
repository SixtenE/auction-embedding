import { z } from "zod";
import { EMBEDDING_DIMENSIONS } from "../constants/embedding.js";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-2-preview"),
  EMBEDDING_DIM: z.coerce
    .number()
    .default(EMBEDDING_DIMENSIONS)
    .refine((n) => n === EMBEDDING_DIMENSIONS, {
      message: `EMBEDDING_DIM must be ${EMBEDDING_DIMENSIONS} to match the configured embedding size`,
    }),
  QDRANT_HOST: z.string().min(1).default("localhost"),
  QDRANT_PORT: z.coerce.number().min(1).default(6333),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().min(1).default("images"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().min(60).max(604800).default(3600),
  MAX_UPLOAD_BYTES: z.coerce.number().default(10 * 1024 * 1024),
  DEFAULT_TOP_K: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  cached = parsed.data;
  return parsed.data;
}
