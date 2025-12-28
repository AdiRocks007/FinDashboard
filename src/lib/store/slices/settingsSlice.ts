import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ApiConfig } from '@/types'

export interface ApiKey {
  id: string
  name: string
  provider: 'alphavantage' | 'finnhub' | 'polygon' | 'custom'
  key: string // Encrypted in storage
  isActive: boolean
  createdAt: number
  lastUsed?: number
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  enabled: boolean
}

export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number
  strategy: 'lru' | 'fifo' | 'lfu'
}

interface SettingsState {
  // API configurations
  apiConfigs: ApiConfig[]
  apiKeys: ApiKey[]
  
  // Rate limiting
  rateLimitConfig: RateLimitConfig
  
  // Cache settings
  cacheConfig: CacheConfig
  
  // Global settings
  globalSettings: {
    defaultRefreshInterval: number
    maxCacheSize: number
    enableNotifications: boolean
    dateFormat: string
    currencyFormat: string
    numberFormat: string
  }
  
  // UI settings
  ui: {
    sidebarCollapsed: boolean
    showTooltips: boolean
    animationsEnabled: boolean
  }
  
  // Export/import configurations
  exportConfig: {
    includeApiKeys: boolean
    includeTemplates: boolean
    format: 'json' | 'yaml'
  }
}

const initialState: SettingsState = {
  apiConfigs: [],
  apiKeys: [],
  rateLimitConfig: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    enabled: true,
  },
  cacheConfig: {
    ttl: 300000, // 5 minutes
    maxSize: 100,
    strategy: 'lru',
  },
  globalSettings: {
    defaultRefreshInterval: 30000,
    maxCacheSize: 100,
    enableNotifications: true,
    dateFormat: 'MM/dd/yyyy',
    currencyFormat: 'USD',
    numberFormat: 'en-US',
  },
  ui: {
    sidebarCollapsed: false,
    showTooltips: true,
    animationsEnabled: true,
  },
  exportConfig: {
    includeApiKeys: false, // Security: don't export keys by default
    includeTemplates: true,
    format: 'json',
  },
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // API Config management
    addApiConfig: (state, action: PayloadAction<ApiConfig>) => {
      state.apiConfigs.push(action.payload)
    },
    
    updateApiConfig: (state, action: PayloadAction<{ id: string; updates: Partial<ApiConfig> }>) => {
      const { id, updates } = action.payload
      const index = state.apiConfigs.findIndex((config) => config.id === id)
      if (index !== -1 && state.apiConfigs[index]) {
        state.apiConfigs[index] = { ...state.apiConfigs[index], ...updates }
      }
    },
    
    removeApiConfig: (state, action: PayloadAction<string>) => {
      state.apiConfigs = state.apiConfigs.filter((config) => config.id !== action.payload)
    },
    
    // API Keys management (encrypted storage)
    addApiKey: (state, action: PayloadAction<Omit<ApiKey, 'id' | 'createdAt'>>) => {
      const now = Date.now()
      const apiKey: ApiKey = {
        ...action.payload,
        id: `key_${now}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
      }
      state.apiKeys.push(apiKey)
    },
    
    updateApiKey: (state, action: PayloadAction<{ id: string; updates: Partial<ApiKey> }>) => {
      const { id, updates } = action.payload
      const key = state.apiKeys.find((k) => k.id === id)
      if (key) {
        Object.assign(key, updates)
        if (updates.key) {
          // Update last used when key is accessed
          key.lastUsed = Date.now()
        }
      }
    },
    
    removeApiKey: (state, action: PayloadAction<string>) => {
      state.apiKeys = state.apiKeys.filter((key) => key.id !== action.payload)
    },
    
    toggleApiKey: (state, action: PayloadAction<string>) => {
      const key = state.apiKeys.find((k) => k.id === action.payload)
      if (key) {
        key.isActive = !key.isActive
      }
    },
    
    // Rate limit configuration
    updateRateLimitConfig: (state, action: PayloadAction<Partial<RateLimitConfig>>) => {
      state.rateLimitConfig = { ...state.rateLimitConfig, ...action.payload }
    },
    
    toggleRateLimit: (state) => {
      state.rateLimitConfig.enabled = !state.rateLimitConfig.enabled
    },
    
    // Cache configuration
    updateCacheConfig: (state, action: PayloadAction<Partial<CacheConfig>>) => {
      state.cacheConfig = { ...state.cacheConfig, ...action.payload }
    },
    
    // Global settings
    updateGlobalSettings: (state, action: PayloadAction<Partial<SettingsState['globalSettings']>>) => {
      state.globalSettings = { ...state.globalSettings, ...action.payload }
    },
    
    // UI settings
    updateUiSettings: (state, action: PayloadAction<Partial<SettingsState['ui']>>) => {
      state.ui = { ...state.ui, ...action.payload }
    },
    
    toggleSidebar: (state) => {
      state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed
    },
    
    // Export/import configuration
    updateExportConfig: (state, action: PayloadAction<Partial<SettingsState['exportConfig']>>) => {
      state.exportConfig = { ...state.exportConfig, ...action.payload }
    },
    
    // Reset settings to defaults
    resetSettings: () => {
      return initialState
    },
  },
})

export const {
  addApiConfig,
  updateApiConfig,
  removeApiConfig,
  addApiKey,
  updateApiKey,
  removeApiKey,
  toggleApiKey,
  updateRateLimitConfig,
  toggleRateLimit,
  updateCacheConfig,
  updateGlobalSettings,
  updateUiSettings,
  toggleSidebar,
  updateExportConfig,
  resetSettings,
} = settingsSlice.actions

export default settingsSlice.reducer