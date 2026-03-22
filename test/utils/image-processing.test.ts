import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImageBytes } from "../../src/utils/image-processing.js";
import type { Env } from "../../src/lib/env.js";

const env: Env = { MAX_UPLOAD_BYTES: 10 * 1024 * 1024 } as Env;

async function makeJpeg(width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
  return new Uint8Array(buf);
}

async function makePng(width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 50, g: 100, b: 200 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

async function makeWebp(width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 200, b: 50 } },
  })
    .webp()
    .toBuffer();
  return new Uint8Array(buf);
}

describe("processImageBytes", () => {
  describe("format handling", () => {
    it("preserves JPEG format for JPEG input", async () => {
      const input = await makeJpeg(100, 80);
      const result = await processImageBytes(env, input, "image/jpeg");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.width).toBe(100);
      expect(result.height).toBe(80);
      expect(result.bytes).toBeInstanceOf(Uint8Array);
      expect(result.bytes.length).toBeGreaterThan(0);
    });

    it("preserves PNG format for PNG input", async () => {
      const input = await makePng(64, 48);
      const result = await processImageBytes(env, input, "image/png");
      expect(result.mimeType).toBe("image/png");
      expect(result.width).toBe(64);
      expect(result.height).toBe(48);
    });

    it("converts WebP to PNG (Gemini embed API compatibility)", async () => {
      const input = await makeWebp(100, 75);
      const result = await processImageBytes(env, input, "image/webp");
      expect(result.mimeType).toBe("image/png");
      expect(result.width).toBe(100);
      expect(result.height).toBe(75);
    });

    it("returns valid byte arrays for each supported format", async () => {
      const jpeg = await makeJpeg(10, 10);
      const png = await makePng(10, 10);
      const webp = await makeWebp(10, 10);

      for (const [input, mime] of [
        [jpeg, "image/jpeg"],
        [png, "image/png"],
        [webp, "image/webp"],
      ] as [Uint8Array, string][]) {
        const result = await processImageBytes(env, input, mime);
        expect(result.bytes.length).toBeGreaterThan(0);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      }
    });
  });

  describe("downscaling", () => {
    it("downscales a landscape image wider than 2048px", async () => {
      const input = await makeJpeg(3000, 1500);
      const result = await processImageBytes(env, input, "image/jpeg");
      // longest edge capped at 2048, aspect ratio preserved
      expect(result.width).toBe(2048);
      expect(result.height).toBe(1024);
    });

    it("downscales a portrait image taller than 2048px", async () => {
      const input = await makePng(1000, 4096);
      const result = await processImageBytes(env, input, "image/png");
      expect(result.height).toBe(2048);
      expect(result.width).toBe(500);
    });

    it("does not upscale an image smaller than 2048px", async () => {
      const input = await makePng(50, 30);
      const result = await processImageBytes(env, input, "image/png");
      expect(result.width).toBe(50);
      expect(result.height).toBe(30);
    });

    it("leaves a square image at exactly 2048px unchanged", async () => {
      const input = await makePng(2048, 2048);
      const result = await processImageBytes(env, input, "image/png");
      expect(result.width).toBe(2048);
      expect(result.height).toBe(2048);
    });

    it("leaves an image whose longest edge is exactly 2048px unchanged", async () => {
      const input = await makeJpeg(2048, 1024);
      const result = await processImageBytes(env, input, "image/jpeg");
      expect(result.width).toBe(2048);
      expect(result.height).toBe(1024);
    });
  });

  describe("error handling", () => {
    it("throws FILE_TOO_LARGE (413) when the processed output exceeds MAX_UPLOAD_BYTES", async () => {
      const tinyEnv = { MAX_UPLOAD_BYTES: 1 } as Env;
      const input = await makePng(10, 10);
      await expect(processImageBytes(tinyEnv, input, "image/png")).rejects.toMatchObject({
        code: "FILE_TOO_LARGE",
        status: 413,
      });
    });

    it("throws UNSUPPORTED_TYPE (400) for an unrecognised mimeType", async () => {
      const input = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      await expect(processImageBytes(env, input, "application/pdf")).rejects.toMatchObject({
        code: "UNSUPPORTED_TYPE",
        status: 400,
      });
    });

    it("throws BAD_IMAGE (400) for corrupt/truncated image bytes", async () => {
      // Valid JPEG header but no image data
      const truncated = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02]);
      await expect(processImageBytes(env, truncated, "image/jpeg")).rejects.toMatchObject({
        code: "BAD_IMAGE",
        status: 400,
      });
    });
  });
});
