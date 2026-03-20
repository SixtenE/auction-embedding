import { QdrantClient } from "@qdrant/js-client-rest";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Env } from "../lib/env.js";
import type { Database } from "../lib/db.js";
import { images } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

export type NeighborRow = {
  id: string;
  storageKey: string;
  publicUrl: string;
  originalFilename: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  score: number;
};

type QdrantSearchHit = {
  id: string;
  score: number;
};

export type QdrantService = {
  upsertImageVector(id: string, vector: number[]): Promise<void>;
  deleteImageVector(id: string): Promise<void>;
  searchSimilar(
    queryVector: number[],
    topK: number,
    excludeId?: string,
  ): Promise<QdrantSearchHit[]>;
};

function qdrantToAppError(err: unknown, operation: string): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new AppError(`Qdrant ${operation} failed: ${message}`, 502, "VECTOR_DB_ERROR");
}

export function createQdrantService(env: Env): QdrantService {
  const collection = env.QDRANT_COLLECTION;

  const client = new QdrantClient({
    host: env.QDRANT_HOST,
    port: env.QDRANT_PORT,
    apiKey: env.QDRANT_API_KEY,
    checkCompatibility: false,
  });

  let ensurePromise: Promise<void> | null = null;
  function ensureCollection() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async () => {
      const { exists } = await client.collectionExists(collection);
      if (exists) return;
      try {
        await client.createCollection(collection, {
          vectors: { size: env.EMBEDDING_DIM, distance: "Cosine" },
        });
      } catch (err) {
        const { exists: nowExists } = await client.collectionExists(collection);
        if (nowExists) return;
        qdrantToAppError(err, "collection create");
      }
    })();
    ensurePromise = ensurePromise.catch((error) => {
      ensurePromise = null;
      throw error;
    });
    return ensurePromise;
  }

  return {
    async upsertImageVector(id, vector) {
      await ensureCollection();
      try {
        await client.upsert(collection, {
          points: [{ id, vector, payload: { imageId: id } }],
        });
      } catch (err) {
        qdrantToAppError(err, "point upsert");
      }
    },

    async deleteImageVector(id) {
      await ensureCollection();
      try {
        await client.delete(collection, { points: [id] });
      } catch (err) {
        qdrantToAppError(err, "point delete");
      }
    },

    async searchSimilar(queryVector, topK, excludeId) {
      await ensureCollection();
      const result = await client
        .search(collection, {
          vector: queryVector,
          limit: topK,
          with_payload: false,
          with_vector: false,
        })
        .catch((err) => qdrantToAppError(err, "search"));

      return result
        .map((hit) => ({ id: String(hit.id), score: hit.score }))
        .filter((hit) => (excludeId ? hit.id !== excludeId : true));
    },
  };
}

export async function queryNearestByVector(
  db: Database,
  qdrant: QdrantService,
  queryVector: number[],
  topK: number,
  excludeId?: string,
): Promise<NeighborRow[]> {
  const hits = await qdrant.searchSimilar(queryVector, topK, excludeId);
  if (hits.length === 0) return [];

  const ids = hits.map((h) => h.id);
  const conditions = [inArray(images.id, ids), eq(images.status, "indexed")];
  if (excludeId) {
    conditions.push(ne(images.id, excludeId));
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
    })
    .from(images)
    .where(and(...conditions));

  const byId = new Map(rows.map((row) => [row.id, row]));
  return hits
    .map((hit) => {
      const row = byId.get(hit.id);
      if (!row) return null;
      return {
        id: row.id,
        storageKey: row.storageKey,
        publicUrl: row.publicUrl,
        originalFilename: row.originalFilename,
        width: row.width,
        height: row.height,
        mimeType: row.mimeType,
        score: hit.score,
      };
    })
    .filter((row): row is NeighborRow => row !== null);
}
