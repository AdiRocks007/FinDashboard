'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface JSONExplorerProps {
  data: unknown
  name?: string
  defaultExpanded?: boolean
  maxDepth?: number
  currentDepth?: number
  basePath?: string
  onFieldClick?: ((path: string) => void) | undefined
  selectedPath?: string | undefined
}

export const JSONExplorer: React.FC<JSONExplorerProps> = ({
  data,
  name,
  defaultExpanded = false,
  maxDepth = Infinity,
  currentDepth = 0,
  basePath = '',
  onFieldClick,
  selectedPath
}) => {
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded || currentDepth < 2
  )
  
  const toggleExpand = () => setIsExpanded(!isExpanded)
  
  // Build full path for this field
  const currentPath = basePath ? `${basePath}.${name || ''}` : (name || '')
  const isSelected = selectedPath === currentPath
  const isClickable = onFieldClick && (typeof data !== 'object' || data === null || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data as Record<string, unknown>).length === 0))
  
  // Handle field click
  const handleFieldClick = () => {
    if (isClickable && onFieldClick) {
      onFieldClick(currentPath)
    }
  }

  // Render primitive values
  if (data === null) {
    return (
      <span 
        className={cn(
          'text-neutral-500',
          isClickable && 'cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300',
          isSelected && 'bg-primary-100 dark:bg-primary-900/30 px-1 rounded'
        )}
        onClick={handleFieldClick}
      >
        null
      </span>
    )
  }
  
  if (data === undefined) {
    return (
      <span 
        className={cn(
          'text-neutral-500',
          isClickable && 'cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300',
          isSelected && 'bg-primary-100 dark:bg-primary-900/30 px-1 rounded'
        )}
        onClick={handleFieldClick}
      >
        undefined
      </span>
    )
  }
  
  if (typeof data === 'string') {
    return (
      <span 
        className={cn(
          'text-gain-600 dark:text-gain-400',
          isClickable && 'cursor-pointer hover:underline',
          isSelected && 'bg-primary-100 dark:bg-primary-900/30 px-1 rounded'
        )}
        onClick={handleFieldClick}
      >
        &quot;{data}&quot;
      </span>
    )
  }
  
  if (typeof data === 'number') {
    return (
      <span 
        className={cn(
          'text-primary-600 dark:text-primary-400',
          isClickable && 'cursor-pointer hover:underline',
          isSelected && 'bg-primary-100 dark:bg-primary-900/30 px-1 rounded'
        )}
        onClick={handleFieldClick}
      >
        {data}
      </span>
    )
  }
  
  if (typeof data === 'boolean') {
    return (
      <span 
        className={cn(
          'text-loss-600 dark:text-loss-400',
          isClickable && 'cursor-pointer hover:underline',
          isSelected && 'bg-primary-100 dark:bg-primary-900/30 px-1 rounded'
        )}
        onClick={handleFieldClick}
      >
        {String(data)}
      </span>
    )
  }
  
  // Render arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-neutral-500">[]</span>
    }
    
    if (currentDepth >= maxDepth) {
      return (
        <span className="text-neutral-500 italic">
          Array[{data.length}] (max depth reached)
        </span>
      )
    }
    
    return (
      <div className="font-mono text-sm">
        <button
          onClick={toggleExpand}
          className="flex items-center gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
        >
          <span className={cn('transition-transform', isExpanded && 'rotate-90')}>
            ▶
          </span>
          {name && <span className="font-medium">{name}: </span>}
          <span className="text-neutral-500">Array[{data.length}]</span>
        </button>
        
        {isExpanded && (
          <div className="ml-4 mt-1 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
            {data.map((item, index) => (
              <div key={index} className="py-1">
                <JSONExplorer
                  data={item}
                  name={String(index)}
                  defaultExpanded={defaultExpanded}
                  maxDepth={maxDepth}
                  currentDepth={currentDepth + 1}
                  basePath={currentPath}
                  onFieldClick={onFieldClick}
                  selectedPath={selectedPath}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  // Render objects
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    
    if (entries.length === 0) {
      return <span className="text-neutral-500">{'{}'}</span>
    }
    
    if (currentDepth >= maxDepth) {
      return (
        <span className="text-neutral-500 italic">
          Object ({entries.length} keys) (max depth reached)
        </span>
      )
    }
    
    return (
      <div className="font-mono text-sm">
        <button
          onClick={toggleExpand}
          className="flex items-center gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
        >
          <span className={cn('transition-transform', isExpanded && 'rotate-90')}>
            ▶
          </span>
          {name && <span className="font-medium">{name}: </span>}
          <span className="text-neutral-500">{'{'}{entries.length} keys{'}'}</span>
        </button>
        
        {isExpanded && (
          <div className="ml-4 mt-1 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
            {entries.map(([key, value]) => (
              <div key={key} className="py-1">
                <JSONExplorer
                  data={value}
                  name={key}
                  defaultExpanded={defaultExpanded}
                  maxDepth={maxDepth}
                  currentDepth={currentDepth + 1}
                  basePath={currentPath}
                  onFieldClick={onFieldClick}
                  selectedPath={selectedPath}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  // Fallback for functions and other types
  return (
    <span className="text-neutral-500 italic">
      {typeof data}
    </span>
  )
}

/**
 * JSON Explorer with search and copy functionality
 */
export const JSONExplorerAdvanced: React.FC<{
  data: unknown
  title?: string
  searchable?: boolean
  copyable?: boolean
}> = ({ data, title, searchable = true, copyable = true }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }
  
  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      {/* Header */}
      {(title || searchable || copyable) && (
        <div className="flex items-center justify-between border-b border-neutral-200 p-3 dark:border-neutral-700">
          {title && (
            <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
              {title}
            </h3>
          )}
          
          <div className="flex items-center gap-2">
            {searchable && (
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700"
              />
            )}
            
            {copyable && (
              <button
                onClick={handleCopy}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                title="Copy JSON"
              >
                {copied ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="max-h-[600px] overflow-auto p-3">
        <JSONExplorer data={data} />
      </div>
    </div>
  )
}

export default JSONExplorer

