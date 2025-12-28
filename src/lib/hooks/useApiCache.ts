import { useState, useEffect, useCallback, useRef } from 'react'
import { apiCache } from '@/lib/utils/caching'

export interface UseApiCacheOptions {
  ttl?: number
  staleWhileRevalidate?: boolean
  retryOnError?: boolean
  maxRetries?: number
}

export interface UseApiCacheReturn<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  invalidate: () => void
}

/**
 * Hook for API caching with automatic cache management
 */
export function useApiCache<T>(
  fetcher: () => Promise<T>,
  key: string,
  options: UseApiCacheOptions = {}
): UseApiCacheReturn<T> {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate = true,
    retryOnError = true,
    maxRetries = 3
  } = options
  
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const retryCountRef = useRef(0)
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | undefined>(undefined)
  
  /**
   * Fetch data with retries
   */
  const fetchData = useCallback(
    async (useCache = true) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()
      
      try {
        // Check cache first
        if (useCache) {
          const cached = apiCache.get(key) as T | undefined
          if (cached) {
            if (isMountedRef.current) {
              setData(cached)
              setIsLoading(false)
              setError(null)
            }
            
            // If stale-while-revalidate, fetch in background
            if (staleWhileRevalidate) {
              fetchData(false).catch(() => {
                // Silently fail background revalidation
              })
            }
            
            return
          }
        }
        
        setIsLoading(true)
        setError(null)
        
        const result = await fetcher()
        
        if (isMountedRef.current) {
          setData(result)
          setIsLoading(false)
          setError(null)
          retryCountRef.current = 0
          
          // Cache the result
          apiCache.set(key, result, ttl)
        }
      } catch (err) {
        if (isMountedRef.current) {
          const errorObj = err instanceof Error ? err : new Error(String(err))
          
          // Retry on error
          if (retryOnError && retryCountRef.current < maxRetries) {
            retryCountRef.current++
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000)
            
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchData(false).catch(() => {
                  // Final retry failed
                })
              }
            }, delay)
          } else {
            setError(errorObj)
            setIsLoading(false)
          }
        }
      }
    },
    [fetcher, key, ttl, staleWhileRevalidate, retryOnError, maxRetries]
  )
  
  /**
   * Invalidate cache and refetch
   */
  const invalidate = useCallback(() => {
    apiCache.delete(key)
  }, [key])
  
  /**
   * Force refetch
   */
  const refetch = useCallback(async () => {
    invalidate()
    await fetchData(false)
  }, [invalidate, fetchData])
  
  // Fetch on mount
  useEffect(() => {
    isMountedRef.current = true
    fetchData().catch(() => {
      // Error handling is done in fetchData
    })
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])
  
  return {
    data,
    isLoading,
    error,
    refetch,
    invalidate
  }
}

/**
 * Hook for polling with cache
 */
export function useApiCachePolling<T>(
  fetcher: () => Promise<T>,
  key: string,
  interval: number,
  options: UseApiCacheOptions = {}
): UseApiCacheReturn<T> {
  const result = useApiCache(fetcher, key, options)
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  useEffect(() => {
    if (interval > 0) {
      intervalRef.current = setInterval(() => {
        result.refetch().catch(() => {
          // Error handling is done in useApiCache
        })
      }, interval)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [interval, result])
  
  return result
}

/**
 * Prefetch data into cache
 */
export function usePrefetch() {
  return useCallback(
    async <T,>(fetcher: () => Promise<T>, key: string, ttl?: number) => {
      try {
        // Check if already cached
        if (apiCache.has(key)) {
          return
        }
        
        const data = await fetcher()
        apiCache.set(key, data, ttl)
      } catch (error) {
        console.warn(`Prefetch failed for key "${key}":`, error)
      }
    },
    []
  )
}

