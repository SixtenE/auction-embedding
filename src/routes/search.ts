import { Hono } from 'hono'
import { queryNearestByVector } from '../services/vector-db.js'
import { db } from '../lib/db.js'
import { embeddings, env, storage } from '../services/index.js'
import { assertValidImageUpload } from '../utils/file.js'
import { processImageBytes } from '../utils/image-processing.js'
import { AppError } from '../lib/errors.js'

export const searchRoute = new Hono()

searchRoute.post('/image', async (c) => {
  const body = await c.req.formData()
  const file = body.get('image')
  if (!(file instanceof File)) {
    throw new AppError('Image is required', 400, 'MISSING_FILE')
  }

  const topKRaw = body.get('topK')
  let topK = env.DEFAULT_TOP_K
  if (typeof topKRaw === 'string' && topKRaw.length > 0) {
    const n = Number.parseInt(topKRaw, 10)
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      throw new AppError('topK must be between 1 and 100', 400, 'BAD_TOPK')
    }
    topK = n
  }

  const buf = new Uint8Array(await file.arrayBuffer())
  const mime = assertValidImageUpload(env, file.type || undefined, buf, file.name || undefined)
  const processed = await processImageBytes(env, buf, mime)
  const vector = await embeddings.embedImage({
    bytes: processed.bytes,
    mimeType: processed.mimeType,
  })

  const matches = await queryNearestByVector(db, vector, topK)
  const withUrls = await Promise.all(
    matches.map(async (m) => ({
      id: m.id,
      url: await storage.presignedGetUrl(m.storageKey),
      score: m.score,
      metadata: {
        filename: m.originalFilename,
        width: m.width,
        height: m.height,
        mimeType: m.mimeType,
      },
    })),
  )

  return c.json({
    query: { topK },
    matches: withUrls,
  })
})
