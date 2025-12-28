import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { ApiResponse } from '@/types'
import { centralizedFetch } from '@/lib/services/centralizedApiService'

// Custom base query using centralized API service
const baseQueryWithRetry: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let url = ''
  let options: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (typeof args === 'string') {
    url = `/api/proxy${args}`
  } else {
    url = `/api/proxy${args.url || ''}`
    options.method = args.method || 'GET'
    if (args.body) {
      options.body = typeof args.body === 'string' ? args.body : JSON.stringify(args.body)
    }
    if (args.headers) {
      options.headers = { 
        ...options.headers as Record<string, string>, 
        ...args.headers as Record<string, string> 
      }
    }
  }

  try {
    // RTK Query doesn't pass polling info in extraOptions, but we can detect it
    // by checking if there's a refetch happening. For now, we'll rely on the
    // reduced cache TTL (10s) to allow frequent refreshes.
    // The centralized service cache is now 10s, which is shorter than most refresh intervals.
    
    // Use centralized API service (handles deduplication, caching, and queue)
    const response = await centralizedFetch(url, options, false)
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      return {
        error: {
          status: response.status,
          data: errorText,
        },
      }
    }

    const data = await response.json()
    return { data }
  } catch (error) {
    return {
      error: {
        status: 'FETCH_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}

// Note: Retry logic is now handled by centralizedApiService and apiRequestQueue
// No need for additional retry logic here

export const apiService = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Widget', 'ApiData', 'StockQuote', 'MarketData', 'Watchlist'],
  // Request deduplication is enabled by default
  keepUnusedDataFor: 300, // 5 minutes cache
  endpoints: (builder) => ({
    // Dynamic widget data fetching - uses GET with url query param
    fetchWidgetData: builder.query<ApiResponse, { url: string; provider?: string }>({
      query: ({ url, provider }) => ({
        url: `?url=${encodeURIComponent(url)}${provider ? `&provider=${provider}` : ''}`,
        method: 'GET',
      }),
      providesTags: (result, error, arg) => [
        { type: 'ApiData', id: arg.url },
        'ApiData',
      ],
      // Transform response to normalize data structure
      transformResponse: (response: unknown): ApiResponse => {
        const timestamp = Date.now()
        // Normalize different API response formats
        if (typeof response === 'object' && response !== null) {
          const res = response as Record<string, unknown>
          const provider = typeof res.provider === 'string' ? res.provider : undefined
          
          if ('data' in res) {
            const result: ApiResponse = {
              data: res.data,
              cached: false,
              timestamp,
            }
            if (provider) {
              result.provider = provider
            }
            return result
          }
          if ('results' in res) {
            const result: ApiResponse = {
              data: res.results,
              cached: false,
              timestamp,
            }
            if (provider) {
              result.provider = provider
            }
            return result
          }
          const result: ApiResponse = {
            data: response,
            cached: false,
            timestamp,
          }
          if (provider) {
            result.provider = provider
          }
          return result
        }
        return { 
          data: response, 
          cached: false, 
          timestamp 
        }
      },
    }),
    
    // Test API connection
    testApiConnection: builder.mutation<{ success: boolean; data?: unknown }, { endpoint: string; config: unknown }>({
      query: ({ endpoint, config }) => ({
        url: '/test',
        method: 'POST',
        body: { endpoint, config },
      }),
    }),
    
    // Predefined: Get stock quote
    getStockQuote: builder.query<ApiResponse, { symbol: string }>({
      query: ({ symbol }) => ({
        url: '/stock/quote',
        method: 'GET',
        params: { symbol },
      }),
      providesTags: (result, error, arg) => [
        { type: 'StockQuote', id: arg.symbol },
      ],
      keepUnusedDataFor: 60, // 1 minute for stock quotes
    }),
    
    // Predefined: Get market gainers
    getMarketGainers: builder.query<ApiResponse, void>({
      query: () => ({
        url: '/market/gainers',
        method: 'GET',
      }),
      providesTags: ['MarketData'],
      keepUnusedDataFor: 300, // 5 minutes
    }),
    
    // Predefined: Get watchlist data
    getWatchlist: builder.query<ApiResponse, { symbols: string[] }>({
      query: ({ symbols }) => ({
        url: '/watchlist',
        method: 'POST',
        body: { symbols },
      }),
      providesTags: ['Watchlist'],
      keepUnusedDataFor: 60, // 1 minute
    }),
  }),
})

// Dynamic endpoint injection helper
export interface DynamicEndpointConfig {
  name: string
  url: string
  method: 'GET' | 'POST'
  transformResponse?: (data: unknown) => unknown
  pollingInterval?: number
  providesTags?: Array<string | { type: string; id?: string }>
}

/**
 * Dynamically inject query endpoint into API service
 * Note: This is a helper function. Actual dynamic injection requires
 * using injectEndpoints or creating endpoints at runtime
 */
export function createDynamicEndpoint(config: DynamicEndpointConfig) {
  return {
    query: config.method === 'GET'
      ? () => ({
          url: config.url,
          method: 'GET',
        })
      : (body: unknown) => ({
          url: config.url,
          method: 'POST',
          body,
        }),
    transformResponse: config.transformResponse,
    providesTags: config.providesTags || ['ApiData'],
    pollingInterval: config.pollingInterval,
  }
}

// Export hooks
export const {
  useFetchWidgetDataQuery,
  useTestApiConnectionMutation,
  useGetStockQuoteQuery,
  useGetMarketGainersQuery,
  useGetWatchlistQuery,
  useLazyGetStockQuoteQuery,
  useLazyGetMarketGainersQuery,
  useLazyGetWatchlistQuery,
} = apiService