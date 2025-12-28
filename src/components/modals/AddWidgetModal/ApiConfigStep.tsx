'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Select, SelectOption } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Plus, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'
import type { WidgetType } from '@/types/widget'
import { centralizedFetch, batchFetch } from '@/lib/services/centralizedApiService'

interface KeyValuePair {
  key: string
  value: string
}

interface ApiConfigStepProps {
  config: Partial<WidgetWithPosition>
  onChange: (config: Partial<WidgetWithPosition>) => void
  onTest: (responses: any[]) => Promise<void>
  apiResponse: any
}

const WIDGET_TYPES: SelectOption[] = [
  { value: 'table', label: 'Table' },
  { value: 'card', label: 'Card' },
  { value: 'chart', label: 'Chart' },
]

const HTTP_METHODS: SelectOption[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
]

const REFRESH_INTERVALS: SelectOption[] = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 0, label: 'Never' },
]

export function ApiConfigStep({ config, onChange, onTest, apiResponse }: ApiConfigStepProps) {
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testingProgress, setTestingProgress] = useState<{ current: string; total: number; index: number } | null>(null)

  // Convert headers/queryParams objects to arrays
  const headersArray: KeyValuePair[] = Object.entries(config.apiConfig?.headers || {}).map(([key, value]) => ({
    key,
    value: String(value),
  }))
  const queryParamsArray: KeyValuePair[] = Object.entries(config.apiConfig?.queryParams || {}).map(([key, value]) => ({
    key,
    value: String(value),
  }))

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    setTestingProgress(null)
    
    try {
      // Check if multi-symbol table
      const isMultiSymbol = config.type === 'table' && config.settings?.symbols
      const symbolsStr = typeof config.settings?.symbols === 'string' ? config.settings.symbols : ''
      const symbols = symbolsStr.split(',').map(s => s.trim()).filter(Boolean)
      
      if (isMultiSymbol && symbols.length > 0 && config.apiConfig?.url?.includes('{symbol}')) {
        // Batch fetch all symbols (centralized service handles deduplication and queue)
        const urls: string[] = []
        
        for (let i = 0; i < symbols.length; i++) {
          const symbol = symbols[i]
          if (!symbol) continue
          
          // Build the actual API URL with symbol replacement
          let apiUrl = config.apiConfig.url.replace('{symbol}', symbol)
          
          // Add query parameters to the API URL if any
          if (config.apiConfig?.queryParams && Object.keys(config.apiConfig.queryParams).length > 0) {
            const urlObj = new URL(apiUrl)
            Object.entries(config.apiConfig.queryParams).forEach(([key, value]) => {
              const strValue = String(value || '')
              if (strValue.trim()) {
                urlObj.searchParams.set(key, strValue.trim())
              }
            })
            apiUrl = urlObj.toString()
          }
          
          // Build proxy URL
          const proxyUrl = new URL('/api/proxy', window.location.origin)
          proxyUrl.searchParams.set('url', apiUrl)
          
          // Detect provider
          const urlLower = apiUrl.toLowerCase()
          let provider = 'custom'
          if (urlLower.includes('alphavantage')) provider = 'alphavantage'
          else if (urlLower.includes('finnhub')) provider = 'finnhub'
          else if (urlLower.includes('polygon')) provider = 'polygon'
          
          if (provider !== 'custom') {
            proxyUrl.searchParams.set('provider', provider)
          }
          
          urls.push(proxyUrl.toString())
        }
        
        try {
          // Update progress before fetching
          setTestingProgress({ 
            current: symbols[0] || '', 
            total: symbols.length, 
            index: 0 
          })
          
          // Batch fetch all symbols (centralized service optimizes this)
          const responses = await batchFetch(urls, {
            method: config.apiConfig.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...config.apiConfig.headers,
            },
          })
          
          // Parse responses and update progress
          const results: any[] = []
          for (let i = 0; i < responses.length; i++) {
            const symbol = symbols[i]
            if (!symbol) continue
            
            // Update progress
            setTestingProgress({ 
              current: symbol, 
              total: symbols.length, 
              index: i + 1 
            })
            
            const response = responses[i]
            if (!response) {
              throw new Error(`No response received for ${symbol}`)
            }
            try {
              const data = await response.json()
              results.push(data.data || data)
            } catch (err) {
              throw new Error(`Failed to parse response for ${symbol}: ${err}`)
            }
          }
          
          setTestingProgress(null)
          await onTest(results)
          setTestResult({ 
            success: true, 
            message: `Successfully tested ${symbols.length} symbol${symbols.length > 1 ? 's' : ''}!` 
          })
        } catch (error: any) {
          setTestingProgress(null)
          throw new Error(`Failed to fetch symbols: ${error?.message || 'Unknown error'}`)
        }
      } else {
        // Single API call - use centralized service
        if (!config.apiConfig?.url) {
          throw new Error('API URL is required')
        }
        let apiUrl = config.apiConfig.url
        
        // Add query parameters to the API URL if any
        if (config.apiConfig?.queryParams && Object.keys(config.apiConfig.queryParams).length > 0) {
          try {
            const urlObj = new URL(apiUrl)
            Object.entries(config.apiConfig.queryParams).forEach(([key, value]) => {
              const strValue = String(value || '')
              if (strValue.trim()) {
                urlObj.searchParams.set(key, strValue.trim())
              }
            })
            apiUrl = urlObj.toString()
          } catch {
            // If URL parsing fails, append query params manually
            const params = new URLSearchParams()
            Object.entries(config.apiConfig.queryParams).forEach(([key, value]) => {
              const strValue = String(value || '')
              if (strValue.trim()) {
                params.append(key, strValue.trim())
              }
            })
            const separator = apiUrl.includes('?') ? '&' : '?'
            apiUrl = `${apiUrl}${separator}${params.toString()}`
          }
        }
        
        const proxyUrl = new URL('/api/proxy', window.location.origin)
        proxyUrl.searchParams.set('url', apiUrl)
        
        // Detect provider for single API call too
        const urlLower = apiUrl.toLowerCase()
        let provider = 'custom'
        if (urlLower.includes('alphavantage')) provider = 'alphavantage'
        else if (urlLower.includes('finnhub')) provider = 'finnhub'
        else if (urlLower.includes('polygon')) provider = 'polygon'
        
        if (provider !== 'custom') {
          proxyUrl.searchParams.set('provider', provider)
        }
        
        const response = await centralizedFetch(proxyUrl.toString(), {
          method: config.apiConfig?.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiConfig?.headers || {}),
          },
        })
        
        const data = await response.json()
        await onTest([data.data || data])
        setTestResult({ success: true, message: 'API connection successful!' })
      }
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error?.message || 'Failed to connect to API' 
      })
      setTestingProgress(null)
    } finally {
      setIsTesting(false)
    }
  }

  const updateHeaders = (headers: KeyValuePair[]) => {
    const headersObj: Record<string, string> = {}
    headers.forEach(({ key, value }) => {
      if (key.trim()) {
        headersObj[key.trim()] = value.trim()
      }
    })
    onChange({
      ...config,
      apiConfig: {
        ...config.apiConfig!,
        headers: headersObj,
      },
    })
  }

  const updateQueryParams = (params: KeyValuePair[]) => {
    const paramsObj: Record<string, string> = {}
    params.forEach(({ key, value }) => {
      if (key.trim()) {
        paramsObj[key.trim()] = value.trim()
      }
    })
    onChange({
      ...config,
      apiConfig: {
        ...config.apiConfig!,
        queryParams: paramsObj,
      },
    })
  }

  const addHeader = () => {
    updateHeaders([...headersArray, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    updateHeaders(headersArray.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...headersArray]
    updated[index] = { ...updated[index], [field]: value } as KeyValuePair
    updateHeaders(updated)
  }

  const addQueryParam = () => {
    updateQueryParams([...queryParamsArray, { key: '', value: '' }])
  }

  const removeQueryParam = (index: number) => {
    updateQueryParams(queryParamsArray.filter((_, i) => i !== index))
  }

  const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...queryParamsArray]
    updated[index] = { ...updated[index], [field]: value } as KeyValuePair
    updateQueryParams(updated)
  }

  // Validate URL
  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const urlError = config.apiConfig?.url && !isValidUrl(config.apiConfig.url)
    ? 'Please enter a valid URL'
    : undefined

  return (
    <div className="space-y-6">
      {/* Widget Type - First thing to select */}
      <Select
        label="Widget Type"
        options={WIDGET_TYPES}
        value={config.type || 'table'}
        onChange={(value) => onChange({ ...config, type: value as WidgetType })}
        helperText="Select the type of widget to display. This determines how data will be mapped."
      />

      {/* Widget Name */}
      <Input
        label="Widget Name"
        placeholder="e.g., Stock Prices"
        value={config.title || ''}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
        required
      />

      {/* Multi-Symbol Support for Tables */}
      {config.type === 'table' && (
        <Input
          label="Stock Symbols (comma-separated)"
          placeholder="AAPL, MSFT, GOOGL, TSLA"
          value={typeof config.settings?.symbols === 'string' ? config.settings.symbols : ''}
          onChange={(e) =>
            onChange({
              ...config,
              settings: {
                ...(config.settings || {}),
                symbols: e.target.value,
              },
            })
          }
          helperText="Enter stock symbols separated by commas. Each symbol will be fetched and displayed as a row in the table."
        />
      )}

      {/* Chart Widget Guidance */}
      {config.type === 'chart' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h4 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
            📊 Chart Widget Setup Guide
          </h4>
          <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
            <li>• <strong>Alpha Vantage:</strong> Use TIME_SERIES_DAILY, TIME_SERIES_WEEKLY, TIME_SERIES_MONTHLY, or TIME_SERIES_INTRADAY endpoints</li>
            <li>• <strong>Example Daily:</strong> https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=YOUR_KEY</li>
            <li>• <strong>Example Weekly:</strong> https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=AAPL&apikey=YOUR_KEY</li>
            <li>• <strong>Example Monthly:</strong> https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=AAPL&apikey=YOUR_KEY</li>
            <li>• <strong>Example Intraday:</strong> https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=AAPL&interval=5min&apikey=YOUR_KEY</li>
            <li>• You can switch between daily/weekly/monthly/intraday using the dropdown in the chart widget after adding it</li>
          </ul>
        </div>
      )}

      {/* API URL */}
      <Input
        label="API URL"
        placeholder="https://api.example.com/data"
        value={config.apiConfig?.url || ''}
        onChange={(e) =>
          onChange({
            ...config,
            apiConfig: {
              ...config.apiConfig!,
              url: e.target.value,
            },
          })
        }
        {...(urlError ? { error: urlError } : {})}
        helperText={config.type === 'table' 
          ? "Enter the API URL template. Use {symbol} as a placeholder for each stock symbol (e.g., https://api.example.com/quote?symbol={symbol})"
          : config.type === 'chart'
          ? "Enter the Alpha Vantage time series URL. The chart widget will automatically switch between daily/weekly/monthly/intraday endpoints when you change the time interval."
          : "Enter the full URL of the API endpoint"}
        required
      />

      {/* HTTP Method */}
      <Select
        label="HTTP Method"
        options={HTTP_METHODS}
        value={config.apiConfig?.method || 'GET'}
        onChange={(value) =>
          onChange({
            ...config,
            apiConfig: {
              ...config.apiConfig!,
              method: String(value),
            },
          })
        }
      />

      {/* Headers - Hidden as they don't work properly */}
      {/* Query Parameters - Hidden as they don't work properly */}

      {/* Refresh Interval */}
      <Select
        label="Refresh Interval"
        options={REFRESH_INTERVALS}
        value={config.apiConfig?.refreshInterval || 60}
        onChange={(value) =>
          onChange({
            ...config,
            apiConfig: {
              ...config.apiConfig!,
              refreshInterval: Number(value),
            },
          })
        }
        helperText="How often should this widget refresh its data?"
      />

      {/* Test API Button */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !config.apiConfig?.url || urlError !== undefined}
            isLoading={isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test API Connection'
            )}
          </Button>

          {testResult && (
            <div
              className={cn(
                'flex items-center gap-2 text-sm',
                testResult.success
                  ? 'text-gain-600 dark:text-gain-400'
                  : 'text-loss-600 dark:text-loss-400'
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Progress indicator for multi-symbol testing */}
        {testingProgress && (
          <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#22c55e]">
                Testing symbol {testingProgress.index} of {testingProgress.total}
              </span>
              <span className="text-xs text-neutral-400">
                {Math.round((testingProgress.index / testingProgress.total) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#22c55e]" />
              <span className="text-sm text-neutral-300">
                Fetching data for <span className="font-semibold text-white">{testingProgress.current}</span>...
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full bg-[#22c55e] transition-all duration-300"
                style={{ width: `${(testingProgress.index / testingProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* API Response Preview */}
      {apiResponse && testResult?.success && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <h4 className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            API Response Preview
          </h4>
          <pre className="max-h-48 overflow-auto text-xs text-neutral-600 dark:text-neutral-400">
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

