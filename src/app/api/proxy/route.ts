import { NextRequest, NextResponse } from 'next/server'
import { TokenBucket } from '@/lib/utils/rateLimiter'
import { apiCache } from '@/lib/utils/caching'
import { generateCacheKey } from '@/lib/utils/caching'

// Provider-specific rate limiters
const providerLimiters = new Map<string, TokenBucket>()

// Initialize rate limiters for each provider
const alphavantageLimiter = new TokenBucket(5, 5 / 60) // 5 req/min
const finnhubLimiter = new TokenBucket(60, 1) // 60 req/min
const polygonLimiter = new TokenBucket(5, 5) // 5 req/sec

providerLimiters.set('alphavantage', alphavantageLimiter)
providerLimiters.set('finnhub', finnhubLimiter)
providerLimiters.set('polygon', polygonLimiter)

// Daily rate limit tracking (for Alpha Vantage: 500 req/day)
const dailyLimits = new Map<string, { count: number; date: string }>()

function checkDailyLimit(provider: string, maxPerDay: number): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (!today) return true // Fallback if date parsing fails
  
  const key = `${provider}:${today}`
  const current = dailyLimits.get(key)

  if (!current || current.date !== today) {
    dailyLimits.set(key, { count: 1, date: today })
    return true
  }

  if (current.count >= maxPerDay) {
    return false
  }

  current.count++
  return true
}

function detectProvider(url: string): string {
  if (url.includes('alphavantage.co')) return 'alphavantage'
  if (url.includes('finnhub.io')) return 'finnhub'
  if (url.includes('polygon.io')) return 'polygon'
  return 'custom'
}

function getApiKey(provider: string): string | null {
  switch (provider) {
    case 'alphavantage':
      return process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || null
    case 'finnhub':
      return process.env.NEXT_PUBLIC_FINNHUB_KEY || null
    case 'polygon':
      return process.env.NEXT_PUBLIC_POLYGON_KEY || null
    default:
      return null
  }
}

function addApiKeyToUrl(url: URL, provider: string): void {
  const apiKey = getApiKey(provider)
  if (!apiKey) {
    console.warn(`[API Proxy] No API key found for provider: ${provider}`)
    return
  }

  switch (provider) {
    case 'alphavantage':
      // Alpha Vantage requires apikey parameter
      if (!url.searchParams.has('apikey')) {
        url.searchParams.set('apikey', apiKey)
        console.log(`[API Proxy] Added Alpha Vantage API key to URL`)
      }
      // Ensure function parameter exists (required by Alpha Vantage)
      if (!url.searchParams.has('function')) {
        console.warn(`[API Proxy] Warning: Alpha Vantage URL missing 'function' parameter`)
      }
      break
    case 'finnhub':
      if (!url.searchParams.has('token')) {
        url.searchParams.set('token', apiKey)
        console.log(`[API Proxy] Added Finnhub API key to URL`)
      }
      break
    case 'polygon':
      if (!url.searchParams.has('apikey')) {
        url.searchParams.set('apikey', apiKey)
        console.log(`[API Proxy] Added Polygon API key to URL`)
      }
      break
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const targetUrl = searchParams.get('url')
    const provider = searchParams.get('provider') || 'custom'

    console.log('🔵 [API PROXY GET] Incoming request:', {
      targetUrl: targetUrl?.substring(0, 200),
      provider: request.nextUrl.searchParams.get('provider'),
      fullUrl: request.url
    })

    if (!targetUrl) {
      console.log('❌ [API PROXY GET] Missing target URL')
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Decode the URL if it's encoded
    let decodedUrl: string
    try {
      decodedUrl = decodeURIComponent(targetUrl)
    } catch {
      decodedUrl = targetUrl // If decoding fails, use as-is
    }

    // Validate allowed domains
    const allowedDomains = [
      'api.finnhub.io',
      'finnhub.io', // Allow both api.finnhub.io and finnhub.io
      'www.alphavantage.co',
      'alphavantage.co', // Allow both www and non-www
      'api.polygon.io',
      'polygon.io',
      'api.iexcloud.io',
    ]

    // Parse the decoded URL
    let url: URL
    try {
      url = new URL(decodedUrl)
    } catch (error) {
      // If URL parsing fails, try to fix common issues
      // Sometimes URLs might be missing protocol
      if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
        decodedUrl = 'https://' + decodedUrl
        url = new URL(decodedUrl)
      } else {
        // If still fails, return error
        return NextResponse.json(
          { error: 'Invalid URL format', message: `Failed to parse URL: ${decodedUrl.substring(0, 100)}` },
          { status: 400 }
        )
      }
    }
    
    const detectedProvider = detectProvider(decodedUrl)
    const finalProvider = provider !== 'custom' ? provider : detectedProvider

    // Check if hostname matches any allowed domain (including subdomains)
    const isAllowed = allowedDomains.some((domain) => {
      return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    })

    if (!isAllowed) {
      return NextResponse.json(
        { error: `Domain not allowed: ${url.hostname}. Allowed domains: ${allowedDomains.join(', ')}` },
        { status: 403 }
      )
    }

    // Rate limiting per provider
    const limiter = providerLimiters.get(finalProvider)
    if (limiter) {
      // Check daily limit for Alpha Vantage
      if (finalProvider === 'alphavantage') {
        if (!checkDailyLimit('alphavantage', 500)) {
          return NextResponse.json(
            { error: 'Daily rate limit exceeded (500 requests/day)' },
            { status: 429 }
          )
        }
      }

      // Check per-minute/per-second limit
      if (!limiter.consume(1)) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            provider: finalProvider,
            resetAt: new Date(Date.now() + 60000).toISOString(),
          },
          { status: 429 }
        )
      }
    }

    // Special handling for Alpha Vantage URLs
    // Sometimes the URL might have query params in the pathname if decoding failed
    if (finalProvider === 'alphavantage' && url.pathname.includes('?')) {
      // If pathname contains ?, it means query params weren't parsed correctly
      // Try to fix it by reconstructing the URL
      const pathParts = url.pathname.split('?')
      if (pathParts.length > 1) {
        const basePath = pathParts[0]
        const queryString = pathParts.slice(1).join('?')
        // Reconstruct URL with proper query string
        url = new URL(`${url.protocol}//${url.host}${basePath}?${queryString}${url.search ? '&' + url.search.substring(1) : ''}`)
        console.log(`[API Proxy] Fixed Alpha Vantage URL - moved query params from pathname`)
      }
    }

    // Add API key from environment (only if not already present)
    if (!url.searchParams.has('apikey') && !url.searchParams.has('token')) {
      addApiKeyToUrl(url, finalProvider)
    }
    
    // Debug: Log the final URL (without exposing the full API key)
    const finalUrlForLog = url.toString().replace(/(apikey|token)=[^&?]+/g, '$1=***')
    console.log(`[API Proxy] Original URL: ${targetUrl.substring(0, 100)}...`)
    console.log(`[API Proxy] Decoded URL: ${decodedUrl.substring(0, 100)}...`)
    console.log(`[API Proxy] Final URL: ${finalUrlForLog}`)
    console.log(`[API Proxy] Provider: ${finalProvider}, Has API Key: ${url.searchParams.has('apikey') || url.searchParams.has('token')}`)
    console.log(`[API Proxy] URL Path: ${url.pathname}, Query: ${url.search}`)
    
    // Special handling for Alpha Vantage - log all query params for debugging
    if (finalProvider === 'alphavantage') {
      const params = Object.fromEntries(url.searchParams.entries())
      console.log(`[API Proxy] Alpha Vantage Query Params:`, params)
      // Validate required parameters
      if (!params.function) {
        console.error(`[API Proxy] ERROR: Alpha Vantage URL missing required 'function' parameter`)
      }
      if (!params.symbol && params.function === 'GLOBAL_QUOTE') {
        console.error(`[API Proxy] ERROR: Alpha Vantage URL missing required 'symbol' parameter`)
      }
    }

    // Check cache
    const cacheKey = generateCacheKey(url.toString(), {})
    const cached = apiCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(
        {
          data: cached,
          cached: true,
          timestamp: Date.now(),
        },
        {
          status: 200,
          headers: {
            'X-Cache': 'HIT',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      )
    }

    // Forward request with timeout (15s)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'FinBoard/1.0',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check content type before parsing
      if (!response || !response.headers) {
        throw new Error('Invalid response from API')
      }
      
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `HTTP error! status: ${response.status}`
        try {
          if (isJson) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorData['Error Message'] || errorMessage
          } else {
            const text = await response.text()
            // If HTML, extract meaningful error
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
              errorMessage = `API returned HTML error page (status ${response.status}). Check if the endpoint URL is correct.`
            } else {
              errorMessage = text.substring(0, 200) || errorMessage
            }
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(errorMessage)
      }

      // Parse response based on content type
      let data: unknown
      if (isJson) {
        data = await response.json()
      } else {
        const text = await response.text()
        // If HTML, return error
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`API returned HTML instead of JSON. This usually means the endpoint is incorrect or the API key is invalid. Response: ${text.substring(0, 300)}`)
        }
        // Try to parse as JSON anyway (some APIs don't set content-type correctly)
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          throw new Error(`API returned non-JSON response. Content-Type: ${contentType}, Response: ${text.substring(0, 300)}`)
        }
      }

      // Cache response with appropriate TTL
      const ttl = finalProvider === 'alphavantage' ? 60 * 1000 : 30 * 1000 // 60s for AV, 30s for others
      apiCache.set(cacheKey, data, ttl)
      
      console.log('✅ [API PROXY] Returning success response:', {
        provider: finalProvider,
        dataType: Array.isArray(data) ? 'array' : typeof data,
        dataKeys: typeof data === 'object' && data ? Object.keys(data) : [],
        cached: false
      })

      return NextResponse.json(
        {
          data,
          cached: false,
          timestamp: Date.now(),
          provider: finalProvider,
        },
        {
          status: 200,
          headers: {
            'X-Cache': 'MISS',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      )
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', message: 'API request took longer than 15 seconds' },
          { status: 504 }
        )
      }

      throw fetchError
    }
  } catch (error) {
    console.error('API Proxy Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint, params = {}, provider } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      )
    }

    // Validate allowed domains
    const allowedDomains = [
      'api.finnhub.io',
      'finnhub.io', // Allow both api.finnhub.io and finnhub.io
      'www.alphavantage.co',
      'alphavantage.co', // Allow both www and non-www
      'api.polygon.io',
      'polygon.io',
      'api.iexcloud.io',
    ]

    const url = new URL(endpoint)
    const detectedProvider = detectProvider(endpoint)
    const finalProvider = provider || detectedProvider

    // Check if hostname matches any allowed domain (including subdomains)
    const isAllowed = allowedDomains.some((domain) => {
      return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    })

    if (!isAllowed) {
      return NextResponse.json(
        { error: `Domain not allowed: ${url.hostname}. Allowed domains: ${allowedDomains.join(', ')}` },
        { status: 403 }
      )
    }

    // Rate limiting
    const limiter = providerLimiters.get(finalProvider)
    if (limiter) {
      if (finalProvider === 'alphavantage' && !checkDailyLimit('alphavantage', 500)) {
        return NextResponse.json(
          { error: 'Daily rate limit exceeded' },
          { status: 429 }
        )
      }

      if (!limiter.consume(1)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', provider: finalProvider },
          { status: 429 }
        )
      }
    }

    // Add API key (only if not already present)
    if (!url.searchParams.has('apikey') && !url.searchParams.has('token')) {
      addApiKeyToUrl(url, finalProvider)
    }

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })

    // Check cache
    const cacheKey = generateCacheKey(url.toString(), params)
    const cached = apiCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(
        { data: cached, cached: true, timestamp: Date.now() },
        {
          status: 200,
          headers: {
            'X-Cache': 'HIT',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Forward request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'User-Agent': 'FinBoard/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body.body || {}),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check content type before parsing
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `HTTP error! status: ${response.status}`
        try {
          if (isJson) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorData['Error Message'] || errorMessage
          } else {
            const text = await response.text()
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
              errorMessage = `API returned HTML error page (status ${response.status})`
            } else {
              errorMessage = text.substring(0, 200) || errorMessage
            }
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(errorMessage)
      }

      // Parse response based on content type
      let data: unknown
      if (isJson) {
        data = await response.json()
      } else {
        const text = await response.text()
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`API returned HTML instead of JSON. Check endpoint URL and API key.`)
        }
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error(`API returned non-JSON response. Content-Type: ${contentType}`)
        }
      }

      // Cache response
      const ttl = finalProvider === 'alphavantage' ? 60 * 1000 : 30 * 1000
      apiCache.set(cacheKey, data, ttl)

      return NextResponse.json(
        {
          data,
          cached: false,
          timestamp: Date.now(),
          provider: finalProvider,
        },
        {
          status: 200,
          headers: {
            'X-Cache': 'MISS',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        )
      }

      throw fetchError
    }
  } catch (error) {
    console.error('API Proxy Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}