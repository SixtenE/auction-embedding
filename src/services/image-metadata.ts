import { eq } from 'drizzle-orm'
import { EMBEDDING_DIMENSIONS } from '../constants/embedding.js'
import type { Database } from '../lib/db.js'
import { images, type ImageRow } from '../db/schema.js'
import type { Env } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { processImageBytes } from '../utils/image-processing.js'
import type { EmbeddingService } from './embeddings.js'
import type { StorageService } from './storage.js'

export type ImageMetadataService = {
  createIndexedImage(input: {
    originalFilename: string
    rawBytes: Uint8Array
    contentType: string
    storageKey: string
    tags?: Record<string, unknown> | null
  }): Promise<ImageRow>

  getById(id: string): Promise<ImageRow | undefined>

  deleteById(id: string): Promise<void>

  reindexImage(id: string): Promise<ImageRow>
}

export function createImageMetadataService(
  env: Env,
  db: Database,
  storage: StorageService,
  embeddings: EmbeddingService,
): ImageMetadataService {
  async function getById(id: string): Promise<ImageRow | undefined> {
    const [row] = await db.select().from(images).where(eq(images.id, id)).limit(1)
    return row
  }

  return {
    async createIndexedImage(input) {
      const {
        originalFilename,
        rawBytes,
        contentType,
        storageKey,
        tags = null,
      } = input

      const processed = await processImageBytes(env, rawBytes, contentType)
      const vector = await embeddings.embedImage({
        bytes: processed.bytes,
        mimeType: processed.mimeType,
      })

      const { url } = await storage.upload({
        key: storageKey,
        body: processed.bytes,
        contentType: processed.mimeType,
      })

      try {
        const [row] = await db
          .insert(images)
          .values({
            originalFilename,
            mimeType: processed.mimeType,
            fileSize: processed.bytes.byteLength,
            width: processed.width,
            height: processed.height,
            storageKey,
            publicUrl: url,
            embeddingModel: env.EMBEDDING_MODEL,
            embeddingDim: EMBEDDING_DIMENSIONS,
            status: 'indexed',
            embedding: vector,
            tags,
          })
          .returning()

        if (!row) {
          throw new AppError('Failed to insert image row', 500, 'DB_ERROR')
        }
        return row
      } catch (e) {
        try {
          await storage.delete(storageKey)
        } catch {
          /* best-effort cleanup */
        }
        throw e
      }
    },

    getById,

    async deleteById(id) {
      const row = await getById(id)
      if (!row) {
        throw new AppError('Image not found', 404, 'NOT_FOUND')
      }
      await db.delete(images).where(eq(images.id, id))
      try {
        await storage.delete(row.storageKey)
      } catch (e) {
        console.error('Storage delete after DB remove failed', e)
      }
    },

    async reindexImage(id) {
      const row = await getById(id)
      if (!row) {
        throw new AppError('Image not found', 404, 'NOT_FOUND')
      }
      const bytes = await storage.getBytes(row.storageKey)
      const processed = await processImageBytes(env, bytes, row.mimeType)
      const vector = await embeddings.embedImage({
        bytes: processed.bytes,
        mimeType: processed.mimeType,
      })

      const [updated] = await db
        .update(images)
        .set({
          embedding: vector,
          embeddingModel: env.EMBEDDING_MODEL,
          embeddingDim: EMBEDDING_DIMENSIONS,
          width: processed.width,
          height: processed.height,
          fileSize: processed.bytes.byteLength,
          mimeType: processed.mimeType,
          status: 'indexed',
          updatedAt: new Date(),
        })
        .where(eq(images.id, id))
        .returning()

      if (!updated) {
        throw new AppError('Failed to update image', 500, 'DB_ERROR')
      }
      return updated
    },
  }
}
