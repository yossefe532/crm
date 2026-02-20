import redis from "redis"
import { env } from "../config/env"

// Redis client initialization
const redisClient = redis.createClient({ url: env.redisUrl })

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err)
})

// Connect to Redis (non-blocking)
redisClient.connect().catch(console.error)

// Cache wrapper for async functions
const TIMEOUT_MS = 1000 // 1 second timeout for cache operations

const withTimeout = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallback)
    }, TIMEOUT_MS)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    console.error("Redis Operation Error:", error)
    return fallback
  }
}

export const cache = {
  // Get cached value
  get: async (key: string): Promise<any> => {
    if (!redisClient.isOpen) return null
    return withTimeout(
      (async () => {
        try {
          const value = await redisClient.get(key)
          return value ? JSON.parse(value) : null
        } catch (error) {
          console.error("Cache GET error:", error)
          return null
        }
      })(),
      null
    )
  },

  // Set value in cache with expiration
  set: async (key: string, value: any, ttlSeconds?: number): Promise<void> => {
    if (!redisClient.isOpen) return
    const operation = async () => {
      try {
        const serializedValue = JSON.stringify(value)
        if (ttlSeconds) {
          await redisClient.setEx(key, ttlSeconds, serializedValue)
        } else {
          await redisClient.set(key, serializedValue)
        }
      } catch (error) {
        console.error("Cache SET error:", error)
      }
    }
    // We don't await the set operation with timeout strictly, but we want to avoid unhandled rejections
    // For set, we can just fire and forget or await with timeout if consistency is critical. 
    // Here we'll await it but fail silently on timeout to not block.
    await withTimeout(operation(), undefined)
  },

  // Delete cached value
  del: async (key: string): Promise<void> => {
    if (!redisClient.isOpen) return
    await withTimeout(
      (async () => {
        try {
          await redisClient.del(key)
        } catch (error) {
          console.error("Cache DEL error:", error)
        }
      })(),
      undefined
    )
  },

  // Clear all cache (use with caution)
  flush: async (): Promise<void> => {
    if (!redisClient.isOpen) return
    await withTimeout(
      (async () => {
        try {
          await redisClient.flushAll()
        } catch (error) {
          console.error("Cache FLUSH error:", error)
        }
      })(),
      undefined
    )
  }
}