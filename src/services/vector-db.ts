import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { cosineDistance } from 'drizzle-orm/sql/functions/vector'
import type { Database } from '../lib/db.js'
import { images } from '../db/schema.js'

export type NeighborRow = {
  id: string
  storageKey: string
  publicUrl: string
  originalFilename: string
  width: number | null
  height: number | null
  mimeType: string
  score: number
}

/**
 * Cosine distance in pgvector (<=> with vector_cosine_ops) is 1 - cosine similarity
 * for normalized vectors; we expose similarity as 1 - distance.
 */
export async function queryNearestByVector(
  db: Database,
  queryVector: number[],
  topK: number,
  excludeId?: string,
): Promise<NeighborRow[]> {
  const dist = cosineDistance(images.embedding, queryVector)

  const conditions = [
    isNotNull(images.embedding),
    eq(images.status, 'indexed'),
  ]
  if (excludeId) {
    conditions.push(ne(images.id, excludeId))
  }

  const rows = await db
    .select({
      id: images.id,
      storageKey: images.storageKey,
      publicUrl: images.publicUrl,
      originalFilename: images.originalFilename,
      width: images.width,
      height: images.height,
      mimeType: images.mimeType,
      distance: dist,
    })
    .from(images)
    .where(and(...conditions))
    .orderBy(dist)
    .limit(topK)

  return rows.map((r) => ({
    id: r.id,
    storageKey: r.storageKey,
    publicUrl: r.publicUrl,
    originalFilename: r.originalFilename,
    width: r.width,
    height: r.height,
    mimeType: r.mimeType,
    score: 1 - Number(r.distance),
  }))
}
