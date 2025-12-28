'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string | number
  onChange?: (value: string | number) => void
  placeholder?: string
  label?: string
  error?: string
  helperText?: string
  disabled?: boolean
  className?: string
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ options, value, onChange, placeholder = 'Select...', label, error, helperText, disabled, className }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const selectRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
      
      return undefined
    }, [isOpen])

    // Handle keyboard navigation
    useEffect(() => {
      if (!isOpen) return undefined

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false)
          buttonRef.current?.focus()
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    const selectedOption = options.find((opt) => opt.value === value)
    const displayValue = selectedOption?.label || placeholder

    const handleSelect = (option: SelectOption): void => {
      if (option.disabled) return
      onChange?.(option.value)
      setIsOpen(false)
      buttonRef.current?.focus()
    }

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        <div ref={selectRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-neutral-700 dark:bg-neutral-800 dark:text-white',
              'transition-all duration-200',
              error && 'border-loss-500 focus:ring-loss-500',
              isOpen && 'ring-2 ring-primary-500 border-transparent',
              className
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className={cn('truncate', !selectedOption && 'text-neutral-400')}>
              {displayValue}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-neutral-400 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          {isOpen && (
            <div
              className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
              role="listbox"
            >
              <div className="max-h-60 overflow-auto p-1">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    disabled={option.disabled}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                      'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                      'focus:bg-neutral-100 focus:outline-none dark:focus:bg-neutral-700',
                      option.value === value && 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
                      option.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-loss-600 dark:text-loss-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select

