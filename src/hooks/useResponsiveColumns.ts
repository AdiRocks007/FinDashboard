'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to get responsive grid columns based on screen width
 * Returns 1-4 columns based on breakpoints:
 * - Mobile (< 640px): 1 column
 * - Tablet (640px - 1024px): 2 columns
 * - Desktop (1024px - 1536px): 3 columns
 * - Large desktop (>= 1536px): 4 columns
 */
export function useResponsiveColumns(): number {
  const [columns, setColumns] = useState(3)

  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') {
      return
    }

    function updateColumns() {
      const width = window.innerWidth
      if (width < 640) {
        setColumns(1) // Mobile
      } else if (width < 1024) {
        setColumns(2) // Tablet
      } else if (width < 1536) {
        setColumns(3) // Desktop
      } else {
        setColumns(4) // Large desktop
      }
    }

    // Set initial value
    updateColumns()

    // Listen for resize events
    window.addEventListener('resize', updateColumns)
    
    // Cleanup
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  return columns
}

