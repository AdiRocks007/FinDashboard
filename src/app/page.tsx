'use client'

import { useState, useEffect } from 'react'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import AddWidgetButton from '@/components/dashboard/AddWidgetButton'
import { AddWidgetModal } from '@/components/modals/AddWidgetModal'
import { useAppSelector } from '@/lib/store/hooks'
import { selectAllWidgets } from '@/lib/store/slices/widgetsSlice'

/**
 * Main dashboard page with drag-and-drop grid layout
 */
export default function DashboardPage() {
  const widgets = useAppSelector(selectAllWidgets)
  const isEditMode = useAppSelector((state) => state.dashboard.isEditMode)
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false)

  // Listen for custom event to open modal
  useEffect(() => {
    const handleOpenModal = () => setIsAddWidgetModalOpen(true)
    window.addEventListener('openAddWidgetModal', handleOpenModal as EventListener)
    return () => window.removeEventListener('openAddWidgetModal', handleOpenModal as EventListener)
  }, [])

  return (
    <main className="min-h-screen bg-[#0a0e27]">
      <DashboardHeader />
      
      {widgets.length === 0 ? (
        <div className="flex min-h-[calc(100vh-100px)] items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e]/10">
                <svg className="h-8 w-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-semibold text-white">
              Build Your Finance Dashboard
            </h2>
            <p className="mb-8 text-sm text-neutral-400">
              Create custom widgets by connecting to any finance API. Track stocks, cryptocurrencies, and more.
            </p>
            <AddWidgetButton 
              onClick={() => setIsAddWidgetModalOpen(true)}
              variant="default"
            />
          </div>
        </div>
      ) : (
        <DashboardGrid />
      )}
      
      {/* Floating Add Widget Button (only in edit mode) */}
      {isEditMode && widgets.length > 0 && (
        <div className="fixed bottom-8 right-8 z-40">
          <AddWidgetButton
            onClick={() => setIsAddWidgetModalOpen(true)}
            variant="floating"
          />
        </div>
      )}

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={isAddWidgetModalOpen}
        onClose={() => setIsAddWidgetModalOpen(false)}
      />
    </main>
  )
}