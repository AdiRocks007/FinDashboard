import { configureStore, combineReducers, Middleware, UnknownAction } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import { encryptTransform } from 'redux-persist-transform-encrypt'
import { createListenerMiddleware } from '@reduxjs/toolkit'
import { rateLimiters } from '@/lib/utils/rateLimiter'

import widgetsSlice from './slices/widgetsSlice'
import dashboardSliceReducer, { dashboardSlice } from './slices/dashboardSlice'
import settingsSlice from './slices/settingsSlice'
import { apiService } from './services/apiService'

const rootReducer = combineReducers({
  widgets: widgetsSlice,
  dashboard: dashboardSliceReducer,
  settings: settingsSlice,
  [apiService.reducerPath]: apiService.reducer,
})

// Get encryption key from environment or generate a default one
const getEncryptionKey = (): string => {
  if (typeof window === 'undefined') {
    return process.env.ENCRYPTION_SECRET_KEY || 'default-secret-key-change-in-production'
  }
  
  // In browser, get from localStorage or generate
  let key = localStorage.getItem('encryption_key')
  if (!key) {
    // Generate a random key
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    key = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('encryption_key', key)
  }
  
  return key
}

// Create encryptor transform
const encryptor = encryptTransform({
  secretKey: getEncryptionKey(),
  onError: (error: unknown) => {
    console.error('Redux persist encryption error:', error)
  }
})

const persistConfig = {
  key: 'finboard',
  storage,
  whitelist: ['widgets', 'dashboard', 'settings'],
  blacklist: [apiService.reducerPath],
  transforms: [encryptor],
}

// Type assertion needed for persistReducer with entity adapter
// @ts-expect-error - persistReducer type incompatibility with entity adapter
const persistedReducer = persistReducer(persistConfig, rootReducer)

// Create listener middleware for cross-slice logic
export const listenerMiddleware = createListenerMiddleware()

// Rate limiting middleware for API calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rateLimitMiddleware: Middleware<any> = () => (next) => (action: any) => {
  // Check if action is an API call
  if (action?.type?.includes('api/executeQuery') || action?.type?.includes('api/executeMutation')) {
    const endpoint = action?.meta?.arg?.endpointName || 'api'
    
    if (!rateLimiters.api.isAllowed(endpoint)) {
      console.warn(`Rate limit exceeded for endpoint: ${endpoint}`)
      return {
        type: 'api/rateLimitExceeded',
        payload: { endpoint, message: 'Rate limit exceeded. Please try again later.' }
      }
    }
  }
  
  return next(action)
}

// Performance optimizations: disable checks in production
const isProduction = process.env.NODE_ENV === 'production'

// Type incompatibility with persistReducer and entity adapter (known issue)
// The persistReducer creates a Partial state type, but middleware expects full state
// Using type assertion to work around this limitation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const store = configureStore({
  reducer: persistedReducer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  middleware: (getDefaultMiddleware: any) =>
    getDefaultMiddleware({
      // Disable immutable check in production for performance
      immutableCheck: !isProduction,
      // Disable serializable check in production, but keep it for development
      serializableCheck: isProduction
        ? false
        : {
            ignoredActions: [
              'persist/PERSIST',
              'persist/REHYDRATE',
              'persist/REGISTER',
              'persist/PAUSE',
              'persist/PURGE',
              'persist/FLUSH',
              // Ignore RTK Query actions
              'api/executeQuery',
              'api/executeMutation',
            ],
            // Allow Date objects in state and persist paths
            ignoredPaths: [
              'register', 
              'rehydrate', 
              'payload.timestamp', 
              'payload.lastUpdated',
              // Ignore RTK Query cache paths
              'api.queries',
              'api.mutations',
            ],
            // Ignore RTK Query's non-serializable action paths
            ignoredActionPaths: [
              'meta.arg',
              'payload.timestamp',
              'meta.baseQueryMeta.request',
              'meta.baseQueryMeta.response',
              'meta.request',
              'meta.response',
            ],
          },
    })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .concat(apiService.middleware as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .concat(rateLimitMiddleware as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .prepend(listenerMiddleware.middleware as any),
  devTools: process.env.NODE_ENV !== 'production' && {
    trace: true,
    traceLimit: 25,
  },
} as any)

export const persistor = persistStore(store)

// Type exports
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Listener middleware for cross-slice logic
// Example: Sync theme changes to localStorage
listenerMiddleware.startListening({
  actionCreator: dashboardSlice.actions.setTheme,
  effect: async (action) => {
    const theme = action.payload
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  },
})

// Sync global refresh interval to all widgets
listenerMiddleware.startListening({
  actionCreator: dashboardSlice.actions.setGlobalRefreshInterval,
  effect: async () => {
    // Update all widgets with new refresh interval if they don't have custom interval
    // This can be extended based on requirements
    // For now, widgets manage their own refresh intervals
  },
})