import { describe, it, expect } from 'vitest'
import { APIAdapter } from '@/lib/utils/apiAdapter'
import type { FieldMapping } from '@/types/api'

describe('API Adapter', () => {
  describe('detectProvider', () => {
    it('should detect Alpha Vantage from URL', () => {
      const url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM'
      expect(APIAdapter.detectProvider(url)).toBe('alphavantage')
    })

    it('should detect Finnhub from URL', () => {
      const url = 'https://finnhub.io/api/v1/quote?symbol=AAPL'
      expect(APIAdapter.detectProvider(url)).toBe('finnhub')
    })

    it('should return custom for unknown URLs', () => {
      const url = 'https://api.example.com/data'
      expect(APIAdapter.detectProvider(url)).toBe('custom')
    })
  })

  describe('normalizeAlphaVantage', () => {
    it('should normalize Global Quote format', () => {
      const response = {
        'Global Quote': {
          '01. symbol': 'IBM',
          '02. open': '150.00',
          '03. high': '155.00',
          '04. low': '149.00',
          '05. price': '152.50',
          '06. volume': '1000000',
          '08. previous close': '150.00',
          '09. change': '2.50',
          '10. change percent': '1.67%',
        },
      }

      const result = APIAdapter.normalizeAlphaVantage(response)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('IBM')
      expect(result[0]?.price).toBe(152.5)
      expect(result[0]?.change).toBe(2.5)
      expect(result[0]?.changePercent).toBe(1.67)
      expect(result[0]?.volume).toBe(1000000)
    })

    it('should normalize Time Series format', () => {
      const response = {
        'Meta Data': {
          '2. Symbol': 'IBM',
        },
        'Time Series (Daily)': {
          '2024-01-01': {
            '1. open': '150.00',
            '2. high': '155.00',
            '3. low': '149.00',
            '4. close': '152.50',
            '5. volume': '1000000',
          },
          '2024-01-02': {
            '1. open': '152.50',
            '2. high': '157.00',
            '3. low': '151.00',
            '4. close': '155.00',
            '5. volume': '1100000',
          },
        },
      }

      const result = APIAdapter.normalizeAlphaVantage(response)

      expect(result).toHaveLength(2)
      expect(result[0]?.symbol).toBe('IBM')
      expect(result[0]?.price).toBe(152.5)
      expect(result[1]?.price).toBe(155.0)
    })

    it('should normalize Top Gainers/Losers format', () => {
      const response = {
        top_gainers: [
          {
            ticker: 'AAPL',
            price: 150.0,
            change_amount: 5.0,
            change_percentage: 3.45,
            volume: 5000000,
          },
        ],
        top_losers: [
          {
            ticker: 'MSFT',
            price: 300.0,
            change_amount: -10.0,
            change_percentage: -3.23,
            volume: 3000000,
          },
        ],
      }

      const result = APIAdapter.normalizeAlphaVantage(response)

      expect(result).toHaveLength(2)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.change).toBe(5.0)
      expect(result[1]?.symbol).toBe('MSFT')
      expect(result[1]?.change).toBe(-10.0)
    })

    it('should handle error responses', () => {
      const response = {
        'Error Message': 'Invalid API call',
      }

      expect(() => APIAdapter.normalizeAlphaVantage(response)).toThrow('Invalid API call')
    })

    it('should return empty array for malformed responses', () => {
      const response = {}
      const result = APIAdapter.normalizeAlphaVantage(response)
      expect(result).toHaveLength(0)
    })
  })

  describe('normalizeFinnhub', () => {
    it('should normalize quote format', () => {
      const response = {
        c: 150.5, // current price
        d: 2.5, // change
        dp: 1.69, // change percent
        h: 155.0, // high
        l: 149.0, // low
        o: 150.0, // open
        pc: 148.0, // previous close
        t: 1640995200, // timestamp
        s: 'AAPL', // symbol
        v: 1000000, // volume
      }

      const result = APIAdapter.normalizeFinnhub(response)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.price).toBe(150.5)
      expect(result[0]?.change).toBe(2.5)
      expect(result[0]?.changePercent).toBe(1.69)
      expect(result[0]?.timestamp).toBe(1640995200000)
    })

    it('should normalize candles format', () => {
      const response = {
        s: 'AAPL',
        c: [150.0, 151.0, 152.0], // closes
        o: [149.0, 150.0, 151.0], // opens
        h: [155.0, 156.0, 157.0], // highs
        l: [148.0, 149.0, 150.0], // lows
        v: [1000000, 1100000, 1200000], // volumes
        t: [1640995200, 1641081600, 1641168000], // timestamps
      }

      const result = APIAdapter.normalizeFinnhub(response)

      expect(result).toHaveLength(3)
      expect(result[0]?.price).toBe(150.0)
      expect(result[1]?.price).toBe(151.0)
      expect(result[2]?.price).toBe(152.0)
    })

    it('should normalize array of quotes', () => {
      const response = [
        {
          symbol: 'AAPL',
          price: 150.0,
          change: 2.5,
          changePercent: 1.69,
          volume: 1000000,
        },
        {
          symbol: 'MSFT',
          price: 300.0,
          change: -5.0,
          changePercent: -1.64,
          volume: 500000,
        },
      ]

      const result = APIAdapter.normalizeFinnhub(response)

      expect(result).toHaveLength(2)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[1]?.symbol).toBe('MSFT')
    })

    it('should return empty array for malformed responses', () => {
      const response = {}
      const result = APIAdapter.normalizeFinnhub(response)
      expect(result).toHaveLength(0)
    })
  })

  describe('normalizeCustom', () => {
    it('should normalize array response with field mapping', () => {
      const response = [
        {
          stock: 'AAPL',
          currentPrice: 150.0,
          priceChange: 2.5,
          priceChangePercent: 1.69,
          tradingVolume: 1000000,
        },
      ]

      const mapping: FieldMapping = {
        symbol: 'stock',
        price: 'currentPrice',
        change: 'priceChange',
        changePercent: 'priceChangePercent',
        volume: 'tradingVolume',
      }

      const result = APIAdapter.normalizeCustom(response, mapping)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.price).toBe(150.0)
      expect(result[0]?.change).toBe(2.5)
      expect(result[0]?.changePercent).toBe(1.69)
      expect(result[0]?.volume).toBe(1000000)
    })

    it('should handle nested field paths', () => {
      const response = [
        {
          data: {
            quote: {
              symbol: 'AAPL',
              price: 150.0,
            },
          },
        },
      ]

      const mapping: FieldMapping = {
        symbol: 'data.quote.symbol',
        price: 'data.quote.price',
      }

      const result = APIAdapter.normalizeCustom(response, mapping)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.price).toBe(150.0)
    })

    it('should handle array notation in paths', () => {
      const response = {
        results: [
          {
            symbol: 'AAPL',
            price: 150.0,
          },
        ],
      }

      const mapping: FieldMapping = {
        symbol: 'results[0].symbol',
        price: 'results[0].price',
      }

      const result = APIAdapter.normalizeCustom(response, mapping)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.price).toBe(150.0)
    })

    it('should normalize single object response', () => {
      const response = {
        stock: 'AAPL',
        currentPrice: 150.0,
      }

      const mapping: FieldMapping = {
        symbol: 'stock',
        price: 'currentPrice',
      }

      const result = APIAdapter.normalizeCustom(response, mapping)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.price).toBe(150.0)
    })

    it('should handle missing fields gracefully', () => {
      const response = [
        {
          stock: 'AAPL',
          // price is missing
        },
      ]

      const mapping: FieldMapping = {
        symbol: 'stock',
        price: 'currentPrice', // doesn't exist
      }

      const result = APIAdapter.normalizeCustom(response, mapping)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
      expect(result[0]?.price).toBeUndefined()
    })
  })

  describe('normalize (main entry point)', () => {
    it('should normalize Alpha Vantage response', () => {
      const url = 'https://www.alphavantage.co/query'
      const response = {
        'Global Quote': {
          '01. symbol': 'IBM',
          '05. price': '152.50',
          '09. change': '2.50',
          '10. change percent': '1.67%',
          '06. volume': '1000000',
        },
      }

      const result = APIAdapter.normalize(url, response)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('IBM')
    })

    it('should normalize Finnhub response', () => {
      const url = 'https://finnhub.io/api/v1/quote'
      const response = {
        c: 150.5,
        d: 2.5,
        dp: 1.69,
        s: 'AAPL',
      }

      const result = APIAdapter.normalize(url, response)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
    })

    it('should normalize custom response with mapping', () => {
      const url = 'https://api.example.com/data'
      const response = [
        {
          stock: 'AAPL',
          price: 150.0,
        },
      ]
      const mapping: FieldMapping = {
        symbol: 'stock',
        price: 'price',
      }

      const result = APIAdapter.normalize(url, response, mapping)

      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('AAPL')
    })

    it('should handle errors during normalization', () => {
      const url = 'https://www.alphavantage.co/query'
      const response = {
        'Error Message': 'Invalid API call',
      }

      expect(() => APIAdapter.normalize(url, response)).toThrow()
    })
  })
})

