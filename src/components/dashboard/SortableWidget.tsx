'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WidgetContainer } from '@/components/widgets/WidgetContainer'
import { cn } from '@/lib/utils/cn'
import type { WidgetWithPosition } from '@/lib/store/slices/widgetsSlice'

interface SortableWidgetProps {
  widget: WidgetWithPosition
  isDragging: boolean
  isEditMode: boolean
}

/**
 * Sortable widget wrapper for dnd-kit
 * Handles drag interactions and visual feedback
 * Now supports dragging from the header area for better UX
 */
export const SortableWidget = memo<SortableWidgetProps>(({ 
  widget, 
  isDragging, 
  isEditMode 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: widget.id,
    // Allow dragging even when not in edit mode for better UX
    disabled: false
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
    cursor: isSortableDragging ? 'grabbing' : 'default',
    willChange: isSortableDragging ? 'transform' : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'relative w-full h-full transition-all duration-200',
        'flex flex-col', // Ensure proper flex layout
        isSortableDragging && 'z-50',
        isDragging && 'scale-105 shadow-2xl'
      )}
    >
      <WidgetContainer 
        widgetId={widget.id} 
        isDragging={isDragging}
        dragListeners={listeners}
        isEditMode={isEditMode}
      />
    </div>
  )
})

SortableWidget.displayName = 'SortableWidget'

