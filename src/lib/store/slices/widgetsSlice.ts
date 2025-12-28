import { createSlice, createEntityAdapter, createSelector, PayloadAction } from '@reduxjs/toolkit'
import { Widget, WidgetType } from '@/types'
import type { RootState } from '../index'

// Define widget with position for grid layout
export interface WidgetWithPosition extends Omit<Widget, 'lastUpdated' | 'position'> {
  position: { x: number; y: number; w: number; h: number }
  apiConfig: {
    url: string
    method: string
    headers?: Record<string, string>
    queryParams?: Record<string, unknown>
    refreshInterval: number // seconds
  }
  fieldMapping: Record<string, string>
  settings: Record<string, unknown>
  lastUpdated: number // Override to use number (timestamp) instead of string
  error?: string
}

// Create entity adapter for normalized storage
const widgetsAdapter = createEntityAdapter<WidgetWithPosition>({
  // selectId is inferred from the id property, but we can specify it explicitly
  // @ts-expect-error - selectId is valid but types may not reflect it in all versions
  selectId: (widget) => widget.id,
  sortComparer: (a, b) => {
    // Sort by position.x (which represents order in the new responsive system)
    return a.position.x - b.position.x
  },
})

interface WidgetsState {
  selectedWidgetId: string | null
  isAddingWidget: boolean
  draggedWidget: string | null
  positionUpdateQueue: Array<{ id: string; position: WidgetWithPosition['position'] }>
}

const initialState = widgetsAdapter.getInitialState<WidgetsState>({
  selectedWidgetId: null,
  isAddingWidget: false,
  draggedWidget: null,
  positionUpdateQueue: [],
})

const widgetsSlice = createSlice({
  name: 'widgets',
  initialState,
  reducers: {
    // Add widget
    addWidget: (state, action: PayloadAction<WidgetWithPosition>) => {
      widgetsAdapter.addOne(state, action.payload)
    },
    
    // Update widget
    updateWidget: (state, action: PayloadAction<{ id: string; updates: Partial<WidgetWithPosition> }>) => {
      const { id, updates } = action.payload
      widgetsAdapter.updateOne(state, { id, changes: updates })
    },
    
    // Remove widget
    removeWidget: (state, action: PayloadAction<string>) => {
      widgetsAdapter.removeOne(state, action.payload)
      if (state.selectedWidgetId === action.payload) {
        state.selectedWidgetId = null
      }
    },
    
    // Batch remove widgets
    removeWidgets: (state, action: PayloadAction<string[]>) => {
      widgetsAdapter.removeMany(state, action.payload)
      if (state.selectedWidgetId && action.payload.includes(state.selectedWidgetId)) {
        state.selectedWidgetId = null
      }
    },
    
    // Update widget position
    updateWidgetPosition: (state, action: PayloadAction<{ id: string; position: WidgetWithPosition['position'] }>) => {
      const { id, position } = action.payload
      widgetsAdapter.updateOne(state, { id, changes: { position } })
    },
    
    // Batch update positions (for drag operations)
    batchUpdatePositions: (state, action: PayloadAction<Array<{ id: string; position: WidgetWithPosition['position'] }>>) => {
      const updates = action.payload.map(({ id, position }) => ({
        id,
        changes: { position },
      }))
      widgetsAdapter.updateMany(state, updates)
    },
    
    // Queue position updates for debouncing
    queuePositionUpdate: (state, action: PayloadAction<{ id: string; position: WidgetWithPosition['position'] }>) => {
      const { id, position } = action.payload
      const existingIndex = state.positionUpdateQueue.findIndex((item) => item.id === id)
      
      if (existingIndex >= 0) {
        state.positionUpdateQueue[existingIndex] = { id, position }
      } else {
        state.positionUpdateQueue.push({ id, position })
      }
    },
    
    // Flush queued position updates
    flushPositionUpdates: (state) => {
      if (state.positionUpdateQueue.length > 0) {
        const updates = state.positionUpdateQueue.map(({ id, position }) => ({
          id,
          changes: { position },
        }))
        widgetsAdapter.updateMany(state, updates)
        state.positionUpdateQueue = []
      }
    },
    
    // Set widget error
    setWidgetError: (state, action: PayloadAction<{ id: string; error: string }>) => {
      const { id, error } = action.payload
      widgetsAdapter.updateOne(state, { id, changes: { error, isLoading: false } })
    },
    
    // Clear widget error
    clearWidgetError: (state, action: PayloadAction<string>) => {
      const widget = state.entities[action.payload]
      if (widget) {
        // Delete the error property directly using Immer
        delete widget.error
      }
    },
    
    // Update widget data
    setWidgetData: (state, action: PayloadAction<{ id: string; data: unknown; error?: string }>) => {
      const { id, data, error } = action.payload
      const widget = state.entities[id]
      if (!widget) return
      
      // Build changes object, conditionally including error
      const changes: Partial<WidgetWithPosition> = {
        data,
        isLoading: false,
        lastUpdated: Date.now(),
      }
      
      // Only include error if provided, otherwise omit it (don't set to undefined)
      if (error !== undefined) {
        changes.error = error
      }
      
      widgetsAdapter.updateOne(state, { id, changes })
    },
    
    // Set widget loading state
    setWidgetLoading: (state, action: PayloadAction<{ id: string; isLoading: boolean }>) => {
      const { id, isLoading } = action.payload
      widgetsAdapter.updateOne(state, { id, changes: { isLoading } })
    },
    
    // Select widget
    selectWidget: (state, action: PayloadAction<string | null>) => {
      state.selectedWidgetId = action.payload
    },
    
    // Set adding widget state
    setAddingWidget: (state, action: PayloadAction<boolean>) => {
      state.isAddingWidget = action.payload
    },
    
    // Set dragged widget
    setDraggedWidget: (state, action: PayloadAction<string | null>) => {
      state.draggedWidget = action.payload
    },
    
    // Normalize widget positions (fix legacy positioning)
    normalizeWidgetPositions: (state) => {
      const widgets = Object.values(state.entities).filter(Boolean) as WidgetWithPosition[]
      
      // Sort by current position.x to maintain relative order
      const sortedWidgets = widgets.sort((a, b) => a.position.x - b.position.x)
      
      // Update positions to be sequential
      const updates = sortedWidgets.map((widget, index) => ({
        id: widget.id,
        changes: {
          position: {
            x: index,
            y: 0,
            w: 1,
            h: 1,
          },
        },
      }))
      
      widgetsAdapter.updateMany(state, updates)
    },
  },
})

// Export actions
export const {
  addWidget,
  updateWidget,
  removeWidget,
  removeWidgets,
  updateWidgetPosition,
  batchUpdatePositions,
  queuePositionUpdate,
  flushPositionUpdates,
  setWidgetError,
  clearWidgetError,
  setWidgetData,
  setWidgetLoading,
  selectWidget,
  setAddingWidget,
  setDraggedWidget,
  normalizeWidgetPositions,
} = widgetsSlice.actions

// Export reducer
export default widgetsSlice.reducer

// Entity adapter selectors
export const {
  selectAll: selectAllWidgets,
  selectById: selectWidgetById,
  selectIds: selectWidgetIds,
  selectEntities: selectWidgetEntities,
  selectTotal: selectWidgetsCount,
} = widgetsAdapter.getSelectors((state: RootState) => state.widgets)

// Memoized selectors with Reselect
export const selectWidgetsByType = createSelector(
  [selectAllWidgets, (_state: RootState, type: WidgetType) => type],
  (widgets, type) => widgets.filter((widget) => widget.type === type)
)

export const selectSelectedWidget = createSelector(
  [(state: RootState) => state.widgets.selectedWidgetId, selectWidgetEntities],
  (selectedId, entities) => (selectedId ? entities[selectedId] : undefined)
)

export const selectWidgetsWithErrors = createSelector([selectAllWidgets], (widgets) =>
  widgets.filter((widget) => widget.error)
)

export const selectLoadingWidgets = createSelector([selectAllWidgets], (widgets) =>
  widgets.filter((widget) => widget.isLoading)
)

export const selectWidgetsByApiEndpoint = createSelector(
  [selectAllWidgets, (_state: RootState, endpoint: string) => endpoint],
  (widgets, endpoint) => widgets.filter((widget) => widget.apiConfig.url === endpoint)
)