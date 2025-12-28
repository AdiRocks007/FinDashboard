import { Widget } from './widget'

export interface Dashboard {
  id: string
  name: string
  description?: string
  widgets: Widget[]
  layout: DashboardLayout
  settings: DashboardSettings
  createdAt: string
  updatedAt: string
}

export interface DashboardLayout {
  columns: number
  rowHeight: number
  margin: [number, number]
  containerPadding: [number, number]
  breakpoints: Record<string, number>
  cols: Record<string, number>
}

export interface DashboardSettings {
  theme: 'light' | 'dark' | 'auto'
  autoRefresh: boolean
  refreshInterval: number
  showGrid: boolean
  snapToGrid: boolean
  allowResize: boolean
  allowDrag: boolean
}

export interface GridItem {
  i: string // widget id
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}