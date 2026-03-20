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

async function parseQdrantResult<T>(res: Response, operation: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new AppError(`Qdrant ${operation} failed: ${res.status} ${body}`, 502, "VECTOR_DB_ERROR");
  }
  const json = (await res.json()) as { result?: T };
  if (json.result === undefined) {
    throw new AppError(`Qdrant ${operation} returned invalid payload`, 502, "VECTOR_DB_ERROR");
  }
  return json.result;
}

export function createQdrantService(env: Env): QdrantService {
  const baseUrl = env.QDRANT_URL.replace(/\/+$/, "");
  const collection = env.QDRANT_COLLECTION;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.QDRANT_API_KEY) {
    defaultHeaders.api_key = env.QDRANT_API_KEY;
  }

  let ensurePromise: Promise<void> | null = null;
  function ensureCollection() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async () => {
      const res = await fetch(`${baseUrl}/collections/${collection}`, {
        method: "PUT",
        headers: defaultHeaders,
        body: JSON.stringify({
          vectors: { size: env.EMBEDDING_DIM, distance: "Cosine" },
        }),
      });
      await parseQdrantResult(res, "collection create");
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
      const res = await fetch(`${baseUrl}/collections/${collection}/points`, {
        method: "PUT",
        headers: defaultHeaders,
        body: JSON.stringify({
          points: [{ id, vector, payload: { imageId: id } }],
        }),
      });
      await parseQdrantResult(res, "point upsert");
    },

    async deleteImageVector(id) {
      await ensureCollection();
      const res = await fetch(`${baseUrl}/collections/${collection}/points/delete`, {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({
          points: [id],
        }),
      });
      await parseQdrantResult(res, "point delete");
    },

    async searchSimilar(queryVector, topK, excludeId) {
      await ensureCollection();
      const res = await fetch(`${baseUrl}/collections/${collection}/points/search`, {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify({
          vector: queryVector,
          limit: topK,
          with_payload: false,
          with_vector: false,
        }),
      });
      const result = await parseQdrantResult<Array<{ id: string | number; score: number }>>(
        res,
        "search",
      );

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
