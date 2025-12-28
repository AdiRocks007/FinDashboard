'use client'

import { useState, useEffect, useMemo } from 'react'
import { JSONExplorer } from '@/components/ui/JSONExplorer'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { X, Link2, Calculator, CheckCircle2, Sparkles, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { WidgetType } from '@/types/widget'
import { autoMapFields } from '@/lib/utils/autoMapper'
import { validateFormula, extractFieldReferences, evaluateFormula } from '@/lib/utils/formulaEvaluator'
import { get } from 'lodash-es'

interface FieldMappingStepProps {
  widgetType: WidgetType
  apiResponse: any
  fieldMapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
}

// Widget fields by type
const WIDGET_FIELDS: Record<WidgetType, string[]> = {
  table: ['symbol', 'price', 'change', 'changePercent', 'volume', 'timestamp'],
  card: ['title', 'value', 'change', 'changePercent', 'timestamp'],
  chart: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
  metric: ['label', 'value', 'change', 'changePercent'],
}

export function FieldMappingStep({
  widgetType,
  apiResponse,
  fieldMapping,
  onChange,
}: FieldMappingStepProps) {
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [selectingFor, setSelectingFor] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<Array<{ name: string; formula: string }>>([])
  const [editingFormula, setEditingFormula] = useState<string | null>(null)
  const [formulaInput, setFormulaInput] = useState('')
  const [formulaError, setFormulaError] = useState<string | null>(null)

  // Get widget fields for the current widget type (must be defined before useEffect)
  const widgetFields = WIDGET_FIELDS[widgetType] || []

  // Initialize customFields from fieldMapping on mount or when fieldMapping changes
  useEffect(() => {
    const customFieldsFromMapping: Array<{ name: string; formula: string }> = []
    Object.entries(fieldMapping).forEach(([fieldName, mapping]) => {
      // Check if it's a custom field (not in widgetFields and has formula: prefix)
      if (mapping?.startsWith('formula:') && !widgetFields.includes(fieldName)) {
        customFieldsFromMapping.push({
          name: fieldName,
          formula: mapping.replace('formula:', ''),
        })
      }
    })
    setCustomFields(customFieldsFromMapping)
  }, [fieldMapping, widgetFields])

  // Auto-detect and auto-map on first load
  const autoMapping = useMemo(() => {
    if (!apiResponse) return null
    // Handle array responses (multi-symbol) - use first item for mapping
    const responseToMap = Array.isArray(apiResponse) ? apiResponse[0] : apiResponse
    return autoMapFields(responseToMap)
  }, [apiResponse])

  // Apply auto-mapping if not already mapped
  useEffect(() => {
    if (autoMapping && autoMapping.mapping && Object.keys(autoMapping.mapping).length > 0) {
      const hasExistingMapping = Object.keys(fieldMapping).length > 0
      if (!hasExistingMapping) {
        // Only auto-map if no manual mapping exists
        onChange(autoMapping.mapping)
      }
    }
  }, [autoMapping, fieldMapping, onChange])

  const handleFieldClick = (apiPath: string) => {
    if (selectingFor) {
      onChange({ ...fieldMapping, [selectingFor]: apiPath })
      setSelectingFor(null)
      setSelectedField(null)
    } else {
      setSelectedField(apiPath)
    }
  }

  const handleMapField = (widgetField: string) => {
    if (selectingFor === widgetField) {
      setSelectingFor(null)
    } else {
      setSelectingFor(widgetField)
    }
  }

  const handleAddCustomField = () => {
    setEditingFormula('new')
    setFormulaInput('')
    setFormulaError(null)
  }

  const handleSaveFormula = () => {
    // First validate syntax
    const validation = validateFormula(formulaInput)
    if (!validation.valid) {
      setFormulaError(validation.error || 'Invalid formula')
      return
    }

    // Then validate with actual data if available
    if (apiResponse) {
      const responseToTest = Array.isArray(apiResponse) ? apiResponse[0] : apiResponse
      const testContext: Record<string, any> = {}
      
      // Build context from existing field mappings (only non-formula fields)
      Object.entries(fieldMapping).forEach(([key, path]) => {
        if (!path.startsWith('formula:')) {
          const value = get(responseToTest, path)
          if (value !== undefined && value !== null) {
            const numValue = typeof value === 'string' 
              ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
              : value
            if (!isNaN(numValue) && typeof numValue === 'number') {
              testContext[key] = numValue
            } else {
              // Even if not a number, include it in context (might be used in formulas)
              testContext[key] = value
            }
          }
        }
      })
      
      // Get field references from formula
      const fieldRefs = extractFieldReferences(formulaInput)
      const missingFields = fieldRefs.filter(ref => {
        // Check if field exists in available fields or test context
        return !availableFields.includes(ref) && testContext[ref] === undefined
      })
      
      if (missingFields.length > 0) {
        setFormulaError(`Formula references unknown fields: ${missingFields.join(', ')}. Available fields: ${availableFields.join(', ') || 'none'}`)
        return
      }
      
      // Try to evaluate with test data (only if we have numeric values)
      if (Object.keys(testContext).length > 0) {
        const testResult = evaluateFormula(formulaInput, testContext)
        if (testResult === null) {
          // Check if it's because of missing numeric values
          const numericFields = fieldRefs.filter(ref => {
            const val = testContext[ref]
            return val !== undefined && typeof val === 'number' && !isNaN(val)
          })
          if (numericFields.length === 0) {
            setFormulaError('Formula requires at least one numeric field. Available fields: ' + availableFields.join(', ') || 'none')
            return
          }
          setFormulaError('Formula evaluation failed. Check your formula syntax.')
          return
        }
      }
    }

    // Check if editing existing or creating new
    if (editingFormula === 'new') {
      const fieldName = `custom_${Date.now()}`
      const newField: { name: string; formula: string } = { name: fieldName, formula: formulaInput }
      setCustomFields([...customFields, newField])
      onChange({ ...fieldMapping, [fieldName]: `formula:${formulaInput}` })
    } else if (editingFormula) {
      const index = customFields.findIndex(f => f.name === editingFormula)
      if (index >= 0) {
        const updated = [...customFields]
        updated[index] = { name: editingFormula, formula: formulaInput }
        setCustomFields(updated)
        onChange({ ...fieldMapping, [editingFormula]: `formula:${formulaInput}` })
      }
    }

    setEditingFormula(null)
    setFormulaInput('')
    setFormulaError(null)
  }

  const handleDeleteCustomField = (fieldName: string) => {
    setCustomFields(customFields.filter(f => f.name !== fieldName))
    const { [fieldName]: _, ...rest } = fieldMapping
    onChange(rest)
  }

  const isAutoMapped = (field: string) => {
    return autoMapping?.mapping[field] === fieldMapping[field]
  }

  const isFormula = (mapping: string) => {
    return mapping?.startsWith('formula:')
  }

  if (!apiResponse) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Please test the API connection in Step 1 first.
          </p>
        </div>
      </div>
    )
  }

  // Get available field references for formula builder
  // Include all mapped fields (both auto-mapped and manually mapped) that are not formulas
  const availableFields = useMemo(() => {
    const fields: string[] = []
    // Include all widget fields that are mapped (not formulas)
    widgetFields.forEach(field => {
      const mapping = fieldMapping[field]
      if (mapping && !mapping.startsWith('formula:')) {
        fields.push(field)
      }
    })
    // Also include any other mapped fields that aren't in widgetFields and aren't formulas
    Object.entries(fieldMapping).forEach(([key, path]) => {
      if (!path.startsWith('formula:') && !widgetFields.includes(key) && !fields.includes(key)) {
        fields.push(key)
      }
    })
    return fields
  }, [fieldMapping, widgetFields])

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-4 dark:border-[#22c55e]/50 dark:bg-[#22c55e]/5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-[#22c55e] mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#22c55e] mb-1">
              {autoMapping?.provider !== 'custom' 
                ? `✅ Auto-mapped for ${autoMapping?.provider === 'alphavantage' ? 'Alpha Vantage' : 'Finnhub'}`
                : 'Manual mapping required'}
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {Array.isArray(apiResponse) && apiResponse.length > 1
                ? `Mapping from first symbol will apply to all ${apiResponse.length} symbols automatically.`
                : 'Map fields once and they will apply to all symbols in your table.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4" style={{ minHeight: '500px' }}>
        {/* Left: API Response */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              API Response {Array.isArray(apiResponse) ? `(${apiResponse.length} symbols)` : ''}
            </h3>
            {selectingFor && (
              <span className="text-xs text-[#22c55e] font-medium">
                Selecting for: {selectingFor}
              </span>
            )}
          </div>
          <div className="max-h-[450px] overflow-auto">
            <JSONExplorer
              data={Array.isArray(apiResponse) ? apiResponse[0] : apiResponse}
              onFieldClick={handleFieldClick}
              {...(selectedField ? { selectedPath: selectedField } : {})}
            />
          </div>
        </div>

        {/* Right: Widget Fields */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Widget Fields ({widgetType})
            </h3>
          </div>
          <div className="space-y-2 max-h-[450px] overflow-y-auto">
            {/* Built-in fields */}
            {widgetFields.map((field) => {
              const mapping = fieldMapping[field]
              const isAuto = isAutoMapped(field)
              const isFormulaField = isFormula(mapping || '')
              
              return (
                <div key={field}>
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3 transition-colors',
                      mapping
                        ? 'border-[#22c55e]/50 bg-[#22c55e]/5 dark:border-[#22c55e]/30 dark:bg-[#22c55e]/5'
                        : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800',
                      selectingFor === field && 'ring-2 ring-[#22c55e]'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {field}
                        </span>
                        {isAuto && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-xs font-medium text-[#22c55e]">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto
                          </span>
                        )}
                        {isFormulaField && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-500">
                            <Calculator className="h-3 w-3" />
                            Formula
                          </span>
                        )}
                      </div>
                      {mapping ? (
                        <div className="mt-1 flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                          {isFormulaField ? (
                            <>
                              <Calculator className="h-3 w-3" />
                              {mapping.replace('formula:', '')}
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3 w-3" />
                              {mapping}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                          Not mapped
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {mapping && (
                        <button
                          type="button"
                          onClick={() => {
                            const { [field]: _, ...rest } = fieldMapping
                            onChange(rest)
                          }}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-700 dark:hover:text-red-400"
                          aria-label={`Unmap ${field}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMapField(field)}
                        className={cn(
                          'rounded px-2 py-1 text-xs transition-colors',
                          selectingFor === field
                            ? 'bg-[#22c55e] text-white'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
                        )}
                      >
                        {selectingFor === field ? 'Click API field' : 'Map'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Custom formula fields */}
            {customFields.map((customField) => {
              const mapping = fieldMapping[customField.name]
              const isEditing = editingFormula === customField.name
              
              return (
                <div key={customField.name}>
                  {isEditing ? (
                    <div className="rounded-lg border border-blue-500/50 bg-blue-500/5 p-3">
                      <Input
                        label="Formula"
                        placeholder="e.g., price * 1.1 or change / previousClose * 100"
                        value={formulaInput}
                        onChange={(e) => {
                          setFormulaInput(e.target.value)
                          setFormulaError(null)
                        }}
                        {...(formulaError ? { error: formulaError } : {})}
                        helperText={`Available fields: ${availableFields.join(', ') || 'none'}`}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveFormula}
                          className="bg-[#22c55e] hover:bg-[#22c55e]/90"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingFormula(null)
                            setFormulaInput('')
                            setFormulaError(null)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {customField.name}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-500">
                            <Calculator className="h-3 w-3" />
                            Formula
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                          {customField.formula}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFormula(customField.name)
                            setFormulaInput(customField.formula)
                            setFormulaError(null)
                          }}
                          className="rounded px-2 py-1 text-xs bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomField(customField.name)}
                          className="rounded p-1 text-neutral-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add custom field button */}
            {editingFormula === 'new' ? (
              <div className="rounded-lg border border-blue-500/50 bg-blue-500/5 p-3">
                <Input
                  label="Formula"
                  placeholder="e.g., price * 1.1 or change / previousClose * 100"
                        value={formulaInput}
                        onChange={(e) => {
                          setFormulaInput(e.target.value)
                          setFormulaError(null)
                        }}
                        {...(formulaError ? { error: formulaError } : {})}
                        helperText={`Available fields: ${availableFields.join(', ') || 'none'}`}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveFormula}
                    className="bg-[#22c55e] hover:bg-[#22c55e]/90"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingFormula(null)
                      setFormulaInput('')
                      setFormulaError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddCustomField}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm font-medium text-neutral-700 transition-colors hover:border-[#22c55e] hover:bg-[#22c55e]/5 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                <Plus className="h-4 w-4" />
                Add Custom Formula Field
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
