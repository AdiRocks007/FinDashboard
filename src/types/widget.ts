export interface Widget {
  id: string
  type: WidgetType
  title: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  config: WidgetConfig
  data?: unknown
  lastUpdated?: string
  isLoading?: boolean
  error?: string | undefined
}

export type WidgetType = 'table' | 'card' | 'chart' | 'metric'

export interface WidgetConfig {
  apiEndpoint?: string
  refreshInterval?: number
  dataPath?: string
  fields?: WidgetFieldMapping[]
  chartType?: ChartType
  theme?: 'light' | 'dark'
  showHeader?: boolean
  showBorder?: boolean
}

export interface WidgetFieldMapping {
  key: string
  label: string
  type: 'string' | 'number' | 'currency' | 'percentage' | 'date'
  format?: string
  visible?: boolean
}

export type ChartType = 'line' | 'bar' | 'area' | 'candlestick' | 'pie' | 'donut'

export interface WidgetTemplate {
  id: string
  name: string
  description: string
  type: WidgetType
  defaultConfig: WidgetConfig
  previewImage?: string
}