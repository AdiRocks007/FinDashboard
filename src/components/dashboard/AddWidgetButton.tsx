'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface AddWidgetButtonProps {
  onClick: () => void
  className?: string
  variant?: 'default' | 'compact' | 'floating'
}

const AddWidgetButton: React.FC<AddWidgetButtonProps> = ({
  onClick,
  className,
  variant = 'default'
}) => {
  if (variant === 'floating') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          className
        )}
        aria-label="Add widget"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 4v16m8-8H4" />
        </svg>
      </button>
    )
  }
  
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          className
        )}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 4v16m8-8H4" />
        </svg>
        Add Widget
      </button>
    )
  }
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative min-h-[200px] w-full overflow-hidden rounded-lg border-2 border-dashed border-[#22c55e] bg-transparent p-8 transition-all hover:border-[#16a34a] hover:bg-[#22c55e]/5 focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:ring-offset-2 focus:ring-offset-[#0a0e27]',
        className
      )}
    >
      <div className="flex flex-col items-center justify-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e] transition-transform group-hover:scale-110">
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 4v16m8-8H4" />
          </svg>
        </div>
        
        <h3 className="mb-2 text-base font-medium text-white">
          Add Widget
        </h3>
        
        <p className="text-sm text-neutral-400">
          Connect to a finance API and create a custom widget
        </p>
      </div>
    </button>
  )
}

/**
 * Widget menu button with dropdown
 */
export const WidgetMenuButton: React.FC<{
  onAddWidget: () => void
  onImportDashboard?: () => void
  onExportDashboard?: () => void
}> = ({ onAddWidget, onImportDashboard, onExportDashboard }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  
  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 4v16m8-8H4" />
        </svg>
        Add Widget
        <svg
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          <div className="py-1">
            <button
              onClick={() => {
                onAddWidget()
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Widget
            </button>
            
            {onImportDashboard && (
              <button
                onClick={() => {
                  onImportDashboard()
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Dashboard
              </button>
            )}
            
            {onExportDashboard && (
              <button
                onClick={() => {
                  onExportDashboard()
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AddWidgetButton
export { AddWidgetButton }

