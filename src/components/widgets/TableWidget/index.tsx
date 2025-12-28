'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useDebounce } from '@/lib/hooks/useDebounce'
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatVolume,
  formatTimestamp,
  getChangeColorClass,
} from '@/lib/utils/dataFormatter'
import { get } from 'lodash-es'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface TableWidgetProps {
  data: any[]
  fieldMapping: Record<string, string>
  settings: {
    rowsPerPage?: number
    sortable?: boolean
    filterable?: boolean
    highlightChanges?: boolean
    fieldLabels?: Record<string, string> // Custom labels for fields
  }
  widgetId?: string
  onFieldLabelChange?: (fieldId: string, newLabel: string) => void
}

/**
 * A powerful, flexible table widget that displays your data in rows and columns.
 * Supports sorting, filtering, searching, pagination, and custom field labels.
 * You can double-click column headers to rename them.
 */
export default function TableWidget({
  data,
  fieldMapping,
  settings = {},
  widgetId,
  onFieldLabelChange,
}: TableWidgetProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: settings.rowsPerPage || 10,
  })
  const [editingHeader, setEditingHeader] = useState<string | null>(null)
  const [headerEditValue, setHeaderEditValue] = useState('')

  const debouncedGlobalFilter = useDebounce(globalFilter, 300)
  const fieldLabels = settings.fieldLabels || {}

  // Generate columns from fieldMapping or auto-detect from data
  const columns = useMemo<ColumnDef<any>[]>(() => {
    // If fieldMapping is provided, always use it (especially for formula fields)
    const hasValidMapping = fieldMapping && Object.keys(fieldMapping).length > 0
    const firstRow = data?.[0]
    
    if (hasValidMapping) {
      // Check if we have any non-formula fields with valid paths
      // Formula fields are always included regardless
      const hasNonFormulaFields = Object.entries(fieldMapping).some(([key, path]) => {
        if (path.startsWith('formula:')) {
          return false // Skip formula fields in this check
        }
        if (!firstRow) return false
        const value = get(firstRow, path)
        return value !== undefined
      })
      
      // Always use fieldMapping if it exists (especially to include formula fields)
      // Only fall back to auto-detection if we have NO valid non-formula fields AND no formula fields
      const hasFormulaFields = Object.entries(fieldMapping).some(([_, path]) => path.startsWith('formula:'))
      
      if (!hasNonFormulaFields && !hasFormulaFields && firstRow) {
        console.log('⚠️ [TABLE WIDGET] Field mapping paths invalid, auto-detecting from data')
        // Fall through to auto-detection
      } else {
        // Use field mapping - include both regular fields and formula fields
        // IMPORTANT: Always include ALL fields from fieldMapping, especially formula fields
        const cols = Object.entries(fieldMapping).map(([key, path]) => {
          let firstValue: any = null
          
          if (path.startsWith('formula:')) {
            // Formula fields are stored at top-level after normalization
            // Check in first row, or try to find in any row
            firstValue = firstRow ? firstRow[key] : null
            if (firstValue === null || firstValue === undefined) {
              // Try to find in any row
              const rowWithValue = data.find(row => row[key] !== undefined && row[key] !== null)
              firstValue = rowWithValue ? rowWithValue[key] : null
            }
            // If still not found, it's a formula field so default to number type
            if (firstValue === null || firstValue === undefined) {
              firstValue = 0 // Default to 0 for formula fields that haven't been evaluated yet
            }
          } else {
            // Regular field mapping path
            firstValue = firstRow ? get(firstRow, path) : null
          }
          
          const dataType = detectDataType(firstValue)

          return {
            id: key,
            accessorFn: (row: any) => {
              if (path.startsWith('formula:')) {
                // Formula fields are at top-level
                const value = row[key]
                if (value !== undefined && value !== null) {
                  return value
                }
                // Also check metadata as fallback
                if (row.metadata?.[key] !== undefined) {
                  return row.metadata[key]
                }
                console.warn(`⚠️ [TABLE WIDGET] Formula field ${key} not found in row:`, {
                  rowKeys: Object.keys(row),
                  rowMetadataKeys: row.metadata ? Object.keys(row.metadata) : [],
                  key,
                  path
                })
                return null
              }
              // For regular fields, check top-level first, then try the path
              // This handles both direct top-level fields and nested paths
              if (row[key] !== undefined) {
                return row[key]
              }
              const pathValue = get(row, path)
              if (pathValue !== undefined) {
                return pathValue
              }
              // Also check metadata as fallback
              return row.metadata?.[key] !== undefined ? row.metadata[key] : null
            },
            header: fieldLabels[key] || key.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            cell: ({ getValue }) => {
              const value = getValue()
              return formatCellValue(value, dataType)
            },
            enableSorting: settings.sortable !== false,
            enableColumnFilter: settings.filterable !== false,
          } as ColumnDef<any>
        })
        
        console.log('✅ [TABLE WIDGET] Columns from valid mapping:', {
          total: cols.length,
          columns: cols.map(c => ({ 
            id: c.id, 
            header: c.header, 
            isFormula: fieldMapping[c.id as string]?.startsWith('formula:'),
            path: fieldMapping[c.id as string]
          })),
          fieldMappingKeys: Object.keys(fieldMapping),
          formulaFields: Object.entries(fieldMapping).filter(([_, path]) => path.startsWith('formula:')).map(([key]) => key)
        })
        return cols
      }
    }
    
    // Auto-detect columns from first data row
    if (data && data.length > 0) {
      const firstRow = data[0]
      // Include all top-level fields except metadata and timestamp
      // This includes custom formula fields that were added during normalization
      const keys = Object.keys(firstRow).filter(key => 
        key !== 'metadata' && 
        key !== 'timestamp' &&
        // Don't exclude custom fields (they start with custom_ or are formula results)
        (key.startsWith('custom_') || firstRow[key] !== undefined)
      )
      
      console.log('🔍 [TABLE WIDGET] Auto-detecting columns from data:', {
        keys,
        firstRow,
        hasCustomFields: keys.some(k => k.startsWith('custom_'))
      })
      
      const cols = keys.map((key) => {
        const firstValue = firstRow[key]
        const dataType = detectDataType(firstValue)
        
        // Format header: capitalize and replace underscores/dots
        // Remove 'custom_' prefix for better display
        const displayKey = key.replace(/^custom_/, '')
        const header = displayKey
          .split(/[._]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        return {
          id: key,
          accessorKey: key,
          header: fieldLabels[key] || header,
          cell: ({ getValue }) => {
            const value = getValue()
            return formatCellValue(value, dataType)
          },
          enableSorting: settings.sortable !== false,
          enableColumnFilter: settings.filterable !== false,
        } as ColumnDef<any>
      })
      
      console.log('✅ [TABLE WIDGET] Auto-detected columns:', cols.length, cols.map(c => ({ id: c.id, header: c.header })))
      return cols
    }
    
    console.log('⚠️ [TABLE WIDGET] No columns generated (no data or mapping)')
    return []
  }, [data, fieldMapping, settings.sortable, settings.filterable])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSorting: settings.sortable !== false,
    enableColumnFilters: settings.filterable !== false,
  })

  // Note: Virtualization can be added later if needed for very large datasets (>1000 rows)
  // For now, pagination handles most use cases efficiently

  // Export to CSV
  const handleExportCSV = () => {
    const headers = columns.map((col) => (col.header as string) || col.id || '')
    const rows = table.getRowModel().rows.map((row) =>
      columns.map((col) => {
        const value = col.id ? row.getValue(col.id) : null
        return value ?? ''
      })
    )

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full space-y-4">
      {/* Search and Export */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {settings.filterable !== false && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search stocks..."
              className="w-full rounded-lg border border-neutral-800 bg-[#0f1629] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/30 transition-all"
            />
          </div>
        )}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-[#0f1629] px-4 py-2.5 text-sm font-medium text-neutral-300 transition-all hover:bg-[#22c55e]/10 hover:border-[#22c55e] hover:text-[#22c55e]"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full">
          <thead className="bg-[#0f1629]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-neutral-800">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          header.column.getCanSort() && editingHeader !== header.id && 'cursor-pointer select-none hover:text-[#22c55e] transition-colors'
                        )}
                        onClick={editingHeader === header.id ? undefined : header.column.getToggleSortingHandler()}
                        onDoubleClick={() => {
                          if (onFieldLabelChange && widgetId) {
                            setEditingHeader(header.id)
                            setHeaderEditValue(String(header.column.columnDef.header || ''))
                          }
                        }}
                      >
                        {editingHeader === header.id ? (
                          <input
                            type="text"
                            value={headerEditValue}
                            onChange={(e) => setHeaderEditValue(e.target.value)}
                            onBlur={() => {
                              if (onFieldLabelChange && widgetId && headerEditValue.trim()) {
                                onFieldLabelChange(header.id, headerEditValue.trim())
                              }
                              setEditingHeader(null)
                              setHeaderEditValue('')
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (onFieldLabelChange && widgetId && headerEditValue.trim()) {
                                  onFieldLabelChange(header.id, headerEditValue.trim())
                                }
                                setEditingHeader(null)
                                setHeaderEditValue('')
                              } else if (e.key === 'Escape') {
                                setEditingHeader(null)
                                setHeaderEditValue('')
                              }
                            }}
                            className="bg-[#0f1629] border border-[#22c55e] rounded px-2 py-1 text-xs font-semibold uppercase text-white focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                            autoFocus
                          />
                        ) : (
                          <>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-neutral-600">
                                {header.column.getIsSorted() === 'asc' ? (
                                  <ChevronUp className="h-4 w-4 text-[#22c55e]" />
                                ) : header.column.getIsSorted() === 'desc' ? (
                                  <ChevronDown className="h-4 w-4 text-[#22c55e]" />
                                ) : (
                                  <span className="h-4 w-4" />
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-neutral-800/50 bg-[#1a1f3a]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-neutral-800 p-3">
                      <Search className="h-6 w-6 text-neutral-500" />
                    </div>
                    <p className="text-sm font-medium text-neutral-400">No stocks found</p>
                    <p className="text-xs text-neutral-500">Try adjusting your search</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-[#22c55e]/5",
                    index % 2 === 0 ? 'bg-[#1a1f3a]' : 'bg-[#151a2e]'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-200"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-neutral-800 pt-4 text-sm">
        <div className="text-neutral-500">
          Showing <span className="font-medium text-neutral-300">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{' '}
          <span className="font-medium text-neutral-300">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
          </span>{' '}
          of <span className="font-medium text-neutral-300">{table.getFilteredRowModel().rows.length}</span> stocks
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg border border-neutral-700 bg-[#0f1629] px-4 py-2 text-sm font-medium text-neutral-300 transition-all hover:bg-[#22c55e]/10 hover:border-[#22c55e] hover:text-[#22c55e] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:bg-[#0f1629] disabled:hover:text-neutral-300"
          >
            ← Previous
          </button>
          <span className="flex items-center gap-2 px-3 text-neutral-400">
            Page <span className="font-semibold text-white">{table.getState().pagination.pageIndex + 1}</span> of <span className="text-neutral-300">{Math.max(table.getPageCount(), 1)}</span>
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg border border-neutral-700 bg-[#0f1629] px-4 py-2 text-sm font-medium text-neutral-300 transition-all hover:bg-[#22c55e]/10 hover:border-[#22c55e] hover:text-[#22c55e] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-700 disabled:hover:bg-[#0f1629] disabled:hover:text-neutral-300"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function detectDataType(value: unknown): 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'volume' {
  if (value === null || value === undefined) return 'string'
  if (typeof value === 'number') {
    // Heuristic: if value is between 0 and 1, likely percentage
    if (value >= 0 && value <= 1) return 'percentage'
    // If value is very large, likely volume
    if (value > 1000000) return 'volume'
    // If value has decimal places and is reasonable size, likely currency
    if (value % 1 !== 0 && value < 1000000) return 'currency'
    return 'number'
  }
  if (typeof value === 'string') {
    // Check if it's a date string
    if (!isNaN(Date.parse(value))) return 'date'
    return 'string'
  }
  return 'string'
}

function formatCellValue(value: unknown, dataType: string): React.ReactNode {
  if (value === null || value === undefined) return '-'

  switch (dataType) {
    case 'currency':
      return typeof value === 'number' ? formatCurrency(value) : String(value)
    case 'percentage':
      return typeof value === 'number' ? (
        <span className={getChangeColorClass(value)}>{formatPercentage(value / 100)}</span>
      ) : (
        String(value)
      )
    case 'number':
      return typeof value === 'number' ? formatNumber(value) : String(value)
    case 'volume':
      return typeof value === 'number' ? formatVolume(value) : String(value)
    case 'date':
      return typeof value === 'string' || typeof value === 'number'
        ? formatTimestamp(typeof value === 'string' ? Date.parse(value) : value, 'MMM dd, yyyy')
        : String(value)
    default:
      return String(value)
  }
}

