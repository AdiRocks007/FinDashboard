import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DashboardLayout, DashboardSettings } from '@/types'
import type { WidgetWithPosition } from './widgetsSlice'

export interface DashboardTemplate {
  id: string
  name: string
  description: string
  layout: DashboardLayout
  settings: DashboardSettings
  widgets: WidgetWithPosition[]
  createdAt: number
  updatedAt: number
}

interface DashboardState {
  layout: 'grid' | 'masonry'
  gridCols: number
  theme: 'light' | 'dark'
  isEditMode: boolean
  selectedWidgetId: string | null
  globalRefreshInterval: number // milliseconds
  templates: DashboardTemplate[]
  // Legacy fields for backward compatibility
  layoutConfig: DashboardLayout
  settings: DashboardSettings
  showGrid: boolean
}

const initialState: DashboardState = {
  layout: 'grid',
  gridCols: 12,
  theme: typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  isEditMode: true, // Enable edit mode by default for better UX
  selectedWidgetId: null,
  globalRefreshInterval: 30000, // 30 seconds
  templates: [],
  layoutConfig: {
    columns: 12,
    rowHeight: 100,
    margin: [10, 10],
    containerPadding: [10, 10],
    breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  },
  settings: {
    theme: typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
    autoRefresh: true,
    refreshInterval: 30000,
    showGrid: false,
    snapToGrid: true,
    allowResize: true,
    allowDrag: true,
  },
  showGrid: false,
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Set layout type
    setLayout: (state, action: PayloadAction<'grid' | 'masonry'>) => {
      state.layout = action.payload
    },
    
    // Set grid columns
    setGridCols: (state, action: PayloadAction<number>) => {
      state.gridCols = action.payload
      state.layoutConfig.columns = action.payload
    },
    
    // Set theme (with localStorage sync handled by listener middleware)
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
      state.settings.theme = action.payload
    },
    
    // Toggle edit mode
    toggleEditMode: (state) => {
      state.isEditMode = !state.isEditMode
    },
    
    // Set edit mode
    setEditMode: (state, action: PayloadAction<boolean>) => {
      state.isEditMode = action.payload
    },
    
    // Select widget
    selectWidget: (state, action: PayloadAction<string | null>) => {
      state.selectedWidgetId = action.payload
    },
    
    // Set global refresh interval
    setGlobalRefreshInterval: (state, action: PayloadAction<number>) => {
      state.globalRefreshInterval = action.payload
      state.settings.refreshInterval = action.payload
    },
    
    // Save template
    saveTemplate: (state, action: PayloadAction<Omit<DashboardTemplate, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const now = Date.now()
      const template: DashboardTemplate = {
        ...action.payload,
        id: `template_${now}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }
      state.templates.push(template)
    },
    
    // Update template
    updateTemplate: (state, action: PayloadAction<{ id: string; updates: Partial<DashboardTemplate> }>) => {
      const { id, updates } = action.payload
      const template = state.templates.find((t) => t.id === id)
      if (template) {
        Object.assign(template, updates, { updatedAt: Date.now() })
      }
    },
    
    // Load template
    loadTemplate: (state, action: PayloadAction<string>) => {
      const template = state.templates.find((t) => t.id === action.payload)
      if (template) {
        state.layoutConfig = template.layout
        state.settings = template.settings
        state.gridCols = template.layout.columns
        state.theme = template.settings.theme as 'light' | 'dark'
        state.globalRefreshInterval = template.settings.refreshInterval
      }
    },
    
    // Delete template
    deleteTemplate: (state, action: PayloadAction<string>) => {
      state.templates = state.templates.filter((t) => t.id !== action.payload)
    },
    
    // Reset dashboard to defaults
    resetDashboard: (state) => {
      state.layout = 'grid'
      state.gridCols = 12
      state.theme = 'light'
      state.isEditMode = false
      state.selectedWidgetId = null
      state.globalRefreshInterval = 30000
      state.showGrid = false
      state.layoutConfig = initialState.layoutConfig
      state.settings = initialState.settings
    },
    
    // Legacy reducers for backward compatibility
    updateLayout: (state, action: PayloadAction<Partial<DashboardLayout>>) => {
      state.layoutConfig = { ...state.layoutConfig, ...action.payload }
      if (action.payload.columns) {
        state.gridCols = action.payload.columns
      }
    },
    
    updateSettings: (state, action: PayloadAction<Partial<DashboardSettings>>) => {
      state.settings = { ...state.settings, ...action.payload }
      if (action.payload.theme) {
        state.theme = action.payload.theme as 'light' | 'dark'
      }
      if (action.payload.refreshInterval) {
        state.globalRefreshInterval = action.payload.refreshInterval
      }
    },
    
    toggleGrid: (state) => {
      state.showGrid = !state.showGrid
      state.settings.showGrid = state.showGrid
    },
    
    setAutoRefresh: (state, action: PayloadAction<boolean>) => {
      state.settings.autoRefresh = action.payload
    },
    
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.globalRefreshInterval = action.payload
      state.settings.refreshInterval = action.payload
    },
  },
})

export const {
  setLayout,
  setGridCols,
  setTheme,
  toggleEditMode,
  setEditMode,
  selectWidget,
  setGlobalRefreshInterval,
  saveTemplate,
  updateTemplate,
  loadTemplate,
  deleteTemplate,
  resetDashboard,
  // Legacy exports
  updateLayout,
  updateSettings,
  toggleGrid,
  setAutoRefresh,
  setRefreshInterval,
} = dashboardSlice.actions

export { dashboardSlice }
export default dashboardSlice.reducer