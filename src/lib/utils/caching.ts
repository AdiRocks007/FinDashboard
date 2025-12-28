/**
 * Simple in-memory cache to avoid hitting APIs too often.
 * Stores responses with expiration times and automatically cleans up old entries.
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  hits: number
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
  onEvict?: (key: string, value: unknown) => void
}

export class MemoryCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>()
  private ttl: number
  private maxSize: number
  private onEvict: ((key: string, value: unknown) => void) | undefined
  
  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 5 * 60 * 1000 // Default 5 minutes
    this.maxSize = options.maxSize || 100
    this.onEvict = options.onEvict
  }
  
  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return undefined
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return undefined
    }
    
    // Update hit count
    entry.hits++
    
    return entry.data
  }
  
  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }
    
    const now = Date.now()
    const expiresAt = now + (ttl || this.ttl)
    
    this.cache.set(key, {
      data: value,
      timestamp: now,
      expiresAt,
      hits: 0
    })
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return false
    }
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return false
    }
    
    return true
  }
  
  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    
    if (entry && this.onEvict) {
      this.onEvict(key, entry.data)
    }
    
    return this.cache.delete(key)
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache.entries()) {
        this.onEvict(key, entry.data)
      }
    }
    
    this.cache.clear()
  }
  
  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }
  
  /**
   * Get cache statistics
   */
  stats(): {
    size: number
    entries: Array<{ key: string; hits: number; age: number }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: now - entry.timestamp
    }))
    
    return {
      size: this.cache.size,
      entries
    }
  }
  
  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey)
    }
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key)
      }
    }
  }
}

/**
 * Create a memoized function with caching
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: CacheOptions & { keyFn?: (...args: Parameters<T>) => string } = {}
): T {
  const cache = new MemoryCache<ReturnType<T>>(options)
  const keyFn = options.keyFn || ((...args: unknown[]) => JSON.stringify(args))
  
  return ((...args: Parameters<T>) => {
    const key = keyFn(...args)
    const cached = cache.get(key)
    
    if (cached !== undefined) {
      return cached
    }
    
    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    
    return result
  }) as T
}

/**
 * Global cache instance for API responses
 */
export const apiCache = new MemoryCache<unknown>({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 50
})

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(
  endpoint: string,
  params?: Record<string, unknown>
): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }
  
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&')
  
  return `${endpoint}?${sortedParams}`
}

/**
 * Sophisticated API cache with size limits and LRU eviction
 */
interface APICacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  size: number
  lastAccessed: number
}

export class APICache {
  private cache = new Map<string, APICacheEntry<unknown>>()
  private maxSize: number = 50 * 1024 * 1024 // 50MB
  private currentSize: number = 0
  private hits: number = 0
  private misses: number = 0

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number): void {
    // Calculate data size
    const dataSize = JSON.stringify(data).length

    // Evict old entries if size limit exceeded (LRU)
    while (this.currentSize + dataSize > this.maxSize && this.cache.size > 0) {
      this.evictLRU()
    }

    // Remove existing entry if present
    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
    }

    // Store new entry
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      size: dataSize,
      lastAccessed: now,
    })

    this.currentSize += dataSize
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // Check TTL
    const now = Date.now()
    if (now > entry.timestamp + entry.ttl) {
      this.delete(key)
      this.misses++
      return null
    }

    // Update last accessed time (for LRU)
    entry.lastAccessed = now
    this.hits++

    return entry.data as T
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now > entry.timestamp + entry.ttl) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry) {
      this.currentSize -= entry.size
      return this.cache.delete(key)
    }
    return false
  }

  /**
   * Invalidate entries matching pattern (regex)
   */
  invalidate(pattern: string): void {
    const regex = new RegExp(pattern)
    const keysToDelete: string[] = []

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.delete(key))
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.currentSize = 0
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; size: number; hitRate: number } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? this.hits / total : 0

    return {
      entries: this.cache.size,
      size: this.currentSize,
      hitRate,
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null
    let lruTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed
        lruKey = key
      }
    }

    if (lruKey) {
      this.delete(lruKey)
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.delete(key))
  }
}

// Export singleton instance
export const apiCacheAdvanced = new APICache()

