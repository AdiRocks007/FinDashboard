/**
 * Helper functions to format numbers, dates, and currency values nicely.
 * Makes sure everything looks good in the widgets.
 */

import { format as dateFnsFormat } from 'date-fns'

/**
 * Formats a number as currency (e.g., 1234.56 becomes "$1,234.56").
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  decimals: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format percentage value
 */
export function formatPercentage(
  value: number,
  decimals: number = 2,
  includeSign: boolean = true
): string {
  const formatted = (value * 100).toFixed(decimals)
  return includeSign && value > 0 ? `+${formatted}%` : `${formatted}%`
}

/**
 * Format number with commas
 */
export function formatNumber(
  value: number,
  decimals: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format large volume numbers (K, M, B)
 */
export function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toString()
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(
  timestamp: number,
  format: string = 'MMM dd, yyyy HH:mm'
): string {
  return dateFnsFormat(new Date(timestamp), format)
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = []
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      const sum = slice.reduce((acc, val) => acc + val, 0)
      result.push(sum / period)
    }
  }
  
  return result
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = []
  const multiplier = 2 / (period + 1)
  
  // Start with SMA for first value
  if (data.length >= period) {
    const firstSlice = data.slice(0, period)
    const firstSMA = firstSlice.reduce((acc, val) => acc + val, 0) / period
    result.push(firstSMA)
    
    // Calculate EMA for remaining values
    for (let i = period; i < data.length; i++) {
      const currentValue = data[i]
      const lastIndex = result.length - 1
      if (lastIndex >= 0 && currentValue !== undefined && typeof currentValue === 'number') {
        const prevEma = result[lastIndex]
        if (prevEma !== undefined && typeof prevEma === 'number' && !isNaN(prevEma)) {
          const ema = (currentValue - prevEma) * multiplier + prevEma
          result.push(ema)
        }
      }
    }
  }
  
  // Pad with NaN for values before period
  return Array(data.length - result.length).fill(NaN).concat(result)
}

/**
 * Get color class for positive/negative values
 */
export function getChangeColorClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-neutral-600 dark:text-neutral-400'
}

/**
 * Get background color class for positive/negative values
 */
export function getChangeBgClass(value: number): string {
  if (value > 0) return 'bg-green-50 dark:bg-green-900/20'
  if (value < 0) return 'bg-red-50 dark:bg-red-900/20'
  return 'bg-neutral-50 dark:bg-neutral-800'
}
