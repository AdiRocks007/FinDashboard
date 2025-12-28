'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Brush,
} from 'recharts'
import { get } from 'lodash-es'
import { calculateSMA, calculateEMA, formatTimestamp, formatCurrency, formatVolume } from '@/lib/utils/dataFormatter'
import { cn } from '@/lib/utils/cn'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Select, SelectOption } from '@/components/ui/Select'
import { useAppDispatch } from '@/lib/store/hooks'
import { updateWidget } from '@/lib/store/slices/widgetsSlice'

interface ChartWidgetProps {
  data: any[]
  fieldMapping: Record<string, string>
  settings: {
    chartType?: 'line' | 'candlestick' | 'area' | 'bar'
    timeInterval?: 'daily' | 'weekly' | 'monthly' | 'intraday'
    indicators?: Array<'sma' | 'ema' | 'volume'>
    colorScheme?: 'default' | 'tradingview' | 'bloomberg'
  }
  widgetId?: string
}

/**
 * Beautiful chart widget for visualizing time series data.
 * Switch between daily, weekly, monthly, and intraday views using the dropdown.
 * Supports technical indicators and multiple chart styles.
 */
const TIME_INTERVAL_OPTIONS: SelectOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'intraday', label: 'Intraday' },
]

export default function ChartWidget({
  data,
  fieldMapping,
  settings = {},
  widgetId,
}: ChartWidgetProps) {
  const dispatch = useAppDispatch()
  // Reduce logging - only log when data actually changes
  const dataLengthRef = useRef(0)
  useEffect(() => {
    if (data?.length !== dataLengthRef.current) {
      console.log('📈 [CHART WIDGET] Data changed:', {
        dataCount: data?.length || 0,
        dataPreview: data?.[0]
      })
      dataLengthRef.current = data?.length || 0
    }
  }, [data])
  
  const chartType = settings.chartType || 'line'
  const indicators = settings.indicators || []
  const colorScheme = settings.colorScheme || 'default'

  // Extract chart data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return []
    }

    const processed = data.map((item, index) => {
      // Try multiple paths for each field
      const price = get(item, fieldMapping.price || 'price') || 
                   get(item, 'metadata.price') || 
                   get(item, 'c') || 
                   get(item, 'close') ||
                   (typeof item === 'object' && item !== null ? Object.values(item).find(v => typeof v === 'number' && v > 0) : null)
      
      const timestamp = get(item, fieldMapping.timestamp || 'timestamp') || 
                        get(item, 'metadata.timestamp') ||
                        get(item, 't') ||
                        Date.now() - (data.length - index) * 60000 // Fallback: generate timestamps
      
      const volume = get(item, fieldMapping.volume || 'volume') || 
                     get(item, 'metadata.volume') || 
                     get(item, 'v') || 
                     0
      
      const open = get(item, fieldMapping.open || 'open') || 
                   get(item, 'metadata.open') || 
                   get(item, 'o') || 
                   price
      
      const high = get(item, fieldMapping.high || 'high') || 
                   get(item, 'metadata.high') || 
                   get(item, 'h') || 
                   price
      
      const low = get(item, fieldMapping.low || 'low') || 
                  get(item, 'metadata.low') || 
                  get(item, 'l') || 
                  price

      const numPrice = typeof price === 'number' ? price : (typeof price === 'string' ? parseFloat(price) : 0) || 0
      const numTimestamp = typeof timestamp === 'number' ? timestamp : (typeof timestamp === 'string' ? Date.parse(timestamp) : Date.now())

      return {
        timestamp: numTimestamp,
        time: formatTimestamp(numTimestamp, 'MMM dd'),
        price: numPrice,
        open: typeof open === 'number' ? open : (typeof open === 'string' ? parseFloat(open) : numPrice) || numPrice,
        high: typeof high === 'number' ? high : (typeof high === 'string' ? parseFloat(high) : numPrice) || numPrice,
        low: typeof low === 'number' ? low : (typeof low === 'string' ? parseFloat(low) : numPrice) || numPrice,
        close: numPrice,
        volume: typeof volume === 'number' ? volume : (typeof volume === 'string' ? parseFloat(volume) : 0) || 0,
      }
    }).sort((a, b) => a.timestamp - b.timestamp)
    
    return processed
  }, [data, fieldMapping])

  // Calculate indicators
  const dataWithIndicators = useMemo(() => {
    if (chartData.length === 0) return []

    const prices = chartData.map((d) => d.price)
    const volumes = chartData.map((d) => d.volume)

    return chartData.map((item, index) => {
      const result: any = { ...item }

      if (indicators.includes('sma')) {
        const sma20 = calculateSMA(prices, 20)
        const sma50 = calculateSMA(prices, 50)
        const sma20Value = sma20[index]
        const sma50Value = sma50[index]
        if (sma20Value !== undefined && typeof sma20Value === 'number' && !isNaN(sma20Value)) {
          result.sma20 = sma20Value
        }
        if (sma50Value !== undefined && typeof sma50Value === 'number' && !isNaN(sma50Value)) {
          result.sma50 = sma50Value
        }
      }

      if (indicators.includes('ema')) {
        const ema12 = calculateEMA(prices, 12)
        const ema26 = calculateEMA(prices, 26)
        const ema12Value = ema12[index]
        const ema26Value = ema26[index]
        if (ema12Value !== undefined && typeof ema12Value === 'number' && !isNaN(ema12Value)) {
          result.ema12 = ema12Value
        }
        if (ema26Value !== undefined && typeof ema26Value === 'number' && !isNaN(ema26Value)) {
          result.ema26 = ema26Value
        }
      }

      return result
    })
  }, [chartData, indicators])

  // Downsample if too many points
  const displayData = useMemo(() => {
    if (dataWithIndicators.length <= 1000) return dataWithIndicators

    // Downsample to ~500 points
    const step = Math.ceil(dataWithIndicators.length / 500)
    return dataWithIndicators.filter((_, index) => index % step === 0)
  }, [dataWithIndicators])

  // Color scheme
  const colors = useMemo(() => {
    switch (colorScheme) {
      case 'tradingview':
        return {
          primary: '#2962FF',
          secondary: '#FF6D00',
          positive: '#26A69A',
          negative: '#EF5350',
          volume: '#78909C',
        }
      case 'bloomberg':
        return {
          primary: '#000000',
          secondary: '#FFD700',
          positive: '#00A651',
          negative: '#E60000',
          volume: '#666666',
        }
      default:
        return {
          primary: '#3B82F6',
          secondary: '#8B5CF6',
          positive: '#10B981',
          negative: '#EF4444',
          volume: '#6B7280',
        }
    }
  }, [colorScheme])

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const data = payload[0].payload
    return (
      <div className="rounded-lg border border-neutral-700 bg-[#1a1f3a] p-3 shadow-xl">
        <p className="mb-2 text-sm font-semibold text-white">{data.time}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-neutral-200" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
        {data.volume > 0 && (
          <p className="mt-2 text-xs text-neutral-400">Volume: {formatVolume(data.volume)}</p>
        )}
      </div>
    )
  }

  // Render chart based on type
  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart data={displayData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8} />
                <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              stroke="#6b7280"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
              tickLine={false}
            />
            <YAxis 
              domain={['auto', 'auto']} 
              stroke="#6b7280"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={colors.primary}
              fillOpacity={1}
              fill="url(#colorPrice)"
            />
            {indicators.includes('sma') && (
              <>
                <Line type="monotone" dataKey="sma20" stroke={colors.secondary} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="sma50" stroke={colors.secondary} strokeDasharray="3 3" dot={false} />
              </>
            )}
            {indicators.includes('ema') && (
              <>
                <Line type="monotone" dataKey="ema12" stroke={colors.positive} dot={false} />
                <Line type="monotone" dataKey="ema26" stroke={colors.negative} dot={false} />
              </>
            )}
            <Brush 
              dataKey="time" 
              height={30} 
              stroke={colors.primary}
              fill="rgba(34, 197, 94, 0.1)"
              travellerWidth={10}
            />
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart data={displayData}>
            <XAxis 
              dataKey="time" 
              stroke="#6b7280"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
              tickLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
              tickLine={false}
              tickFormatter={(value) => formatVolume(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="volume" fill={colors.volume} />
          </BarChart>
        )

      case 'line':
      default:
        return (
          <LineChart data={displayData}>
            <XAxis 
              dataKey="time" 
              stroke="#6b7280"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
              tickLine={false}
            />
            <YAxis 
              domain={['auto', 'auto']} 
              stroke="#6b7280"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="price"
              stroke={colors.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {indicators.includes('sma') && (
              <>
                <Line
                  type="monotone"
                  dataKey="sma20"
                  stroke={colors.secondary}
                  strokeDasharray="5 5"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="sma50"
                  stroke={colors.secondary}
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1}
                />
              </>
            )}
            {indicators.includes('ema') && (
              <>
                <Line type="monotone" dataKey="ema12" stroke={colors.positive} dot={false} strokeWidth={1} />
                <Line type="monotone" dataKey="ema26" stroke={colors.negative} dot={false} strokeWidth={1} />
              </>
            )}
            <Brush 
              dataKey="time" 
              height={30} 
              stroke={colors.primary}
              fill="rgba(34, 197, 94, 0.1)"
              travellerWidth={10}
            />
          </LineChart>
        )
    }
  }

  if (displayData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-neutral-500">
        No chart data available
      </div>
    )
  }

  // Calculate price change
  const firstPrice = displayData[0]?.price || 0
  const lastPrice = displayData[displayData.length - 1]?.price || 0
  const priceChange = lastPrice - firstPrice
  const priceChangePercent = firstPrice !== 0 ? (priceChange / firstPrice) * 100 : 0

  const currentTimeInterval = settings.timeInterval || 'daily'

  const handleTimeIntervalChange = (newInterval: string | number) => {
    if (widgetId) {
      dispatch(updateWidget({
        id: widgetId,
        updates: {
          settings: {
            ...settings,
            timeInterval: newInterval as 'daily' | 'weekly' | 'monthly' | 'intraday',
          },
        },
      }))
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Header with price info and time interval selector */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatCurrency(lastPrice)}
          </div>
          <div className={cn('flex items-center gap-2', priceChange >= 0 ? 'text-green-600' : 'text-red-600')}>
            {priceChange >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">
              {formatCurrency(Math.abs(priceChange))} ({priceChangePercent >= 0 ? '+' : ''}
              {priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Time Interval Selector */}
          {widgetId && (
            <div className="w-32">
              <Select
                options={TIME_INTERVAL_OPTIONS}
                value={currentTimeInterval}
                onChange={handleTimeIntervalChange}
                label="Time Period"
              />
            </div>
          )}
          {indicators.length > 0 && (
            <div className="flex gap-4 text-xs text-neutral-500">
              {indicators.includes('sma') && (
                <div>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors.secondary }} />
                  SMA
                </div>
              )}
              {indicators.includes('ema') && (
                <div>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors.positive }} />
                  EMA
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}

