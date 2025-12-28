import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'

/**
 * Figures out where to place a new widget on the dashboard.
 * Just puts it after the last widget in sequence.
 */
export function findNextPosition(
  existingWidgets: WidgetWithPosition[],
  widgetSize: { w: number; h: number } = { w: 1, h: 1 }, // Default: single grid cell
  maxColumns: number = 4 // Max columns for responsive grid
): { x: number; y: number; w: number; h: number } {
  // For the new responsive layout, we use sequential positioning
  // x represents the order/index, y is always 0 (single row conceptually)
  
  if (existingWidgets.length === 0) {
    return { x: 0, y: 0, w: widgetSize.w, h: widgetSize.h }
  }

  // Find the highest x position (last widget in sequence)
  const maxX = existingWidgets.reduce((max, widget) => {
    return Math.max(max, widget.position.x)
  }, -1)

  // Next position is simply the next index
  return { 
    x: maxX + 1, 
    y: 0, 
    w: widgetSize.w, 
    h: widgetSize.h 
  }
}

