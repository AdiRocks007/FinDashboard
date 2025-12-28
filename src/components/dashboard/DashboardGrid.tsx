'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragCancelEvent,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useAppSelector, useAppDispatch } from '@/lib/store/hooks'
import { 
  selectAllWidgets, 
  batchUpdatePositions,
  setDraggedWidget
} from '@/lib/store/slices/widgetsSlice'
import { SortableWidget } from './SortableWidget'
import { WidgetContainer } from '@/components/widgets/WidgetContainer'
import { resetWidgetPositions } from '@/lib/utils/resetWidgetPositions'
import { cn } from '@/lib/utils/cn'

/**
 * The main dashboard grid that holds all your widgets.
 * Supports drag and drop - just hover over a widget header and drag it around.
 * Automatically arranges widgets in a responsive grid layout.
 */
export function DashboardGrid() {
  const widgets = useAppSelector(selectAllWidgets)
  const isEditMode = useAppSelector((state) => state.dashboard.isEditMode)
  const dispatch = useAppDispatch()
  
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Type for pending position updates
  type PendingUpdate = {
    id: string
    position: { x: number; y: number; w: number; h: number }
  }
  
  // Debounce timer for position updates
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdatesRef = useRef<PendingUpdate[]>([])

  // Sensor configuration with activation constraints
  // PointerSensor handles both mouse and touch events
  // Optimized for hella responsive dragging from header
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // Very responsive - activate after just 1px movement
        delay: 0, // No delay for instant activation
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Memoize widget IDs for SortableContext
  const widgetIds = useMemo(() => widgets.map((w) => w.id), [widgets])

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    console.log('🎯 Drag started:', id)
    setActiveId(id)
    dispatch(setDraggedWidget(id))
    
    // Haptic feedback on mobile devices
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
    
    // Screen reader announcement
    if (typeof window !== 'undefined') {
      const widget = widgets.find((w) => w.id === id)
      const announcement = widget 
        ? `Started dragging widget: ${widget.title}. Use arrow keys to move, Space to drop.`
        : 'Started dragging widget.'
      
      // Create temporary aria-live region for announcement
      const announcementEl = document.createElement('div')
      announcementEl.setAttribute('role', 'status')
      announcementEl.setAttribute('aria-live', 'polite')
      announcementEl.className = 'sr-only'
      announcementEl.textContent = announcement
      document.body.appendChild(announcementEl)
      
      setTimeout(() => {
        document.body.removeChild(announcementEl)
      }, 1000)
    }
  }, [widgets, dispatch])

  // Debounced position update function
  const flushPositionUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length > 0) {
      dispatch(batchUpdatePositions(pendingUpdatesRef.current))
      pendingUpdatesRef.current = []
    }
  }, [dispatch])

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    console.log('🎯 Drag ended:', { activeId: active.id, overId: over?.id })
    
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id)
      const newIndex = widgets.findIndex((w) => w.id === over.id)
      
      console.log('🔄 Reordering widgets:', { oldIndex, newIndex })
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Simple reordering - just update the order, no complex positioning
        const reorderedWidgets = arrayMove(widgets, oldIndex, newIndex)
        
        // Update positions based on new order (simple sequential positioning)
        const updates = reorderedWidgets.map((widget, index) => ({
          id: widget.id,
          position: {
            x: index, // Simple sequential x position
            y: 0,     // All widgets on same row level
            w: widget.position.w || 1,
            h: widget.position.h || 1,
          },
        }))
        
        console.log('📝 Batch updating positions:', updates)
        
        // Batch update positions immediately (no debounce on drag end)
        dispatch(batchUpdatePositions(updates))
        
        // Screen reader announcement
        if (typeof window !== 'undefined') {
          const widget = widgets.find((w) => w.id === active.id)
          const announcement = widget
            ? `Moved widget ${widget.title} to position ${newIndex + 1}.`
            : `Widget moved to position ${newIndex + 1}.`
          
          const announcementEl = document.createElement('div')
          announcementEl.setAttribute('role', 'status')
          announcementEl.setAttribute('aria-live', 'polite')
          announcementEl.className = 'sr-only'
          announcementEl.textContent = announcement
          document.body.appendChild(announcementEl)
          
          setTimeout(() => {
            document.body.removeChild(announcementEl)
          }, 1000)
        }
      }
    }
    
    setActiveId(null)
    dispatch(setDraggedWidget(null))
  }, [widgets, dispatch])

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    
    // Flush any pending updates
    flushPositionUpdates()
    
    setActiveId(null)
    dispatch(setDraggedWidget(null))
    
    // Screen reader announcement
    if (typeof window !== 'undefined') {
      const announcementEl = document.createElement('div')
      announcementEl.setAttribute('role', 'status')
      announcementEl.setAttribute('aria-live', 'polite')
      announcementEl.className = 'sr-only'
      announcementEl.textContent = 'Drag cancelled.'
      document.body.appendChild(announcementEl)
      
      setTimeout(() => {
        document.body.removeChild(announcementEl)
      }, 1000)
    }
  }, [dispatch, flushPositionUpdates])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      flushPositionUpdates()
    }
  }, [flushPositionUpdates])

  // Normalize widget positions on mount (fix any legacy positioning)
  useEffect(() => {
    if (widgets.length > 0) {
      console.log('🔍 Current widget positions:', widgets.map(w => ({ id: w.id, title: w.title, position: w.position })))
      
      // Check if positions need normalization
      const needsNormalization = widgets.some((widget, index) => 
        widget.position.x !== index || widget.position.y !== 0
      )
      
      if (needsNormalization) {
        console.log('🔧 Normalizing widget positions for responsive grid')
        const updates = resetWidgetPositions(widgets)
        console.log('📝 Position updates:', updates)
        dispatch(batchUpdatePositions(updates))
      } else {
        console.log('✅ Widget positions are already normalized')
      }
    }
  }, [widgets.length]) // Run when widget count changes

  // Get active widget for drag overlay
  const activeWidget = useMemo(() => {
    return activeId ? widgets.find((w) => w.id === activeId) : null
  }, [activeId, widgets])

  // Sort widgets by position.x (order) for proper display sequence
  const sortedWidgets = useMemo(() => {
    return [...widgets].sort((a, b) => {
      // Sort by x position (which represents order in the new system)
      return a.position.x - b.position.x
    })
  }, [widgets])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            const widget = widgets.find((w) => w.id === active.id)
            return widget 
              ? `Picked up widget ${widget.title}. Use arrow keys to move, Space to drop.`
              : 'Picked up widget.'
          },
          onDragOver({ active, over }) {
            if (!over) return ''
            const widget = widgets.find((w) => w.id === active.id)
            const overWidget = widgets.find((w) => w.id === over.id)
            return widget && overWidget
              ? `Moving ${widget.title} over ${overWidget.title}.`
              : 'Moving widget.'
          },
          onDragEnd({ active, over }) {
            if (!over || active.id === over.id) return ''
            const widget = widgets.find((w) => w.id === active.id)
            return widget
              ? `Dropped ${widget.title}.`
              : 'Dropped widget.'
          },
          onDragCancel({ active }) {
            const widget = widgets.find((w) => w.id === active.id)
            return widget
              ? `Cancelled dragging ${widget.title}.`
              : 'Cancelled dragging.'
          },
        },
      }}
    >
      <SortableContext
        items={widgetIds}
        strategy={rectSortingStrategy}
      >
        <div
          className={cn(
            "p-6 min-h-screen",
            "grid gap-4 auto-rows-min",
            // Responsive grid columns - 4 columns on desktop for half-width charts
            "grid-cols-1", // Mobile: 1 column
            "sm:grid-cols-2", // Tablet: 2 columns  
            "lg:grid-cols-4", // Desktop: 4 columns (allows 2 charts side by side)
            "xl:grid-cols-4" // Large desktop: 4 columns
          )}
          role="grid"
          aria-label="Dashboard widgets"
        >
          {sortedWidgets.map((widget) => {
            // Determine widget size based on type
            const isTable = widget.type === 'table'
            const isChart = widget.type === 'chart'
            
            return (
              <div
                key={widget.id}
                className={cn(
                  "w-full",
                  // Tables span full width on all screen sizes
                  isTable && "col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-4 min-h-[400px]",
                  // Charts span half width (2 columns) on large screens, full width on mobile
                  isChart && "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2 min-h-[500px]",
                  // Cards take single column with fixed height
                  !isTable && !isChart && "col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1 h-[300px]"
                )}
              >
                <SortableWidget
                  widget={widget}
                  isDragging={activeId === widget.id}
                  isEditMode={isEditMode}
                />
              </div>
            )
          })}
        </div>
      </SortableContext>

      {/* Drag overlay - shows widget being dragged */}
      <DragOverlay>
        {activeId && activeWidget ? (
          <div
            className="rotate-2 shadow-2xl"
            style={{
              cursor: 'grabbing',
              transform: 'rotate(2deg)',
            }}
          >
            <WidgetContainer widgetId={activeId} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
