import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";

export type StorageService = {
  upload(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
  getBytes(key: string): Promise<Uint8Array>;
  presignedGetUrl(key: string): Promise<string>;
};

function publicUrlForKey(env: Env, key: string): string {
  const base = env.S3_ENDPOINT.replace(/\/$/, "");
  return `${base}/${env.S3_BUCKET}/${key}`;
}

export function createStorageService(env: Env): StorageService {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  return {
    async upload({ key, body, contentType }) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: Buffer.from(body),
            ContentType: contentType,
          }),
        );
      } catch (e) {
        console.error(e);
        throw new AppError("Object storage upload failed", 502, "STORAGE_FAILED");
      }
      return { key, url: publicUrlForKey(env, key) };
    },

    async delete(key) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
          }),
        );
      } catch (e) {
        console.error(e);
        throw new AppError("Object storage delete failed", 502, "STORAGE_FAILED");
      }
    },

    async getBytes(key) {
      const out = await client.send(
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
        }),
      );
      const body = out.Body;
      if (!body) throw new AppError("Object not found in storage", 404, "NOT_FOUND");
      const buf = await body.transformToByteArray();
      return new Uint8Array(buf);
    },

    async presignedGetUrl(key) {
      try {
        const cmd = new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
        });
        return await getSignedUrl(client, cmd, {
          expiresIn: env.S3_PRESIGN_EXPIRES_SECONDS,
        });
      } catch (e) {
        console.error(e);
        throw new AppError("Failed to sign object URL", 502, "STORAGE_FAILED");
      }
    },
  };
}
