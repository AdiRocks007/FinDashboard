import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { AddWidgetModal } from '@/components/modals/AddWidgetModal'
import widgetsReducer from '@/lib/store/slices/widgetsSlice'
import dashboardReducer from '@/lib/store/slices/dashboardSlice'
import { apiService } from '@/lib/store/services/apiService'

// Mock fetch
global.fetch = vi.fn()

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}))

describe('AddWidgetModal', () => {
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
    vi.clearAllMocks()
  })

  describe('Modal Open/Close', () => {
    it('should open and close the modal', () => {
      const { rerender } = render(
        <Provider store={store}>
          <AddWidgetModal isOpen={false} onClose={vi.fn()} />
        </Provider>
      )

      expect(screen.queryByText('Add New Widget')).not.toBeInTheDocument()

      rerender(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      expect(screen.getByText('Add New Widget')).toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={onClose} />
        </Provider>
      )

      const closeButton = screen.getByLabelText('Close modal')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Multi-step Navigation', () => {
    it('should show step 1 initially', () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
      expect(screen.getByLabelText('Widget Name')).toBeInTheDocument()
    })

    it('should navigate to next step when Next is clicked', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      // Fill in required fields for step 1
      const nameInput = screen.getByLabelText('Widget Name')
      const urlInput = screen.getByLabelText('API URL')

      fireEvent.change(nameInput, { target: { value: 'Test Widget' } })
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } })

      // Mock API test response
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { price: 100 } }),
      })

      // Test API connection
      const testButton = screen.getByText('Test API Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText(/API connection successful/i)).toBeInTheDocument()
      })

      // Click Next
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })
    })

    it('should navigate back to previous step', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      // Fill step 1 and go to step 2
      const nameInput = screen.getByLabelText('Widget Name')
      const urlInput = screen.getByLabelText('API URL')

      fireEvent.change(nameInput, { target: { value: 'Test Widget' } })
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } })

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { price: 100 } }),
      })

      const testButton = screen.getByText('Test API Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText(/API connection successful/i)).toBeInTheDocument()
      })

      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })

      // Go back
      const prevButton = screen.getByText('Previous')
      fireEvent.click(prevButton)

      await waitFor(() => {
        expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
      })
    })

    it('should disable Previous button on first step', () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      const prevButton = screen.getByText('Previous')
      expect(prevButton).toBeDisabled()
    })
  })

  describe('API Validation', () => {
    it('should validate URL format', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      const urlInput = screen.getByLabelText('API URL')
      fireEvent.change(urlInput, { target: { value: 'not-a-url' } })

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid URL/i)).toBeInTheDocument()
      })
    })

    it('should test API connection', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      const urlInput = screen.getByLabelText('API URL')
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } })

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { price: 100, symbol: 'AAPL' } }),
      })

      const testButton = screen.getByText('Test API Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText(/API connection successful/i)).toBeInTheDocument()
      })
    })

    it('should show error when API test fails', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      const urlInput = screen.getByLabelText('API URL')
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } })

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const testButton = screen.getByText('Test API Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        // Check for error message (could be various formats)
        const errorMessage = screen.queryByText(/Failed to connect/i) || 
                            screen.queryByText(/failed/i) ||
                            screen.queryByText(/error/i)
        expect(errorMessage).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Field Mapping', () => {
    it('should show field mapping step after API test', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      // Complete step 1
      const nameInput = screen.getByLabelText('Widget Name')
      const urlInput = screen.getByLabelText('API URL')

      fireEvent.change(nameInput, { target: { value: 'Test Widget' } })
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } })

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { price: 100 } }),
      })

      const testButton = screen.getByText('Test API Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText(/API connection successful/i)).toBeInTheDocument()
      })

      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        // Use getAllByText and check that field mapping step is shown
        const apiResponseHeaders = screen.getAllByText(/API Response/i)
        expect(apiResponseHeaders.length).toBeGreaterThan(0)
        expect(screen.getByText(/Widget Fields/i)).toBeInTheDocument()
      })
    })
  })

  describe('Widget Creation', () => {
    it('should create widget when Add Widget is clicked', async () => {
      render(
        <Provider store={store}>
          <AddWidgetModal isOpen={true} onClose={vi.fn()} />
        </Provider>
      )

      // Step 1: Configure API
      const nameInput = screen.getByLabelText('Widget Name')
      const urlInput = screen.getByLabelText('API URL')

      fireEvent.change(nameInput, { target: { value: 'Test Widget' } })
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } })

      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { price: 100 } }),
      })

      const testButton = screen.getByText('Test API Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText(/API connection successful/i)).toBeInTheDocument()
      })

      // Go to step 2
      let nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })

      // Go to step 3
      nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
      })

      // Add widget
      const addButton = screen.getByText('Add Widget')
      fireEvent.click(addButton)

      // Check that widget was added to store
      const state = store.getState()
      const widgets = state.widgets.entities
      expect(Object.keys(widgets)).toHaveLength(1)
      expect(Object.values(widgets)[0]?.title).toBe('Test Widget')
    })
  })
})

