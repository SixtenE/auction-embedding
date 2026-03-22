import sharp from "sharp";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { testClient } from "hono/testing";
import { AppError } from "../../src/lib/errors.js";

vi.mock("../../src/services/index.js", () => ({
  env: {
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    DEFAULT_TOP_K: 10,
    EMBEDDING_MODEL: "gemini-embedding-2-preview",
  },
  imageMetadata: {
    createIndexedImage: vi.fn(),
    getById: vi.fn(),
    deleteById: vi.fn(),
    reindexImage: vi.fn(),
  },
  embeddings: {
    embedImage: vi.fn(),
  },
  storage: {
    presignedGetUrl: vi.fn(),
  },
  vectorDb: {},
}));

vi.mock("../../src/services/vector-db.js", () => ({
  queryNearestByVector: vi.fn(),
}));

vi.mock("../../src/lib/db.js", () => ({
  db: {},
}));

import { createApp } from "../../src/app.js";
import { imageMetadata, storage } from "../../src/services/index.js";

const mocks = {
  imageMetadata: imageMetadata as any,
  storage: storage as any,
};

async function makePng(): Promise<Uint8Array> {
  const data = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(data);
}

const VALID_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const BASE_ROW = {
  id: VALID_UUID,
  userId: null,
  originalFilename: "photo.png",
  mimeType: "image/png",
  fileSize: 200,
  width: 4,
  height: 4,
  storageKey: `images/${VALID_UUID}.png`,
  publicUrl: `http://localhost:9000/bucket/images/${VALID_UUID}.png`,
  embeddingModel: "gemini-embedding-2-preview",
  embeddingDim: 3072,
  status: "indexed" as const,
  tags: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

describe("GET /images/:id", () => {
  const app = createApp();
  const client = testClient<typeof app>(app);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.presignedGetUrl.mockResolvedValue("https://example.test/photo.png");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with image metadata and a presigned URL", async () => {
    mocks.imageMetadata.getById.mockResolvedValue(BASE_ROW);

    const res = await client.images[":id"].$get({ param: { id: VALID_UUID } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(VALID_UUID);
    expect(body.mimeType).toBe("image/png");
    expect(body.status).toBe("indexed");
    expect(body.url).toBe("https://example.test/photo.png");
    expect(mocks.storage.presignedGetUrl).toHaveBeenCalledWith(`images/${VALID_UUID}.png`);
  });

  it("returns 404 when the image does not exist", async () => {
    mocks.imageMetadata.getById.mockResolvedValue(null);

    const res = await client.images[":id"].$get({ param: { id: VALID_UUID } });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns 500 when the service throws an unexpected error", async () => {
    mocks.imageMetadata.getById.mockRejectedValue(new Error("database connection lost"));

    const res = await client.images[":id"].$get({ param: { id: VALID_UUID } });

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Internal Server Error" });
  });
});

describe("DELETE /images/:id", () => {
  const app = createApp();
  const client = testClient<typeof app>(app);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on successful deletion", async () => {
    mocks.imageMetadata.deleteById.mockResolvedValue(undefined);

    const res = await client.images[":id"].$delete({ param: { id: VALID_UUID } });

    expect(res.status).toBe(204);
    expect(mocks.imageMetadata.deleteById).toHaveBeenCalledWith(VALID_UUID);
  });

  it("returns 404 when the image does not exist", async () => {
    mocks.imageMetadata.deleteById.mockRejectedValue(
      new AppError("Image not found", 404, "NOT_FOUND"),
    );

    const res = await client.images[":id"].$delete({ param: { id: VALID_UUID } });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("POST /images/:id/reindex", () => {
  const app = createApp();
  const client = testClient<typeof app>(app);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.presignedGetUrl.mockResolvedValue("https://example.test/reindexed.png");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated embedding metadata", async () => {
    mocks.imageMetadata.reindexImage.mockResolvedValue(BASE_ROW);

    const res = await client.images[":id"].reindex.$post({ param: { id: VALID_UUID } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(VALID_UUID);
    expect(body.status).toBe("indexed");
    expect(body.url).toBe("https://example.test/reindexed.png");
    expect(body.embeddingModel).toBe("gemini-embedding-2-preview");
    expect(mocks.imageMetadata.reindexImage).toHaveBeenCalledWith(VALID_UUID);
  });

  it("returns 404 when the image does not exist", async () => {
    mocks.imageMetadata.reindexImage.mockRejectedValue(
      new AppError("Image not found", 404, "NOT_FOUND"),
    );

    const res = await client.images[":id"].reindex.$post({ param: { id: VALID_UUID } });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("propagates AppError from the reindex service", async () => {
    mocks.imageMetadata.reindexImage.mockRejectedValue(
      new AppError("Embedding API failed", 502, "EMBEDDING_FAILED"),
    );

    const res = await client.images[":id"].reindex.$post({ param: { id: VALID_UUID } });

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "EMBEDDING_FAILED" });
  });
});

describe("Global error handler", () => {
  const app = createApp();
  const client = testClient<typeof app>(app);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 with generic message for unexpected errors", async () => {
    mocks.imageMetadata.getById.mockRejectedValue(new Error("totally unexpected"));

    const res = await client.images[":id"].$get({ param: { id: VALID_UUID } });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal Server Error" });
  });

  it("returns 400 with validation details for ZodError (invalid UUID param)", async () => {
    const res = await client.images[":id"].$get({ param: { id: "not-a-uuid" } });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Validation error");
    expect(body.details).toBeDefined();
  });
});
