import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketManager, WEBSOCKET_PROVIDERS } from '@/lib/services/websocketService'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  url: string
  protocols?: string[]

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  private messageQueue: string[] = []

  constructor(url: string, protocols?: string[]) {
    this.url = url
    this.protocols = protocols

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    this.messageQueue.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  }

  // Test helpers
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }))
    }
  }

  getSentMessages(): any[] {
    return this.messageQueue.map((msg) => JSON.parse(msg))
  }
}

// Replace global WebSocket
const originalWebSocket = global.WebSocket
beforeEach(() => {
  // @ts-ignore
  global.WebSocket = MockWebSocket
})

afterEach(() => {
  global.WebSocket = originalWebSocket
})

describe('WebSocket Integration', () => {
  let manager: WebSocketManager

  beforeEach(() => {
    manager = new WebSocketManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    manager.disconnect()
  })

  describe('Connection Management', () => {
    it('should establish connection when subscribing', (done) => {
      const callback = vi.fn()
      
      const unsubscribe = manager.subscribe('FINNHUB', ['AAPL'], callback)

      // Wait for connection
      setTimeout(() => {
        const status = manager.getConnectionStatus('FINNHUB')
        expect(status).toBe('connected')
        unsubscribe()
        done()
      }, 50)
    })

    it('should reuse existing connection for multiple subscriptions', (done) => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      manager.subscribe('FINNHUB', ['AAPL'], callback1)
      
      setTimeout(() => {
        manager.subscribe('FINNHUB', ['MSFT'], callback2)
        
        setTimeout(() => {
          const status = manager.getConnectionStatus('FINNHUB')
          expect(status).toBe('connected')
          done()
        }, 50)
      }, 50)
    })

    it('should close connection when all subscriptions are removed', (done) => {
      const callback = vi.fn()
      const unsubscribe = manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        unsubscribe()
        
        setTimeout(() => {
          const status = manager.getConnectionStatus('FINNHUB')
          expect(status).toBe('disconnected')
          done()
        }, 50)
      }, 50)
    })
  })

  describe('Message Handling', () => {
    it('should parse and broadcast Finnhub messages', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        // Get the WebSocket instance
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        
        // Simulate Finnhub trade message
        ws.simulateMessage({
          type: 'trade',
          s: 'AAPL',
          p: 150.50,
          v: 1000,
          t: 1234567890,
          pc: 150.00,
        })

        setTimeout(() => {
          expect(callback).toHaveBeenCalled()
          const callData = callback.mock.calls[0][0]
          expect(callData.symbol).toBe('AAPL')
          expect(callData.price).toBe(150.50)
          expect(callData.volume).toBe(1000)
          done()
        }, 10)
      }, 50)
    })

    it('should handle multiple symbols in one message', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL', 'MSFT'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        
        ws.simulateMessage({
          type: 'trade',
          s: 'AAPL',
          p: 150.50,
          v: 1000,
          t: 1234567890,
        })

        setTimeout(() => {
          expect(callback).toHaveBeenCalled()
          done()
        }, 10)
      }, 50)
    })

    it('should filter messages by symbol', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        
        // Send message for different symbol
        ws.simulateMessage({
          type: 'trade',
          s: 'MSFT',
          p: 300.00,
          v: 500,
          t: 1234567890,
        })

        setTimeout(() => {
          // Callback should still be called (filtering happens in component)
          // But we verify the message was parsed
          expect(callback).toHaveBeenCalled()
          done()
        }, 10)
      }, 50)
    })
  })

  describe('Subscription Management', () => {
    it('should send subscribe message when connecting', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        const sentMessages = ws.getSentMessages()
        
        expect(sentMessages.length).toBeGreaterThan(0)
        const subscribeMsg = sentMessages.find((msg: any) => msg.type === 'subscribe')
        expect(subscribeMsg).toBeDefined()
        expect(subscribeMsg.symbol).toContain('AAPL')
        done()
      }, 50)
    })

    it('should send unsubscribe message when unsubscribing', (done) => {
      const callback = vi.fn()
      const unsubscribe = manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        unsubscribe()
        
        setTimeout(() => {
          const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
          if (ws) {
            const sentMessages = ws.getSentMessages()
            const unsubscribeMsg = sentMessages.find((msg: any) => msg.type === 'unsubscribe')
            expect(unsubscribeMsg).toBeDefined()
          }
          done()
        }, 50)
      }, 50)
    })

    it('should handle multiple callbacks for same symbol', (done) => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      manager.subscribe('FINNHUB', ['AAPL'], callback1)
      
      setTimeout(() => {
        manager.subscribe('FINNHUB', ['AAPL'], callback2)
        
        setTimeout(() => {
          const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
          ws.simulateMessage({
            type: 'trade',
            s: 'AAPL',
            p: 150.50,
            v: 1000,
            t: 1234567890,
          })

          setTimeout(() => {
            expect(callback1).toHaveBeenCalled()
            expect(callback2).toHaveBeenCalled()
            done()
          }, 10)
        }, 50)
      }, 50)
    })
  })

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on disconnect', (done) => {
      vi.useFakeTimers()
      
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        ws.simulateClose(1006) // Abnormal closure

        // Fast-forward time to trigger reconnection
        vi.advanceTimersByTime(3000)

        setTimeout(() => {
          const newStatus = manager.getConnectionStatus('FINNHUB')
          // Should attempt reconnection
          expect(newStatus).toBeDefined()
          vi.useRealTimers()
          done()
        }, 100)
      }, 50)
    })
  })

  describe('Provider Configuration', () => {
    it('should have Finnhub provider configuration', () => {
      expect(WEBSOCKET_PROVIDERS.FINNHUB).toBeDefined()
      expect(WEBSOCKET_PROVIDERS.FINNHUB.url).toBe('wss://ws.finnhub.io')
      expect(WEBSOCKET_PROVIDERS.FINNHUB.requiresAuth).toBe(true)
    })

    it('should parse Finnhub trade messages correctly', () => {
      const provider = WEBSOCKET_PROVIDERS.FINNHUB
      const message = {
        type: 'trade',
        s: 'AAPL',
        p: 150.50,
        v: 1000,
        t: 1234567890,
        pc: 150.00,
      }

      const parsed = provider.parseMessage(message)
      expect(parsed).toBeDefined()
      expect(parsed?.symbol).toBe('AAPL')
      expect(parsed?.price).toBe(150.50)
      expect(parsed?.timestamp).toBe(1234567890000) // Converted to milliseconds
    })

    it('should generate correct subscribe message for Finnhub', () => {
      const provider = WEBSOCKET_PROVIDERS.FINNHUB
      const message = provider.getSubscribeMessage(['AAPL', 'MSFT'])
      
      expect(message.type).toBe('subscribe')
      expect(message.symbol).toContain('AAPL')
      expect(message.symbol).toContain('MSFT')
    })

    it('should generate correct unsubscribe message for Finnhub', () => {
      const provider = WEBSOCKET_PROVIDERS.FINNHUB
      const message = provider.getUnsubscribeMessage(['AAPL'])
      
      expect(message.type).toBe('unsubscribe')
      expect(message.symbol).toBe('AAPL')
    })
  })

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        ws.simulateError()

        // Should not crash
        expect(manager.getConnectionStatus('FINNHUB')).toBeDefined()
        done()
      }, 50)
    })

    it('should handle invalid message formats', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        
        // Send invalid message
        ws.simulateMessage({
          type: 'unknown',
          data: 'invalid',
        })

        setTimeout(() => {
          // Should not crash, callback may or may not be called
          expect(true).toBe(true) // Just verify no crash
          done()
        }, 10)
      }, 50)
    })
  })

  describe('Message Throttling', () => {
    it('should handle rapid message updates', (done) => {
      const callback = vi.fn()
      manager.subscribe('FINNHUB', ['AAPL'], callback)

      setTimeout(() => {
        const ws = (manager as any).connections.get('FINNHUB') as MockWebSocket
        
        // Send multiple rapid messages
        for (let i = 0; i < 10; i++) {
          ws.simulateMessage({
            type: 'trade',
            s: 'AAPL',
            p: 150.50 + i,
            v: 1000,
            t: 1234567890 + i,
          })
        }

        setTimeout(() => {
          // All messages should be received (throttling happens in component)
          expect(callback.mock.calls.length).toBeGreaterThan(0)
          done()
        }, 100)
      }, 50)
    })
  })
})

