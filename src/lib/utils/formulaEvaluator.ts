/**
 * Safely evaluates math formulas without using eval (to avoid security issues).
 * Lets users create calculated fields like "price * 1.1" or "volume + change".
 * Supports basic math: +, -, *, /, %, and parentheses.
 */

export interface FormulaContext {
  [key: string]: number | string | null | undefined
}

/**
 * Safely evaluates math expressions without using eval (which browsers block).
 * Handles basic arithmetic operations and respects operator precedence.
 */
function evaluateExpression(expression: string): number | null {
  try {
    // Remove all whitespace
    expression = expression.replace(/\s/g, '')
    
    if (!expression) return null
    
    // Validate expression contains only allowed characters
    if (!/^[0-9+\-*/().%]+$/.test(expression)) {
      return null
    }
    
    // Use a simple recursive descent parser
    let index = 0
    
    function parseExpression(): number {
      let result = parseTerm()
      
      while (index < expression.length) {
        const char = expression[index]
        if (char === '+') {
          index++
          result += parseTerm()
        } else if (char === '-') {
          index++
          result -= parseTerm()
        } else {
          break
        }
      }
      
      return result
    }
    
    function parseTerm(): number {
      let result = parseFactor()
      
      while (index < expression.length) {
        const char = expression[index]
        if (char === '*') {
          index++
          result *= parseFactor()
        } else if (char === '/') {
          index++
          const divisor = parseFactor()
          if (divisor === 0) {
            throw new Error('Division by zero')
          }
          result /= divisor
        } else if (char === '%') {
          index++
          result %= parseFactor()
        } else {
          break
        }
      }
      
      return result
    }
    
    function parseFactor(): number {
      if (index >= expression.length) {
        throw new Error('Unexpected end of expression')
      }
      
      const char = expression[index]
      
      if (char === '(') {
        index++ // consume '('
        const result = parseExpression()
        if (index >= expression.length || expression[index] !== ')') {
          throw new Error('Unmatched parenthesis')
        }
        index++ // consume ')'
        return result
      } else if (char === '-') {
        index++
        return -parseFactor()
      } else if (char === '+') {
        index++
        return parseFactor()
      } else {
        // Parse number
        let numStr = ''
        let hasDot = false
        
        while (index < expression.length) {
          const ch = expression[index]
          if (ch && ch >= '0' && ch <= '9') {
            numStr += ch
            index++
          } else if (ch === '.' && !hasDot) {
            numStr += ch
            hasDot = true
            index++
          } else {
            break
          }
        }
        
        if (numStr === '') {
          throw new Error('Expected number')
        }
        
        const num = parseFloat(numStr)
        if (isNaN(num)) {
          throw new Error('Invalid number')
        }
        
        return num
      }
    }
    
    const result = parseExpression()
    
    if (index < expression.length) {
      throw new Error('Unexpected characters at end of expression')
    }
    
    return result
  } catch (error) {
    console.error('Expression evaluation error:', error)
    return null
  }
}

/**
 * Evaluates a formula like "price * 1.1" using the provided field values.
 * Returns the calculated number, or null if something goes wrong.
 */
export function evaluateFormula(formula: string, context: FormulaContext): number | null {
  if (!formula || !formula.trim()) {
    return null
  }

  try {
    // Sanitize formula - only allow alphanumeric, spaces, operators, parentheses, and dots
    const sanitized = formula.replace(/[^a-zA-Z0-9\s+\-*/().%_]/g, '')
    
    // Replace field references with their values
    let expression = sanitized
    const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g
    const matches = expression.match(fieldPattern) || []
    
    for (const field of matches) {
      const value = context[field]
      if (value !== undefined && value !== null) {
        const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value
        if (!isNaN(numValue)) {
          expression = expression.replace(new RegExp(`\\b${field}\\b`, 'g'), String(numValue))
        } else {
          // If field not found or invalid, return null
          return null
        }
      }
    }
    
    // Evaluate the expression safely without using eval or Function constructor
    // This avoids CSP violations
    const result = evaluateExpression(expression)
    
    // Validate result
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Prevent overflow
      if (Math.abs(result) > Number.MAX_SAFE_INTEGER) {
        return null
      }
      return result
    }
    
    return null
  } catch (error) {
    console.error('Formula evaluation error:', error)
    return null
  }
}

/**
 * Finds all field names used in a formula (like "price" and "volume" in "price * volume").
 */
export function extractFieldReferences(formula: string): string[] {
  const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g
  const matches = formula.match(fieldPattern) || []
  return [...new Set(matches)] // Remove duplicates
}

/**
 * Checks if a formula is valid before trying to evaluate it.
 * Makes sure parentheses are balanced and there are no dangerous characters.
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || !formula.trim()) {
    return { valid: false, error: 'Formula cannot be empty' }
  }

  // Check for dangerous patterns
  if (formula.includes('eval') || formula.includes('Function') || formula.includes('constructor')) {
    return { valid: false, error: 'Invalid characters in formula' }
  }

  // Check for balanced parentheses
  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    return { valid: false, error: 'Unbalanced parentheses' }
  }

  return { valid: true }
}

