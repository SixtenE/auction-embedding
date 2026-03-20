import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../lib/env.js";
import { createQdrantService } from "./vector-db.js";

const env: Env = {
  NODE_ENV: "test",
  PORT: 3000,
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  GEMINI_API_KEY: "test-gemini-key",
  EMBEDDING_MODEL: "gemini-embedding-2-preview",
  EMBEDDING_DIM: 3072,
  QDRANT_URL: "http://localhost:6333",
  QDRANT_API_KEY: undefined,
  QDRANT_COLLECTION: "images",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "test",
  S3_SECRET_ACCESS_KEY: "test",
  S3_BUCKET: "test-bucket",
  S3_PUBLIC_BASE_URL: "http://127.0.0.1:9000/test-bucket",
  S3_PRESIGN_EXPIRES_SECONDS: 3600,
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  DEFAULT_TOP_K: 10,
};

describe("createQdrantService.ensureCollection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries collection creation after a transient failure", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("temporary outage", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { status: "green" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { operation_id: 1 } }), { status: 200 }));

    const qdrant = createQdrantService(env);

    await expect(qdrant.upsertImageVector("a", [0.1, 0.2, 0.3])).rejects.toThrow(
      /Qdrant collection create failed/,
    );
    await expect(qdrant.upsertImageVector("a", [0.1, 0.2, 0.3])).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:6333/collections/images",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:6333/collections/images",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:6333/collections/images/points",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
