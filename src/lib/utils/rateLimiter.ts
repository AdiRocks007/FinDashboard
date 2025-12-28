/**
 * Prevents making too many API calls too quickly.
 * Tracks requests and blocks new ones if you exceed the limit.
 */

export interface RateLimitConfig {
  maxRequests: number // Maximum requests allowed
  windowMs: number // Time window in milliseconds
  message?: string // Error message when rate limited
}

export interface RateLimitEntry {
  count: number
  resetTime: number
  requests: number[]
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig
  
  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Rate limit exceeded. Please try again later.',
      ...config
    }
  }
  
  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)
    
    // No previous requests
    if (!entry) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        requests: [now]
      })
      return true
    }
    
    // Window has expired, reset
    if (now >= entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        requests: [now]
      })
      return true
    }
    
    // Check if under limit
    if (entry.count < this.config.maxRequests) {
      entry.count++
      entry.requests.push(now)
      return true
    }
    
    return false
  }
  
  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const entry = this.limits.get(key)
    
    if (!entry) {
      return this.config.maxRequests
    }
    
    const now = Date.now()
    
    if (now >= entry.resetTime) {
      return this.config.maxRequests
    }
    
    return Math.max(0, this.config.maxRequests - entry.count)
  }
  
  /**
   * Get reset time for a key
   */
  getResetTime(key: string): number | null {
    const entry = this.limits.get(key)
    
    if (!entry) {
      return null
    }
    
    const now = Date.now()
    
    if (now >= entry.resetTime) {
      return null
    }
    
    return entry.resetTime
  }
  
  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key)
  }
  
  /**
   * Clear all rate limits
   */
  clear(): void {
    this.limits.clear()
  }
  
  /**
   * Get rate limit info for a key
   */
  getInfo(key: string): {
    remaining: number
    resetTime: number | null
    total: number
  } {
    return {
      remaining: this.getRemaining(key),
      resetTime: this.getResetTime(key),
      total: this.config.maxRequests
    }
  }
}

/**
 * Token Bucket Rate Limiter - More sophisticated rate limiting
 */
export class TokenBucket {
  private tokens: number
  private lastRefill: number
  private capacity: number
  private refillRate: number // tokens per second
  private interval: number // Window in milliseconds
  
  constructor(
    maxTokens: number, // Max requests per interval
    refillRate: number, // Tokens added per second
    interval: number = 60000 // Window in milliseconds (default 1 minute)
  ) {
    this.capacity = maxTokens
    this.tokens = maxTokens
    this.refillRate = refillRate
    this.interval = interval
    this.lastRefill = Date.now()
  }
  
  /**
   * Acquire a token (async for potential future async operations)
   */
  async acquire(): Promise<boolean> {
    this.refill()
    
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    
    return false
  }
  
  /**
   * Try to consume tokens (synchronous version)
   */
  consume(tokens = 1): boolean {
    this.refill()
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return true
    }
    
    return false
  }
  
  /**
   * Get available tokens
   */
  getAvailable(): number {
    this.refill()
    return Math.floor(this.tokens)
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000 // seconds
    const tokensToAdd = elapsed * this.refillRate
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd)
    this.lastRefill = now
  }
  
  /**
   * Reset bucket to full capacity
   */
  reset(): void {
    this.tokens = this.capacity
    this.lastRefill = Date.now()
  }
  
  /**
   * Get current status
   */
  getStatus(): { remaining: number; resetAt: Date } {
    this.refill()
    const remaining = Math.floor(this.tokens)
    const tokensNeeded = this.capacity - remaining
    const secondsUntilFull = tokensNeeded / this.refillRate
    const resetAt = new Date(Date.now() + secondsUntilFull * 1000)
    
    return {
      remaining,
      resetAt,
    }
  }
}

/**
 * Global rate limiters for different API endpoints
 */
export const rateLimiters = {
  // General API calls - 60 requests per minute
  api: new RateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000
  }),
  
  // WebSocket connections - 5 per minute
  websocket: new RateLimiter({
    maxRequests: 5,
    windowMs: 60 * 1000,
    message: 'Too many WebSocket connection attempts'
  }),
  
  // Data refresh - 30 per minute
  refresh: new RateLimiter({
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: 'Refresh rate limit exceeded'
  })
}

/**
 * Predefined rate limiters for API providers
 */
export const alphavantageLimiter = new TokenBucket(5, 5 / 60, 60000) // 5 req/min
export const finnhubLimiter = new TokenBucket(60, 1, 60000) // 60 req/min
export const polygonLimiter = new TokenBucket(5, 5, 1000) // 5 req/sec

/**
 * Delay execution until rate limit allows
 */
export async function waitForRateLimit(
  limiter: RateLimiter,
  key: string,
  maxWaitMs = 60000
): Promise<boolean> {
  const startTime = Date.now()
  
  while (!limiter.isAllowed(key)) {
    if (Date.now() - startTime > maxWaitMs) {
      return false
    }
    
    const resetTime = limiter.getResetTime(key)
    if (!resetTime) {
      continue
    }
    
    const waitTime = Math.min(resetTime - Date.now(), 1000)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  
  return true
}

