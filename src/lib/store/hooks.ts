import { useDispatch, useSelector } from 'react-redux'
import { useMemo } from 'react'
import type { EntityId } from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from './index'
import { selectWidgetById, selectWidgetsByType } from './slices/widgetsSlice'
import type { WidgetWithPosition } from './slices/widgetsSlice'
import { apiService } from './services/apiService'

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector = <TSelected = unknown>(
  selector: (state: RootState) => TSelected
) => useSelector<RootState, TSelected>(selector)

/**
 * Memoized selector for single widget
 */
export function useWidget(id: string) {
  return useAppSelector((state) => {
    if (!state.widgets || !state.widgets.ids || !state.widgets.entities) {
      return undefined
    }
    // Access entity directly from state
    return state.widgets.entities[id]
  })
}

/**
 * Returns current dashboard layout configuration
 */
export function useDashboardLayout() {
  return useAppSelector((state) => state.dashboard?.layoutConfig ?? {
    columns: 12,
    rowHeight: 100,
    margin: [10, 10],
    containerPadding: [10, 10],
    breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  })
}

/**
 * Returns dashboard settings
 */
export function useDashboardSettings() {
  return useAppSelector((state) => state.dashboard?.settings ?? {
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 30000,
    showGrid: false,
    snapToGrid: true,
    allowResize: true,
    allowDrag: true,
  })
}

/**
 * Returns RTK Query loading states for API calls
 */
export function useApiStatus() {
  const state = useAppSelector((state) => state)
  
  return useMemo(() => {
    const apiState = state[apiService.reducerPath]
    if (!apiState) {
      return {
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        queries: {},
        mutations: {},
      }
    }
    
    const queries = apiState.queries || {}
    const mutations = apiState.mutations || {}
    
    // Aggregate loading states
    const isLoading = Object.values(queries).some(
      (query: unknown) => (query as { status?: string })?.status === 'pending'
    )
    
    const isFetching = Object.values(queries).some(
      (query: unknown) => (query as { status?: string })?.status === 'pending'
    )
    
    const isError = Object.values(queries).some(
      (query: unknown) => (query as { status?: string })?.status === 'rejected'
    )
    
    const errors = Object.values(queries)
      .filter((query: unknown) => (query as { status?: string })?.status === 'rejected')
      .map((query: unknown) => (query as { error?: unknown })?.error)
    
    return {
      isLoading,
      isFetching,
      isError,
      error: errors[0] || null,
      queries,
      mutations,
    }
  }, [state])
}

/**
 * Returns widgets filtered by type
 */
export function useWidgetsByType(type: 'table' | 'card' | 'chart' | 'metric') {
  return useAppSelector((state) => {
    if (!state.widgets || !state.widgets.ids || !state.widgets.entities) {
      return []
    }
    // Filter widgets by type directly
    const widgets = state.widgets
    return widgets.ids
      .map((id: EntityId) => widgets.entities[id])
      .filter((widget: WidgetWithPosition | undefined): widget is WidgetWithPosition => 
        widget !== undefined && widget.type === type
      )
  })
}

/**
 * Returns all widgets count
 */
export function useWidgetsCount() {
  return useAppSelector((state) => state.widgets?.ids.length ?? 0)
}

/**
 * Returns selected widget ID
 */
export function useSelectedWidget() {
  return useAppSelector((state) => state.widgets?.selectedWidgetId ?? null)
}

/**
 * Returns edit mode state
 */
export function useEditMode() {
  return useAppSelector((state) => state.dashboard?.isEditMode ?? false)
}

/**
 * Returns theme preference
 */
export function useTheme() {
  return useAppSelector((state) => state.dashboard?.theme ?? 'light')
}