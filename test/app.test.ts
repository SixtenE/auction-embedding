import { describe, expect, it } from "vitest";
import { testClient } from "hono/testing";
import { createApp } from "../src/app.js";

const app = createApp();
const client = testClient<typeof app>(app);

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await client.health.$get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /images/:id", () => {
  it("returns 400 for invalid UUID", async () => {
    const res = await client.images[":id"].$get({
      param: { id: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Validation error");
  });
});

describe("DELETE /images/:id", () => {
  it("returns 400 for invalid UUID", async () => {
    const res = await client.images[":id"].$delete({
      param: { id: "bad" },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /images/:id/reindex", () => {
  it("returns 400 for invalid UUID", async () => {
    const res = await client.images[":id"].reindex.$post({
      param: { id: "bad" },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /images", () => {
  it("returns 400 when image file is missing", async () => {
    const res = await client.images.$post({
      form: {},
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("MISSING_FILE");
  });
});

describe("POST /search/image", () => {
  it("returns 400 when image file is missing", async () => {
    const res = await client.search.image.$post({
      form: {},
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("MISSING_FILE");
  });
});
