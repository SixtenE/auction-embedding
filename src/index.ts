import { createApp } from "./app.js";
import { getEnv } from "./lib/env.js";
import { serveStatic } from "hono/bun";

const env = getEnv();
const app = createApp()
  .use("/*", serveStatic({ root: "./frontend/dist" }))
  .get("*", async (c) => {
    const html = await Bun.file("./frontend/dist/index.html").text();
    return c.html(html);
  });

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

console.log(`Listening on http://localhost:${env.PORT}`);
