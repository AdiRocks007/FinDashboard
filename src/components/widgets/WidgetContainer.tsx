'use client'

import { memo, Suspense, lazy, useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { useAppSelector } from '@/lib/store/hooks'
import { selectWidgetById } from '@/lib/store/slices/widgetsSlice'
import { useFetchWidgetDataQuery } from '@/lib/store/services/apiService'
import { APIAdapter } from '@/lib/utils/apiAdapter'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { WidgetSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/utils/cn'
import { useEditMode } from '@/lib/store/hooks'
import { useAppDispatch } from '@/lib/store/hooks'
import { removeWidget, setWidgetError, clearWidgetError, setWidgetData, setWidgetLoading, updateWidget } from '@/lib/store/slices/widgetsSlice'
import { X, Settings, GripVertical } from 'lucide-react'
import { WidgetConfigModal } from '@/components/modals/WidgetConfigModal'
import { centralizedFetch, batchFetch } from '@/lib/services/centralizedApiService'
import { rebuildAlphaVantageUrl, isAlphaVantageUrl } from '@/lib/utils/alphaVantageUrlBuilder'

// Lazy load widget types for code splitting
const TableWidget = lazy(() => import('./TableWidget'))
const CardWidget = lazy(() => import('./CardWidget'))
const ChartWidget = lazy(() => import('./ChartWidget'))

interface WidgetContainerProps {
  widgetId: string
  isDragging?: boolean
  dragListeners?: any
  isEditMode?: boolean
}

/**
 * The main widget container that wraps all widgets.
 * Handles data fetching, error states, loading states, and provides the widget UI.
 * Also supports dragging from the header and includes edit mode controls.
 */
export const WidgetContainer = memo<WidgetContainerProps>(({ 
  widgetId, 
  isDragging,
  dragListeners,
  isEditMode: propIsEditMode
}) => {
  const dispatch = useAppDispatch()
  const storeEditMode = useEditMode()
  const isEditMode = propIsEditMode !== undefined ? propIsEditMode : storeEditMode
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isHeaderHovered, setIsHeaderHovered] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleEditValue, setTitleEditValue] = useState('')
  
  // Get widget from store
  const widget = useAppSelector((state) => {
    if (!state.widgets || !state.widgets.entities) {
      return undefined
    }
    return selectWidgetById(state, widgetId)
  })

  if (!widget) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
        <p className="text-sm text-neutral-500">Widget not found</p>
      </div>
    )
  }

  // Safety check: ensure widget has required apiConfig
  if (!widget.apiConfig?.url) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
        <p className="text-sm text-neutral-500">Widget configuration incomplete</p>
      </div>
    )
  }

  // Detect provider from URL
  const provider = useMemo(() => {
    const url = widget.apiConfig.url.toLowerCase()
    if (url.includes('alphavantage')) return 'alphavantage'
    if (url.includes('finnhub')) return 'finnhub'
    if (url.includes('polygon')) return 'polygon'
    return 'custom'
  }, [widget.apiConfig.url])

  // Check if this is a multi-symbol table widget
  const isMultiSymbolTable = widget.type === 'table' && widget.settings?.symbols
  
  // Parse symbols if multi-symbol table
  const symbols = useMemo(() => {
    if (!isMultiSymbolTable) return []
    const symbolsStr = String(widget.settings.symbols || '')
    return symbolsStr.split(',').map(s => s.trim()).filter(Boolean)
  }, [isMultiSymbolTable, widget.settings?.symbols])

  // Build URL template with {symbol} placeholder
  const urlTemplate = widget.apiConfig.url
  
  // Rebuild URL for Alpha Vantage if timeInterval changed (for chart widgets)
  const effectiveUrl = useMemo(() => {
    let url = isMultiSymbolTable && symbols.length > 0 && symbols[0]
      ? urlTemplate.replace('{symbol}', symbols[0])
      : widget.apiConfig.url
    
    // For chart widgets with Alpha Vantage, rebuild URL based on timeInterval
    if (widget.type === 'chart' && isAlphaVantageUrl(url) && widget.settings?.timeInterval) {
      url = rebuildAlphaVantageUrl(url, widget.settings.timeInterval as 'daily' | 'weekly' | 'monthly' | 'intraday')
    }
    
    return url
  }, [widget.apiConfig.url, widget.type, widget.settings?.timeInterval, isMultiSymbolTable, symbols, urlTemplate])
  
  // State for additional symbol data
  const [additionalSymbolData, setAdditionalSymbolData] = useState<any[]>([])
  const [isLoadingAdditional, setIsLoadingAdditional] = useState(false)
  
  // Calculate refresh interval in milliseconds
  const refreshIntervalMs = useMemo(() => {
    const intervalSeconds = widget.apiConfig.refreshInterval || 60
    // If refresh interval is 0, disable polling
    if (intervalSeconds === 0) return 0
    return intervalSeconds * 1000
  }, [widget.apiConfig.refreshInterval])

  // Fetch data for single widget or first symbol
  const { data, error, isLoading, refetch } = useFetchWidgetDataQuery(
    {
      url: effectiveUrl,
      provider,
    },
    {
      pollingInterval: refreshIntervalMs,
      // Continue polling even when tab is not visible
      skipPollingIfUnfocused: false,
      skip: Boolean(!widget.apiConfig.url || (isMultiSymbolTable && symbols.length === 0)),
    }
  )

  // Fetch additional symbols with polling support
  useEffect(() => {
    if (!isMultiSymbolTable || symbols.length <= 1) {
      setAdditionalSymbolData([])
      return
    }
    
    setIsLoadingAdditional(true)
    
    // Batch fetch all symbols at once (centralized service handles deduplication and queue)
    const fetchSymbols = async () => {
      const symbolsToFetch = symbols.slice(1)
      
      if (symbolsToFetch.length === 0) {
        setAdditionalSymbolData([])
        setIsLoadingAdditional(false)
        return
      }

      try {
        console.log(`📦 [WIDGET ${widgetId}] Batch fetching ${symbolsToFetch.length} symbols`)
        
        // Build all URLs with query parameters
        const urls = symbolsToFetch.map(symbol => {
          // Build the actual API URL with symbol replacement
          let apiUrl = urlTemplate.replace('{symbol}', symbol)
          
          // Rebuild URL for Alpha Vantage if timeInterval changed (for chart widgets)
          if (widget.type === 'chart' && isAlphaVantageUrl(apiUrl) && widget.settings?.timeInterval) {
            apiUrl = rebuildAlphaVantageUrl(apiUrl, widget.settings.timeInterval as 'daily' | 'weekly' | 'monthly' | 'intraday')
          }
          
          // Add query parameters to the API URL if any
          if (widget.apiConfig.queryParams && Object.keys(widget.apiConfig.queryParams).length > 0) {
            try {
              const urlObj = new URL(apiUrl)
              Object.entries(widget.apiConfig.queryParams).forEach(([key, value]) => {
                const strValue = String(value || '')
                if (strValue.trim()) {
                  urlObj.searchParams.set(key, strValue.trim())
                }
              })
              apiUrl = urlObj.toString()
            } catch {
              // If URL parsing fails, append query params manually
              const params = new URLSearchParams()
              Object.entries(widget.apiConfig.queryParams).forEach(([key, value]) => {
                const strValue = String(value || '')
                if (strValue.trim()) {
                  params.append(key, strValue.trim())
                }
              })
              const separator = apiUrl.includes('?') ? '&' : '?'
              apiUrl = `${apiUrl}${separator}${params.toString()}`
            }
          }
          
          // Build proxy URL
          const proxyUrl = new URL('/api/proxy', window.location.origin)
          proxyUrl.searchParams.set('url', apiUrl)
          if (provider && provider !== 'custom') {
            proxyUrl.searchParams.set('provider', provider)
          }
          return proxyUrl.toString()
        })
        
        // Batch fetch all symbols (centralized service handles deduplication, caching, and queue)
        // Bypass cache when polling to get fresh data
        const isPolling = refreshIntervalMs > 0
        const responses = await batchFetch(urls, {
          method: widget.apiConfig.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(widget.apiConfig.headers || {}),
          },
        }, isPolling) // Bypass cache when polling
        
        // Parse all responses
        const results: any[] = []
        for (let i = 0; i < responses.length; i++) {
          try {
            const response = responses[i]
            if (response) {
              const data = await response.json()
              results.push(data.data || data)
              console.log(`✅ [WIDGET ${widgetId}] Successfully fetched ${symbolsToFetch[i]}`)
            }
          } catch (err) {
            console.error(`❌ [WIDGET ${widgetId}] Failed to parse response for ${symbolsToFetch[i]}:`, err)
            // Continue with other symbols
          }
        }
        
        setAdditionalSymbolData(results)
        setIsLoadingAdditional(false)
        console.log(`✅ [WIDGET ${widgetId}] Completed batch fetching ${results.length}/${symbolsToFetch.length} symbols`)
      } catch (err) {
        console.error(`❌ [WIDGET ${widgetId}] Batch fetch failed:`, err)
        setAdditionalSymbolData([])
        setIsLoadingAdditional(false)
      }
    }
    
    // Initial fetch
    fetchSymbols()
    
    // Set up polling if refresh interval is set and > 0
    let intervalId: NodeJS.Timeout | undefined
    if (refreshIntervalMs > 0) {
      intervalId = setInterval(() => {
        console.log(`🔄 [WIDGET ${widgetId}] Refreshing additional symbols (interval: ${refreshIntervalMs}ms)`)
        fetchSymbols()
      }, refreshIntervalMs)
    }
    
    // Cleanup interval on unmount or dependency change
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isMultiSymbolTable, symbols, urlTemplate, provider, refreshIntervalMs, widget.apiConfig.method, widget.apiConfig.headers, widget.apiConfig.queryParams, widgetId, widget.settings?.timeInterval, widget.type])
  
  // Combine loading and error states
  const combinedLoading = isLoading || isLoadingAdditional
  const combinedError = error
  
  // Combine data from all symbols
  const combinedData = useMemo(() => {
    if (!isMultiSymbolTable || symbols.length === 0) {
      return data
    }
    
    if (!data?.data) return null
    
    // Combine first symbol data with additional symbols
    const allData = [data.data, ...additionalSymbolData].filter(Boolean)
    
    return {
      ...data,
      data: allData
    }
  }, [isMultiSymbolTable, symbols.length, data, additionalSymbolData])
  
  // Only log on state changes, not every render
  useEffect(() => {
    console.log(`🎯 [WIDGET ${widgetId}] State Change:`, {
      widgetType: widget.type,
      widgetTitle: widget.title,
      provider,
      isLoading: combinedLoading,
      hasError: !!combinedError,
      hasData: !!combinedData,
      isMultiSymbol: isMultiSymbolTable,
      symbolsCount: symbols.length,
    })
  }, [widgetId, widget.type, widget.title, provider, combinedLoading, combinedError, combinedData, isMultiSymbolTable, symbols.length])

  // Transform data using API adapter
  const normalizedData = useMemo(() => {
    const dataToNormalize = combinedData || data
    
    if (!dataToNormalize?.data) {
      console.log(`⚠️ [WIDGET ${widgetId}] No data to normalize`)
      return null
    }
    
    // For multi-symbol tables, combine all symbol data
    if (isMultiSymbolTable && Array.isArray(dataToNormalize.data)) {
      console.log(`🔄 [WIDGET ${widgetId}] Normalizing multi-symbol data:`, {
        symbolsCount: symbols.length,
        dataArrayLength: dataToNormalize.data.length,
        fieldMapping: widget.fieldMapping,
      })
      
      try {
        // Normalize each symbol's data and combine
        const allNormalized: any[] = []
        dataToNormalize.data.forEach((symbolData: any, index: number) => {
          if (symbolData) {
            const normalized = APIAdapter.normalize(
              urlTemplate.replace('{symbol}', symbols[index] || ''),
              symbolData,
              widget.fieldMapping
            )
            if (Array.isArray(normalized)) {
              allNormalized.push(...normalized)
            } else if (normalized) {
              allNormalized.push(normalized)
            }
          }
        })
        
        console.log(`✅ [WIDGET ${widgetId}] Normalized multi-symbol data:`, {
          totalRows: allNormalized.length,
          symbolsProcessed: symbols.length,
          allData: allNormalized
        })
        return allNormalized
      } catch (err) {
        console.error(`❌ [WIDGET ${widgetId}] Error normalizing multi-symbol data:`, err)
        return null
      }
    }
    
    // Single symbol or non-table widget
    console.log(`🔄 [WIDGET ${widgetId}] Normalizing data:`, {
      url: widget.apiConfig.url,
      fieldMapping: widget.fieldMapping,
      rawDataType: Array.isArray(dataToNormalize.data) ? 'array' : typeof dataToNormalize.data,
      rawDataKeys: typeof dataToNormalize.data === 'object' ? Object.keys(dataToNormalize.data) : [],
    })
    
    try {
      const normalized = APIAdapter.normalize(widget.apiConfig.url, dataToNormalize.data, widget.fieldMapping)
      console.log(`✅ [WIDGET ${widgetId}] Normalized data:`, {
        count: Array.isArray(normalized) ? normalized.length : 1,
        firstItem: normalized?.[0],
        firstItemKeys: normalized?.[0] ? Object.keys(normalized[0]) : [],
        fieldMapping: widget.fieldMapping,
        formulaFields: Object.entries(widget.fieldMapping).filter(([_, path]) => path.startsWith('formula:')).map(([key]) => key),
        allData: normalized
      })
      return normalized
    } catch (err) {
      console.error(`❌ [WIDGET ${widgetId}] Error normalizing data:`, err)
      return null
    }
  }, [combinedData, data, widget.apiConfig.url, widget.fieldMapping, widgetId, isMultiSymbolTable, symbols, urlTemplate])

  // Track previous values to prevent unnecessary dispatches and infinite loops
  const prevLoadingRef = useRef<boolean | undefined>(undefined)
  const prevDataRef = useRef<string | null>(null)
  const prevErrorRef = useRef<string | null>(null)

  // Sync loading state to Redux store
  useEffect(() => {
    // Only dispatch if widget exists and loading state actually changed
    if (widget && prevLoadingRef.current !== combinedLoading) {
      prevLoadingRef.current = combinedLoading
      dispatch(setWidgetLoading({ id: widgetId, isLoading: combinedLoading }))
    }
  }, [dispatch, widgetId, combinedLoading])

  // Sync data and error to Redux store when normalized data changes
  useEffect(() => {
    // Only dispatch if widget exists in store
    if (!widget) return
    
    // Prevent infinite loops by checking if data actually changed
    // Use JSON.stringify for comparison (safe since normalizedData should be serializable)
    const currentDataStr = normalizedData !== null ? JSON.stringify(normalizedData) : null
    const currentErrorStr = combinedError ? JSON.stringify(combinedError) : null
    
    const dataChanged = prevDataRef.current !== currentDataStr
    const errorChanged = prevErrorRef.current !== currentErrorStr
    
    // Skip if nothing changed
    if (!dataChanged && !errorChanged) return
    
    try {
      if (combinedError && errorChanged) {
        const errorMessage = (combinedError as { message?: string })?.message || 'Failed to load data'
        prevErrorRef.current = currentErrorStr
        prevDataRef.current = null // Clear data ref when error occurs
        dispatch(setWidgetError({ id: widgetId, error: errorMessage }))
      } else if (normalizedData !== null && !combinedLoading && dataChanged) {
        // Only update data if we have normalized data and we're not loading
        // Use normalizedData for the store, but keep it as the raw structure for compatibility
        const dataToStore = isMultiSymbolTable && Array.isArray(normalizedData) 
          ? normalizedData 
          : (Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : null)
        
        // Update refs before dispatching to prevent re-triggering
        prevDataRef.current = currentDataStr
        prevErrorRef.current = null // Clear error ref when data is successfully fetched
        
        // Clear any previous errors when data is successfully fetched
        dispatch(clearWidgetError(widgetId))
        
        dispatch(setWidgetData({ 
          id: widgetId, 
          data: dataToStore
        }))
      }
    } catch (error) {
      // Silently catch errors to prevent breaking the app
      console.error(`[WidgetContainer] Error syncing data for widget ${widgetId}:`, error)
    }
  }, [dispatch, widgetId, normalizedData, combinedError, combinedLoading, isMultiSymbolTable])

  // Handle widget deletion
  const handleDelete = () => {
    if (confirm(`Delete widget "${widget.title}"?`)) {
      dispatch(removeWidget(widgetId))
    }
  }

  // Handle error retry
  const handleRetry = () => {
    dispatch(clearWidgetError(widgetId))
    refetch()
  }

  // Handle field label change
  const handleFieldLabelChange = useCallback((fieldId: string, newLabel: string) => {
    if (!widget) return
    const currentLabels = (widget.settings?.fieldLabels as Record<string, string>) || {}
    dispatch(updateWidget({
      id: widgetId,
      updates: {
        settings: {
          ...widget.settings,
          fieldLabels: {
            ...currentLabels,
            [fieldId]: newLabel,
          },
        },
      },
    }))
  }, [widget, widgetId, dispatch])

  // Handle widget title change
  const handleTitleChange = useCallback((newTitle: string) => {
    if (!widget || !newTitle.trim()) return
    dispatch(updateWidget({
      id: widgetId,
      updates: {
        title: newTitle.trim(),
      },
    }))
  }, [widget, widgetId, dispatch])

  // Render widget based on type
  const renderWidget = () => {
    if (combinedLoading) {
      return <WidgetSkeleton />
    }

    if (combinedError || widget.error) {
      const errorMessage = widget.error || (combinedError as { message?: string })?.message || 'Failed to load data'
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 text-red-500">
            <X className="h-8 w-8" />
          </div>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">{errorMessage}</p>
          <button
            onClick={handleRetry}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      )
    }

    if (!normalizedData && !data) {
      return (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <p className="text-sm text-neutral-500">No data available</p>
        </div>
      )
    }

    // Convert normalized data to array if needed
    const widgetData = Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : []
    
    console.log(`📦 [WIDGET ${widgetId}] Rendering ${widget.type}:`, {
      dataCount: widgetData.length,
      fieldMapping: widget.fieldMapping,
      settings: widget.settings,
      widgetData: widgetData,
      rawNormalizedData: normalizedData
    })

    switch (widget.type) {
      case 'table':
        return (
          <TableWidget
            data={widgetData}
            fieldMapping={widget.fieldMapping}
            settings={widget.settings as any}
            widgetId={widgetId}
            onFieldLabelChange={handleFieldLabelChange}
          />
        )
      case 'card':
        return (
          <CardWidget
            data={widgetData}
            fieldMapping={widget.fieldMapping}
            settings={widget.settings as any}
          />
        )
      case 'chart':
        return (
          <ChartWidget
            data={widgetData}
            fieldMapping={widget.fieldMapping}
            settings={widget.settings as any}
            widgetId={widgetId}
          />
        )
      default:
        return (
          <div className="p-6">
            <p className="text-sm text-neutral-500">Unknown widget type: {widget.type}</p>
          </div>
        )
    }
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">Widget crashed</p>
        </div>
      }
    >
      <div
        className={cn(
          'group relative w-full h-full rounded-lg border border-neutral-800 bg-[#1a1f3a] shadow-lg transition-all',
          'flex flex-col', // Ensure proper flex layout
          isDragging && 'shadow-2xl ring-2 ring-[#22c55e]',
          isEditMode && 'hover:border-[#22c55e]/50'
        )}
      >
        {/* Header with drag handle and controls */}
        <div 
          className={cn(
            "flex items-center justify-between border-b border-neutral-800 bg-[#0f1629] px-6 py-4",
            "transition-all duration-200",
            dragListeners && isHeaderHovered && "border-[#22c55e]/30"
          )}
          onMouseEnter={() => setIsHeaderHovered(true)}
          onMouseLeave={() => setIsHeaderHovered(false)}
        >
          {/* Draggable title area - separate from buttons */}
          <div 
            className={cn(
              "flex items-center gap-3 flex-1",
              "transition-all duration-200",
              dragListeners && isHeaderHovered && "cursor-grab"
            )}
            {...(dragListeners || {})}
          >
            {isEditMode && (
              <div className={cn(
                "text-neutral-500 transition-colors",
                isHeaderHovered && dragListeners && "text-[#22c55e]"
              )}>
                <GripVertical className="h-5 w-5" />
              </div>
            )}
            {isEditingTitle ? (
              <input
                type="text"
                value={titleEditValue}
                onChange={(e) => setTitleEditValue(e.target.value)}
                onBlur={() => {
                  if (titleEditValue.trim()) {
                    handleTitleChange(titleEditValue.trim())
                  }
                  setIsEditingTitle(false)
                  setTitleEditValue('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (titleEditValue.trim()) {
                      handleTitleChange(titleEditValue.trim())
                    }
                    setIsEditingTitle(false)
                    setTitleEditValue('')
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false)
                    setTitleEditValue('')
                  }
                }}
                className="bg-[#0f1629] border border-[#22c55e] rounded px-2 py-1 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                autoFocus
              />
            ) : (
              <h3 
                className={cn(
                  "text-base font-semibold text-white select-none",
                  dragListeners && isHeaderHovered && "text-[#22c55e]",
                  "cursor-text hover:text-[#22c55e] transition-colors"
                )}
                onDoubleClick={() => {
                  setIsEditingTitle(true)
                  setTitleEditValue(widget.title)
                }}
                title="Double-click to rename"
              >
                {widget.title}
              </h3>
            )}
            {dragListeners && isHeaderHovered && (
              <span className="text-xs text-neutral-400 ml-2 select-none">
                Drag to move
              </span>
            )}
          </div>
          
          {/* Button area - completely separate, no drag listeners */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Configuration button - always visible on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsConfigOpen(true)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={cn(
                "rounded-lg p-2 text-neutral-400 transition-all",
                "opacity-0 group-hover:opacity-100 hover:bg-[#22c55e]/20 hover:text-[#22c55e]",
                isEditMode && "opacity-100"
              )}
              aria-label="Configure widget"
              title="Configure widget"
            >
              <Settings className="h-5 w-5" />
            </button>
            {/* Delete button - always visible on hover, more prominent in edit mode */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={cn(
                "rounded-lg p-2 text-neutral-400 transition-all",
                "opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400",
                isEditMode && "opacity-100"
              )}
              aria-label="Delete widget"
              title="Delete widget"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Widget content */}
        <div className="flex-1 p-4 overflow-hidden">
          <Suspense fallback={<WidgetSkeleton />}>
            {renderWidget()}
          </Suspense>
        </div>

        {/* Last updated timestamp */}
        {widget.lastUpdated && (
          <div className="border-t border-neutral-800 px-6 py-3 text-right text-xs text-neutral-500">
            Last updated: {new Date(widget.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Widget Configuration Modal */}
      <WidgetConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        widget={widget}
      />
    </ErrorBoundary>
  )
})

// Add displayName for debugging
WidgetContainer.displayName = 'WidgetContainer'

