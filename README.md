# auction-embedding

Hono API: upload images to S3-compatible storage, embed with **Gemini Embedding 2**, store vectors in **PostgreSQL + pgvector**, search by image similarity.

## Prerequisites

- [Bun](https://bun.sh/)
- Docker (for local Postgres + MinIO)
- A [Gemini API key](https://ai.google.dev/gemini-api/docs/api-key) with access to the embedding model you configure (`gemini-embedding-2-preview` by default)

## Setup

1. **Environment**

   ```sh
   cp .env.example .env
   ```

   Set `GEMINI_API_KEY` and adjust URLs if not using the compose defaults.

2. **Start Postgres + MinIO**

   ```sh
   docker compose up -d
   ```

3. **Create the MinIO bucket**

   The app does not create the bucket automatically. In the MinIO console (`http://localhost:9001`, user `minio` / `minio_secret`), create a bucket named **`images`**, or:

   ```sh
   aws --endpoint-url http://localhost:9000 s3 mb s3://images \
     --region us-east-1
   ```

   (Configure `aws` with access key `minio` / secret `minio_secret` if needed.)

4. **Run migrations**

   ```sh
   bun run db:migrate
   ```

   Ensure `DATABASE_URL` in `.env` points at the running Postgres (see `.env.example`).

5. **Run the API**

   ```sh
   bun run dev
   ```

   Server: `http://localhost:3000` (or `PORT` from `.env`).

## Tests

[Vitest](https://vitest.dev/) with Hono’s [`testClient`](https://hono.dev/docs/helpers/testing) (no live DB/S3 required for the included cases):

```sh
bun run test
```

## API

HTTP reference: [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0; use with Swagger UI, Redoc, or codegen).

### Health

```sh
curl -s http://localhost:3000/health
```

### Upload an image (`POST /images`)

Multipart form field **`image`**. Optional **`metadata`**: JSON string of extra tags (object).

```sh
curl -s -X POST http://localhost:3000/images \
  -F "image=@./photo.jpg" \
  -F 'metadata={"source":"demo"}'
```

### Search by image (`POST /search/image`)

Form fields: **`image`** (file), optional **`topK`** (string, default from `DEFAULT_TOP_K`).

```sh
curl -s -X POST http://localhost:3000/search/image \
  -F "image=@./query.jpg" \
  -F "topK=5"
```

### Get metadata (`GET /images/:id`)

```sh
curl -s http://localhost:3000/images/<uuid>
```

### Delete (`DELETE /images/:id`)

```sh
curl -s -X DELETE http://localhost:3000/images/<uuid>
```

### Reindex (`POST /images/:id/reindex`)

Re-embeds from stored object (same model/dim from env).

```sh
curl -s -X POST http://localhost:3000/images/<uuid>/reindex
```

## Scripts

| Script            | Description              |
| ----------------- | ------------------------ |
| `bun run dev`     | Dev server with hot reload |
| `bun run db:generate` | New migration from schema |
| `bun run db:migrate`  | Apply migrations       |
| `bun run db:push`     | Push schema (dev only) |

## Notes

- **Similarity**: Results use cosine distance via pgvector; the API returns **score ≈ 1 − distance** (`vector_cosine_ops`).
- **Limits**: Max upload size `MAX_UPLOAD_BYTES` (default 10 MB). Accepted types: JPEG, PNG, WebP, HEIC/HEIF (MIME + magic-byte check). **HEIC** uploads are decoded and stored as **PNG** (and embedded from that PNG). HEIC needs a **sharp/libvips build with libheif** (common on macOS; on Linux you may need extra packages such as `libheif` / `vips` with HEIF enabled).
- **Image URLs**: JSON responses use **presigned GET URLs** so private buckets work. TTL is `S3_PRESIGN_EXPIRES_SECONDS` (60–604800s, default 3600). `S3_PUBLIC_BASE_URL` is still stored on rows as a stable prefix reference.

## Project layout

- `src/routes/` — HTTP handlers
- `src/services/` — storage, embeddings, vector search, image records
- `src/db/schema.ts` — Drizzle + `vector(3072)`
- `drizzle/` — SQL migrations
