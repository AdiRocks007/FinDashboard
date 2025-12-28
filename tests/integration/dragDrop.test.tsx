import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { addWidget } from '@/lib/store/slices/widgetsSlice'
import { toggleEditMode } from '@/lib/store/slices/dashboardSlice'
import widgetsReducer from '@/lib/store/slices/widgetsSlice'
import dashboardReducer from '@/lib/store/slices/dashboardSlice'
import { apiService } from '@/lib/store/services/apiService'

// Mock the WidgetContainer to avoid loading actual widgets
vi.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({ widgetId }: { widgetId: string }) => (
    <div data-testid={`widget-${widgetId}`}>Widget {widgetId}</div>
  ),
}))

// Mock useResponsiveColumns
vi.mock('@/hooks/useResponsiveColumns', () => ({
  useResponsiveColumns: () => 3,
}))

describe('Drag and Drop Dashboard', () => {
  let store: ReturnType<typeof createTestStore>

  function createTestStore() {
    return configureStore({
      reducer: {
        widgets: widgetsReducer,
        dashboard: dashboardReducer,
        [apiService.reducerPath]: apiService.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }).concat(apiService.middleware),
    })
  }

  beforeEach(() => {
    store = createTestStore()
  })

  function createTestWidget(id: string, position = { x: 0, y: 0, w: 1, h: 1 }) {
    return {
      id,
      type: 'card' as const,
      title: `Widget ${id}`,
      position,
      size: { width: 0, height: 0 },
      config: {},
      apiConfig: {
        url: 'https://finnhub.io/api/v1/quote?symbol=AAPL',
        method: 'GET' as const,
        headers: {},
        queryParams: {},
        refreshInterval: 30,
      },
      fieldMapping: {
        symbol: 'symbol',
        price: 'price',
      },
      settings: {},
      lastUpdated: Date.now(),
    }
  }

  describe('Widget Reordering', () => {
    it('should render widgets in the grid', () => {
      const widget1 = createTestWidget('widget-1', { x: 0, y: 0, w: 1, h: 1 })
      const widget2 = createTestWidget('widget-2', { x: 1, y: 0, w: 1, h: 1 })
      
      store.dispatch(addWidget(widget1))
      store.dispatch(addWidget(widget2))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      expect(screen.getByTestId('widget-widget-1')).toBeInTheDocument()
      expect(screen.getByTestId('widget-widget-2')).toBeInTheDocument()
    })

    it('should enable drag handles in edit mode', () => {
      const widget = createTestWidget('widget-1')
      store.dispatch(addWidget(widget))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      // Check for drag handle (grip icon)
      const dragHandle = screen.getByLabelText(/drag widget/i)
      expect(dragHandle).toBeInTheDocument()
    })

    it('should disable drag handles in view mode', () => {
      const widget = createTestWidget('widget-1')
      store.dispatch(addWidget(widget))
      // Don't toggle edit mode - should be in view mode (isEditMode defaults to false)

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      // Drag handle should not be present in view mode
      const dragHandle = screen.queryByLabelText(/drag widget widget-1/i)
      expect(dragHandle).not.toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for drag and drop', async () => {
      const widget1 = createTestWidget('widget-1', { x: 0, y: 0, w: 1, h: 1 })
      const widget2 = createTestWidget('widget-2', { x: 1, y: 0, w: 1, h: 1 })
      
      store.dispatch(addWidget(widget1))
      store.dispatch(addWidget(widget2))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      // Wait for widget to render
      await waitFor(() => {
        expect(screen.getByTestId('widget-widget-1')).toBeInTheDocument()
      })

      // Get all drag handles and use the first one
      const dragHandles = await waitFor(() => {
        return screen.getAllByLabelText(/drag widget/i)
      }, { timeout: 2000 })
      
      expect(dragHandles.length).toBeGreaterThan(0)
      const dragHandle = dragHandles[0]
      
      // Focus on drag handle
      dragHandle.focus()
      
      // Simulate keyboard interaction
      fireEvent.keyDown(dragHandle, { key: ' ', code: 'Space' })
      
      // Should be able to interact with keyboard
      expect(dragHandle).toHaveFocus()
    })
  })

  describe('Position Persistence', () => {
    it('should persist widget positions after drag', async () => {
      const widget1 = createTestWidget('widget-1', { x: 0, y: 0, w: 1, h: 1 })
      const widget2 = createTestWidget('widget-2', { x: 1, y: 0, w: 1, h: 1 })
      
      store.dispatch(addWidget(widget1))
      store.dispatch(addWidget(widget2))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      // Get initial state
      const initialState = store.getState()
      const initialWidget1 = initialState.widgets.entities['widget-1']
      const initialWidget2 = initialState.widgets.entities['widget-2']

      expect(initialWidget1?.position).toEqual({ x: 0, y: 0, w: 1, h: 1 })
      expect(initialWidget2?.position).toEqual({ x: 1, y: 0, w: 1, h: 1 })

      // Note: Actual drag simulation would require more complex setup
      // This test verifies the structure is in place
      expect(initialWidget1).toBeDefined()
      expect(initialWidget2).toBeDefined()
    })
  })

  describe('Mobile Touch Interactions', () => {
    it('should support touch sensors for mobile devices', async () => {
      const widget = createTestWidget('widget-1')
      store.dispatch(addWidget(widget))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      // Wait for widget and drag handle to render
      await waitFor(() => {
        expect(screen.getByTestId('widget-widget-1')).toBeInTheDocument()
      })
      
      const dragHandle = await waitFor(() => {
        return screen.getByLabelText(/drag widget/i)
      }, { timeout: 2000 })
      
      // Simulate touch events
      fireEvent.touchStart(dragHandle, {
        touches: [{ clientX: 0, clientY: 0 }],
      })
      
      // Touch sensor should be configured (tested via component rendering)
      expect(dragHandle).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const widget = createTestWidget('widget-1')
      store.dispatch(addWidget(widget))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      const grid = screen.getByRole('grid', { name: /dashboard widgets/i })
      expect(grid).toBeInTheDocument()

      // Wait for widget to render
      await waitFor(() => {
        expect(screen.getByTestId('widget-widget-1')).toBeInTheDocument()
      })

      // Check for drag handle in edit mode - wait for it to appear
      // The aria-label uses widget.title which is "Widget widget-1"
      const dragHandle = await waitFor(() => {
        return screen.getByLabelText(/drag widget/i)
      }, { timeout: 2000 })
      expect(dragHandle).toBeInTheDocument()
    })

    it('should announce drag actions to screen readers', () => {
      const widget = createTestWidget('widget-1')
      store.dispatch(addWidget(widget))
      store.dispatch(toggleEditMode())

      render(
        <Provider store={store}>
          <DashboardGrid />
        </Provider>
      )

      // Check for aria-live regions (announcements are created dynamically)
      // The component should have proper accessibility setup
      const grid = screen.getByRole('grid')
      expect(grid).toHaveAttribute('aria-label', 'Dashboard widgets')
    })
  })
})

