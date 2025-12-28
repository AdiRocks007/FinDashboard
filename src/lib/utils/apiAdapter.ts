/**
 * Takes messy API responses from different providers and turns them into a clean,
 * consistent format that our widgets can use. Handles Alpha Vantage, Finnhub,
 * and custom APIs, plus evaluates custom formula fields.
 */

import { get } from 'lodash-es'
import { evaluateFormula, type FormulaContext } from './formulaEvaluator'

export interface NormalizedData {
  symbol?: string
  price?: number
  change?: number
  changePercent?: number
  volume?: number
  timestamp: number
  metadata: Record<string, unknown>
}

export interface FieldMapping {
  [widgetField: string]: string // API response path, e.g., "data.price" or "results[0].value"
}

export interface ApiResponse {
  data?: unknown
  results?: unknown
  response?: unknown
  [key: string]: unknown
}

/**
 * Normalize API responses to a consistent format
 */
export function normalizeApiResponse(response: ApiResponse): NormalizedData {
  const timestamp = Date.now()
  
  // Extract metadata from response
  const metadata = extractMetadata(response)
  
  // Return normalized data structure
  // The actual data extraction will be done by specific adapter methods
  return {
    timestamp,
    metadata,
  }
}

/**
 * Extract metadata from API response
 */
function extractMetadata(response: ApiResponse): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  
  // Common metadata fields
  const metadataKeys = [
    'status',
    'statusText',
    'headers',
    'meta',
    'metadata',
    'pagination',
    'count',
    'total',
    'page',
    'limit'
  ]
  
  for (const key of metadataKeys) {
    if (key in response && key !== 'data' && key !== 'results') {
      metadata[key] = response[key]
    }
  }
  
  return metadata
}

/**
 * Transform nested JSON paths (e.g., "data.quotes[0].price")
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  
  const keys = path.split('.')
  let current: unknown = obj
  
  for (const key of keys) {
    // Handle array notation like "quotes[0]"
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    
    if (arrayMatch) {
      const arrayKey = arrayMatch[1]
      const indexStr = arrayMatch[2]
      
      if (!arrayKey || !indexStr) continue
      
      const index = parseInt(indexStr, 10)
      
      if (current && typeof current === 'object' && arrayKey in current) {
        const value = (current as Record<string, unknown>)[arrayKey]
        if (Array.isArray(value) && index < value.length) {
          current = value[index]
        } else {
          return undefined
        }
      } else {
        return undefined
      }
    } else {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key]
      } else {
        return undefined
      }
    }
  }
  
  return current
}

/**
 * Validate API response structure
 */
export function validateApiResponse(response: unknown): response is ApiResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    !Array.isArray(response)
  )
}

/**
 * Convert API errors to standard format
 */
export interface ApiError {
  message: string
  code?: string | number
  status?: number
  details?: unknown
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: error
    }
  }
  
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    const result: ApiError = {
      message: String(err.message || err.error || 'Unknown error'),
      details: err
    }
    
    if (err.code !== undefined) {
      result.code = err.code as string | number
    }
    
    if (err.status !== undefined) {
      result.status = err.status as number
    }
    
    return result
  }
  
  return {
    message: String(error)
  }
}

/**
 * API Adapter class for normalizing different API response formats
 */
export class APIAdapter {
  /**
   * Normalize Alpha Vantage response
   * @param symbol - Symbol extracted from URL (since AlphaVantage doesn't always return it)
   */
  static normalizeAlphaVantage(response: unknown, symbol?: string): NormalizedData[] {
    if (!response || typeof response !== 'object') {
      return []
    }

    const data = response as Record<string, unknown>
    const results: NormalizedData[] = []

    // Handle Global Quote format
    if ('Global Quote' in data) {
      const quote = data['Global Quote'] as Record<string, string>
      const normalized: NormalizedData = {
        price: parseFloat(quote['05. price'] || '0'),
        change: parseFloat(quote['09. change'] || '0'),
        changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
        volume: parseInt(quote['06. volume'] || '0', 10),
        timestamp: Date.now(),
        metadata: {
          open: quote['02. open'],
          high: quote['03. high'],
          low: quote['04. low'],
          previousClose: quote['08. previous close'],
        },
      }
      // Try to get symbol from response, fallback to provided symbol parameter
      normalized.symbol = quote['01. symbol'] || symbol || 'N/A'
      results.push(normalized)
    }

    // Handle Time Series format (Daily, Weekly, Monthly, Intraday)
    // Alpha Vantage uses keys like:
    // - "Time Series (Daily)"
    // - "Time Series (Weekly)"
    // - "Time Series (Monthly)"
    // - "Time Series (1min)", "Time Series (5min)", etc.
    const timeSeriesKey = Object.keys(data).find((key) => {
      const normalizedKey = key.trim()
      return (
        normalizedKey.startsWith('Time Series') ||
        normalizedKey.includes('Time Series') ||
        /^Time Series\s*\([^)]+\)$/.test(normalizedKey)
      )
    })
    
    if (timeSeriesKey) {
      const timeSeries = data[timeSeriesKey] as Record<string, Record<string, string>>
      const metaData = data['Meta Data'] as Record<string, string> | undefined

      Object.entries(timeSeries).forEach(([date, values]) => {
        const normalized: NormalizedData = {
          price: parseFloat(values['4. close'] || '0'),
          timestamp: new Date(date).getTime(),
          metadata: {
            open: values['1. open'],
            high: values['2. high'],
            low: values['3. low'],
            volume: values['5. volume'],
            date,
          },
        }
        if (metaData?.['2. Symbol']) {
          normalized.symbol = metaData['2. Symbol']
        }
        results.push(normalized)
      })
    }

    // Handle Top Gainers/Losers format
    if ('top_gainers' in data || 'top_losers' in data) {
      const gainers = (data['top_gainers'] as Array<Record<string, unknown>>) || []
      const losers = (data['top_losers'] as Array<Record<string, unknown>>) || []

      ;[...gainers, ...losers].forEach((item) => {
        const normalized: NormalizedData = {
          price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0')),
          change: typeof item.change_amount === 'number' ? item.change_amount : parseFloat(String(item.change_amount || '0')),
          changePercent: typeof item.change_percentage === 'number' ? item.change_percentage : parseFloat(String(item.change_percentage || '0')),
          volume: typeof item.volume === 'number' ? item.volume : parseInt(String(item.volume || '0'), 10),
          timestamp: Date.now(),
          metadata: item,
        }
        if (item.ticker) {
          normalized.symbol = String(item.ticker)
        }
        results.push(normalized)
      })
    }

    // Handle error responses
    if ('Error Message' in data || 'Note' in data) {
      throw new Error(String(data['Error Message'] || data['Note'] || 'Alpha Vantage API error'))
    }

    return results.length > 0 ? results : []
  }

  /**
   * Normalize Finnhub response
   */
  static normalizeFinnhub(response: unknown): NormalizedData[] {
    if (!response || typeof response !== 'object') {
      return []
    }

    const data = response as Record<string, unknown>
    const results: NormalizedData[] = []

    // Handle quote format
    if ('c' in data && 'd' in data && 'dp' in data) {
      const normalized: NormalizedData = {
        price: typeof data.c === 'number' ? data.c : parseFloat(String(data.c || '0')),
        change: typeof data.d === 'number' ? data.d : parseFloat(String(data.d || '0')),
        changePercent: typeof data.dp === 'number' ? data.dp : parseFloat(String(data.dp || '0')),
        timestamp: typeof data.t === 'number' ? data.t * 1000 : Date.now(),
        metadata: {
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
          volume: data.v,
        },
      }
      if (data.s) {
        normalized.symbol = String(data.s)
      }
      results.push(normalized)
    }

    // Handle candles format
    if ('c' in data && Array.isArray(data.c)) {
      const closes = data.c as number[]
      const opens = (data.o as number[]) || []
      const highs = (data.h as number[]) || []
      const lows = (data.l as number[]) || []
      const volumes = (data.v as number[]) || []
      const timestamps = (data.t as number[]) || []

      timestamps.forEach((ts, index) => {
        const normalized: NormalizedData = {
          price: closes[index] || 0,
          timestamp: ts * 1000,
          metadata: {
            open: opens[index],
            high: highs[index],
            low: lows[index],
            volume: volumes[index],
          },
        }
        if (data.s) {
          normalized.symbol = String(data.s)
        }
        results.push(normalized)
      })
    }

    // Handle array of quotes
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (item && typeof item === 'object') {
          const normalized: NormalizedData = {
            price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || item.c || '0')),
            change: typeof item.change === 'number' ? item.change : parseFloat(String(item.change || item.d || '0')),
            changePercent: typeof item.changePercent === 'number' ? item.changePercent : parseFloat(String(item.changePercent || item.dp || '0')),
            volume: typeof item.volume === 'number' ? item.volume : parseInt(String(item.volume || item.v || '0'), 10),
            timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
            metadata: item,
          }
          const symbol = item.symbol || item.s
          if (symbol) {
            normalized.symbol = String(symbol)
          }
          results.push(normalized)
        }
      })
    }

    return results.length > 0 ? results : []
  }

  /**
   * Normalize custom API response using field mapping
   */
  static normalizeCustom(response: unknown, mapping: FieldMapping): NormalizedData[] {
    if (!response || typeof response !== 'object') {
      return []
    }

    const results: NormalizedData[] = []

    // Helper function to process a single item
    const processItem = (item: any): NormalizedData => {
      const normalized: NormalizedData = {
        timestamp: Date.now(),
        metadata: {},
      }

      // First pass: map regular fields
      const formulaContext: FormulaContext = {}
      
      Object.entries(mapping).forEach(([widgetField, apiPath]) => {
        // Skip formula fields in first pass
        if (apiPath.startsWith('formula:')) {
          return
        }
        
        const value = get(item, apiPath)
        if (value !== undefined) {
          const numValue = typeof value === 'string' 
            ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
            : value
          
          // Add to formula context
          formulaContext[widgetField] = typeof numValue === 'number' && !isNaN(numValue) ? numValue : value
          
          // Store all fields at top level for easy access in widgets
          // Also map to standard fields if applicable
          switch (widgetField) {
            case 'symbol':
              normalized.symbol = String(value)
              ;(normalized as any)[widgetField] = normalized.symbol
              break
            case 'price':
              normalized.price = typeof value === 'number' ? value : parseFloat(String(value))
              ;(normalized as any)[widgetField] = normalized.price
              break
            case 'change':
              normalized.change = typeof value === 'number' ? value : parseFloat(String(value))
              ;(normalized as any)[widgetField] = normalized.change
              break
            case 'changePercent':
              normalized.changePercent = typeof value === 'number' ? value : parseFloat(String(value).replace('%', ''))
              ;(normalized as any)[widgetField] = normalized.changePercent
              break
            case 'volume':
              normalized.volume = typeof value === 'number' ? value : parseInt(String(value), 10)
              ;(normalized as any)[widgetField] = normalized.volume
              break
            default:
              // Store all other fields at top level for table/widget access
              ;(normalized as any)[widgetField] = numValue !== undefined && typeof numValue === 'number' && !isNaN(numValue) ? numValue : value
              normalized.metadata[widgetField] = value
          }
        }
      })

      // Second pass: evaluate formulas
      Object.entries(mapping).forEach(([widgetField, apiPath]) => {
        if (apiPath.startsWith('formula:')) {
          const formula = apiPath.replace('formula:', '')
          
          console.log(`🔢 [API ADAPTER] Evaluating formula for ${widgetField}:`, {
            formula,
            formulaContext,
            contextKeys: Object.keys(formulaContext),
            contextValues: Object.entries(formulaContext).map(([k, v]) => ({ key: k, value: v, type: typeof v }))
          })
          
          const result = evaluateFormula(formula, formulaContext)
          
          console.log(`🔢 [API ADAPTER] Formula result for ${widgetField}:`, result)
          
          // Always add formula result to top-level normalized object (even if null, so column shows)
          // This ensures custom fields appear in tables and other widgets
          ;(normalized as any)[widgetField] = result
          
          // Also store in metadata for reference
          normalized.metadata[widgetField] = result
          
          // Map to standard fields if applicable
          if (widgetField === 'price' && result !== null) {
            normalized.price = result
          } else if (widgetField === 'change' && result !== null) {
            normalized.change = result
          } else if (widgetField === 'changePercent' && result !== null) {
            normalized.changePercent = result
          } else if (widgetField === 'volume' && result !== null) {
            normalized.volume = result
          }
        }
      })
      
      console.log(`📊 [API ADAPTER] Normalized object keys:`, Object.keys(normalized))

      normalized.metadata.original = item
      return normalized
    }

    // Handle array responses
    if (Array.isArray(response)) {
      response.forEach((item) => {
        results.push(processItem(item))
      })
    } else {
      // Handle single object response
      results.push(processItem(response))
    }

    return results
  }

  /**
   * Extract all fields from response for display when no mapping is provided
   */
  static extractAllFields(response: unknown): NormalizedData[] {
    if (Array.isArray(response)) {
      return response.map((item) => ({
        timestamp: Date.now(),
        metadata: { ...item },
        ...this.flattenObject(item),
      }))
    }
    
    if (response && typeof response === 'object') {
      const flattened = this.flattenObject(response)
      return [{
        timestamp: Date.now(),
        metadata: { ...(response as Record<string, unknown>) },
        ...flattened,
      }]
    }
    
    return [{
      timestamp: Date.now(),
      metadata: { value: response },
    }]
  }

  /**
   * Flatten nested object for easier field access
   */
  static flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj).forEach(([key, value]) => {
        const newKey = prefix ? `${prefix}.${key}` : key
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, this.flattenObject(value, newKey))
        } else {
          result[newKey] = value
        }
      })
    }
    
    return result
  }

  /**
   * Auto-detect API provider from URL
   */
  static detectProvider(url: string): 'alphavantage' | 'finnhub' | 'custom' {
    if (url.includes('alphavantage.co')) {
      return 'alphavantage'
    }
    if (url.includes('finnhub.io')) {
      return 'finnhub'
    }
    return 'custom'
  }

  /**
   * Main normalization entry point
   */
  static normalize(
    url: string,
    response: unknown,
    customMapping?: FieldMapping
  ): NormalizedData[] {
    const provider = this.detectProvider(url)
    
    // Extract symbol from URL if present (common in stock APIs)
    const symbolMatch = url.match(/[?&]symbol=([^&]+)/i)
    const symbol = (symbolMatch && symbolMatch[1]) ? decodeURIComponent(symbolMatch[1]) : undefined
    
    console.log('🔧 [API ADAPTER] Starting normalization:', {
      provider,
      url: url.substring(0, 100),
      symbol,
      hasCustomMapping: !!(customMapping && Object.keys(customMapping).length > 0),
      customMapping,
      responseType: Array.isArray(response) ? 'array' : typeof response,
      responseKeys: typeof response === 'object' && response ? Object.keys(response) : []
    })

    try {
      let result: NormalizedData[]
      
      switch (provider) {
        case 'alphavantage':
          console.log('📈 [API ADAPTER] Using AlphaVantage normalizer with symbol:', symbol)
          result = this.normalizeAlphaVantage(response, symbol)
          break
        case 'finnhub':
          console.log('📊 [API ADAPTER] Using Finnhub normalizer with symbol:', symbol)
          result = this.normalizeFinnhub(response)
          // Add symbol to Finnhub results if available
          if (symbol && result.length > 0) {
            result = result.map(item => ({ ...item, symbol }))
          }
          break
        default:
          if (customMapping && Object.keys(customMapping).length > 0) {
            console.log('🎯 [API ADAPTER] Using custom mapping:', customMapping)
            result = this.normalizeCustom(response, customMapping)
          } else {
            console.log('🔍 [API ADAPTER] Auto-detecting fields (no mapping)')
            result = this.extractAllFields(response)
          }
          // Add symbol to results if available and not already present
          if (symbol && result.length > 0 && result[0] && !result[0].symbol) {
            result = result.map(item => ({ ...item, symbol }))
          }
      }
      
      // Apply custom formula fields to all results (even from provider-specific normalizers)
      if (customMapping && result.length > 0) {
        const formulaFields = Object.entries(customMapping).filter(([_, path]) => path.startsWith('formula:'))
        if (formulaFields.length > 0) {
          console.log('🔢 [API ADAPTER] Applying custom formula fields to normalized data:', formulaFields.map(([key]) => key))
          result = result.map(item => {
            // Build formula context from the normalized item
            const formulaContext: FormulaContext = {}
            
            // Add all top-level fields to context (including those from provider normalizers)
            Object.keys(item).forEach(key => {
              if (key !== 'metadata' && key !== 'timestamp') {
                const value = (item as any)[key]
                if (value !== undefined && value !== null) {
                  if (typeof value === 'number') {
                    formulaContext[key] = value
                  } else if (typeof value === 'string') {
                    const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''))
                    formulaContext[key] = !isNaN(numValue) ? numValue : value
                  } else {
                    formulaContext[key] = value
                  }
                }
              }
            })
            
            // Also add fields from metadata (but don't overwrite top-level fields)
            if (item.metadata) {
              Object.entries(item.metadata).forEach(([key, value]) => {
                // Only add if not already in context (top-level takes precedence)
                if (!(key in formulaContext) && value !== undefined && value !== null && typeof value !== 'object') {
                  if (typeof value === 'number') {
                    formulaContext[key] = value
                  } else if (typeof value === 'string') {
                    const numValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
                    formulaContext[key] = !isNaN(numValue) ? numValue : value
                  } else if (typeof value === 'boolean') {
                    formulaContext[key] = value ? 1 : 0
                  }
                }
              })
            }
            
            console.log(`🔢 [API ADAPTER] Formula context for item:`, {
              contextKeys: Object.keys(formulaContext),
              context: formulaContext
            })
            
            // Evaluate each formula field
            formulaFields.forEach(([widgetField, apiPath]) => {
              const formula = apiPath.replace('formula:', '')
              const formulaResult = evaluateFormula(formula, formulaContext)
              
              if (formulaResult !== null) {
                ;(item as any)[widgetField] = formulaResult
                item.metadata[widgetField] = formulaResult
              } else {
                // Store null so column still shows
                ;(item as any)[widgetField] = null
                item.metadata[widgetField] = null
              }
            })
            
            return item
          })
        }
      }
      
      console.log('✅ [API ADAPTER] Normalization complete:', {
        resultCount: result.length,
        firstResult: result[0],
        firstResultKeys: result[0] ? Object.keys(result[0]) : [],
        allResults: result
      })
      
      return result
    } catch (error) {
      console.error(`❌ [API ADAPTER] Error normalizing ${provider} response:`, error)
      throw error
    }
  }
}

