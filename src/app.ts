import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { imagesRoute } from "./routes/images.js";
import { searchRoute } from "./routes/search.js";
import { isAppError } from "./lib/errors.js";

export function createApp() {
  return new Hono()
    .get("/health", (c) => c.json({ ok: true }))
    .route("/images", imagesRoute)
    .route("/search", searchRoute)
    .use("/*", serveStatic({ root: "./frontend/dist" }))
    .get("*", async (c) => {
      const html = await Bun.file("./frontend/dist/index.html").text();
      return c.html(html);
    })
    .onError((err, c) => {
      if (err instanceof ZodError) {
        return c.json(
          { error: "Validation error", details: err.flatten() },
          400 as ContentfulStatusCode,
        );
      }
      if (isAppError(err)) {
        return c.json({ error: err.message, code: err.code }, err.status as ContentfulStatusCode);
      }
      console.error(err);
      return c.json({ error: "Internal Server Error" }, 500);
    });
}
