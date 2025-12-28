'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { Select, SelectOption } from '@/components/ui/Select'
import { WidgetContainer } from '@/components/widgets/WidgetContainer'
import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'
import type { WidgetType } from '@/types/widget'

interface PreviewStepProps {
  widget: Partial<WidgetWithPosition>
  onChange: (config: Partial<WidgetWithPosition>) => void
}

const WIDGET_TYPES: SelectOption[] = [
  { value: 'table', label: 'Table' },
  { value: 'card', label: 'Card' },
  { value: 'chart', label: 'Chart' },
  { value: 'metric', label: 'Metric' },
]

const TABLE_SETTINGS_OPTIONS = {
  rowsPerPage: [
    { value: 10, label: '10 rows' },
    { value: 25, label: '25 rows' },
    { value: 50, label: '50 rows' },
    { value: 100, label: '100 rows' },
  ] as SelectOption[],
}

const CARD_LAYOUT_OPTIONS: SelectOption[] = [
  { value: 'single', label: 'Single Card' },
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
]

const CHART_TYPE_OPTIONS: SelectOption[] = [
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'candlestick', label: 'Candlestick' },
]

export function PreviewStep({ widget, onChange }: PreviewStepProps) {
  const settings = widget.settings || {}

  const widgetId = useMemo(() => {
    // Create a temporary ID for preview
    return `preview-${Date.now()}`
  }, [])

  const handleSettingChange = (key: string, value: unknown) => {
    onChange({
      ...widget,
      settings: {
        ...settings,
        [key]: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Widget Title - can be edited here too */}
      <Input
        label="Widget Title"
        placeholder="Enter widget title"
        value={widget.title || ''}
        onChange={(e) => onChange({ ...widget, title: e.target.value })}
        helperText="This will be displayed as the widget header"
      />

      {/* Type-specific Settings */}
      {widget.type === 'table' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Table Settings
          </h4>
          <Select
            label="Rows Per Page"
            options={TABLE_SETTINGS_OPTIONS.rowsPerPage}
            value={(typeof settings.rowsPerPage === 'number' ? settings.rowsPerPage : 25)}
            onChange={(value) => handleSettingChange('rowsPerPage', Number(value))}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.sortable !== false}
                onChange={(e) => handleSettingChange('sortable', e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Sortable
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.filterable !== false}
                onChange={(e) => handleSettingChange('filterable', e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Filterable
              </span>
            </label>
          </div>
        </div>
      )}

      {widget.type === 'card' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Card Settings
          </h4>
          <Select
            label="Layout Mode"
            options={CARD_LAYOUT_OPTIONS}
            value={(typeof settings.layout === 'string' ? settings.layout : 'single')}
            onChange={(value) => handleSettingChange('layout', value)}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.showSparkline === true}
              onChange={(e) => handleSettingChange('showSparkline', e.target.checked)}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Show Sparkline
            </span>
          </label>
        </div>
      )}

      {widget.type === 'chart' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Chart Settings
          </h4>
          <Select
            label="Chart Type"
            options={CHART_TYPE_OPTIONS}
            value={(typeof settings.chartType === 'string' ? settings.chartType : 'line')}
            onChange={(value) => handleSettingChange('chartType', value)}
          />
          <Select
            label="Time Interval"
            options={[
              { value: 'daily', label: 'Daily - End-of-day prices (recommended for most use cases)' },
              { value: 'weekly', label: 'Weekly - Weekly adjusted prices' },
              { value: 'monthly', label: 'Monthly - Monthly adjusted prices' },
              { value: 'intraday', label: 'Intraday - Real-time intraday prices (requires interval parameter)' },
            ]}
            value={(typeof settings.timeInterval === 'string' ? settings.timeInterval : 'daily')}
            onChange={(value) => handleSettingChange('timeInterval', value)}
            helperText={
              settings.timeInterval === 'intraday' 
                ? 'Intraday requires Alpha Vantage TIME_SERIES_INTRADAY endpoint with interval parameter (e.g., 1min, 5min, 15min, 30min, 60min)'
                : settings.timeInterval === 'daily'
                ? 'Best for daily stock price analysis. Works with Alpha Vantage TIME_SERIES_DAILY endpoint.'
                : settings.timeInterval === 'weekly'
                ? 'Shows weekly aggregated data. Works with Alpha Vantage TIME_SERIES_WEEKLY endpoint.'
                : 'Shows monthly aggregated data. Works with Alpha Vantage TIME_SERIES_MONTHLY endpoint.'
            }
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Indicators
            </label>
            <div className="flex flex-wrap gap-2">
              {['sma', 'ema', 'volume'].map((indicator) => (
                <label key={indicator} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(settings.indicators as string[])?.includes(indicator) || false}
                    onChange={(e) => {
                      const current = (settings.indicators as string[]) || []
                      const updated = e.target.checked
                        ? [...current, indicator]
                        : current.filter((i) => i !== indicator)
                      handleSettingChange('indicators', updated)
                    }}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {indicator.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h4 className="mb-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Preview
        </h4>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            Note: Preview will show actual data once the widget is added to the dashboard.
          </p>
          {/* Widget preview would go here - for now just show a placeholder */}
          <div className="flex h-48 items-center justify-center rounded border-2 border-dashed border-neutral-300 dark:border-neutral-600">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Widget Preview ({widget.type || 'table'})
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

