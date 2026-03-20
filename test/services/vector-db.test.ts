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
    QdrantClient: vi.fn(() => qdrantMocks),
  };
});

import { createQdrantService } from "../../src/services/vector-db.js";

const mocks = qdrantMocks;

const env: Env = {
  PORT: 3000,
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  GEMINI_API_KEY: "test-gemini-key",
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

describe("createQdrantService.ensureCollection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retries collection creation after a transient failure", async () => {
    mocks.collectionExists
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: false });
    mocks.createCollection
      .mockRejectedValueOnce(new Error("Unexpected Response: 503"))
      .mockResolvedValueOnce(true);
    mocks.upsert.mockResolvedValue({ status: "completed", operation_id: 1 });

    const qdrant = createQdrantService(env);

    await expect(qdrant.upsertImageVector("a", [0.1, 0.2, 0.3])).rejects.toThrow(
      /Qdrant collection create failed/,
    );
    await expect(qdrant.upsertImageVector("a", [0.1, 0.2, 0.3])).resolves.toBeUndefined();

    expect(mocks.collectionExists).toHaveBeenCalledTimes(3);
    expect(mocks.createCollection).toHaveBeenCalledTimes(2);
    expect(mocks.createCollection).toHaveBeenNthCalledWith(1, "images", {
      vectors: { size: 3072, distance: "Cosine" },
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith("images", {
      points: [{ id: "a", vector: [0.1, 0.2, 0.3], payload: { imageId: "a" } }],
    });
  });

  it("skips create when collection already exists", async () => {
    mocks.collectionExists.mockResolvedValue({ exists: true });
    mocks.upsert.mockResolvedValue({ status: "completed", operation_id: 1 });

    const qdrant = createQdrantService(env);
    await expect(qdrant.upsertImageVector("a", [0.1, 0.2, 0.3])).resolves.toBeUndefined();

    expect(mocks.collectionExists).toHaveBeenCalledTimes(1);
    expect(mocks.createCollection).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith("images", {
      points: [{ id: "a", vector: [0.1, 0.2, 0.3], payload: { imageId: "a" } }],
    });
  });
});
