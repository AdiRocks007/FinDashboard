'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string
  protocols?: string[]
  reconnectAttempts?: number
  reconnectInterval?: number
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  shouldConnect?: boolean
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    protocols,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onMessage,
    onError,
    shouldConnect = true,
  } = options

  const ws = useRef<WebSocket | null>(null)
  const reconnectCount = useRef(0)
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const isManualClose = useRef(false)

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)

  // Connect function
  const connect = useCallback(() => {
    if (!shouldConnect) return

    // Don't reconnect if manually closed
    if (isManualClose.current) return

    try {
      // Close existing connection if any
      if (ws.current) {
        ws.current.close()
      }

      ws.current = new WebSocket(url, protocols)

      ws.current.onopen = () => {
        console.log('[WebSocket] Connected:', url)
        setIsConnected(true)
        reconnectCount.current = 0
      }

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          onMessage?.(data)
        } catch (err) {
          console.error('[WebSocket] Message parse error:', err)
          // Try to pass raw data if JSON parsing fails
          setLastMessage(event.data)
          onMessage?.(event.data)
        }
      }

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        setIsConnected(false)
        onError?.(error)
      }

      ws.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason)
        setIsConnected(false)

        // Attempt reconnection if not manually closed
        if (!isManualClose.current && reconnectCount.current < reconnectAttempts) {
          reconnectCount.current++
          const delay = reconnectInterval * Math.pow(1.5, reconnectCount.current - 1) // Exponential backoff
          console.log(`[WebSocket] Reconnecting... Attempt ${reconnectCount.current}/${reconnectAttempts} in ${delay}ms`)
          
          reconnectTimeout.current = setTimeout(() => {
            connect()
          }, delay)
        } else if (reconnectCount.current >= reconnectAttempts) {
          console.error('[WebSocket] Max reconnection attempts reached')
        }
      }
    } catch (err) {
      console.error('[WebSocket] Connection error:', err)
      setIsConnected(false)
    }
  }, [url, protocols, reconnectAttempts, reconnectInterval, onMessage, onError, shouldConnect])

  // Disconnect function
  const disconnect = useCallback(() => {
    isManualClose.current = true
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = undefined
    }
    
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
    
    setIsConnected(false)
  }, [])

  // Send message function
  const sendMessage = useCallback((data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data)
        ws.current.send(message)
      } catch (err) {
        console.error('[WebSocket] Send error:', err)
      }
    } else {
      console.warn('[WebSocket] Cannot send message: not connected')
    }
  }, [])

  // Reconnect function (reset manual close flag)
  const reconnect = useCallback(() => {
    isManualClose.current = false
    reconnectCount.current = 0
    connect()
  }, [connect])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (shouldConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [connect, disconnect, shouldConnect])

  // Handle page visibility (pause when tab not visible)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - pause connection
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.close()
          console.log('[WebSocket] Paused due to tab visibility')
        }
      } else {
        // Tab is visible - reconnect if needed
        if (shouldConnect && !isConnected && !isManualClose.current) {
          reconnect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [shouldConnect, isConnected, reconnect])

  return {
    isConnected,
    lastMessage,
    sendMessage,
    disconnect,
    reconnect,
  }
}
