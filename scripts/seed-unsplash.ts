#!/usr/bin/env bun
/**
 * seed-unsplash.ts
 *
 * Downloads the Unsplash Lite dataset, then uploads and indexes every photo
 * through the auction-embedding API.
 *
 * Usage:
 *   bun run seed:unsplash [options]
 *
 * Options:
 *   --api-url <url>      Base URL of the running API  (default: http://localhost:3000)
 *   --limit <n>          Max photos to process        (default: all)
 *   --concurrency <n>    Parallel upload workers      (default: 5)
 *   --image-width <px>   Requested image width        (default: 640)
 *   --dataset-url <url>  Override dataset download URL
 *   --skip-download      Re-use a previously downloaded zip at /tmp/unsplash-lite.zip
 *
 * Environment:
 *   UNSPLASH_DATASET_URL   Override dataset URL (same as --dataset-url)
 */

import { createWriteStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as path from "node:path";
import * as fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

const argv = parseArgs(process.argv.slice(2));

const API_URL = argv["api-url"] ?? "http://localhost:3000";
const LIMIT = argv["limit"] ? parseInt(argv["limit"], 10) : Infinity;
const CONCURRENCY = parseInt(argv["concurrency"] ?? "5", 10);
const IMAGE_WIDTH = parseInt(argv["image-width"] ?? "640", 10);
const DATASET_URL =
  argv["dataset-url"] ??
  process.env["UNSPLASH_DATASET_URL"] ??
  "https://unsplash.com/data/lite/latest";
const SKIP_DOWNLOAD = argv["skip-download"] === "true";

const ZIP_PATH = "/tmp/unsplash-lite.zip";
const EXTRACT_DIR = "/tmp/unsplash-lite";

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

const log = {
  info: (...args: unknown[]) => console.log("[INFO]", ...args),
  warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  progress: (done: number, total: number, label: string) => {
    const pct = total === Infinity ? "" : ` (${Math.round((done / total) * 100)}%)`;
    process.stdout.write(`\r[PROGRESS] ${done}/${total === Infinity ? "?" : total}${pct} — ${label}  `);
  },
};

// ---------------------------------------------------------------------------
// Step 1: Download the dataset ZIP
// ---------------------------------------------------------------------------

async function downloadDataset(): Promise<void> {
  if (SKIP_DOWNLOAD) {
    try {
      await fs.access(ZIP_PATH);
      log.info(`Skipping download, using cached file at ${ZIP_PATH}`);
      return;
    } catch {
      log.warn(`--skip-download set but ${ZIP_PATH} not found; downloading anyway`);
    }
  }

  log.info(`Downloading Unsplash Lite dataset from ${DATASET_URL} …`);

  const res = await fetch(DATASET_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; auction-embedding-seeder/1.0; +https://github.com/sixtene/auction-embedding)",
      Accept: "application/zip,application/octet-stream,*/*",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Dataset download failed: HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const total = parseInt(res.headers.get("content-length") ?? "0", 10);
  log.info(`Content-Type: ${contentType}, Size: ${total ? `${(total / 1_048_576).toFixed(1)} MB` : "unknown"}`);

  if (!res.body) {
    throw new Error("No response body from dataset download");
  }

  let downloaded = 0;
  const out = createWriteStream(ZIP_PATH);

  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      out.write(value);
      downloaded += value.length;
      if (total) {
        log.progress(Math.round(downloaded / 1_048_576), Math.round(total / 1_048_576), "MB downloaded");
      }
    }
  } finally {
    reader.releaseLock();
    out.end();
  }

  console.log(); // newline after progress
  log.info(`Download complete: ${(downloaded / 1_048_576).toFixed(1)} MB → ${ZIP_PATH}`);
}

// ---------------------------------------------------------------------------
// Step 2: Extract the ZIP and find the photos TSV
// ---------------------------------------------------------------------------

async function extractDataset(): Promise<string> {
  await fs.mkdir(EXTRACT_DIR, { recursive: true });

  log.info(`Extracting ${ZIP_PATH} → ${EXTRACT_DIR} …`);

  // Use the system unzip command (available on most Linux/macOS environments)
  const proc = Bun.spawnSync(["unzip", "-o", "-d", EXTRACT_DIR, ZIP_PATH]);
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`unzip failed (exit ${proc.exitCode}): ${stderr}`);
  }

  // Locate photos TSV — Unsplash names the file "photos.tsv000" or "photos.tsv"
  const files = await fs.readdir(EXTRACT_DIR);
  const photosTsv = files.find((f) => f.startsWith("photos.tsv"));
  if (!photosTsv) {
    throw new Error(
      `Could not find photos TSV in extracted archive. Files found: ${files.join(", ")}`,
    );
  }

  const tsvPath = path.join(EXTRACT_DIR, photosTsv);
  log.info(`Found photos file: ${tsvPath}`);
  return tsvPath;
}

// ---------------------------------------------------------------------------
// Step 3: Parse the photos TSV
// ---------------------------------------------------------------------------

type PhotoRow = {
  photo_id: string;
  photo_url: string;
  photo_image_url: string;
  photo_description: string;
  ai_description: string;
  photo_aspect_ratio: string;
  photo_width: string;
  photo_height: string;
  photographer_username: string;
  photographer_first_name: string;
  photographer_last_name: string;
  photographer_location: string;
  photo_submitted_at: string;
  [key: string]: string;
};

async function* parsePhotosTsv(tsvPath: string): AsyncGenerator<PhotoRow> {
  const file = Bun.file(tsvPath);
  const text = await file.text();
  const lines = text.split("\n");

  if (lines.length < 2) {
    throw new Error("photos TSV appears empty");
  }

  const headers = lines[0]!.split("\t").map((h) => h.trim());
  log.info(`TSV columns (${headers.length}): ${headers.slice(0, 8).join(", ")} …`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const cols = line.split("\t");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = cols[j] ?? "";
    }

    if (!row["photo_id"] || !row["photo_image_url"]) continue;

    yield row as PhotoRow;
  }
}

// ---------------------------------------------------------------------------
// Step 4: Build image download URL
// ---------------------------------------------------------------------------

function buildImageUrl(photo: PhotoRow): string {
  const base = photo["photo_image_url"];
  // Append sizing params if not already present
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}w=${IMAGE_WIDTH}&q=80&fm=jpg&fit=max`;
}

// ---------------------------------------------------------------------------
// Step 5: Upload one image to the API
// ---------------------------------------------------------------------------

type UploadResult =
  | { ok: true; id: string; photoId: string }
  | { ok: false; photoId: string; reason: string };

async function uploadPhoto(photo: PhotoRow): Promise<UploadResult> {
  const imageUrl = buildImageUrl(photo);

  // Download the image bytes
  let imgRes: Response;
  try {
    imgRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "auction-embedding-seeder/1.0",
      },
    });
  } catch (e) {
    return { ok: false, photoId: photo["photo_id"], reason: `Fetch failed: ${e}` };
  }

  if (!imgRes.ok) {
    return {
      ok: false,
      photoId: photo["photo_id"],
      reason: `Image download HTTP ${imgRes.status}`,
    };
  }

  const imgBytes = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

  // Build multipart form
  const formData = new FormData();
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const blob = new Blob([imgBytes], { type: contentType });
  formData.append("image", blob, `${photo["photo_id"]}.${ext}`);

  // Attach Unsplash metadata as tags
  const description =
    photo["photo_description"] || photo["ai_description"] || undefined;
  const tags: Record<string, unknown> = {
    source: "unsplash",
    unsplash_id: photo["photo_id"],
    unsplash_url: photo["photo_url"],
    photographer: `${photo["photographer_first_name"]} ${photo["photographer_last_name"]}`.trim(),
    photographer_username: photo["photographer_username"],
  };
  if (description) tags["description"] = description;
  if (photo["photographer_location"]) tags["location"] = photo["photographer_location"];

  formData.append("metadata", JSON.stringify(tags));

  // POST to API
  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/images`, {
      method: "POST",
      body: formData,
    });
  } catch (e) {
    return { ok: false, photoId: photo["photo_id"], reason: `API request failed: ${e}` };
  }

  if (!apiRes.ok) {
    let body = "";
    try {
      body = await apiRes.text();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      photoId: photo["photo_id"],
      reason: `API HTTP ${apiRes.status}: ${body.slice(0, 200)}`,
    };
  }

  const json = (await apiRes.json()) as { id: string };
  return { ok: true, id: json["id"], photoId: photo["photo_id"] };
}

// ---------------------------------------------------------------------------
// Step 6: Concurrent worker pool
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(
  items: AsyncGenerator<T>,
  concurrency: number,
  fn: (item: T) => Promise<R>,
  onResult: (result: R, index: number) => void,
): Promise<void> {
  const queue: Promise<void>[] = [];
  let index = 0;

  async function processNext(item: T, i: number): Promise<void> {
    const result = await fn(item);
    onResult(result, i);
  }

  for await (const item of items) {
    const i = index++;
    const p = processNext(item, i).catch((e) => {
      log.warn(`Worker ${i} threw unexpectedly: ${e}`);
    });
    queue.push(p);

    if (queue.length >= concurrency) {
      // Wait for at least one to finish before continuing
      await Promise.race(queue);
      // Remove settled promises
      for (let j = queue.length - 1; j >= 0; j--) {
        const status = await Promise.race([
          queue[j]!.then(() => "done"),
          Promise.resolve("pending"),
        ]);
        if (status === "done") queue.splice(j, 1);
      }
    }
  }

  // Drain remaining
  await Promise.allSettled(queue);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log.info("=== auction-embedding Unsplash seeder ===");
  log.info(`API URL:      ${API_URL}`);
  log.info(`Limit:        ${LIMIT === Infinity ? "all" : LIMIT}`);
  log.info(`Concurrency:  ${CONCURRENCY}`);
  log.info(`Image width:  ${IMAGE_WIDTH}px`);

  // Verify the API is reachable before doing heavy work
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    log.info("API health check: OK");
  } catch (e) {
    log.error(`API at ${API_URL} is not reachable: ${e}`);
    log.error("Start the server with `bun run dev` then retry.");
    process.exit(1);
  }

  // Download dataset
  await downloadDataset();

  // Extract archive
  const tsvPath = await extractDataset();

  // Parse and stream photos
  const allPhotos = parsePhotosTsv(tsvPath);

  // Apply limit
  async function* limitedPhotos(): AsyncGenerator<PhotoRow> {
    let count = 0;
    for await (const p of allPhotos) {
      if (count >= LIMIT) break;
      yield p;
      count++;
    }
  }

  let succeeded = 0;
  let failed = 0;
  let total = 0;
  const failures: Array<{ photoId: string; reason: string }> = [];

  function onResult(result: UploadResult, _index: number) {
    total++;
    if (result.ok) {
      succeeded++;
      log.progress(total, LIMIT, `✓ ${result.photoId} → ${result.id}`);
    } else {
      failed++;
      failures.push({ photoId: result.photoId, reason: result.reason });
      // Don't spam, just count
      log.progress(total, LIMIT, `✗ ${result.photoId}: ${result.reason.slice(0, 60)}`);
    }
  }

  log.info("Starting upload …");
  await runWithConcurrency(limitedPhotos(), CONCURRENCY, uploadPhoto, onResult);

  console.log(); // newline after last progress line

  // Summary
  log.info("=== Done ===");
  log.info(`Total processed: ${total}`);
  log.info(`Succeeded:       ${succeeded}`);
  log.info(`Failed:          ${failed}`);

  if (failures.length > 0) {
    const failPath = "/tmp/unsplash-seed-failures.json";
    await fs.writeFile(failPath, JSON.stringify(failures, null, 2));
    log.warn(`${failures.length} failures written to ${failPath}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  log.error("Fatal:", e);
  process.exit(1);
});
