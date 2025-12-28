import React from 'react'
import { cn } from '@/lib/utils/cn'

interface WidgetPlaceholderProps {
  message?: string
  icon?: React.ReactNode
  className?: string
  onClick?: () => void
}

const WidgetPlaceholder: React.FC<WidgetPlaceholderProps> = ({
  message = 'No data available',
  icon,
  className,
  onClick
}) => {
  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center transition-colors dark:border-neutral-700 dark:bg-neutral-900/50',
        onClick && 'cursor-pointer hover:border-primary-400 hover:bg-neutral-100 dark:hover:border-primary-600 dark:hover:bg-neutral-800',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      {icon || (
        <svg
          className="mb-4 h-12 w-12 text-neutral-400 dark:text-neutral-600"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      )}
      
      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {message}
      </p>
      
      {onClick && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
          Click to add a widget
        </p>
      )}
    </div>
  )
}

/**
 * Empty dashboard placeholder
 */
export const EmptyDashboard: React.FC<{
  onAddWidget: () => void
}> = ({ onAddWidget }) => {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <svg
          className="mx-auto mb-6 h-24 w-24 text-neutral-300 dark:text-neutral-700"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        
        <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">
          Your dashboard is empty
        </h3>
        
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Start building your personalized finance dashboard by adding widgets to track your
          investments, view market data, and monitor your portfolio.
        </p>
        
        <button
          onClick={onAddWidget}
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
          Add Your First Widget
        </button>
      </div>
    </div>
  )
}

/**
 * Loading placeholder for widgets
 */
export const WidgetLoadingPlaceholder: React.FC = () => {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-500" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading widget...</p>
      </div>
    </div>
  )
}

/**
 * Error placeholder for widgets
 */
export const WidgetErrorPlaceholder: React.FC<{
  error: string
  onRetry?: () => void
}> = ({ error, onRetry }) => {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-loss-200 bg-loss-50 p-8 text-center dark:border-loss-800 dark:bg-loss-900/20">
      <svg
        className="mb-4 h-10 w-10 text-loss-500"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      
      <p className="mb-4 text-sm font-medium text-loss-700 dark:text-loss-300">{error}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-loss-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-loss-700 focus:outline-none focus:ring-2 focus:ring-loss-500 focus:ring-offset-2"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

export default WidgetPlaceholder

