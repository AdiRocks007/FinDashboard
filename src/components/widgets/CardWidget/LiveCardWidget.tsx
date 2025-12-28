'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import { animated, useSpring } from 'react-spring'
import { formatCurrency, formatPercentage, formatTimestamp } from '@/lib/utils/dataFormatter'
import { WEBSOCKET_PROVIDERS } from '@/lib/services/websocketService'
import { throttle } from 'lodash-es'

// Real-time card widget with WebSocket:
// - Subscribe to symbol on mount
// - Unsubscribe on unmount
// - Throttle updates to prevent excessive renders (500ms)
// - Animate value changes
// - Flash green/red on price change
// - Show connection status indicator

interface LiveCardWidgetProps {
  symbol: string
  provider: 'finnhub' | 'polygon'
  title?: string
  className?: string
}

export function LiveCardWidget({ symbol, provider, title, className }: LiveCardWidgetProps) {
  const [data, setData] = useState<{
    price?: number
    volume?: number
    timestamp?: number
    change?: number
    changePercent?: number
  } | null>(null)
  
  const prevPrice = useRef<number | null>(null)
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null)

  // Get provider config
  const providerConfig = useMemo(() => {
    const upperProvider = provider.toUpperCase()
    return WEBSOCKET_PROVIDERS[upperProvider]
  }, [provider])

  // Get WebSocket URL with auth
  const wsUrl = useMemo(() => {
    if (!providerConfig) return ''
    
    let url = providerConfig.url
    const token = provider === 'finnhub' 
      ? process.env.NEXT_PUBLIC_FINNHUB_KEY
      : process.env.NEXT_PUBLIC_POLYGON_KEY
    
    if (token) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}token=${token}`
    }
    
    return url
  }, [provider, providerConfig])

  // Throttled update function (max once per 500ms)
  const throttledUpdate = useRef(
    throttle((newData: any) => {
      setData((prev: any) => ({
        ...prev,
        ...newData,
      }))
    }, 500)
  ).current

  // WebSocket connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket({
    url: wsUrl,
    shouldConnect: !!wsUrl,
    onMessage: (message) => {
      if (!providerConfig) return

      // Parse provider-specific message format
      const parsed = providerConfig.parseMessage(message)
      
      if (parsed) {
        // Handle array of messages (Polygon)
        const messages = Array.isArray(parsed) ? parsed : [parsed]
        
        messages.forEach((msg: any) => {
          // Only update if symbol matches
          if (msg.symbol === symbol || msg.symbol?.toUpperCase() === symbol.toUpperCase()) {
            throttledUpdate(msg)
          }
        })
      }
    },
    onError: (error) => {
      console.error('[LiveCardWidget] WebSocket error:', error)
    },
  })

  // Subscribe to symbol when connected
  useEffect(() => {
    if (isConnected && providerConfig) {
      // Send subscribe message
      const subscribeMsg = providerConfig.getSubscribeMessage([symbol])
      sendMessage(subscribeMsg)
      
      console.log(`[LiveCardWidget] Subscribed to ${symbol} via ${provider}`)
    }

    return () => {
      // Unsubscribe on unmount
      if (isConnected && providerConfig) {
        const unsubscribeMsg = providerConfig.getUnsubscribeMessage([symbol])
        sendMessage(unsubscribeMsg)
        console.log(`[LiveCardWidget] Unsubscribed from ${symbol}`)
      }
    }
  }, [isConnected, symbol, provider, providerConfig, sendMessage])

  // Animate price changes
  const priceSpring = useSpring({
    value: data?.price || 0,
    config: { tension: 280, friction: 60 },
  })

  // Flash effect on price change
  useEffect(() => {
    if (data?.price !== undefined && prevPrice.current !== null && data.price !== prevPrice.current) {
      const color = data.price > prevPrice.current ? 'green' : 'red'
      setFlashColor(color)
      
      const timeout = setTimeout(() => {
        setFlashColor(null)
      }, 300)
      
      prevPrice.current = data.price
      return () => clearTimeout(timeout)
    }
    
    prevPrice.current = data?.price ?? null
    return undefined
  }, [data?.price])

  const change = data?.change ?? 0
  const changePercent = data?.changePercent ?? 0

  return (
    <div
      className={`
        p-4 rounded-lg border transition-all duration-300
        ${flashColor === 'green' ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' : ''}
        ${flashColor === 'red' ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' : ''}
        ${!flashColor ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800' : ''}
        ${className || ''}
      `}
    >
      {/* Connection status indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        {data?.timestamp && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {formatTimestamp(data.timestamp, 'HH:mm:ss')}
          </span>
        )}
      </div>

      {/* Symbol/Title */}
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
        {title || symbol}
      </h3>

      {/* Animated price */}
      <animated.div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
        {priceSpring.value.to((val) => formatCurrency(val, 'USD', 2))}
      </animated.div>

      {/* Change */}
      {change !== 0 && (
        <div
          className={`text-sm font-medium ${
            change >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {change >= 0 ? '+' : ''}
          {formatCurrency(change, 'USD', 2)} ({formatPercentage(changePercent / 100, 2, true)})
        </div>
      )}

      {/* Volume */}
      {data?.volume && (
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          Vol: {data.volume.toLocaleString()}
        </div>
      )}
    </div>
  )
}

