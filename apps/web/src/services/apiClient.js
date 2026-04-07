import axios from 'axios'
import { z } from 'zod'
import { API_BASE_URL } from './authClient.js'

// ── Axios Instance ──
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Interceptors (Professional Error Handling) ──
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || 'Something went wrong.'
    const status = error.response?.status
    
    // Globally handle 401s if needed (e.g., redirect to login)
    if (status === 401) {
      // window.location.href = '/auth'
    }

    const enhancedError = new Error(message)
    enhancedError.status = status
    return Promise.reject(enhancedError)
  }
)

/**
 * Professional Fetcher with Zod Validation
 * @param {string} url 
 * @param {object} options 
 * @param {z.ZodSchema} schema 
 */
export const validatedRequest = async (config, schema) => {
  // Config can now include a 'signal' property from AbortController
  const data = await api(config)
  
  if (schema) {
    const result = schema.safeParse(data)
    if (!result.success) {
      console.error('[API Validation Error]:', result.error.format())
      // In production, we might just return data anyway to be safe, 
      // but log the error to Sentry/Analytics.
    }
  }
  
  return data
}

// ── Schemas (Standardizing our data models) ──

export const AlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(z.string()),
  cover: z.string().optional().nullable(),
  releaseYear: z.number().optional().nullable(),
  genres: z.array(z.string()).optional(),
  communityRating: z.number().optional(),
  reviewCount: z.number().optional(),
})

export const ApiResponseSchema = z.object({
  data: z.any(),
  error: z.string().optional(),
})

export default api
