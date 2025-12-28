'use client'

import { useState, useCallback, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectOption } from '@/components/ui/Select'
import { useAppDispatch } from '@/lib/store/hooks'
import { updateWidget } from '@/lib/store/slices/widgetsSlice'
import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'

interface WidgetConfigModalProps {
  isOpen: boolean
  onClose: () => void
  widget: WidgetWithPosition | null
}

const REFRESH_INTERVALS: SelectOption[] = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 0, label: 'Never' },
]

export function WidgetConfigModal({ isOpen, onClose, widget }: WidgetConfigModalProps) {
  const dispatch = useAppDispatch()
  const [title, setTitle] = useState(widget?.title || '')
  const [refreshInterval, setRefreshInterval] = useState(widget?.apiConfig?.refreshInterval || 60)

  // Update local state when widget changes
  useEffect(() => {
    if (widget) {
      setTitle(widget.title)
      setRefreshInterval(widget.apiConfig?.refreshInterval || 60)
    }
  }, [widget])

  const handleSave = useCallback(() => {
    if (!widget) return

    dispatch(updateWidget({
      id: widget.id,
      updates: {
        title,
        apiConfig: {
          ...widget.apiConfig,
          refreshInterval: Number(refreshInterval),
        },
      },
    }))

    onClose()
  }, [widget, title, refreshInterval, dispatch, onClose])

  if (!widget) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Widget"
      size="md"
    >
      <div className="space-y-6">
        <Input
          label="Widget Name"
          placeholder="e.g., Stock Prices"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Refresh Interval"
          options={REFRESH_INTERVALS}
          value={refreshInterval}
          onChange={(value) => setRefreshInterval(Number(value))}
          helperText="How often should this widget refresh its data?"
        />

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <h4 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            API Configuration
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">URL:</span>
              <span className="ml-2 text-neutral-600 dark:text-neutral-400 break-all">
                {widget.apiConfig.url}
              </span>
            </div>
            <div>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Method:</span>
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                {widget.apiConfig.method || 'GET'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

