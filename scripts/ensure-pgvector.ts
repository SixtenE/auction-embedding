import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url?.trim()) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector')
} finally {
  await client.end()
}
