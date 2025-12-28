export interface FieldMapping {
  [widgetField: string]: string // API response path, e.g., "data.price" or "results[0].value"
}

export interface ApiConfig {
  id: string
  name: string
  baseUrl: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  authType?: 'none' | 'apiKey' | 'bearer'
  authConfig?: {
    key?: string
    value?: string
    location?: 'header' | 'query'
  }
  rateLimit?: {
    requests: number
    windowMs: number
  }
  refreshInterval?: number // seconds
  cacheTTL?: number // milliseconds
  retryConfig?: {
    maxRetries: number
    backoffMultiplier: number
  }
}

export interface ApiResponse<T = unknown> {
  data: T
  error?: string
  cached: boolean
  timestamp: number
  provider?: string
  status?: number
  headers?: Record<string, string>
}

export interface ApiError {
  message: string
  status?: number
  code?: string | number
  details?: unknown
}

export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  key: string
  tags?: string[]
}

export type APIProvider = 'alphavantage' | 'finnhub' | 'polygon' | 'custom'