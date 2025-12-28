/**
 * Automatically figures out which fields from an API response map to our standard fields.
 * Works with Alpha Vantage, Finnhub, and other common formats.
 */

export interface AutoMappingResult {
  mapping: Record<string, string>
  provider: 'alphavantage' | 'finnhub' | 'custom'
}

/**
 * Looks at an API response and guesses which provider it's from.
 * This helps us use the right field mapping automatically.
 */
export function detectProvider(response: any): 'alphavantage' | 'finnhub' | 'custom' {
  if (!response || typeof response !== 'object') {
    return 'custom'
  }

  // Check for Alpha Vantage structure
  if (Array.isArray(response)) {
    // Multi-symbol Alpha Vantage (array of Global Quote objects)
    if (response.length > 0 && response[0]?.['Global Quote']) {
      return 'alphavantage'
    }
  } else {
    // Single Alpha Vantage response
    if ('Global Quote' in response || 'Time Series' in response || 'top_gainers' in response) {
      return 'alphavantage'
    }
    
    // Finnhub structure
    if (('c' in response && 'd' in response && 'dp' in response) || 
        (Array.isArray(response.c) && Array.isArray(response.t))) {
      return 'finnhub'
    }
  }

  return 'custom'
}

/**
 * Auto-map Alpha Vantage Global Quote format
 */
function mapAlphaVantageGlobalQuote(response: any): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  // Handle array of Global Quote objects (multi-symbol) - like user's example
  // Each item in array has "Global Quote" key, so path is just "Global Quote.XX. field"
  if (Array.isArray(response) && response.length > 0) {
    const firstItem = response[0]
    if (firstItem?.['Global Quote']) {
      // Paths are relative to each array item, not including array index
      mapping.symbol = 'Global Quote.01. symbol'
      mapping.price = 'Global Quote.05. price'
      mapping.change = 'Global Quote.09. change'
      mapping.changePercent = 'Global Quote.10. change percent'
      mapping.volume = 'Global Quote.06. volume'
      mapping.timestamp = 'Global Quote.07. latest trading day'
      // Additional fields
      mapping.open = 'Global Quote.02. open'
      mapping.high = 'Global Quote.03. high'
      mapping.low = 'Global Quote.04. low'
      mapping.previousClose = 'Global Quote.08. previous close'
    }
  } else if (response?.['Global Quote']) {
    // Single Global Quote
    mapping.symbol = 'Global Quote.01. symbol'
    mapping.price = 'Global Quote.05. price'
    mapping.change = 'Global Quote.09. change'
    mapping.changePercent = 'Global Quote.10. change percent'
    mapping.volume = 'Global Quote.06. volume'
    mapping.timestamp = 'Global Quote.07. latest trading day'
    mapping.open = 'Global Quote.02. open'
    mapping.high = 'Global Quote.03. high'
    mapping.low = 'Global Quote.04. low'
    mapping.previousClose = 'Global Quote.08. previous close'
  }
  
  return mapping
}

/**
 * Auto-map Finnhub quote format
 */
function mapFinnhubQuote(response: any): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  // Handle array response (multi-symbol)
  if (Array.isArray(response) && response.length > 0) {
    const firstItem = response[0]
    if (firstItem?.c !== undefined) {
      mapping.price = 'c'
      mapping.change = 'd'
      mapping.changePercent = 'dp'
      mapping.high = 'h'
      mapping.low = 'l'
      mapping.open = 'o'
      mapping.previousClose = 'pc'
      mapping.volume = 'v'
      mapping.timestamp = 't'
      mapping.symbol = 's'
    }
  } else if (response?.c !== undefined) {
    // Single quote
    mapping.price = 'c'
    mapping.change = 'd'
    mapping.changePercent = 'dp'
    mapping.high = 'h'
    mapping.low = 'l'
    mapping.open = 'o'
    mapping.previousClose = 'pc'
    mapping.volume = 'v'
    mapping.timestamp = 't'
    mapping.symbol = 's'
  }
  
  return mapping
}

/**
 * Auto-map fields based on API provider
 */
export function autoMapFields(response: any): AutoMappingResult {
  const provider = detectProvider(response)
  let mapping: Record<string, string> = {}
  
  if (provider === 'alphavantage') {
    mapping = mapAlphaVantageGlobalQuote(response)
  } else if (provider === 'finnhub') {
    mapping = mapFinnhubQuote(response)
  }
  
  return { mapping, provider }
}

