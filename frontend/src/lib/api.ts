import type { ImageRecord, SearchResponse, UploadResponse } from "@/types";

const BASE = "";

export async function uploadImage(
  file: File,
  tags?: Record<string, unknown>
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("image", file);
  if (tags) form.append("metadata", JSON.stringify({ tags }));

  const res = await fetch(`${BASE}/images`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<UploadResponse>;
}

export async function getImage(id: string): Promise<ImageRecord> {
  const res = await fetch(`${BASE}/images/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Not found (${res.status})`);
  }
  return res.json() as Promise<ImageRecord>;
}

export async function deleteImage(id: string): Promise<void> {
  const res = await fetch(`${BASE}/images/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Delete failed (${res.status})`);
  }
}

export async function searchByImage(
  file: File,
  topK?: number
): Promise<SearchResponse> {
  const form = new FormData();
  form.append("image", file);
  if (topK != null) form.append("topK", String(topK));

  const res = await fetch(`${BASE}/search/image`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Search failed (${res.status})`);
  }
  return res.json() as Promise<SearchResponse>;
}
