import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TokenBucket } from '@/lib/utils/rateLimiter'

describe('TokenBucket Rate Limiter', () => {
  let limiter: TokenBucket

  beforeEach(() => {
    vi.useFakeTimers()
    limiter = new TokenBucket(5, 1, 60000) // 5 tokens, 1 token/sec, 60s window
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('acquire', () => {
    it('should allow request when tokens available', async () => {
      const result = await limiter.acquire()
      expect(result).toBe(true)
    })

    it('should deny request when no tokens available', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire()
      }

      // Next request should be denied
      const result = await limiter.acquire()
      expect(result).toBe(false)
    })

    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire()
      }

      // Advance time by 2 seconds (should refill 2 tokens)
      vi.advanceTimersByTime(2000)

      const result = await limiter.acquire()
      expect(result).toBe(true)
    })
  })

  describe('consume', () => {
    it('should consume tokens synchronously', () => {
      expect(limiter.consume(1)).toBe(true)
      expect(limiter.consume(1)).toBe(true)
      expect(limiter.consume(1)).toBe(true)
      expect(limiter.consume(1)).toBe(true)
      expect(limiter.consume(1)).toBe(true)
      expect(limiter.consume(1)).toBe(false) // No more tokens
    })

    it('should handle multiple token consumption', () => {
      expect(limiter.consume(3)).toBe(true)
      expect(limiter.consume(2)).toBe(true)
      expect(limiter.consume(1)).toBe(false) // Only 5 tokens total
    })
  })

  describe('getAvailable', () => {
    it('should return correct number of available tokens', () => {
      expect(limiter.getAvailable()).toBe(5)

      limiter.consume(2)
      expect(limiter.getAvailable()).toBe(3)

      limiter.consume(3)
      expect(limiter.getAvailable()).toBe(0)
    })

    it('should refill tokens when checking availability', () => {
      // Consume all tokens
      limiter.consume(5)

      // Advance time
      vi.advanceTimersByTime(3000)

      // Should have refilled 3 tokens
      expect(limiter.getAvailable()).toBe(3)
    })
  })

  describe('getStatus', () => {
    it('should return correct status', () => {
      limiter.consume(2)
      const status = limiter.getStatus()

      expect(status.remaining).toBe(3)
      expect(status.resetAt).toBeInstanceOf(Date)
    })

    it('should calculate reset time correctly', () => {
      // Consume all tokens
      limiter.consume(5)

      const status = limiter.getStatus()
      expect(status.remaining).toBe(0)

      // Advance time by 1 second (1 token should refill)
      vi.advanceTimersByTime(1000)

      const newStatus = limiter.getStatus()
      expect(newStatus.remaining).toBeGreaterThan(0)
    })
  })

  describe('reset', () => {
    it('should reset tokens to full capacity', () => {
      limiter.consume(5)
      expect(limiter.getAvailable()).toBe(0)

      limiter.reset()
      expect(limiter.getAvailable()).toBe(5)
    })
  })

  describe('concurrent requests', () => {
    it('should handle concurrent token consumption', async () => {
      const promises = Array.from({ length: 10 }, () => limiter.acquire())
      const results = await Promise.all(promises)

      // Only 5 should succeed
      const successCount = results.filter((r) => r === true).length
      expect(successCount).toBe(5)
    })
  })

  describe('rate limit reset', () => {
    it('should reset after interval', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire()
      }

      // Advance time by full interval (60 seconds)
      vi.advanceTimersByTime(60000)

      // Should be able to acquire again
      const result = await limiter.acquire()
      expect(result).toBe(true)
    })
  })
})

