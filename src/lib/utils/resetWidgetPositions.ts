import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'

/**
 * Reset all widget positions to sequential order
 * This is useful when switching layout systems or fixing positioning issues
 */
export function resetWidgetPositions(widgets: WidgetWithPosition[]): Array<{ id: string; position: { x: number; y: number; w: number; h: number } }> {
  return widgets.map((widget, index) => ({
    id: widget.id,
    position: {
      x: index, // Sequential order
      y: 0,     // All on same conceptual row
      w: 1,     // Single grid cell
      h: 1,     // Single grid cell
    },
  }))
}