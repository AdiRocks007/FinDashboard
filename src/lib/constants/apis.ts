import { ApiConfig } from '@/types'

export const API_CONFIGS = {
  ALPHA_VANTAGE: {
    baseUrl: 'https://www.alphavantage.co/query',
    endpoints: {
      QUOTE: (symbol: string) => `function=GLOBAL_QUOTE&symbol=${symbol}`,
      TIME_SERIES_DAILY: (symbol: string) => `function=TIME_SERIES_DAILY&symbol=${symbol}`,
      TIME_SERIES_WEEKLY: (symbol: string) => `function=TIME_SERIES_WEEKLY&symbol=${symbol}`,
      TIME_SERIES_MONTHLY: (symbol: string) => `function=TIME_SERIES_MONTHLY&symbol=${symbol}`,
      TIME_SERIES_INTRADAY: (symbol: string, interval: string = '5min') => `function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}`,
      MARKET_GAINERS: () => 'function=TOP_GAINERS_LOSERS',
    },
    rateLimits: { perMinute: 5, perDay: 500 },
    cacheTTL: 60, // seconds
  },
  FINNHUB: {
    baseUrl: 'https://finnhub.io/api/v1',
    endpoints: {
      QUOTE: (symbol: string) => `/quote?symbol=${symbol}`,
      CANDLES: (symbol: string) => `/stock/candle?symbol=${symbol}`,
      MARKET_NEWS: () => '/news?category=general',
      COMPANY_PROFILE: (symbol: string) => `/stock/profile2?symbol=${symbol}`,
    },
    rateLimits: { perMinute: 60 },
    cacheTTL: 30, // seconds
  },
  POLYGON: {
    baseUrl: 'https://api.polygon.io',
    endpoints: {
      QUOTE: (symbol: string) => `/v2/aggs/ticker/${symbol}/prev`,
      DAILY: (symbol: string, from: string, to: string) =>
        `/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}`,
      INTRADAY: (symbol: string, multiplier: number, timespan: string) =>
        `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/today`,
    },
    rateLimits: { perSecond: 5 },
    cacheTTL: 30, // seconds
  },
} as const

/**
 * Helper function to build full URL with API key
 */
export function buildApiUrl(
  provider: keyof typeof API_CONFIGS,
  endpoint: string,
  params?: Record<string, string>
): string {
  const config = API_CONFIGS[provider]
  let url = `${config.baseUrl}${endpoint}`

  // Add API key based on provider
  const apiKey = getApiKey(provider)
  if (apiKey) {
    const separator = endpoint.includes('?') ? '&' : '?'
    switch (provider) {
      case 'ALPHA_VANTAGE':
        url += `${separator}apikey=${apiKey}`
        break
      case 'FINNHUB':
        url += `${separator}token=${apiKey}`
        break
      case 'POLYGON':
        url += `${separator}apikey=${apiKey}`
        break
    }
  }

  // Add additional params
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      const separator = url.includes('?') ? '&' : '?'
      url += `${separator}${key}=${encodeURIComponent(value)}`
    })
  }

  return url
}

/**
 * Get API key from environment variables
 */
function getApiKey(provider: keyof typeof API_CONFIGS): string | null {
  switch (provider) {
    case 'ALPHA_VANTAGE':
      return process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || null
    case 'FINNHUB':
      return process.env.NEXT_PUBLIC_FINNHUB_KEY || null
    case 'POLYGON':
      return process.env.NEXT_PUBLIC_POLYGON_KEY || null
    default:
      return null
  }
}

/**
 * Legacy exports for backward compatibility
 */
export const PREDEFINED_APIS: ApiConfig[] = [
  {
    id: 'finnhub',
    name: 'Finnhub',
    baseUrl: API_CONFIGS.FINNHUB.baseUrl,
    authType: 'apiKey',
    authConfig: {
      key: 'token',
      location: 'query',
    },
    rateLimit: {
      requests: API_CONFIGS.FINNHUB.rateLimits.perMinute,
      windowMs: 60000,
    },
  },
  {
    id: 'alpha_vantage',
    name: 'Alpha Vantage',
    baseUrl: API_CONFIGS.ALPHA_VANTAGE.baseUrl,
    authType: 'apiKey',
    authConfig: {
      key: 'apikey',
      location: 'query',
    },
    rateLimit: {
      requests: API_CONFIGS.ALPHA_VANTAGE.rateLimits.perMinute,
      windowMs: 60000,
    },
  },
  {
    id: 'polygon',
    name: 'Polygon.io',
    baseUrl: API_CONFIGS.POLYGON.baseUrl,
    authType: 'apiKey',
    authConfig: {
      key: 'apikey',
      location: 'query',
    },
    rateLimit: {
      requests: API_CONFIGS.POLYGON.rateLimits.perSecond,
      windowMs: 1000,
    },
  },
]

export const API_ENDPOINTS = {
  finnhub: API_CONFIGS.FINNHUB.endpoints,
  alpha_vantage: API_CONFIGS.ALPHA_VANTAGE.endpoints,
  polygon: API_CONFIGS.POLYGON.endpoints,
}