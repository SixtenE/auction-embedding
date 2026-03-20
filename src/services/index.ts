import { db } from "../lib/db.js";
import { getEnv } from "../lib/env.js";
import { createEmbeddingService } from "./embeddings.js";
import { createImageMetadataService } from "./image-metadata.js";
import { createStorageService } from "./storage.js";
import { createQdrantService } from "./vector-db.js";

export const env = getEnv();
export const storage = createStorageService(env);
export const embeddings = createEmbeddingService(env);
export const vectorDb = createQdrantService(env);
export const imageMetadata = createImageMetadataService(env, db, storage, embeddings, vectorDb);
