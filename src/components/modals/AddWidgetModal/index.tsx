'use client'

import { useState, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ApiConfigStep } from './ApiConfigStep'
import { FieldMappingStep } from './FieldMappingStep'
import { PreviewStep } from './PreviewStep'
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks'
import { addWidget, selectAllWidgets } from '@/lib/store/slices/widgetsSlice'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils/cn'
import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'
import type { WidgetType } from '@/types/widget'
import { centralizedFetch } from '@/lib/services/centralizedApiService'
import { findNextPosition } from '@/lib/utils/findNextPosition'

interface AddWidgetModalProps {
  isOpen: boolean
  onClose: () => void
}

interface StepIndicatorProps {
  current: number
  total: number
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  step === current
                    ? 'bg-primary-600 text-white'
                    : step < current
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                )}
              >
                {step}
              </div>
              {step < total && (
                <div
                  className={cn(
                    'h-1 flex-1 transition-colors',
                    step < current
                      ? 'bg-primary-600'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                  )}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
        Step {current} of {total}
      </div>
    </div>
  )
}

export function AddWidgetModal({ isOpen, onClose }: AddWidgetModalProps) {
  const dispatch = useAppDispatch()
  const existingWidgets = useAppSelector(selectAllWidgets)
  const [currentStep, setCurrentStep] = useState(1)
  const [widgetConfig, setWidgetConfig] = useState<Partial<WidgetWithPosition>>({
    type: 'table',
    apiConfig: {
      url: '',
      method: 'GET',
      headers: {},
      queryParams: {},
      refreshInterval: 60,
    },
    fieldMapping: {},
    settings: {},
    position: { x: 0, y: 0, w: 1, h: 1 },
    size: { width: 0, height: 0 },
    config: {},
  })
  const [apiResponse, setApiResponse] = useState<any>(null)

  const handleNextStep = useCallback(() => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!widgetConfig.title?.trim()) {
        alert('Please enter a widget name')
        return
      }
      if (!widgetConfig.apiConfig?.url?.trim()) {
        alert('Please enter an API URL')
        return
      }
      try {
        new URL(widgetConfig.apiConfig.url)
      } catch {
        alert('Please enter a valid URL')
        return
      }
    }
    if (currentStep === 2 && !apiResponse) {
      alert('Please test the API connection first')
      return
    }
    setCurrentStep((s) => Math.min(s + 1, 3))
  }, [currentStep, widgetConfig, apiResponse])

  const handlePrevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }, [])

  const handleApiTest = useCallback(async (responses: any[] = []) => {
    if (!widgetConfig.apiConfig?.url) {
      throw new Error('API URL is required')
    }

    try {
      // If responses array is provided (multi-symbol), combine them
      if (responses.length > 0) {
        // Combine all responses into a single array for preview
        setApiResponse(responses)
        return
      }

      // Single API call (original logic)
      const proxyUrl = new URL('/api/proxy', window.location.origin)
      proxyUrl.searchParams.set('url', widgetConfig.apiConfig.url)
      
      // Add query parameters if any
      if (widgetConfig.apiConfig.queryParams) {
        Object.entries(widgetConfig.apiConfig.queryParams).forEach(([key, value]) => {
          if (value) {
            proxyUrl.searchParams.append(key, String(value))
          }
        })
      }

      // Use centralized API service (handles deduplication, caching, and queue)
      const response = await centralizedFetch(proxyUrl.toString(), {
        method: widgetConfig.apiConfig.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...widgetConfig.apiConfig.headers,
        },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        let errorMessage = `API request failed: ${errorText || response.statusText}`
        
        // Try to parse JSON error if available
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          // Not JSON, use text
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setApiResponse(data.data || data)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to connect to API')
    }
  }, [widgetConfig.apiConfig])

  const handleAddWidget = useCallback(() => {
    // Final validation
    if (!widgetConfig.title?.trim()) {
      alert('Please enter a widget name')
      return
    }
    if (!widgetConfig.apiConfig?.url?.trim()) {
      alert('Please enter an API URL')
      return
    }
    if (!widgetConfig.type) {
      alert('Please select a widget type')
      return
    }

    // For the new responsive layout, widgets use different sizing based on type
    // Charts: half width (2 columns), Tables: full width (4 columns), Cards: single column (1 column)
    const widgetSize = widgetConfig.type === 'chart' 
      ? { w: 2, h: 2 } // Charts: 2 columns wide, 2 rows tall
      : widgetConfig.type === 'table'
      ? { w: 4, h: 2 } // Tables: 4 columns wide, 2 rows tall
      : { w: 1, h: 1 } // Cards: 1 column wide, 1 row tall
    
    // Find the next available position using sequential positioning
    const nextPosition = findNextPosition(existingWidgets, widgetSize, 4)

    // Create the widget
    const newWidget: WidgetWithPosition = {
      id: nanoid(),
      type: widgetConfig.type as WidgetType,
      title: widgetConfig.title,
      apiConfig: widgetConfig.apiConfig!,
      fieldMapping: widgetConfig.fieldMapping || {},
      settings: widgetConfig.settings || {},
      position: nextPosition,
      size: widgetConfig.size || { width: 0, height: 0 },
      config: widgetConfig.config || {},
      lastUpdated: Date.now(),
      isLoading: false,
    }

    // Dispatch to Redux
    dispatch(addWidget(newWidget))

    // Reset and close
    setCurrentStep(1)
    setWidgetConfig({
      type: 'table',
      apiConfig: {
        url: '',
        method: 'GET',
        headers: {},
        queryParams: {},
        refreshInterval: 60,
      },
      fieldMapping: {},
      settings: {},
      position: { x: 0, y: 0, w: 1, h: 1 },
      size: { width: 0, height: 0 },
      config: {},
    })
    setApiResponse(null)
    onClose()

    // Show success message (you could use a toast library here)
    console.log('Widget added successfully!')
  }, [widgetConfig, existingWidgets, dispatch, onClose])

  const handleClose = useCallback(() => {
    // Reset state when closing
    setCurrentStep(1)
    setWidgetConfig({
      type: 'table',
      apiConfig: {
        url: '',
        method: 'GET',
        headers: {},
        queryParams: {},
        refreshInterval: 60,
      },
      fieldMapping: {},
      settings: {},
      position: { x: 0, y: 0, w: 1, h: 1 },
      size: { width: 0, height: 0 },
      config: {},
    })
    setApiResponse(null)
    onClose()
  }, [onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Widget"
      size="xl"
      closeOnOverlayClick={false}
    >
      {/* Step indicator */}
      <StepIndicator current={currentStep} total={3} />

      {/* Step content */}
      {currentStep === 1 && (
        <ApiConfigStep
          config={widgetConfig}
          onChange={setWidgetConfig}
          onTest={handleApiTest}
          apiResponse={apiResponse}
        />
      )}

      {currentStep === 2 && (
        <FieldMappingStep
          widgetType={widgetConfig.type || 'table'}
          apiResponse={apiResponse}
          fieldMapping={widgetConfig.fieldMapping || {}}
          onChange={(mapping) =>
            setWidgetConfig({ ...widgetConfig, fieldMapping: mapping })
          }
        />
      )}

      {currentStep === 3 && (
        <PreviewStep widget={widgetConfig} onChange={setWidgetConfig} />
      )}

      {/* Navigation buttons */}
      <div className="mt-6 flex justify-between border-t border-neutral-800 pt-4">
        <Button
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          variant="outline"
        >
          Previous
        </Button>

        {currentStep < 3 ? (
          <Button onClick={handleNextStep}>Next</Button>
        ) : (
          <Button onClick={handleAddWidget}>Add Widget</Button>
        )}
      </div>
    </Modal>
  )
}

