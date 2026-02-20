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
export const cache = {
  // Get cached value
  get: async (key: string): Promise<any> => {
    try {
      const value = await redisClient.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error("Cache GET error:", error)
      return null
    }
  },

  // Set value in cache with expiration
  set: async (key: string, value: any, ttlSeconds?: number): Promise<void> => {
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
  },

  // Delete cached value
  del: async (key: string): Promise<void> => {
    try {
      await redisClient.del(key)
    } catch (error) {
      console.error("Cache DEL error:", error)
    }
  },

  // Clear all cache (use with caution)
  flush: async (): Promise<void> => {
    try {
      await redisClient.flushAll()
    } catch (error) {
      console.error("Cache FLUSH error:", error)
    }
  }
}