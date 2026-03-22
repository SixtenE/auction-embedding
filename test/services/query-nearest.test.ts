import { describe, expect, it, vi } from "vitest";
import { queryNearestByVector } from "../../src/services/vector-db.js";
import type { QdrantService } from "../../src/services/vector-db.js";

// Prevent the real QdrantClient from being constructed during module load
vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: vi.fn(function () {
    return {};
  }),
}));

type DbRow = {
  id: string;
  storageKey: string;
  publicUrl: string;
  originalFilename: string;
  width: number;
  height: number;
  mimeType: string;
};

/** Minimal DB mock that returns the supplied rows from .select().from().where() */
function makeDb(rows: DbRow[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => rows),
      })),
    })),
  };
}

function makeQdrant(hits: { id: string; score: number }[]): QdrantService {
  return {
    searchSimilar: vi.fn().mockResolvedValue(hits),
    upsertImageVector: vi.fn(),
    deleteImageVector: vi.fn(),
  };
}

const ROW_A: DbRow = {
  id: "img-a",
  storageKey: "images/img-a.png",
  publicUrl: "http://s3/bucket/img-a.png",
  originalFilename: "alpha.png",
  width: 800,
  height: 600,
  mimeType: "image/png",
};

const ROW_B: DbRow = {
  id: "img-b",
  storageKey: "images/img-b.jpg",
  publicUrl: "http://s3/bucket/img-b.jpg",
  originalFilename: "beta.jpg",
  width: 1024,
  height: 768,
  mimeType: "image/jpeg",
};

describe("queryNearestByVector", () => {
  it("returns an empty array when there are no vector hits", async () => {
    const db = makeDb([]);
    const qdrant = makeQdrant([]);
    const result = await queryNearestByVector(db as any, qdrant, [0.1, 0.2], 10);
    expect(result).toEqual([]);
    // DB should not be queried at all when Qdrant returns nothing
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns neighbors with the correct shape including score", async () => {
    const db = makeDb([ROW_A]);
    const qdrant = makeQdrant([{ id: "img-a", score: 0.95 }]);

    const result = await queryNearestByVector(db as any, qdrant, [0.1], 5);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "img-a",
      storageKey: "images/img-a.png",
      publicUrl: "http://s3/bucket/img-a.png",
      originalFilename: "alpha.png",
      width: 800,
      height: 600,
      mimeType: "image/png",
      score: 0.95,
    });
  });

  it("filters out hits whose images are not in the DB (non-indexed status)", async () => {
    // Qdrant returns two hits but only one is in the DB (the other is non-indexed / deleted)
    const db = makeDb([ROW_A]);
    const qdrant = makeQdrant([
      { id: "img-a", score: 0.99 },
      { id: "img-deleted", score: 0.88 },
    ]);

    const result = await queryNearestByVector(db as any, qdrant, [0.1], 10);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("img-a");
  });

  it("preserves the score-descending ordering returned by Qdrant", async () => {
    const db = makeDb([ROW_A, ROW_B]);
    const qdrant = makeQdrant([
      { id: "img-a", score: 0.95 },
      { id: "img-b", score: 0.80 },
    ]);

    const result = await queryNearestByVector(db as any, qdrant, [0.1, 0.2], 5);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "img-a", score: 0.95 });
    expect(result[1]).toMatchObject({ id: "img-b", score: 0.80 });
  });

  it("passes topK and excludeId through to searchSimilar", async () => {
    const db = makeDb([]);
    const qdrant = makeQdrant([]);

    await queryNearestByVector(db as any, qdrant, [0.1, 0.2, 0.3], 7, "excluded-id");

    expect(qdrant.searchSimilar).toHaveBeenCalledWith([0.1, 0.2, 0.3], 7, "excluded-id");
  });

  it("calls searchSimilar without excludeId when not provided", async () => {
    const db = makeDb([]);
    const qdrant = makeQdrant([]);

    await queryNearestByVector(db as any, qdrant, [0.5], 3);

    expect(qdrant.searchSimilar).toHaveBeenCalledWith([0.5], 3, undefined);
  });

  it("returns an empty array when all vector hits are filtered out by DB join", async () => {
    // DB returns no rows (all images are non-indexed or missing)
    const db = makeDb([]);
    const qdrant = makeQdrant([
      { id: "img-x", score: 0.9 },
      { id: "img-y", score: 0.7 },
    ]);

    const result = await queryNearestByVector(db as any, qdrant, [0.1], 5);

    expect(result).toEqual([]);
  });
});
