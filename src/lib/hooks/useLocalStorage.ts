import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for using localStorage with React state
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Get initial value from localStorage
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  }, [initialValue, key])
  
  const [storedValue, setStoredValue] = useState<T>(readValue)
  
  // Update localStorage when value changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        
        setStoredValue(valueToStore)
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
          
          // Dispatch event to sync across tabs
          window.dispatchEvent(
            new StorageEvent('storage', {
              key,
              newValue: JSON.stringify(valueToStore),
              storageArea: window.localStorage
            })
          )
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )
  
  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
        
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: null,
            storageArea: window.localStorage
          })
        )
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])
  
  // Listen for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === window.localStorage) {
        try {
          const newValue = e.newValue ? (JSON.parse(e.newValue) as T) : initialValue
          setStoredValue(newValue)
        } catch (error) {
          console.warn(`Error parsing storage event for key "${key}":`, error)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key, initialValue])
  
  return [storedValue, setValue, removeValue]
}

/**
 * Hook for using sessionStorage with React state
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  }, [initialValue, key])
  
  const [storedValue, setStoredValue] = useState<T>(readValue)
  
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        
        setStoredValue(valueToStore)
        
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )
  
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key)
      }
    } catch (error) {
      console.warn(`Error removing sessionStorage key "${key}":`, error)
    }
  }, [key, initialValue])
  
  return [storedValue, setValue, removeValue]
}

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Get storage size in bytes
 */
export function getStorageSize(): number {
  let size = 0
  
  try {
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        const value = localStorage[key]
        if (typeof value === 'string') {
          size += key.length + value.length
        }
      }
    }
  } catch (error) {
    console.warn('Error calculating storage size:', error)
  }
  
  return size
}

/**
 * Clear all items with a specific prefix
 */
export function clearStorageByPrefix(prefix: string): void {
  try {
    const keysToRemove: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn(`Error clearing storage with prefix "${prefix}":`, error)
  }
}

