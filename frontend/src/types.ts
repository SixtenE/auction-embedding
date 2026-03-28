export type ImageStatus = "uploaded" | "embedding" | "indexed" | "failed";

export interface UploadResponse {
  id: string;
  status: ImageStatus;
  url: string;
  width?: number | null;
  height?: number | null;
  embeddingModel?: string;
}

export interface ImageRecord {
  id: string;
  userId?: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  url: string;
  embeddingModel: string;
  embeddingDim: number;
  status: ImageStatus;
  tags?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchMatch {
  id: string;
  url: string;
  score: number;
  metadata: {
    filename?: string;
    width?: number;
    height?: number;
    mimeType?: string;
  };
}

export interface SearchResponse {
  query: { topK: number };
  matches: SearchMatch[];
}
