/**
 * Smart API service that prevents duplicate requests and caches responses.
 * If multiple widgets request the same URL, it only makes one API call and shares the result.
 */

import { queuedFetch } from '@/lib/utils/apiRequestQueue'

interface PendingRequest {
  url: string
  options: RequestInit
  resolve: (value: Response) => void
  reject: (error: Error) => void
  timestamp: number
}

interface CacheEntry {
  response: Response
  data: any
  timestamp: number
  expiresAt: number
}

class CentralizedApiService {
  private pendingRequests = new Map<string, PendingRequest[]>()
  private cache = new Map<string, CacheEntry>()
  // Reduced cache TTL to 10 seconds to allow faster refresh intervals
  // This ensures data can be refreshed more frequently without cache interference
  private readonly CACHE_TTL_MS = 10000 // 10 seconds cache (reduced from 30s)
  private readonly DEDUPE_WINDOW_MS = 1000 // 1 second deduplication window

  /**
   * Make an API request with deduplication and caching
   * @param url The URL to fetch
   * @param options Fetch options
   * @param bypassCache If true, bypass cache and fetch fresh data (useful for polling)
   */
  async request(url: string, options: RequestInit = {}, bypassCache: boolean = false): Promise<Response> {
    const cacheKey = this.getCacheKey(url, options)
    
    // Check cache first (unless bypassing)
    if (!bypassCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        console.log(`💾 [CENTRALIZED API] Cache hit: ${url.substring(0, 80)}`)
        // Return cloned response
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else {
      console.log(`🔄 [CENTRALIZED API] Bypassing cache for: ${url.substring(0, 80)}`)
    }

    // Check for pending identical requests (deduplication)
    const pending = this.pendingRequests.get(cacheKey)
    if (pending && pending.length > 0) {
      console.log(`🔄 [CENTRALIZED API] Deduplicating request: ${url.substring(0, 80)} (${pending.length} pending)`)
      // Return a promise that resolves when the pending request completes
      return new Promise<Response>((resolve, reject) => {
        pending.push({
          url,
          options,
          resolve,
          reject,
          timestamp: Date.now(),
        })
      })
    }

    // New request - add to pending
    const requestEntry: PendingRequest = {
      url,
      options,
      resolve: () => {},
      reject: () => {},
      timestamp: Date.now(),
    }

    if (!this.pendingRequests.has(cacheKey)) {
      this.pendingRequests.set(cacheKey, [])
    }
    this.pendingRequests.get(cacheKey)!.push(requestEntry)

    try {
      console.log(`📡 [CENTRALIZED API] New request: ${url.substring(0, 80)}`)
      
      // Use global queue for actual fetch
      const response = await queuedFetch(url, options)
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`)
      }

      // Clone response BEFORE reading body (Response body can only be read once)
      const clonedResponse = response.clone()
      
      // Read data from cloned response for caching
      const data = await clonedResponse.json()
      
      // Cache the data (not the response object)
      this.cache.set(cacheKey, {
        response: new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        }),
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      })

      // Create a new response from data for each caller
      // This ensures all callers can read the body independently
      const createResponse = () => new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' },
      })

      // Resolve all pending requests for this URL
      const pendingList = this.pendingRequests.get(cacheKey) || []
      pendingList.forEach(req => {
        try {
          req.resolve(createResponse())
        } catch (err) {
          req.reject(err instanceof Error ? err : new Error('Failed to resolve request'))
        }
      })
      
      // Clear pending requests
      this.pendingRequests.delete(cacheKey)

      // Return a new response for the first caller too (consistency)
      return createResponse()
    } catch (error) {
      // Reject all pending requests
      const pendingList = this.pendingRequests.get(cacheKey) || []
      pendingList.forEach(req => {
        req.reject(error instanceof Error ? error : new Error('Request failed'))
      })
      
      // Clear pending requests
      this.pendingRequests.delete(cacheKey)
      
      throw error
    }
  }

  /**
   * Batch multiple requests (for multi-symbol tables)
   * Returns responses in the same order as URLs
   * @param urls Array of URLs to fetch
   * @param options Fetch options
   * @param bypassCache If true, bypass cache for all requests (useful for polling)
   */
  async batchRequest(urls: string[], options: RequestInit = {}, bypassCache: boolean = false): Promise<Response[]> {
    console.log(`📦 [CENTRALIZED API] Batching ${urls.length} requests${bypassCache ? ' (bypassing cache)' : ''}`)
    
    // Use Promise.all but requests go through centralized service
    // This ensures deduplication and caching work
    const promises = urls.map(url => this.request(url, options, bypassCache))
    return Promise.all(promises)
  }

  /**
   * Get cache key for request
   * Includes method, full URL (with query params), and headers for proper cache isolation
   */
  private getCacheKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET'
    // Normalize URL to ensure consistent cache keys (remove trailing slashes, sort query params)
    const normalizedUrl = this.normalizeUrl(url)
    // Include headers in cache key (but exclude common headers that don't affect response)
    const relevantHeaders = this.getRelevantHeaders(options.headers || {})
    const headersKey = JSON.stringify(relevantHeaders)
    return `${method}:${normalizedUrl}:${headersKey}`
  }

  /**
   * Normalize URL for consistent cache keys
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Sort query parameters for consistent cache keys
      const sortedParams = Array.from(urlObj.searchParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
      
      const normalized = `${urlObj.origin}${urlObj.pathname}${sortedParams ? `?${sortedParams}` : ''}`
      return normalized
    } catch {
      // If URL parsing fails, return as-is
      return url
    }
  }

  /**
   * Get only relevant headers that affect the response
   * Excludes headers like User-Agent, Accept-Language that don't affect API responses
   */
  private getRelevantHeaders(headers: HeadersInit): Record<string, string> {
    const relevant: Record<string, string> = {}
    const headerObj = headers instanceof Headers 
      ? Object.fromEntries(headers.entries())
      : Array.isArray(headers)
      ? Object.fromEntries(headers)
      : headers as Record<string, string>
    
    // Only include headers that might affect the response
    const relevantHeaderKeys = ['Authorization', 'X-API-Key', 'Content-Type', 'Accept']
    Object.entries(headerObj).forEach(([key, value]) => {
      if (relevantHeaderKeys.some(rk => key.toLowerCase().includes(rk.toLowerCase()))) {
        relevant[key] = String(value)
      }
    })
    
    return relevant
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
    console.log('🗑️ [CENTRALIZED API] Cache cleared')
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now()
    let cleared = 0
    
    this.cache.forEach((entry, key) => {
      if (now >= entry.expiresAt) {
        this.cache.delete(key)
        cleared++
      }
    })
    
    if (cleared > 0) {
      console.log(`🧹 [CENTRALIZED API] Cleared ${cleared} expired cache entries`)
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: Array.from(this.pendingRequests.values()).reduce((sum, arr) => sum + arr.length, 0),
    }
  }
}

// Global singleton instance
export const centralizedApiService = new CentralizedApiService()

// Cleanup expired cache every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    centralizedApiService.clearExpiredCache()
  }, 60000) // Every minute
}

/**
 * Wrapper function for centralized API requests
 * @param url The URL to fetch
 * @param options Fetch options
 * @param bypassCache If true, bypass cache and fetch fresh data (useful for polling)
 */
export async function centralizedFetch(url: string, options: RequestInit = {}, bypassCache: boolean = false): Promise<Response> {
  return centralizedApiService.request(url, options, bypassCache)
}

/**
 * Batch fetch multiple URLs
 * @param urls Array of URLs to fetch
 * @param options Fetch options
 * @param bypassCache If true, bypass cache for all requests (useful for polling)
 */
export async function batchFetch(urls: string[], options: RequestInit = {}, bypassCache: boolean = false): Promise<Response[]> {
  return centralizedApiService.batchRequest(urls, options, bypassCache)
}

