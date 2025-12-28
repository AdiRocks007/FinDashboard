'use client'

import { useEffect } from 'react'
import { useAppDispatch } from '@/lib/store/hooks'
import { addWidget } from '@/lib/store/slices/widgetsSlice'
import { WidgetContainer } from '@/components/widgets'

export default function TestWidgetsPage() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    // Add test table widget
    dispatch(addWidget({
      id: 'test-table-1',
      type: 'table',
      title: 'Stock Prices',
      size: { width: 6, height: 4 },
      config: {}, // Widget base type requires this
      position: { x: 0, y: 0, w: 6, h: 4 },
      apiConfig: {
        url: 'https://finnhub.io/api/v1/quote?symbol=AAPL',
        method: 'GET',
        headers: {},
        queryParams: {},
        refreshInterval: 30
      },
      fieldMapping: {
        'Symbol': 'symbol',
        'Price': 'price',
        'Change': 'change',
        'Change %': 'changePercent',
        'Volume': 'volume'
      },
      settings: {
        rowsPerPage: 10,
        sortable: true,
        filterable: true,
        highlightChanges: true
      },
      lastUpdated: Date.now()
    }))

    // Add test card widget
    dispatch(addWidget({
      id: 'test-card-1',
      type: 'card',
      title: 'AAPL Quote',
      size: { width: 3, height: 2 },
      config: {},
      position: { x: 6, y: 0, w: 3, h: 2 },
      apiConfig: {
        url: 'https://finnhub.io/api/v1/quote?symbol=AAPL',
        method: 'GET',
        headers: {},
        queryParams: {},
        refreshInterval: 30
      },
      fieldMapping: {
        'symbol': 'symbol',
        'price': 'price',
        'change': 'change',
        'changePercent': 'changePercent'
      },
      settings: {
        layout: 'single',
        showSparkline: false,
        animateChanges: true
      },
      lastUpdated: Date.now()
    }))

    // Add test chart widget
    dispatch(addWidget({
      id: 'test-chart-1',
      type: 'chart',
      title: 'Price Chart',
      size: { width: 9, height: 4 },
      config: {},
      position: { x: 0, y: 4, w: 9, h: 4 },
      apiConfig: {
        url: 'https://finnhub.io/api/v1/quote?symbol=AAPL',
        method: 'GET',
        headers: {},
        queryParams: {},
        refreshInterval: 60
      },
      fieldMapping: {
        'price': 'price',
        'timestamp': 'timestamp',
        'volume': 'volume'
      },
      settings: {
        chartType: 'line',
        timeInterval: 'daily',
        indicators: ['sma'],
        colorScheme: 'default'
      },
      lastUpdated: Date.now()
    }))
  }, [dispatch])

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Widget Testing Page
      </h1>
      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        This page demonstrates all three widget types with real API data.
      </p>
      
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8">
          <WidgetContainer widgetId="test-table-1" />
        </div>
        <div className="col-span-12 md:col-span-4">
          <WidgetContainer widgetId="test-card-1" />
        </div>
        <div className="col-span-12">
          <WidgetContainer widgetId="test-chart-1" />
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Testing Instructions
        </h2>
        <ul className="list-disc space-y-1 pl-6 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Table Widget: Try sorting columns, filtering, and exporting CSV</li>
          <li>Card Widget: Watch for animations on data updates</li>
          <li>Chart Widget: Try zooming with the brush, hover for tooltips</li>
          <li>Check browser console for any errors</li>
          <li>Open Redux DevTools to inspect state</li>
        </ul>
      </div>
    </div>
  )
}

