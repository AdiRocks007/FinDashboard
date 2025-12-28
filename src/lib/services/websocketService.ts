// WebSocket service for financial data providers

export interface WebSocketProvider {
  url: string
  getSubscribeMessage: (symbols: string[]) => any
  getUnsubscribeMessage: (symbols: string[]) => any
  parseMessage: (data: any) => any | null
  requiresAuth?: boolean
  authToken?: string
}

export const WEBSOCKET_PROVIDERS: Record<string, WebSocketProvider> = {
  FINNHUB: {
    url: 'wss://ws.finnhub.io',
    requiresAuth: true,
    getSubscribeMessage: (symbols: string[]) => ({
      type: 'subscribe',
      symbol: symbols.join(','),
    }),
    getUnsubscribeMessage: (symbols: string[]) => ({
      type: 'unsubscribe',
      symbol: symbols.join(','),
    }),
    parseMessage: (data: any) => {
      // Transform Finnhub WebSocket message format to normalized format
      if (data.type === 'trade') {
        return {
          symbol: data.s,
          price: data.p,
          volume: data.v,
          timestamp: data.t * 1000, // Convert to milliseconds
          change: data.p - (data.pc || 0), // Price change
          changePercent: data.pc ? ((data.p - data.pc) / data.pc) * 100 : 0,
        }
      }
      return null
    },
  },
  POLYGON: {
    url: 'wss://socket.polygon.io/stocks',
    requiresAuth: true,
    getSubscribeMessage: (symbols: string[]) => ({
      action: 'subscribe',
      params: symbols.map(s => `T.${s}`).join(','),
    }),
    getUnsubscribeMessage: (symbols: string[]) => ({
      action: 'unsubscribe',
      params: symbols.map(s => `T.${s}`).join(','),
    }),
    parseMessage: (data: any) => {
      // Transform Polygon WebSocket message format
      if (Array.isArray(data)) {
        return data.map((item: any) => {
          if (item.ev === 'T') {
            // Trade event
            return {
              symbol: item.sym,
              price: item.p,
              volume: item.s,
              timestamp: item.t,
              change: item.p - (item.pc || 0),
              changePercent: item.pc ? ((item.p - item.pc) / item.pc) * 100 : 0,
            }
          }
          return null
        }).filter(Boolean)
      }
      return null
    },
  },
}

export type WebSocketProviderType = keyof typeof WEBSOCKET_PROVIDERS

interface Subscription {
  symbols: Set<string>
  callbacks: Set<(data: any) => void>
}

export class WebSocketManager {
  private connections = new Map<string, WebSocket>()
  private subscriptions = new Map<string, Subscription>()
  private messageCallbacks = new Map<string, Set<(data: any) => void>>()
  private reconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private reconnectCounts = new Map<string, number>()

  private getProviderConfig(provider: string): WebSocketProvider | null {
    const upperProvider = provider.toUpperCase()
    return WEBSOCKET_PROVIDERS[upperProvider] || null
  }

  private getAuthUrl(provider: string): string {
    const config = this.getProviderConfig(provider)
    if (!config) return ''

    let url = config.url

    if (config.requiresAuth) {
      const token = config.authToken || this.getAuthToken(provider)
      if (token) {
        const separator = url.includes('?') ? '&' : '?'
        url = `${url}${separator}token=${token}`
      }
    }

    return url
  }

  private getAuthToken(provider: string): string | null {
    const upperProvider = provider.toUpperCase()
    switch (upperProvider) {
      case 'FINNHUB':
        return process.env.NEXT_PUBLIC_FINNHUB_KEY || null
      case 'POLYGON':
        return process.env.NEXT_PUBLIC_POLYGON_KEY || null
      default:
        return null
    }
  }

  private createConnection(provider: string): WebSocket | undefined {
    const url = this.getAuthUrl(provider)
    if (!url) {
      console.error(`[WebSocketManager] Invalid provider or missing auth: ${provider}`)
      return undefined
    }

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log(`[WebSocketManager] Connected to ${provider}`)
        this.reconnectCounts.set(provider, 0)

        // Resubscribe to all symbols
        const subscription = this.subscriptions.get(provider)
        if (subscription && subscription.symbols.size > 0) {
          const config = this.getProviderConfig(provider)
          if (config) {
            const subscribeMsg = config.getSubscribeMessage(Array.from(subscription.symbols))
            ws.send(JSON.stringify(subscribeMsg))
          }
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(provider, data)
        } catch (err) {
          console.error(`[WebSocketManager] Parse error for ${provider}:`, err)
        }
      }

      ws.onerror = (error) => {
        console.error(`[WebSocketManager] Error for ${provider}:`, error)
      }

      ws.onclose = () => {
        console.log(`[WebSocketManager] Disconnected from ${provider}`)
        this.connections.delete(provider)

        // Attempt reconnection
        this.attemptReconnect(provider)
      }

      return ws
    } catch (err) {
      console.error(`[WebSocketManager] Connection error for ${provider}:`, err)
      return undefined
    }
  }

  private attemptReconnect(provider: string, maxAttempts = 5, baseDelay = 3000) {
    const currentAttempt = this.reconnectCounts.get(provider) || 0

    if (currentAttempt >= maxAttempts) {
      console.error(`[WebSocketManager] Max reconnection attempts reached for ${provider}`)
      return
    }

    const delay = baseDelay * Math.pow(1.5, currentAttempt) // Exponential backoff
    this.reconnectCounts.set(provider, currentAttempt + 1)

    console.log(`[WebSocketManager] Reconnecting to ${provider} in ${delay}ms (attempt ${currentAttempt + 1}/${maxAttempts})`)

    const timeout = setTimeout(() => {
      const ws = this.createConnection(provider)
      if (ws) {
        this.connections.set(provider, ws)
      }
    }, delay)

    this.reconnectTimeouts.set(provider, timeout)
  }

  private handleMessage(provider: string, data: any) {
    const config = this.getProviderConfig(provider)
    if (!config) return

    const parsed = config.parseMessage(data)
    if (!parsed) return

    // Handle array of messages (Polygon)
    const messages = Array.isArray(parsed) ? parsed : [parsed]

    messages.forEach((message) => {
      // Broadcast to all callbacks
      const subscription = this.subscriptions.get(provider)
      if (subscription) {
        subscription.callbacks.forEach((callback) => {
          try {
            callback(message)
          } catch (err) {
            console.error(`[WebSocketManager] Callback error:`, err)
          }
        })
      }
    })
  }

  subscribe(
    provider: string,
    symbols: string[],
    callback: (data: any) => void
  ): () => void {
    const upperProvider = provider.toUpperCase()

    // Get or create subscription
    let subscription = this.subscriptions.get(upperProvider)
    if (!subscription) {
      subscription = {
        symbols: new Set(),
        callbacks: new Set(),
      }
      this.subscriptions.set(upperProvider, subscription)
    }

    // Add symbols and callback
    symbols.forEach((symbol) => subscription.symbols.add(symbol))
    subscription.callbacks.add(callback)

    // Get or create connection
    let ws = this.connections.get(upperProvider)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = this.createConnection(upperProvider)
      if (ws) {
        this.connections.set(upperProvider, ws)
      }
    } else {
      // Already connected, send subscribe message
      const config = this.getProviderConfig(upperProvider)
      if (config) {
        const subscribeMsg = config.getSubscribeMessage(symbols)
        ws.send(JSON.stringify(subscribeMsg))
      }
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(upperProvider, symbols, callback)
    }
  }

  unsubscribe(
    provider: string,
    symbols: string[],
    callback: (data: any) => void
  ) {
    const upperProvider = provider.toUpperCase()
    const subscription = this.subscriptions.get(upperProvider)

    if (!subscription) return

    // Remove callback
    subscription.callbacks.delete(callback)

    // Remove symbols if no more callbacks
    if (subscription.callbacks.size === 0) {
      // Unsubscribe from symbols
      const config = this.getProviderConfig(upperProvider)
      const ws = this.connections.get(upperProvider)

      if (config && ws && ws.readyState === WebSocket.OPEN) {
        const unsubscribeMsg = config.getUnsubscribeMessage(symbols)
        ws.send(JSON.stringify(unsubscribeMsg))
      }

      // Remove symbols
      symbols.forEach((symbol) => subscription.symbols.delete(symbol))

      // Close connection if no more subscriptions
      if (subscription.symbols.size === 0) {
        if (ws) {
          ws.close()
          this.connections.delete(upperProvider)
        }
        this.subscriptions.delete(upperProvider)
      }
    } else {
      // Still have callbacks, just remove these symbols
      symbols.forEach((symbol) => subscription.symbols.delete(symbol))
    }
  }

  disconnect(provider?: string) {
    if (provider) {
      const upperProvider = provider.toUpperCase()
      const ws = this.connections.get(upperProvider)
      if (ws) {
        ws.close()
        this.connections.delete(upperProvider)
      }
      this.subscriptions.delete(upperProvider)
    } else {
      // Disconnect all
      this.connections.forEach((ws) => ws.close())
      this.connections.clear()
      this.subscriptions.clear()
    }
  }

  getConnectionStatus(provider: string): 'connected' | 'disconnected' | 'connecting' {
    const upperProvider = provider.toUpperCase()
    const ws = this.connections.get(upperProvider)

    if (!ws) return 'disconnected'

    switch (ws.readyState) {
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CONNECTING:
        return 'connecting'
      default:
        return 'disconnected'
    }
  }
}

export const wsManager = new WebSocketManager()

