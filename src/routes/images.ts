import { Hono } from 'hono'
import { z } from 'zod'
import { assertValidImageUpload, extensionForMime } from '../utils/file.js'
import { AppError } from '../lib/errors.js'
import { imageMetadata, env, storage } from '../services/index.js'
import type { ImageRow } from '../db/schema.js'

async function toPublicImage(row: ImageRow) {
  const url = await storage.presignedGetUrl(row.storageKey)
  return {
    id: row.id,
    userId: row.userId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    width: row.width,
    height: row.height,
    url,
    embeddingModel: row.embeddingModel,
    embeddingDim: row.embeddingDim,
    status: row.status,
    tags: row.tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const imagesRoute = new Hono()

imagesRoute.post('/', async (c) => {
  const body = await c.req.formData()
  const file = body.get('image')
  if (!(file instanceof File)) {
    throw new AppError('Image is required', 400, 'MISSING_FILE')
  }

  const buf = new Uint8Array(await file.arrayBuffer())
  const mime = assertValidImageUpload(env, file.type || undefined, buf, file.name || undefined)

  const metaRaw = body.get('metadata')
  let tags: Record<string, unknown> | null = null
  if (typeof metaRaw === 'string' && metaRaw.length > 0) {
    try {
      const parsed: unknown = JSON.parse(metaRaw)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        tags = parsed as Record<string, unknown>
      } else {
        throw new AppError('metadata must be a JSON object', 400, 'BAD_METADATA')
      }
    } catch (e) {
      if (e instanceof AppError) throw e
      throw new AppError('Invalid metadata JSON', 400, 'BAD_METADATA')
    }
  }

  const id = crypto.randomUUID()
  const ext =
    mime === 'image/heic' || mime === 'image/heif' ? 'png' : extensionForMime(mime)
  const storageKey = `images/${id}.${ext}`

  const row = await imageMetadata.createIndexedImage({
    originalFilename: file.name || `upload.${ext}`,
    rawBytes: buf,
    contentType: mime,
    storageKey,
    tags,
  })

  const url = await storage.presignedGetUrl(row.storageKey)
  return c.json({
    id: row.id,
    status: row.status,
    url,
    width: row.width,
    height: row.height,
    embeddingModel: row.embeddingModel,
  })
})

imagesRoute.get('/:id', async (c) => {
  const id = z.uuid().parse(c.req.param('id'))
  const row = await imageMetadata.getById(id)
  if (!row) {
    throw new AppError('Image not found', 404, 'NOT_FOUND')
  }
  return c.json(await toPublicImage(row))
})

imagesRoute.delete('/:id', async (c) => {
  const id = z.uuid().parse(c.req.param('id'))
  await imageMetadata.deleteById(id)
  return c.body(null, 204)
})

imagesRoute.post('/:id/reindex', async (c) => {
  const id = z.uuid().parse(c.req.param('id'))
  const row = await imageMetadata.reindexImage(id)
  const url = await storage.presignedGetUrl(row.storageKey)
  return c.json({
    id: row.id,
    status: row.status,
    url,
    width: row.width,
    height: row.height,
    embeddingModel: row.embeddingModel,
  })
})
