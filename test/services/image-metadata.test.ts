import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/lib/errors.js";
import { createImageMetadataService } from "../../src/services/image-metadata.js";

vi.mock("../../src/utils/image-processing.js", () => ({
  processImageBytes: vi.fn(),
}));
import { processImageBytes } from "../../src/utils/image-processing.js";

const mocked = {
  processImageBytes: processImageBytes as any,
};

function makeDb() {
  const state = {
    selectRows: [] as unknown[],
    insertRows: [] as unknown[],
    updateRows: [] as unknown[],
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => state.selectRows),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => state.insertRows),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => state.updateRows),
        })),
      })),
    })),
  };

  return { db, state };
}

const env = {
  EMBEDDING_MODEL: "gemini-embedding-2-preview",
} as any;

describe("createImageMetadataService", () => {
  let storage: any;
  let embeddings: any;
  let vectorDb: any;
  let dbBundle: ReturnType<typeof makeDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    dbBundle = makeDb();

    storage = {
      upload: vi.fn(),
      delete: vi.fn(),
      getBytes: vi.fn(),
      presignedGetUrl: vi.fn(),
    };
    embeddings = {
      embedImage: vi.fn(),
    };
    vectorDb = {
      upsertImageVector: vi.fn(),
      deleteImageVector: vi.fn(),
    };

    mocked.processImageBytes.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3, 4]),
      mimeType: "image/png",
      width: 10,
      height: 20,
    });
    embeddings.embedImage.mockResolvedValue([0.1, 0.2, 0.3]);
    storage.upload.mockResolvedValue({ key: "images/key.png", url: "https://public/key.png" });
    storage.delete.mockResolvedValue(undefined);
    storage.getBytes.mockResolvedValue(new Uint8Array([9, 9, 9]));
    vectorDb.upsertImageVector.mockResolvedValue(undefined);
    vectorDb.deleteImageVector.mockResolvedValue(undefined);
  });

  it("createIndexedImage persists metadata and uploads vector", async () => {
    const inserted = {
      id: "img-1",
      storageKey: "images/key.png",
      mimeType: "image/png",
    };
    dbBundle.state.insertRows = [inserted];

    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    const out = await svc.createIndexedImage({
      originalFilename: "photo.png",
      rawBytes: new Uint8Array([1, 2]),
      contentType: "image/png",
      storageKey: "images/key.png",
      tags: { source: "test" },
    });

    expect(out).toBe(inserted);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(dbBundle.db.insert).toHaveBeenCalledTimes(1);
    expect(vectorDb.upsertImageVector).toHaveBeenCalledWith("img-1", [0.1, 0.2, 0.3]);
  });

  it("createIndexedImage rolls back db row and object when vector upsert fails", async () => {
    dbBundle.state.insertRows = [{ id: "img-2", storageKey: "images/key.png" }];
    vectorDb.upsertImageVector.mockRejectedValueOnce(
      new AppError("Qdrant failed", 502, "VECTOR_DB_ERROR"),
    );

    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    await expect(
      svc.createIndexedImage({
        originalFilename: "photo.png",
        rawBytes: new Uint8Array([1, 2]),
        contentType: "image/png",
        storageKey: "images/key.png",
      }),
    ).rejects.toMatchObject({ code: "VECTOR_DB_ERROR" });

    expect(dbBundle.db.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith("images/key.png");
  });

  it("createIndexedImage cleans up object when db insert fails", async () => {
    dbBundle.state.insertRows = [];

    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    await expect(
      svc.createIndexedImage({
        originalFilename: "photo.png",
        rawBytes: new Uint8Array([1, 2]),
        contentType: "image/png",
        storageKey: "images/key.png",
      }),
    ).rejects.toMatchObject({ code: "DB_ERROR" });

    expect(dbBundle.db.delete).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledWith("images/key.png");
  });

  it("deleteById removes vector and row; storage delete failure is swallowed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      dbBundle.state.selectRows = [{ id: "img-3", storageKey: "images/key.png" }];
      storage.delete.mockRejectedValueOnce(new Error("s3 down"));

      const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

      await expect(svc.deleteById("img-3")).resolves.toBeUndefined();
      expect(vectorDb.deleteImageVector).toHaveBeenCalledWith("img-3");
      expect(dbBundle.db.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledWith("images/key.png");
      const deleteOrder = dbBundle.db.delete.mock.invocationCallOrder[0];
      const vectorDeleteOrder = vectorDb.deleteImageVector.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(vectorDeleteOrder);
      expect(consoleError).toHaveBeenCalledWith(
        "Storage delete after DB remove failed",
        expect.objectContaining({ message: "s3 down" }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("deleteById throws 404 when image does not exist", async () => {
    dbBundle.state.selectRows = [];
    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    await expect(svc.deleteById("missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(vectorDb.deleteImageVector).not.toHaveBeenCalled();
  });

  it("deleteById does not delete vector when database delete fails", async () => {
    dbBundle.state.selectRows = [{ id: "img-6", storageKey: "images/key.png" }];
    dbBundle.db.delete.mockImplementationOnce(() => ({
      where: vi.fn(async () => {
        throw new AppError("delete failed", 500, "DB_ERROR");
      }),
    }));

    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    await expect(svc.deleteById("img-6")).rejects.toMatchObject({
      status: 500,
      code: "DB_ERROR",
    });
    expect(vectorDb.deleteImageVector).not.toHaveBeenCalled();
  });

  it("reindexImage refreshes vector and metadata", async () => {
    dbBundle.state.selectRows = [
      { id: "img-4", storageKey: "images/key.png", mimeType: "image/png" },
    ];
    dbBundle.state.updateRows = [{ id: "img-4", status: "indexed" }];

    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    const out = await svc.reindexImage("img-4");
    expect(out).toEqual({ id: "img-4", status: "indexed" });
    expect(storage.getBytes).toHaveBeenCalledWith("images/key.png");
    expect(vectorDb.upsertImageVector).toHaveBeenCalledWith("img-4", [0.1, 0.2, 0.3]);
    expect(dbBundle.db.update).toHaveBeenCalledTimes(1);
    const updateOrder = dbBundle.db.update.mock.invocationCallOrder[0];
    const upsertOrder = vectorDb.upsertImageVector.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(upsertOrder);
  });

  it("reindexImage throws DB_ERROR when update returns no row", async () => {
    dbBundle.state.selectRows = [
      { id: "img-5", storageKey: "images/key.png", mimeType: "image/png" },
    ];
    dbBundle.state.updateRows = [];

    const svc = createImageMetadataService(env, dbBundle.db as any, storage, embeddings, vectorDb);

    await expect(svc.reindexImage("img-5")).rejects.toMatchObject({
      status: 500,
      code: "DB_ERROR",
    });
    expect(vectorDb.upsertImageVector).not.toHaveBeenCalled();
  });
});
