'use client'

import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { useState } from 'react'
import { store, persistor } from '@/lib/store'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

interface StoreProviderProps {
  children: React.ReactNode
}

/**
 * Loading component for PersistGate
 */
function PersistLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-500" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading dashboard...</p>
      </div>
    </div>
  )
}

/**
 * Client-side Redux Provider with proper SSR handling
 * 
 * Handles:
 * - Redux store hydration
 * - PersistGate for localStorage persistence
 * - Error boundaries for error handling
 * - SSR-safe rendering
 */
export default function StoreProvider({ children }: StoreProviderProps) {
  // Use useState with lazy initialization to avoid hydration mismatches
  const [isClient] = useState(() => typeof window !== 'undefined')
  
  // Prevent hydration mismatches
  if (!isClient) {
    return (
      <Provider store={store}>
        <PersistLoading />
      </Provider>
    )
  }
  
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[StoreProvider] Error caught by ErrorBoundary:', error)
        console.error('[StoreProvider] Error info:', errorInfo)
      }}
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-loss-200 bg-loss-50 p-6 text-center dark:border-loss-800 dark:bg-loss-900/20">
            <h3 className="mb-2 text-lg font-semibold text-loss-900 dark:text-loss-100">
              Store Initialization Error
            </h3>
            <p className="mb-4 text-sm text-loss-700 dark:text-loss-300">
              Failed to initialize the application store. Please refresh the page.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="mb-4 text-xs text-loss-600 dark:text-loss-400">
                Check the console for error details
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-loss-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-loss-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      }
    >
      <Provider store={store}>
        <PersistGate loading={<PersistLoading />} persistor={persistor}>
          {children}
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  )
}