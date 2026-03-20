import sharp from "sharp";
import type { Env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

const MAX_EDGE = 2048;

const SHARP_FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function mimeFromSharpOutputFormat(format: string | undefined): string {
  if (!format) {
    throw new AppError("Could not determine output image format", 500, "BAD_IMAGE");
  }
  const mime = SHARP_FORMAT_TO_MIME[format];
  if (!mime) {
    throw new AppError("Could not determine output image format", 500, "BAD_IMAGE");
  }
  return mime;
}

export type ProcessedImage = {
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
};

/** Auto-orient, optional downscale; outputs jpeg/png for jpeg/png inputs, png for webp/heic. */
export async function processImageBytes(
  env: Env,
  input: Uint8Array,
  mimeType: string,
): Promise<ProcessedImage> {
  try {
    const base = sharp(Buffer.from(input)).rotate().resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });

    let data: Buffer;
    let info: sharp.OutputInfo;

    switch (mimeType) {
      case "image/jpeg":
        ({ data, info } = await base.jpeg({ mozjpeg: true }).toBuffer({ resolveWithObject: true }));
        break;
      case "image/png":
        ({ data, info } = await base
          .png({ compressionLevel: 9 })
          .toBuffer({ resolveWithObject: true }));
        break;
      case "image/webp":
        // Gemini embed API accepts only PNG/JPEG for images, not WebP.
        ({ data, info } = await base
          .png({ compressionLevel: 9 })
          .toBuffer({ resolveWithObject: true }));
        break;
      case "image/heic":
      case "image/heif":
        ({ data, info } = await base
          .png({ compressionLevel: 9 })
          .toBuffer({ resolveWithObject: true }));
        break;
      default:
        throw new AppError("Unsupported image type", 400, "UNSUPPORTED_TYPE");
    }

    const w = info.width;
    const h = info.height;
    if (!w || !h) {
      throw new AppError("Could not read image dimensions", 400, "BAD_IMAGE");
    }

    if (data.byteLength > env.MAX_UPLOAD_BYTES) {
      throw new AppError("Processed image still too large", 413, "FILE_TOO_LARGE");
    }

    return {
      bytes: new Uint8Array(data),
      mimeType: mimeFromSharpOutputFormat(info.format),
      width: w,
      height: h,
    };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("Invalid or corrupt image", 400, "BAD_IMAGE");
  }
}
