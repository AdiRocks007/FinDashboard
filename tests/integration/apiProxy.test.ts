import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/proxy/route'
import { apiCache } from '@/lib/utils/caching'

// Mock fetch
global.fetch = vi.fn()

describe('API Proxy Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear API cache before each test
    apiCache.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET requests', () => {
    it('should proxy request with rate limiting', async () => {
      // Set environment variable for test
      const originalKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
      process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY = 'test-key-123'
      
      const mockResponse = {
        'Global Quote': {
          '01. symbol': 'IBM',
          '05. price': '152.50',
        },
      }

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      const request = new NextRequest(
        'http://localhost:3000/api/proxy?url=https%3A%2F%2Fwww.alphavantage.co%2Fquery%3Ffunction%3DGLOBAL_QUOTE%26symbol%3DIBM&provider=alphavantage'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.cached).toBe(false)
      
      // Restore original key
      if (originalKey) {
        process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY = originalKey
      } else {
        delete process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
      }
    })

    it('should return cached response when available', async () => {
      // First request
      const mockResponse = { c: 150.25, d: 2.5, dp: 1.67 }
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      const request1 = new NextRequest(
        'http://localhost:3000/api/proxy?url=https%3A%2F%2Ffinnhub.io%2Fapi%2Fv1%2Fquote%3Fsymbol%3DAAPL&provider=finnhub'
      )

      await GET(request1)

      // Second request (should be cached)
      const request2 = new NextRequest(
        'http://localhost:3000/api/proxy?url=https%3A%2F%2Ffinnhub.io%2Fapi%2Fv1%2Fquote%3Fsymbol%3DAAPL&provider=finnhub'
      )

      const response2 = await GET(request2)
      const data2 = await response2.json()

      // Should not call fetch again (cached)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(data2.cached).toBe(true)
    })

    it('should return 429 when rate limited', async () => {
      const mockResponse = {
        'Global Quote': {
          '01. symbol': 'IBM',
          '05. price': '152.50',
        },
      }

      // Mock fetch to return success for all requests
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockResponse,
          text: async () => JSON.stringify(mockResponse),
        } as Response)
      )

      // Make multiple requests to trigger rate limit (Alpha Vantage has 5 req/min limit)
      const requests = Array.from({ length: 10 }, () =>
        GET(
          new NextRequest(
            'http://localhost:3000/api/proxy?url=https%3A%2F%2Fwww.alphavantage.co%2Fquery%3Ffunction%3DGLOBAL_QUOTE%26symbol%3DIBM&provider=alphavantage'
          )
        )
      )

      const responses = await Promise.all(requests)
      const statusCodes = responses.map((r) => r.status)

      // Some requests should be rate limited
      expect(statusCodes.some((code) => code === 429)).toBe(true)
    })

    it('should return 504 on timeout', async () => {
      const uniqueUrl = `https://finnhub.io/api/v1/quote?symbol=TIMEOUT_TEST_${Date.now()}`
      const encodedUrl = encodeURIComponent(uniqueUrl)
      
      // Mock fetch to reject with AbortError after a delay (simulating timeout)
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => {
          return new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error('The operation was aborted')
              error.name = 'AbortError'
              reject(error)
            }, 100) // Fast timeout for testing
          })
        }
      )

      const request = new NextRequest(
        `http://localhost:3000/api/proxy?url=${encodedUrl}&provider=finnhub`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(504)
      expect(data.error).toBe('Request timeout')
    })

    it('should return 403 for disallowed domains', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/proxy?url=https%3A%2F%2Fmalicious-site.com%2Fdata'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Domain not allowed')
    })

    it('should add API key to request', async () => {
      // Set environment variable for test
      process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY = 'test-key-123'
      
      const mockResponse = {
        'Global Quote': {
          '01. symbol': 'IBM',
          '05. price': '152.50',
        },
      }

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      const request = new NextRequest(
        'http://localhost:3000/api/proxy?url=https%3A%2F%2Fwww.alphavantage.co%2Fquery%3Ffunction%3DGLOBAL_QUOTE%26symbol%3DIBM&provider=alphavantage'
      )

      await GET(request)

      // Check that fetch was called with API key
      const fetchCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      if (fetchCalls.length > 0) {
        const fetchUrl = fetchCalls[0]?.[0] as string
        expect(fetchUrl).toContain('apikey=')
      }
      
      // Cleanup
      delete process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
    })
  })

  describe('POST requests', () => {
    it('should proxy POST request', async () => {
      const mockResponse = { c: 150.25, d: 2.5, dp: 1.67 }
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as Response)

      const request = new NextRequest('http://localhost:3000/api/proxy', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://finnhub.io/api/v1/quote?symbol=AAPL',
          params: {},
          provider: 'finnhub',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBeDefined()
    }, 10000) // Increase timeout to 10s

    it('should return 400 for missing endpoint', async () => {
      const request = new NextRequest('http://localhost:3000/api/proxy', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Endpoint is required')
    })
  })

  describe('Error handling', () => {
    it('should handle fetch errors', async () => {
      // Clear cache before this specific test
      apiCache.clear()
      
      // Use a unique URL to avoid cache collisions
      const uniqueUrl = `https://finnhub.io/api/v1/quote?symbol=ERROR_TEST_${Date.now()}_${Math.random()}`
      const encodedUrl = encodeURIComponent(uniqueUrl)
      
      // Mock fetch to reject with network error
      const originalFetch = global.fetch
      const mockFetch = vi.fn().mockRejectedValueOnce(
        new Error('Network error')
      )
      global.fetch = mockFetch as unknown as typeof fetch

      try {
        const request = new NextRequest(
          `http://localhost:3000/api/proxy?url=${encodedUrl}&provider=finnhub`
        )

        const response = await GET(request)
        const data = await response.json()

        // Verify fetch was called (not cached)
        expect(mockFetch).toHaveBeenCalled()
        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to fetch data')
      } finally {
        // Restore original fetch
        global.fetch = originalFetch
      }
    })

    it('should handle non-OK responses', async () => {
      // Clear cache to ensure fresh request
      apiCache.clear()
      
      // Reset mocks
      vi.clearAllMocks()
      
      // Use unique URL to avoid cache collisions
      const uniqueUrl = `https://finnhub.io/api/v1/quote?symbol=NON_OK_TEST_${Date.now()}_${Math.random()}`
      const encodedUrl = encodeURIComponent(uniqueUrl)
      
      // Mock fetch to return non-OK response
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not found' }),
        text: async () => JSON.stringify({ error: 'Not found' }),
      } as Response)
      
      const originalFetch = global.fetch
      global.fetch = mockFetch as unknown as typeof fetch

      try {
        const request = new NextRequest(
          `http://localhost:3000/api/proxy?url=${encodedUrl}&provider=finnhub`
        )

        const response = await GET(request)
        const data = await response.json()

        // Verify fetch was called (not cached)
        expect(mockFetch).toHaveBeenCalled()
        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to fetch data')
        expect(data.message).toBeDefined()
      } finally {
        global.fetch = originalFetch
      }
    })
  })
})

