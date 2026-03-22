import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/lib/env.js";

type QdrantMocks = {
  collectionExists: ReturnType<typeof vi.fn>;
  createCollection: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
};

/** Set by the mock factory (Vitest hoists `vi.mock`; `var` is visible to the factory). */
var qdrantMocks: QdrantMocks;

vi.mock("@qdrant/js-client-rest", () => {
  qdrantMocks = {
    collectionExists: vi.fn(),
    createCollection: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
  };
  return {
    QdrantClient: vi.fn(function QdrantClientMock() {
      return qdrantMocks;
    }),
  };
});

import { createQdrantService } from "../../src/services/vector-db.js";

const mocks = qdrantMocks;

const env: Env = {
  PORT: 3000,
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  GEMINI_API_KEY: "test-key",
  EMBEDDING_MODEL: "gemini-embedding-2-preview",
  EMBEDDING_DIM: 3072,
  QDRANT_HOST: "localhost",
  QDRANT_PORT: 6333,
  QDRANT_API_KEY: undefined,
  QDRANT_COLLECTION: "images",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "test",
  S3_SECRET_ACCESS_KEY: "test",
  S3_BUCKET: "test-bucket",
  S3_PRESIGN_EXPIRES_SECONDS: 3600,
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  DEFAULT_TOP_K: 10,
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// searchSimilar
// ---------------------------------------------------------------------------

describe("QdrantService.searchSimilar", () => {
  it("queries the collection with vector and limit, returns mapped hits", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.search.mockResolvedValue([
      { id: "img-1", score: 0.95, version: 1, payload: {} },
      { id: "img-2", score: 0.80, version: 1, payload: {} },
    ]);

    const qdrant = createQdrantService(env);
    const result = await qdrant.searchSimilar([0.1, 0.2, 0.3], 5);

    expect(mocks.search).toHaveBeenCalledWith("images", {
      vector: [0.1, 0.2, 0.3],
      limit: 5,
      with_payload: false,
      with_vector: false,
    });
    expect(result).toEqual([
      { id: "img-1", score: 0.95 },
      { id: "img-2", score: 0.80 },
    ]);
  });

  it("filters out the excludeId from results", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.search.mockResolvedValue([
      { id: "excluded", score: 0.99, version: 1, payload: {} },
      { id: "img-1", score: 0.90, version: 1, payload: {} },
    ]);

    const qdrant = createQdrantService(env);
    const result = await qdrant.searchSimilar([0.1], 5, "excluded");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("img-1");
  });

  it("returns all results when excludeId is not provided", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.search.mockResolvedValue([
      { id: "img-a", score: 0.88, version: 1, payload: {} },
      { id: "img-b", score: 0.75, version: 1, payload: {} },
    ]);

    const qdrant = createQdrantService(env);
    const result = await qdrant.searchSimilar([0.5, 0.5], 10);

    expect(result).toHaveLength(2);
  });

  it("returns an empty array when Qdrant returns no results", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.search.mockResolvedValue([]);

    const qdrant = createQdrantService(env);
    const result = await qdrant.searchSimilar([0.1], 10);

    expect(result).toEqual([]);
  });

  it("wraps Qdrant search errors as AppError VECTOR_DB_ERROR (502)", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.search.mockRejectedValue(new Error("Qdrant unavailable"));

    const qdrant = createQdrantService(env);
    await expect(qdrant.searchSimilar([0.1], 5)).rejects.toMatchObject({
      code: "VECTOR_DB_ERROR",
      status: 502,
    });
  });
});

// ---------------------------------------------------------------------------
// deleteImageVector
// ---------------------------------------------------------------------------

describe("QdrantService.deleteImageVector", () => {
  it("calls delete on the collection with the correct point id", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.delete.mockResolvedValue({});

    const qdrant = createQdrantService(env);
    await expect(qdrant.deleteImageVector("img-42")).resolves.toBeUndefined();

    expect(mocks.delete).toHaveBeenCalledWith("images", { points: ["img-42"] });
  });

  it("wraps Qdrant delete errors as AppError VECTOR_DB_ERROR (502)", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.delete.mockRejectedValue(new Error("delete failed"));

    const qdrant = createQdrantService(env);
    await expect(qdrant.deleteImageVector("img-bad")).rejects.toMatchObject({
      code: "VECTOR_DB_ERROR",
      status: 502,
    });
  });
});

// ---------------------------------------------------------------------------
// ensureCollection — non-transient failure
// ---------------------------------------------------------------------------

describe("QdrantService.ensureCollection non-transient error", () => {
  it("throws VECTOR_DB_ERROR immediately when collection create fails and collection still does not exist", async () => {
    mocks.collectionExists
      .mockResolvedValueOnce({ exists: false }) // initial check
      .mockResolvedValueOnce({ exists: false }); // post-failure check
    mocks.createCollection.mockRejectedValueOnce(new Error("Permission denied"));

    const qdrant = createQdrantService(env);

    await expect(qdrant.upsertImageVector("x", [0.1])).rejects.toMatchObject({
      code: "VECTOR_DB_ERROR",
      status: 502,
    });
  });

  it("succeeds when collection is found to exist after a failed create (race condition)", async () => {
    // Another process created the collection between the first check and our create attempt
    mocks.collectionExists
      .mockResolvedValueOnce({ exists: false }) // initial check → try to create
      .mockResolvedValueOnce({ exists: true }); // post-failure check → already exists
    mocks.createCollection.mockRejectedValueOnce(new Error("Already exists"));
    mocks.upsert.mockResolvedValue({ status: "completed", operation_id: 1 });

    const qdrant = createQdrantService(env);
    await expect(qdrant.upsertImageVector("x", [0.1])).resolves.toBeUndefined();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
