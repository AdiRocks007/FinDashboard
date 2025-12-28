/**
 * Helper functions for working with Alpha Vantage API URLs.
 * When you change the time period in a chart, this rebuilds the URL
 * to use the correct endpoint (daily, weekly, monthly, or intraday).
 */

export type TimeInterval = 'daily' | 'weekly' | 'monthly' | 'intraday'

/**
 * Takes an Alpha Vantage URL and changes it to use a different time period.
 * For example, converts a daily URL to weekly or monthly.
 */
export function rebuildAlphaVantageUrl(originalUrl: string, timeInterval: TimeInterval): string {
  try {
    const url = new URL(originalUrl)
    const params = url.searchParams
    
    // Extract symbol from current URL
    const symbol = params.get('symbol') || ''
    
    if (!symbol) {
      // If no symbol, return original URL
      return originalUrl
    }
    
    // Remove existing function parameter
    params.delete('function')
    params.delete('interval') // Remove interval for non-intraday
    
    // Set the new function based on time interval
    switch (timeInterval) {
      case 'daily':
        params.set('function', 'TIME_SERIES_DAILY')
        break
      case 'weekly':
        params.set('function', 'TIME_SERIES_WEEKLY')
        break
      case 'monthly':
        params.set('function', 'TIME_SERIES_MONTHLY')
        break
      case 'intraday':
        params.set('function', 'TIME_SERIES_INTRADAY')
        // Intraday requires an interval parameter (default to 5min)
        if (!params.has('interval')) {
          params.set('interval', '5min')
        }
        break
    }
    
    // Ensure symbol is set
    params.set('symbol', symbol)
    
    return url.toString()
  } catch (error) {
    // If URL parsing fails, try manual string replacement
    console.warn('[AlphaVantageUrlBuilder] Failed to parse URL, using string replacement:', error)
    
    // Try to replace function parameter manually
    let newUrl = originalUrl
    
    // Remove existing function
    newUrl = newUrl.replace(/function=[^&]*/i, '')
    
    // Remove existing interval
    newUrl = newUrl.replace(/&interval=[^&]*/i, '')
    
    // Add new function
    const functionMap: Record<TimeInterval, string> = {
      daily: 'TIME_SERIES_DAILY',
      weekly: 'TIME_SERIES_WEEKLY',
      monthly: 'TIME_SERIES_MONTHLY',
      intraday: 'TIME_SERIES_INTRADAY',
    }
    
    const separator = newUrl.includes('?') ? '&' : '?'
    newUrl = `${newUrl}${separator}function=${functionMap[timeInterval]}`
    
    // Add interval for intraday
    if (timeInterval === 'intraday' && !newUrl.includes('interval=')) {
      newUrl = `${newUrl}&interval=5min`
    }
    
    return newUrl
  }
}

/**
 * Checks if a URL is from Alpha Vantage so we know we can rebuild it.
 */
export function isAlphaVantageUrl(url: string): boolean {
  return url.toLowerCase().includes('alphavantage.co')
}

/**
 * Pulls the stock symbol out of an Alpha Vantage URL.
 */
export function extractSymbolFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('symbol')
  } catch {
    // Try regex fallback
    const match = url.match(/[?&]symbol=([^&]+)/i)
    return match && match[1] ? decodeURIComponent(match[1]) : null
  }
}

