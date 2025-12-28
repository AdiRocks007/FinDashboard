'use client'

import { useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { get } from 'lodash-es'
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  getChangeColorClass,
} from '@/lib/utils/dataFormatter'
import { cn } from '@/lib/utils/cn'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface CardWidgetProps {
  data: any[]
  fieldMapping: Record<string, string>
  settings: {
    layout?: 'single' | 'grid' | 'list'
    showSparkline?: boolean
    animateChanges?: boolean
  }
}

/**
 * Card widget for displaying KPIs and watchlists
 * Features:
 * - Three layout modes: single, grid, list
 * - Sparkline charts (optional)
 * - Smooth animations on data updates
 * - Color coding for positive/negative changes
 * - Responsive design
 */
export default function CardWidget({ data, fieldMapping, settings = {} }: CardWidgetProps) {
  // Reduce logging noise - only log on mount or data change
  const hasLoggedRef = useRef(false)
  useEffect(() => {
    if (!hasLoggedRef.current) {
      console.log('💳 [CARD WIDGET] Initial render:', {
        dataCount: data?.length || 0,
        dataPreview: data?.[0],
        fieldMapping,
        settings,
      })
      hasLoggedRef.current = true
    }
  }, [])

  const animateChanges = settings.animateChanges ?? true

  // Auto-detect fields if mapping is empty
  const effectiveFieldMapping = useMemo(() => {
    console.log('🔍 [CARD WIDGET] Field mapping analysis:', {
      originalFieldMapping: fieldMapping,
      hasFieldMapping: fieldMapping && Object.keys(fieldMapping).length > 0,
      dataPreview: data?.[0],
    })

    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      return fieldMapping
    }

    // Auto-detect from first data item
    if (data && data.length > 0) {
      const firstItem = data[0]
      const detected: Record<string, string> = {}

      // Look for common financial data fields (for future use)
      Object.keys(firstItem).forEach((key) => {
        if (key !== 'metadata' && key !== 'timestamp') {
          detected[key] = key
        }
      })

      console.log('🔍 [CARD WIDGET] Auto-detected fields:', detected)
      return detected
    }

    return {}
  }, [data, fieldMapping])

  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-neutral-400">No data available</p>
      </div>
    )
  }

  // For dashboard cards, always use single card layout to fit properly in the grid
  // The dashboard grid will handle the arrangement of multiple cards
  if (data.length === 1) {
    return (
      <SingleCard
        data={data[0]}
        fieldMapping={effectiveFieldMapping}
        animateChanges={animateChanges}
      />
    )
  }

  // For multiple data items, show the first one as a single card
  // (Each widget should represent one data point in the dashboard grid)
  return (
    <SingleCard
      data={data[0]}
      fieldMapping={effectiveFieldMapping}
      animateChanges={animateChanges}
    />
  )
}

// Single large card
function SingleCard({
  data,
  fieldMapping,
  animateChanges,
}: {
  data: any
  fieldMapping: Record<string, string>
  animateChanges: boolean
}) {
  if (!data) return null

  // Debug logging to see what we're working with
  console.log('🔍 [SINGLE CARD] Debug info:', {
    data,
    fieldMapping,
    dataKeys: Object.keys(data || {}),
    fieldMappingKeys: Object.keys(fieldMapping || {}),
  })

  // Improved field detection with fallbacks
  let titlePath = ''
  let pricePath = ''
  let changePath = ''
  let changePercentPath = ''

  // Try to find title field
  if (fieldMapping.symbol) titlePath = fieldMapping.symbol
  else if (fieldMapping.title) titlePath = fieldMapping.title
  else if (data.symbol !== undefined) titlePath = 'symbol'
  else if (data.title !== undefined) titlePath = 'title'
  else if (data.name !== undefined) titlePath = 'name'
  else if (data.T !== undefined) titlePath = 'T' // Polygon symbol field
  else if (data['01. symbol'] !== undefined) titlePath = '01. symbol' // Alpha Vantage symbol
  else titlePath = Object.keys(fieldMapping)[0] || Object.keys(data)[0] || ''

  // Try to find price field - check common API response fields
  if (fieldMapping.price) pricePath = fieldMapping.price
  else if (fieldMapping.c) pricePath = fieldMapping.c
  else if (fieldMapping.close) pricePath = fieldMapping.close
  else if (data.price !== undefined) pricePath = 'price'
  else if (data.c !== undefined) pricePath = 'c' // Finnhub current price
  else if (data.close !== undefined) pricePath = 'close'
  else if (data.current !== undefined) pricePath = 'current'
  else if (data.l !== undefined) pricePath = 'l' // Last price
  else if (data.pc !== undefined) pricePath = 'pc' // Previous close
  else if (data['05. price'] !== undefined) pricePath = '05. price' // Alpha Vantage price
  else pricePath = Object.values(fieldMapping)[0] || ''

  // Try to find change field
  if (fieldMapping.change) changePath = fieldMapping.change
  else if (fieldMapping.d) changePath = fieldMapping.d
  else if (data.change !== undefined) changePath = 'change'
  else if (data.d !== undefined) changePath = 'd' // Finnhub change
  else if (data['09. change'] !== undefined) changePath = '09. change' // Alpha Vantage change
  else changePath = Object.values(fieldMapping)[1] || ''

  // Try to find change percent field
  if (fieldMapping.changePercent) changePercentPath = fieldMapping.changePercent
  else if (fieldMapping.dp) changePercentPath = fieldMapping.dp
  else if (data.changePercent !== undefined) changePercentPath = 'changePercent'
  else if (data.dp !== undefined) changePercentPath = 'dp' // Finnhub change percent
  else if (data['10. change percent'] !== undefined) changePercentPath = '10. change percent' // Alpha Vantage change percent
  else changePercentPath = Object.values(fieldMapping)[2] || ''

  // Extract values with better fallback handling
  let title = titlePath ? get(data, titlePath) : 'N/A'
  let price = pricePath ? get(data, pricePath) : null
  let change = changePath ? get(data, changePath) : null
  let changePercent = changePercentPath ? get(data, changePercentPath) : null

  // If we still don't have values, try direct access to common fields
  if (!title || title === 'N/A') {
    title = data.symbol || data.title || data.name || data.T || 'Unknown'
  }
  
  if (price === null || price === undefined) {
    price = data.price || data.c || data.close || data.current || data.l || data.pc
  }
  
  if (change === null || change === undefined) {
    change = data.change || data.d || 0
  }
  
  if (changePercent === null || changePercent === undefined) {
    changePercent = data.changePercent || data.dp || 0
  }

  // Debug the extracted values
  console.log('🔍 [SINGLE CARD] Extracted values:', {
    titlePath, title,
    pricePath, price,
    changePath, change,
    changePercentPath, changePercent,
  })

  const changeValue = typeof change === 'number' ? change : parseFloat(String(change || 0))
  const changePercentValue =
    typeof changePercent === 'number' ? changePercent : parseFloat(String(changePercent || 0))

  return (
    <motion.div
      initial={animateChanges ? { scale: 0.95, opacity: 0 } : false}
      animate={animateChanges ? { scale: 1, opacity: 1 } : false}
      transition={{ duration: 0.3 }}
      className="h-full w-full p-4"
    >
      <div className="mb-3 text-sm font-semibold tracking-wider text-neutral-400 uppercase">
        {String(title || 'Unknown')}
      </div>
      <div className="mb-3 text-3xl font-bold text-white">
        {typeof price === 'number' ? formatCurrency(price) : 
         price !== null && price !== undefined ? String(price) : 'N/A'}
      </div>
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {changeValue > 0 ? (
            <motion.div
              key="up"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn('flex items-center gap-1', getChangeColorClass(changeValue))}
            >
              <TrendingUp className="h-4 w-4" />
              <span className="font-semibold">
                {formatCurrency(Math.abs(changeValue))} (
                {formatPercentage(changePercentValue / 100)})
              </span>
            </motion.div>
          ) : changeValue < 0 ? (
            <motion.div
              key="down"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn('flex items-center gap-1', getChangeColorClass(changeValue))}
            >
              <TrendingDown className="h-4 w-4" />
              <span className="font-semibold">
                {formatCurrency(Math.abs(changeValue))} (
                {formatPercentage(changePercentValue / 100)})
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="neutral"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-neutral-500"
            >
              <Minus className="h-4 w-4" />
              <span>No change</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
