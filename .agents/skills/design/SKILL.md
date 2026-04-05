---
name: design
description: Generates or updates a DESIGN.md file that documents the project's architecture, key design decisions, data models, service boundaries, and API contracts. Trigger this skill when the user asks to "create a DESIGN.md", "document the architecture", or "explain the system design".
---

# Design Documentation Skill

This skill produces a `DESIGN.md` file that captures the technical design of the project in one authoritative place.

## When to Use This Skill

Trigger this skill when the user:

- Asks to "create a DESIGN.md" or "write a design doc"
- Wants to "document the architecture" or "explain how the system works"
- Asks for an "architectural overview" or "system design summary"
- Onboards contributors and needs a technical reference document
- Prepares for a design review

## What to Include in DESIGN.md

A good `DESIGN.md` covers:

1. **Overview** — One paragraph explaining what the system does and why it exists.
2. **Architecture Diagram** (ASCII or Mermaid) — Shows how the major components connect.
3. **Component Breakdown** — Each major service, module, or layer with its responsibility.
4. **Data Models** — Key database tables or schemas and their relationships.
5. **API Contracts** — Endpoints, request/response shapes, and notable constraints.
6. **Key Design Decisions** — The non-obvious choices made and the reasons behind them (ADR-style).
7. **External Dependencies** — Third-party services, why they were chosen, and what they own.
8. **Invariants & Constraints** — Things that must always be true (e.g. vector dimension must match embedding model).

## How to Generate DESIGN.md

### Step 1: Read the Codebase

Before writing anything, read:

- Entry point (e.g. `src/index.ts`, `src/app.ts`, `main.py`)
- Route / controller files
- Service layer files
- Database schema files
- Environment / configuration files
- Existing `README.md`

Use `Glob` and `Read` to gather this context. Do **not** guess—read the actual files.

### Step 2: Identify the Layers

Map what you find into layers:

| Layer | What to look for |
|-------|-----------------|
| HTTP / API | Route definitions, middleware, request validation |
| Service | Business logic, orchestration between storage and external APIs |
| Storage | Database schema, ORM queries, migrations |
| External APIs | Third-party SDK calls (AI models, object storage, vector DBs) |
| Frontend | UI components, API client, state management |

### Step 3: Surface Design Decisions

Look for:

- Comments that say "why" not "what"
- Configuration constants with magic values (e.g. embedding dimensions)
- Error handling strategies (custom error classes, status codes)
- Any workarounds or normalisation steps (e.g. converting HEIC → PNG before embedding)

### Step 4: Write DESIGN.md

Write the file at the repo root. Use the template below as a starting point, filling in project-specific details from what you read.

```markdown
# Design

## Overview

[One paragraph: what the system does, who uses it, the core value.]

## Architecture

\`\`\`
[ASCII or Mermaid diagram of components and data flow]
\`\`\`

## Components

### [Component Name]
- **Location**: `src/...`
- **Responsibility**: ...

(repeat for each major component)

## Data Model

### [Table / Schema Name]
| Column | Type | Notes |
|--------|------|-------|
| ...    | ...  | ...   |

## API

| Method | Path | Description |
|--------|------|-------------|
| ...    | ...  | ...         |

## Key Design Decisions

### [Decision Title]
**Context**: ...
**Decision**: ...
**Consequences**: ...

(repeat for each significant decision)

## External Dependencies

| Service | Purpose | SDK / Client |
|---------|---------|--------------|
| ...     | ...     | ...          |

## Invariants

- ...
\`\`\`

### Step 5: Verify and Commit

After writing:

1. Re-read the generated `DESIGN.md` and check it against the actual code.
2. Confirm every component, table, and endpoint mentioned actually exists.
3. Commit: `docs: add DESIGN.md`

## Quality Checklist

Before finishing, confirm:

- [ ] Every top-level `src/` directory has a corresponding component entry
- [ ] All database tables in the schema are documented
- [ ] All HTTP routes are listed in the API section
- [ ] External services are listed with their purpose
- [ ] At least one design decision is documented
- [ ] No fabricated details—everything is traceable to the source code

## Example: auction-embedding

Below is a reference DESIGN.md for the `auction-embedding` project that lives in this repository. Use it as a concrete example of the expected output quality.

---

# Design

## Overview

`auction-embedding` is a Hono API that lets clients upload images, embed them with Google's Gemini Embedding model, store the vectors in Qdrant, and search for visually similar images. A React frontend provides upload and search UI.

## Architecture

```
Client (browser / curl)
        │
        ▼
  Hono HTTP API  (src/app.ts)
  ┌──────────────────────────────┐
  │  POST /images                │──► S3-compatible storage (MinIO / R2)
  │  GET  /images/:id            │──► PostgreSQL  (image metadata)
  │  DELETE /images/:id          │──► Qdrant      (embedding vectors)
  │  POST /images/:id/reindex    │
  │  POST /search/image          │──► Gemini Embedding API
  └──────────────────────────────┘
        ▲
        │
  React Frontend (frontend/)
```

## Components

### Routes (`src/routes/`)
Thin HTTP handlers that parse multipart form data, delegate to services, and shape JSON responses.

### EmbeddingService (`src/services/embeddings.ts`)
Wraps the `@google/genai` SDK. Encodes image bytes as base64, calls `embedContent`, and validates the returned vector dimension matches `EMBEDDING_DIMENSIONS`.

### QdrantService (`src/services/vector-db.ts`)
Wraps `@qdrant/js-client-rest`. Lazily creates the collection on first use (with a mutex-style promise to avoid races). Exposes `upsertImageVector`, `deleteImageVector`, and `searchSimilar`.

### ImageMetadataService (`src/services/image-metadata.ts`)
Reads and writes image rows in PostgreSQL via Drizzle ORM.

### StorageService (`src/services/storage.ts`)
Uploads objects to and generates presigned URLs from an S3-compatible bucket.

### Database Schema (`src/db/schema.ts`)
Drizzle schema for the `images` table in PostgreSQL.

### Frontend (`frontend/`)
Vite + React app. Two tabs: upload (drag-and-drop) and search (query by image). Uses TanStack Query for data fetching.

## Data Model

### `images`

| Column             | Type        | Notes                                      |
|--------------------|-------------|--------------------------------------------|
| `id`               | uuid PK     | Auto-generated                             |
| `original_filename`| text        |                                            |
| `mime_type`        | text        |                                            |
| `file_size`        | integer     | Bytes                                      |
| `width` / `height` | integer     | Nullable; populated during upload          |
| `storage_key`      | text unique | Object key in S3 bucket                    |
| `public_url`       | text        | Path-style reference; presigned at query time |
| `embedding_model`  | text        | Model name used for this image's embedding |
| `embedding_dim`    | integer     | Dimension of the stored vector             |
| `status`           | text        | `uploaded` → `embedding` → `indexed` / `failed` |
| `tags`             | jsonb       | Arbitrary client-supplied metadata         |
| `created_at`       | timestamptz |                                            |
| `updated_at`       | timestamptz |                                            |

## API

| Method | Path                      | Description                              |
|--------|---------------------------|------------------------------------------|
| GET    | `/health`                 | Liveness check                           |
| POST   | `/images`                 | Upload image + optional metadata JSON    |
| GET    | `/images/:id`             | Fetch image metadata + presigned URL     |
| DELETE | `/images/:id`             | Delete image from storage, DB, and Qdrant|
| POST   | `/images/:id/reindex`     | Re-embed from stored object              |
| POST   | `/search/image`           | Find similar images by query image       |

## Key Design Decisions

### Image normalisation before embedding
**Context**: Gemini image embeddings only accept PNG and JPEG. Clients may upload WebP or HEIC.  
**Decision**: Decode WebP and HEIC to PNG via `sharp` before sending to the embedding API.  
**Consequences**: HEIC support requires a `sharp` build with `libheif` (not always present on Linux).

### Cosine similarity in Qdrant
**Context**: Images with similar visual content should score high regardless of vector magnitude.  
**Decision**: Create the Qdrant collection with `distance: Cosine`.  
**Consequences**: Scores are in `[-1, 1]`; returned as-is in search results.

### Presigned URLs instead of public bucket
**Context**: Keeping the bucket private avoids accidental public exposure.  
**Decision**: `public_url` stored in Postgres is a logical path reference; actual download URLs are presigned at query time with a configurable TTL (`S3_PRESIGN_EXPIRES_SECONDS`, default 3600 s).  
**Consequences**: URLs in API responses expire. Clients must not cache them beyond the TTL.

### Lazy Qdrant collection creation
**Context**: Requiring operators to pre-create the collection adds setup friction.  
**Decision**: `QdrantService` checks for collection existence and creates it on the first operation, using a promise to prevent duplicate create races.  
**Consequences**: First request after a cold start is slightly slower; races between concurrent first-requests are handled gracefully by re-checking existence after a create error.

## External Dependencies

| Service              | Purpose                        | SDK / Client                  |
|----------------------|--------------------------------|-------------------------------|
| Google Gemini        | Image embedding                | `@google/genai`               |
| Qdrant               | Vector storage and ANN search  | `@qdrant/js-client-rest`      |
| PostgreSQL           | Image metadata                 | Drizzle ORM + `postgres` driver|
| S3-compatible storage| Binary image storage           | `@aws-sdk/client-s3`          |

## Invariants

- The vector dimension stored in Qdrant must equal `EMBEDDING_DIMENSIONS` (defined in `src/constants/embedding.ts`). A mismatch throws an `EMBEDDING_FAILED` error immediately.
- An image row must reach `status = "indexed"` before it appears in search results (`queryNearestByVector` filters on `eq(images.status, "indexed")`).
- `storage_key` is unique; uploading the same file twice produces two distinct rows with distinct keys.
