'use client'

import { useTheme } from '@/components/providers/ThemeProvider'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 p-1 bg-neutral-200 dark:bg-neutral-700 rounded-lg">
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'p-2 rounded transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-600',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          theme === 'light' && 'bg-white dark:bg-neutral-600 shadow-sm'
        )}
        aria-label="Light mode"
        title="Light mode"
      >
        <Sun className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'p-2 rounded transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-600',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          theme === 'dark' && 'bg-white dark:bg-neutral-600 shadow-sm'
        )}
        aria-label="Dark mode"
        title="Dark mode"
      >
        <Moon className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={cn(
          'p-2 rounded transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-600',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          theme === 'system' && 'bg-white dark:bg-neutral-600 shadow-sm'
        )}
        aria-label="System mode"
        title="Use system preference"
      >
        <Monitor className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
      </button>
    </div>
  )
}

