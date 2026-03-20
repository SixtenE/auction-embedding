import sharp from "sharp";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { testClient } from "hono/testing";
import { AppError } from "../src/lib/errors.js";

vi.mock("../src/services/index.js", () => ({
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

vi.mock("../src/services/vector-db.js", () => ({
  queryNearestByVector: vi.fn(),
}));

vi.mock("../src/lib/db.js", () => ({
  db: {},
}));

import { createApp } from "../src/app.js";
import { imageMetadata, embeddings, storage, vectorDb } from "../src/services/index.js";
import { queryNearestByVector } from "../src/services/vector-db.js";
import { db } from "../src/lib/db.js";

const mocks = {
  imageMetadata: imageMetadata as any,
  embeddings: embeddings as any,
  storage: storage as any,
  queryNearestByVector: queryNearestByVector as any,
  vectorDb,
  db,
};

async function makePng(): Promise<Uint8Array> {
  const data = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 200, g: 20, b: 40 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(data);
}

async function makeJpeg(): Promise<Uint8Array> {
  const data = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 30, g: 160, b: 90 },
    },
  })
    .jpeg()
    .toBuffer();
  return new Uint8Array(data);
}

describe("Upload + search flow", () => {
  const app = createApp();
  const client = testClient<typeof app>(app);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-2222-4333-8444-555555555555");

    mocks.storage.presignedGetUrl.mockResolvedValue("https://example.test/file.png");
    mocks.embeddings.embedImage.mockResolvedValue([0.1, 0.2, 0.3]);
    mocks.imageMetadata.createIndexedImage.mockResolvedValue({
      id: "11111111-2222-4333-8444-555555555555",
      userId: null,
      originalFilename: "photo.png",
      mimeType: "image/png",
      fileSize: 100,
      width: 4,
      height: 4,
      storageKey: "images/11111111-2222-4333-8444-555555555555.png",
      publicUrl: "http://localhost:9000/auction/images/x.png",
      embeddingModel: "gemini-embedding-2-preview",
      embeddingDim: 3072,
      status: "indexed",
      tags: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.queryNearestByVector.mockResolvedValue([
      {
        id: "11111111-2222-4333-8444-555555555555",
        storageKey: "images/11111111-2222-4333-8444-555555555555.png",
        publicUrl: "http://localhost:9000/auction/images/x.png",
        originalFilename: "photo.png",
        width: 4,
        height: 4,
        mimeType: "image/png",
        score: 0.99,
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a valid image and forwards parsed metadata", async () => {
    const png = await makePng();
    const res = await client.images.$post({
      form: {
        image: new File([png], "photo.png", { type: "image/png" }),
        metadata: JSON.stringify({ source: "camera", album: "a1" }),
      },
    });

    expect(res.status).toBe(200);
    expect(mocks.imageMetadata.createIndexedImage).toHaveBeenCalledTimes(1);
    expect(mocks.imageMetadata.createIndexedImage).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilename: "photo.png",
        contentType: "image/png",
        storageKey: "images/11111111-2222-4333-8444-555555555555.png",
        tags: { source: "camera", album: "a1" },
      }),
    );
  });

  it("rejects metadata that is not valid JSON", async () => {
    const png = await makePng();
    const res = await client.images.$post({
      form: {
        image: new File([png], "photo.png", { type: "image/png" }),
        metadata: "{not-json}",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "BAD_METADATA" });
    expect(mocks.imageMetadata.createIndexedImage).not.toHaveBeenCalled();
  });

  it("rejects metadata when JSON is not an object", async () => {
    const png = await makePng();
    const res = await client.images.$post({
      form: {
        image: new File([png], "photo.png", { type: "image/png" }),
        metadata: JSON.stringify(["not", "an", "object"]),
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "BAD_METADATA" });
    expect(mocks.imageMetadata.createIndexedImage).not.toHaveBeenCalled();
  });

  it("rejects MIME mismatches before indexing", async () => {
    const jpeg = await makeJpeg();
    const res = await client.images.$post({
      form: {
        image: new File([jpeg], "photo.png", { type: "image/png" }),
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "MIME_MISMATCH" });
    expect(mocks.imageMetadata.createIndexedImage).not.toHaveBeenCalled();
  });

  it("searches by image and maps vector matches to presigned URLs", async () => {
    const png = await makePng();
    const res = await client.search.image.$post({
      form: {
        image: new File([png], "query.png", { type: "image/png" }),
        topK: "3",
      },
    });

    expect(res.status).toBe(200);
    expect(mocks.embeddings.embedImage).toHaveBeenCalledTimes(1);
    expect(mocks.queryNearestByVector).toHaveBeenCalledWith(
      mocks.db,
      mocks.vectorDb,
      [0.1, 0.2, 0.3],
      3,
    );
    expect(mocks.storage.presignedGetUrl).toHaveBeenCalledWith(
      "images/11111111-2222-4333-8444-555555555555.png",
    );

    const body = (await res.json()) as { matches: Array<{ score: number; id: string }> };
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({
      id: "11111111-2222-4333-8444-555555555555",
      score: 0.99,
    });
  });

  it("uses env default topK when topK is omitted", async () => {
    const png = await makePng();
    const res = await client.search.image.$post({
      form: {
        image: new File([png], "query.png", { type: "image/png" }),
      },
    });

    expect(res.status).toBe(200);
    expect(mocks.queryNearestByVector).toHaveBeenCalledWith(
      mocks.db,
      mocks.vectorDb,
      [0.1, 0.2, 0.3],
      10,
    );
  });

  it("rejects invalid topK values", async () => {
    const png = await makePng();

    const badValues = ["0", "101", "abc"];
    for (const topK of badValues) {
      const res = await client.search.image.$post({
        form: {
          image: new File([png], "query.png", { type: "image/png" }),
          topK,
        },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "BAD_TOPK" });
    }
  });

  it("returns embedding failure from search flow", async () => {
    const png = await makePng();
    mocks.embeddings.embedImage.mockRejectedValueOnce(
      new AppError("Embedding API failed", 502, "EMBEDDING_FAILED"),
    );

    const res = await client.search.image.$post({
      form: {
        image: new File([png], "query.png", { type: "image/png" }),
      },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "EMBEDDING_FAILED" });
    expect(mocks.queryNearestByVector).not.toHaveBeenCalled();
  });

  it("returns vector DB failure from search flow", async () => {
    const png = await makePng();
    mocks.queryNearestByVector.mockRejectedValueOnce(
      new AppError("Qdrant search failed", 502, "VECTOR_DB_ERROR"),
    );

    const res = await client.search.image.$post({
      form: {
        image: new File([png], "query.png", { type: "image/png" }),
      },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "VECTOR_DB_ERROR" });
  });
});
