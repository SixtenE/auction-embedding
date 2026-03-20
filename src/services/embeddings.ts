import {
  createPartFromBase64,
  createUserContent,
  GoogleGenAI,
} from '@google/genai'
import { EMBEDDING_DIMENSIONS } from '../constants/embedding.js'
import type { Env } from '../lib/env.js'
import { AppError } from '../lib/errors.js'

export type EmbeddingService = {
  embedImage(input: { bytes: Uint8Array; mimeType: string }): Promise<number[]>
}

export function createEmbeddingService(env: Env): EmbeddingService {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })

  return {
    async embedImage({ bytes, mimeType }) {
      const b64 = Buffer.from(bytes).toString('base64')
      try {
        const res = await ai.models.embedContent({
          model: env.EMBEDDING_MODEL,
          contents: createUserContent(createPartFromBase64(b64, mimeType)),
          config: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        })
        const values = res.embeddings?.[0]?.values
        if (!values || values.length !== EMBEDDING_DIMENSIONS) {
          throw new AppError(
            `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${values?.length ?? 0}`,
            502,
            'EMBEDDING_FAILED',
          )
        }
        return values
      } catch (e) {
        if (e instanceof AppError) throw e
        console.error(e)
        throw new AppError('Embedding API failed', 502, 'EMBEDDING_FAILED')
      }
    },
  }
}
