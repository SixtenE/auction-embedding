import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "../constants/embedding.js";

export { EMBEDDING_DIMENSIONS };

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  storageKey: text("storage_key").notNull().unique(),
  publicUrl: text("public_url").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  embeddingDim: integer("embedding_dim").notNull(),
  status: text("status").notNull().$type<"uploaded" | "embedding" | "indexed" | "failed">(),
  tags: jsonb("tags").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImageRow = typeof images.$inferSelect;
export type NewImageRow = typeof images.$inferInsert;
