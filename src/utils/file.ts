import type { Env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
  "hev1",
  "heim",
  "heis",
  "avic",
]);

const MIME_FROM_SNIFF: { prefix: number[]; mime: string }[] = [
  { prefix: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png" },
];

/** ISO BMFF `ftyp` at offset 4; HEIC / HEIF (not AVIF `avif` / etc.). */
function sniffHeifLike(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false;
  const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  return HEIF_BRANDS.has(brand);
}

function hasHeifFilename(filename: string | undefined): boolean {
  if (!filename) return false;
  const n = filename.toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

function matchesWebp(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  return (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  );
}

/** Sniff image MIME from magic bytes; returns null if unknown. */
export function sniffImageMime(buf: Uint8Array): string | null {
  for (const { prefix, mime } of MIME_FROM_SNIFF) {
    if (buf.length < prefix.length) continue;
    if (prefix.every((b, i) => buf[i] === b)) return mime;
  }
  if (matchesWebp(buf)) return "image/webp";
  if (sniffHeifLike(buf)) return "image/heic";
  return null;
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function assertValidImageUpload(
  env: Env,
  declaredMime: string | undefined,
  buf: Uint8Array,
  filename?: string,
): string {
  if (buf.byteLength > env.MAX_UPLOAD_BYTES) {
    throw new AppError("File too large", 413, "FILE_TOO_LARGE");
  }
  const sniffed = sniffImageMime(buf);
  if (!sniffed) {
    throw new AppError("Unsupported or invalid image", 400, "INVALID_IMAGE");
  }

  const declared = (declaredMime ?? "").trim().toLowerCase();

  if (sniffed === "image/heic") {
    const okDeclared =
      declared === "image/heic" ||
      declared === "image/heif" ||
      ((declared === "" || declared === "application/octet-stream") && hasHeifFilename(filename));
    if (!okDeclared) {
      throw new AppError("Unsupported image type", 400, "UNSUPPORTED_TYPE");
    }
    return sniffed;
  }

  if (!declared || !ALLOWED_IMAGE_MIMES.has(declared)) {
    throw new AppError("Unsupported image type", 400, "UNSUPPORTED_TYPE");
  }
  if (declared !== sniffed) {
    throw new AppError("MIME type does not match file contents", 400, "MIME_MISMATCH");
  }
  return sniffed;
}
