/**
 * Loaded before test files so `getEnv()` and DB pool init see valid values
 * when importing the app graph.
 */
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/test'
process.env.GEMINI_API_KEY ??= 'test-gemini-key'
process.env.S3_ENDPOINT ??= 'http://127.0.0.1:9000'
process.env.S3_REGION ??= 'us-east-1'
process.env.S3_ACCESS_KEY_ID ??= 'test'
process.env.S3_SECRET_ACCESS_KEY ??= 'test'
process.env.S3_BUCKET ??= 'test-bucket'
process.env.S3_PUBLIC_BASE_URL ??= 'http://127.0.0.1:9000/test-bucket'
