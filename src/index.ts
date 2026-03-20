import { createApp } from './app.js'
import { getEnv } from './lib/env.js'

const env = getEnv()
const app = createApp()

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
})

console.log(`Listening on http://localhost:${env.PORT}`)
