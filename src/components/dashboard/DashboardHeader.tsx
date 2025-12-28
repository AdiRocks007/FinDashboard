'use client'

import { useAppSelector, useAppDispatch } from '@/lib/store/hooks'
import { toggleEditMode } from '@/lib/store/slices/dashboardSlice'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Edit2, Eye, Settings } from 'lucide-react'

/**
 * Dashboard header with edit mode toggle and theme switcher
 */
export function DashboardHeader() {
  const isEditMode = useAppSelector((state) => state.dashboard.isEditMode)
  const dispatch = useAppDispatch()

  const handleToggleEditMode = () => {
    dispatch(toggleEditMode())
  }

  const widgets = useAppSelector((state) => state.widgets?.ids?.length || 0)
  
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0e27]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#22c55e]">
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Finance Dashboard
            </h1>
            <p className="text-xs text-neutral-400">
              {widgets} active widget{widgets !== 1 ? 's' : ''} • Real-time data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Widget Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openAddWidgetModal'))
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16a34a] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:ring-offset-2 focus:ring-offset-[#0a0e27]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Widget
          </button>
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

