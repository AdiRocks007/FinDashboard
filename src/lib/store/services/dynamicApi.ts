import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { ApiConfig } from '@/types'

// Dynamic API service for creating endpoints at runtime
export const createDynamicApiService = (config: ApiConfig) => {
  return createApi({
    reducerPath: `dynamicApi_${config.id}`,
    baseQuery: fetchBaseQuery({
      baseUrl: config.baseUrl,
      prepareHeaders: (headers) => {
        // Add authentication headers
        if (config.authType === 'apiKey' && config.authConfig) {
          if (config.authConfig.location === 'header') {
            headers.set(config.authConfig.key || 'X-API-Key', config.authConfig.value || '')
          }
        } else if (config.authType === 'bearer' && config.authConfig) {
          headers.set('Authorization', `Bearer ${config.authConfig.value || ''}`)
        }

        // Add custom headers
        if (config.headers) {
          Object.entries(config.headers).forEach(([key, value]) => {
            headers.set(key, value)
          })
        }

        return headers
      },
    }),
    endpoints: (builder) => ({
      fetchData: builder.query<unknown, { endpoint?: string; params?: Record<string, unknown> }>({
        query: ({ endpoint = '', params = {} }) => {
          const url = new URL(endpoint, config.baseUrl)
          
          // Add query parameters
          if (config.queryParams) {
            Object.entries(config.queryParams).forEach(([key, value]) => {
              url.searchParams.set(key, value)
            })
          }
          
          if (params) {
            Object.entries(params).forEach(([key, value]) => {
              url.searchParams.set(key, String(value))
            })
          }

          // Add API key to query params if needed
          if (config.authType === 'apiKey' && config.authConfig?.location === 'query') {
            url.searchParams.set(config.authConfig.key || 'apikey', config.authConfig.value || '')
          }

          return {
            url: url.pathname + url.search,
          }
        },
      }),
    }),
  })
}