import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema.js'
import { getEnv } from './env.js'

const env = getEnv()

const pool = new pg.Pool({ connectionString: env.DATABASE_URL })

export const db = drizzle(pool, { schema })

export type Database = typeof db

export { pool }
