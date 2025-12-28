import { describe, it, expect, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import widgetsReducer, {
  addWidget,
  removeWidget,
  updateWidget,
  batchUpdatePositions,
  setWidgetError,
  clearWidgetError,
  selectWidgetById,
  selectAllWidgets,
  selectWidgetsByType,
} from '@/lib/store/slices/widgetsSlice'
import dashboardReducer, {
  setLayout,
  setTheme,
  toggleEditMode,
  setGlobalRefreshInterval,
  saveTemplate,
  loadTemplate,
  resetDashboard,
} from '@/lib/store/slices/dashboardSlice'
import settingsReducer, {
  addApiKey,
  updateApiKey,
  removeApiKey,
  updateRateLimitConfig,
  updateCacheConfig,
} from '@/lib/store/slices/settingsSlice'
import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'
import type { DashboardTemplate } from '@/lib/store/slices/dashboardSlice'

// Create a test store
function createTestStore() {
  return configureStore({
    reducer: {
      widgets: widgetsReducer,
      dashboard: dashboardReducer,
      settings: settingsReducer,
    },
  })
}

describe('Redux Store - Widgets Slice', () => {
  let store: ReturnType<typeof createTestStore>
  
  beforeEach(() => {
    store = createTestStore()
  })
  
  const createTestWidget = (id: string, type: 'table' | 'card' | 'chart' = 'table'): WidgetWithPosition => ({
    id,
    type,
    title: `Test Widget ${id}`,
    position: { x: 0, y: 0, w: 4, h: 3 },
    size: { width: 400, height: 300 },
    config: {
      apiEndpoint: 'https://api.example.com/data',
      refreshInterval: 30000,
    },
    apiConfig: {
      url: 'https://api.example.com/data',
      method: 'GET',
      refreshInterval: 30,
    },
    fieldMapping: {},
    settings: {},
    lastUpdated: Date.now(),
  })
  
  describe('Widget CRUD Operations', () => {
    it('should add a widget', () => {
      const widget = createTestWidget('widget-1')
      
      store.dispatch(addWidget(widget))
      
      const state = store.getState()
      const addedWidget = selectWidgetById(state, 'widget-1')
      
      expect(addedWidget).toBeDefined()
      expect(addedWidget?.id).toBe('widget-1')
      expect(addedWidget?.title).toBe('Test Widget widget-1')
    })
    
    it('should remove a widget', () => {
      const widget = createTestWidget('widget-1')
      
      store.dispatch(addWidget(widget))
      store.dispatch(removeWidget('widget-1'))
      
      const state = store.getState()
      const removedWidget = selectWidgetById(state, 'widget-1')
      
      expect(removedWidget).toBeUndefined()
    })
    
    it('should update a widget', () => {
      const widget = createTestWidget('widget-1')
      
      store.dispatch(addWidget(widget))
      store.dispatch(
        updateWidget({
          id: 'widget-1',
          updates: { title: 'Updated Title' },
        })
      )
      
      const state = store.getState()
      const updatedWidget = selectWidgetById(state, 'widget-1')
      
      expect(updatedWidget?.title).toBe('Updated Title')
    })
    
    it('should batch update positions', () => {
      const widget1 = createTestWidget('widget-1')
      const widget2 = createTestWidget('widget-2')
      
      store.dispatch(addWidget(widget1))
      store.dispatch(addWidget(widget2))
      
      store.dispatch(
        batchUpdatePositions([
          { id: 'widget-1', position: { x: 1, y: 1, w: 4, h: 3 } },
          { id: 'widget-2', position: { x: 5, y: 1, w: 4, h: 3 } },
        ])
      )
      
      const state = store.getState()
      const updatedWidget1 = selectWidgetById(state, 'widget-1')
      const updatedWidget2 = selectWidgetById(state, 'widget-2')
      
      expect(updatedWidget1?.position.x).toBe(1)
      expect(updatedWidget1?.position.y).toBe(1)
      expect(updatedWidget2?.position.x).toBe(5)
      expect(updatedWidget2?.position.y).toBe(1)
    })
    
    it('should set widget error', () => {
      const widget = createTestWidget('widget-1')
      
      store.dispatch(addWidget(widget))
      store.dispatch(setWidgetError({ id: 'widget-1', error: 'API Error' }))
      
      const state = store.getState()
      const widgetWithError = selectWidgetById(state, 'widget-1')
      
      expect(widgetWithError?.error).toBe('API Error')
      expect(widgetWithError?.isLoading).toBe(false)
    })
    
    it('should clear widget error', () => {
      const widget = createTestWidget('widget-1')
      
      store.dispatch(addWidget(widget))
      store.dispatch(setWidgetError({ id: 'widget-1', error: 'API Error' }))
      store.dispatch(clearWidgetError('widget-1'))
      
      const state = store.getState()
      const widgetWithoutError = selectWidgetById(state, 'widget-1')
      
      expect(widgetWithoutError?.error).toBeUndefined()
    })
  })
  
  describe('Widget Selectors', () => {
    beforeEach(() => {
      const widgets = [
        createTestWidget('widget-1', 'table'),
        createTestWidget('widget-2', 'card'),
        createTestWidget('widget-3', 'chart'),
        createTestWidget('widget-4', 'table'),
      ]
      
      widgets.forEach((widget) => store.dispatch(addWidget(widget)))
    })
    
    it('should select all widgets', () => {
      const state = store.getState()
      const allWidgets = selectAllWidgets(state)
      
      expect(allWidgets).toHaveLength(4)
    })
    
    it('should select widgets by type', () => {
      const state = store.getState()
      const tableWidgets = selectWidgetsByType(state, 'table')
      
      expect(tableWidgets).toHaveLength(2)
      expect(tableWidgets.every((w) => w.type === 'table')).toBe(true)
    })
    
    it('should select widget by id', () => {
      const state = store.getState()
      const widget = selectWidgetById(state, 'widget-1')
      
      expect(widget).toBeDefined()
      expect(widget?.id).toBe('widget-1')
    })
  })
})

describe('Redux Store - Dashboard Slice', () => {
  let store: ReturnType<typeof createTestStore>
  
  beforeEach(() => {
    store = createTestStore()
  })
  
  describe('Layout Management', () => {
    it('should set layout type', () => {
      store.dispatch(setLayout('masonry'))
      
      const state = store.getState()
      expect(state.dashboard.layout).toBe('masonry')
    })
    
    it('should set theme', () => {
      store.dispatch(setTheme('dark'))
      
      const state = store.getState()
      expect(state.dashboard.theme).toBe('dark')
      expect(state.dashboard.settings.theme).toBe('dark')
    })
    
    it('should toggle edit mode', () => {
      expect(store.getState().dashboard.isEditMode).toBe(false)
      
      store.dispatch(toggleEditMode())
      
      expect(store.getState().dashboard.isEditMode).toBe(true)
      
      store.dispatch(toggleEditMode())
      
      expect(store.getState().dashboard.isEditMode).toBe(false)
    })
    
    it('should set global refresh interval', () => {
      store.dispatch(setGlobalRefreshInterval(60000))
      
      const state = store.getState()
      expect(state.dashboard.globalRefreshInterval).toBe(60000)
      expect(state.dashboard.settings.refreshInterval).toBe(60000)
    })
  })
  
  describe('Template Management', () => {
    it('should save a template', () => {
      const template: Omit<DashboardTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'Test Template',
        description: 'Test description',
        layout: {
          columns: 12,
          rowHeight: 100,
          margin: [10, 10],
          containerPadding: [10, 10],
          breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
          cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
        },
        settings: {
          theme: 'dark',
          autoRefresh: true,
          refreshInterval: 60000,
          showGrid: false,
          snapToGrid: true,
          allowResize: true,
          allowDrag: true,
        },
        widgets: [],
      }
      
      store.dispatch(saveTemplate(template))
      
      const state = store.getState()
      expect(state.dashboard.templates).toHaveLength(1)
      expect(state.dashboard.templates[0]?.name).toBe('Test Template')
      expect(state.dashboard.templates[0]?.id).toBeDefined()
    })
    
    it('should load a template', () => {
      const template: Omit<DashboardTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'Test Template',
        description: 'Test description',
        layout: {
          columns: 16,
          rowHeight: 120,
          margin: [15, 15],
          containerPadding: [15, 15],
          breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
          cols: { lg: 16, md: 12, sm: 8, xs: 4, xxs: 2 },
        },
        settings: {
          theme: 'dark',
          autoRefresh: false,
          refreshInterval: 120000,
          showGrid: true,
          snapToGrid: false,
          allowResize: false,
          allowDrag: false,
        },
        widgets: [],
      }
      
      store.dispatch(saveTemplate(template))
      const templateId = store.getState().dashboard.templates[0]?.id
      
      store.dispatch(loadTemplate(templateId!))
      
      const state = store.getState()
      expect(state.dashboard.gridCols).toBe(16)
      expect(state.dashboard.theme).toBe('dark')
      expect(state.dashboard.globalRefreshInterval).toBe(120000)
    })
    
    it('should reset dashboard', () => {
      store.dispatch(setTheme('dark'))
      store.dispatch(setLayout('masonry'))
      store.dispatch(setGlobalRefreshInterval(60000))
      
      store.dispatch(resetDashboard())
      
      const state = store.getState()
      expect(state.dashboard.theme).toBe('light')
      expect(state.dashboard.layout).toBe('grid')
      expect(state.dashboard.globalRefreshInterval).toBe(30000)
    })
  })
})

describe('Redux Store - Settings Slice', () => {
  let store: ReturnType<typeof createTestStore>
  
  beforeEach(() => {
    store = createTestStore()
  })
  
  describe('API Key Management', () => {
    it('should add an API key', () => {
      store.dispatch(
        addApiKey({
          name: 'Alpha Vantage',
          provider: 'alphavantage',
          key: 'test-key-123',
          isActive: true,
        })
      )
      
      const state = store.getState()
      expect(state.settings.apiKeys).toHaveLength(1)
      expect(state.settings.apiKeys[0]?.name).toBe('Alpha Vantage')
      expect(state.settings.apiKeys[0]?.id).toBeDefined()
    })
    
    it('should update an API key', () => {
      store.dispatch(
        addApiKey({
          name: 'Alpha Vantage',
          provider: 'alphavantage',
          key: 'test-key-123',
          isActive: true,
        })
      )
      
      const keyId = store.getState().settings.apiKeys[0]?.id
      
      store.dispatch(
        updateApiKey({
          id: keyId!,
          updates: { name: 'Updated Name', isActive: false },
        })
      )
      
      const state = store.getState()
      const updatedKey = state.settings.apiKeys[0]
      expect(updatedKey?.name).toBe('Updated Name')
      expect(updatedKey?.isActive).toBe(false)
    })
    
    it('should remove an API key', () => {
      store.dispatch(
        addApiKey({
          name: 'Alpha Vantage',
          provider: 'alphavantage',
          key: 'test-key-123',
          isActive: true,
        })
      )
      
      const keyId = store.getState().settings.apiKeys[0]?.id
      
      store.dispatch(removeApiKey(keyId!))
      
      const state = store.getState()
      expect(state.settings.apiKeys).toHaveLength(0)
    })
  })
  
  describe('Rate Limit Configuration', () => {
    it('should update rate limit config', () => {
      store.dispatch(
        updateRateLimitConfig({
          maxRequests: 200,
          windowMs: 120000,
        })
      )
      
      const state = store.getState()
      expect(state.settings.rateLimitConfig.maxRequests).toBe(200)
      expect(state.settings.rateLimitConfig.windowMs).toBe(120000)
    })
  })
  
  describe('Cache Configuration', () => {
    it('should update cache config', () => {
      store.dispatch(
        updateCacheConfig({
          ttl: 600000,
          maxSize: 200,
          strategy: 'lfu',
        })
      )
      
      const state = store.getState()
      expect(state.settings.cacheConfig.ttl).toBe(600000)
      expect(state.settings.cacheConfig.maxSize).toBe(200)
      expect(state.settings.cacheConfig.strategy).toBe('lfu')
    })
  })
})

describe('Redux Store - Selector Memoization', () => {
  let store: ReturnType<typeof createTestStore>
  
  beforeEach(() => {
    store = createTestStore()
    
    // Add test widgets
    const widgets = [
      { id: 'widget-1', type: 'table' as const },
      { id: 'widget-2', type: 'card' as const },
      { id: 'widget-3', type: 'table' as const },
    ].map((w) => ({
      id: w.id,
      type: w.type,
      title: `Widget ${w.id}`,
      position: { x: 0, y: 0, w: 4, h: 3 },
      size: { width: 400, height: 300 },
      config: {},
      apiConfig: {
        url: 'https://api.example.com',
        method: 'GET',
        refreshInterval: 30,
      },
      fieldMapping: {},
      settings: {},
      lastUpdated: Date.now(),
    }))
    
    widgets.forEach((widget) => store.dispatch(addWidget(widget)))
  })
  
  it('should memoize selectors correctly', () => {
    const state1 = store.getState()
    const widgets1 = selectAllWidgets(state1)
    
    // Dispatch unrelated action
    store.dispatch(setTheme('dark'))
    
    const state2 = store.getState()
    const widgets2 = selectAllWidgets(state2)
    
    // Selectors should return same reference if state hasn't changed
    expect(widgets1).toBe(widgets2)
  })
  
  it('should update selectors when relevant state changes', () => {
    const state1 = store.getState()
    const tableWidgets1 = selectWidgetsByType(state1, 'table')
    
    // Add a new table widget
    const newWidget: WidgetWithPosition = {
      id: 'widget-4',
      type: 'table',
      title: 'Widget 4',
      position: { x: 0, y: 0, w: 4, h: 3 },
      size: { width: 400, height: 300 },
      config: {},
      apiConfig: {
        url: 'https://api.example.com',
        method: 'GET',
        refreshInterval: 30,
      },
      fieldMapping: {},
      settings: {},
      lastUpdated: Date.now(),
    }
    
    store.dispatch(addWidget(newWidget))
    
    const state2 = store.getState()
    const tableWidgets2 = selectWidgetsByType(state2, 'table')
    
    expect(tableWidgets2.length).toBe(tableWidgets1.length + 1)
  })
})

