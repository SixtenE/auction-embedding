import { describe, expect, it } from "vitest";
import { sniffImageMime, extensionForMime, assertValidImageUpload } from "../../src/utils/file.js";
import type { Env } from "../../src/lib/env.js";

// ---------------------------------------------------------------------------
// Magic byte helpers
// ---------------------------------------------------------------------------

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function webpBytes(): Uint8Array {
  const buf = new Uint8Array(12);
  // RIFF
  buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
  // WEBP
  buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
  return buf;
}

function heicBytes(brand = "heic"): Uint8Array {
  const buf = new Uint8Array(12);
  // ftyp at offset 4
  buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70;
  buf[8] = brand.charCodeAt(0); buf[9] = brand.charCodeAt(1);
  buf[10] = brand.charCodeAt(2); buf[11] = brand.charCodeAt(3);
  return buf;
}

const env: Env = { MAX_UPLOAD_BYTES: 10 * 1024 * 1024 } as Env;

// ---------------------------------------------------------------------------
// sniffImageMime
// ---------------------------------------------------------------------------

describe("sniffImageMime", () => {
  it("detects JPEG from magic bytes", () => {
    expect(sniffImageMime(jpegBytes())).toBe("image/jpeg");
  });

  it("detects PNG from magic bytes", () => {
    expect(sniffImageMime(pngBytes())).toBe("image/png");
  });

  it("detects WebP from RIFF+WEBP signature", () => {
    expect(sniffImageMime(webpBytes())).toBe("image/webp");
  });

  it("detects HEIC with brand 'heic'", () => {
    expect(sniffImageMime(heicBytes("heic"))).toBe("image/heic");
  });

  it("detects HEIC with brand 'mif1'", () => {
    expect(sniffImageMime(heicBytes("mif1"))).toBe("image/heic");
  });

  it("detects HEIC with brand 'heix'", () => {
    expect(sniffImageMime(heicBytes("heix"))).toBe("image/heic");
  });

  it("returns null for unknown magic bytes", () => {
    expect(sniffImageMime(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
  });

  it("returns null for a buffer shorter than the PNG header", () => {
    // PNG needs 8 bytes; 4 bytes is not enough
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });

  it("returns null for a WebP-length buffer with wrong bytes", () => {
    // 12 bytes of zeros — not any known format
    expect(sniffImageMime(new Uint8Array(12))).toBeNull();
  });

  it("returns null for an 11-byte buffer (too short for WebP)", () => {
    expect(sniffImageMime(new Uint8Array(11).fill(0x52))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extensionForMime
// ---------------------------------------------------------------------------

describe("extensionForMime", () => {
  it("maps image/jpeg to jpg", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
  });

  it("maps image/png to png", () => {
    expect(extensionForMime("image/png")).toBe("png");
  });

  it("maps image/webp to webp", () => {
    expect(extensionForMime("image/webp")).toBe("webp");
  });

  it("returns bin for image/heic (converted at route level)", () => {
    expect(extensionForMime("image/heic")).toBe("bin");
  });

  it("returns bin for unknown MIME types", () => {
    expect(extensionForMime("application/pdf")).toBe("bin");
    expect(extensionForMime("text/plain")).toBe("bin");
  });
});

// ---------------------------------------------------------------------------
// assertValidImageUpload
// ---------------------------------------------------------------------------

describe("assertValidImageUpload", () => {
  it("accepts a valid JPEG with matching declared MIME", () => {
    const result = assertValidImageUpload(env, "image/jpeg", jpegBytes());
    expect(result).toBe("image/jpeg");
  });

  it("accepts a valid PNG with matching declared MIME", () => {
    const result = assertValidImageUpload(env, "image/png", pngBytes());
    expect(result).toBe("image/png");
  });

  it("accepts a valid WebP with matching declared MIME", () => {
    const result = assertValidImageUpload(env, "image/webp", webpBytes());
    expect(result).toBe("image/webp");
  });

  it("throws FILE_TOO_LARGE (413) when buffer exceeds the configured limit", () => {
    const tinyEnv = { MAX_UPLOAD_BYTES: 5 } as Env;
    const buf = new Uint8Array(10);
    expect(() => assertValidImageUpload(tinyEnv, "image/png", buf)).toThrow(
      expect.objectContaining({ code: "FILE_TOO_LARGE", status: 413 }),
    );
  });

  it("throws INVALID_IMAGE (400) for unrecognised magic bytes", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(() => assertValidImageUpload(env, "image/jpeg", garbage)).toThrow(
      expect.objectContaining({ code: "INVALID_IMAGE", status: 400 }),
    );
  });

  it("throws MIME_MISMATCH (400) when JPEG bytes are declared as PNG", () => {
    expect(() => assertValidImageUpload(env, "image/png", jpegBytes())).toThrow(
      expect.objectContaining({ code: "MIME_MISMATCH", status: 400 }),
    );
  });

  it("throws MIME_MISMATCH (400) when PNG bytes are declared as JPEG", () => {
    expect(() => assertValidImageUpload(env, "image/jpeg", pngBytes())).toThrow(
      expect.objectContaining({ code: "MIME_MISMATCH", status: 400 }),
    );
  });

  it("throws MIME_MISMATCH (400) when WebP bytes are declared as PNG", () => {
    expect(() => assertValidImageUpload(env, "image/png", webpBytes())).toThrow(
      expect.objectContaining({ code: "MIME_MISMATCH", status: 400 }),
    );
  });

  it("throws UNSUPPORTED_TYPE (400) when declared MIME is not in the allowed set", () => {
    expect(() => assertValidImageUpload(env, "application/pdf", jpegBytes())).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE", status: 400 }),
    );
  });

  it("throws UNSUPPORTED_TYPE (400) when declared MIME is empty for a non-HEIC file", () => {
    expect(() => assertValidImageUpload(env, "", jpegBytes())).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE", status: 400 }),
    );
  });

  it("throws UNSUPPORTED_TYPE (400) when declared MIME is undefined for a non-HEIC file", () => {
    expect(() => assertValidImageUpload(env, undefined, jpegBytes())).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE", status: 400 }),
    );
  });

  describe("HEIC special-case handling", () => {
    it("accepts HEIC bytes declared as image/heic", () => {
      expect(assertValidImageUpload(env, "image/heic", heicBytes())).toBe("image/heic");
    });

    it("accepts HEIC bytes declared as image/heif", () => {
      expect(assertValidImageUpload(env, "image/heif", heicBytes())).toBe("image/heic");
    });

    it("accepts HEIC bytes with empty declared MIME when filename ends in .heic", () => {
      expect(assertValidImageUpload(env, "", heicBytes(), "photo.heic")).toBe("image/heic");
    });

    it("accepts HEIC bytes with application/octet-stream MIME when filename ends in .heif", () => {
      expect(
        assertValidImageUpload(env, "application/octet-stream", heicBytes(), "photo.heif"),
      ).toBe("image/heic");
    });

    it("throws UNSUPPORTED_TYPE when HEIC bytes have a mismatched declared MIME", () => {
      expect(() => assertValidImageUpload(env, "image/jpeg", heicBytes())).toThrow(
        expect.objectContaining({ code: "UNSUPPORTED_TYPE", status: 400 }),
      );
    });

    it("throws UNSUPPORTED_TYPE for HEIC bytes with empty MIME and a non-HEIC filename", () => {
      expect(() => assertValidImageUpload(env, "", heicBytes(), "photo.png")).toThrow(
        expect.objectContaining({ code: "UNSUPPORTED_TYPE", status: 400 }),
      );
    });

    it("throws UNSUPPORTED_TYPE for HEIC bytes with empty MIME and no filename", () => {
      expect(() => assertValidImageUpload(env, "", heicBytes())).toThrow(
        expect.objectContaining({ code: "UNSUPPORTED_TYPE", status: 400 }),
      );
    });
  });
});
