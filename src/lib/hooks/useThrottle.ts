import { useRef, useCallback, useEffect, useState } from 'react'

/**
 * Throttle hook - Limits function execution to once per delay period
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  // Initialize lastRun on first render using useEffect
  useEffect(() => {
    if (lastRun.current === 0) {
      lastRun.current = Date.now()
    }
  }, [])
  
  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastRun = now - lastRun.current
      
      if (timeSinceLastRun >= delay) {
        callback(...args)
        lastRun.current = now
      } else {
        // Clear previous timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        // Schedule call for remaining time
        const remainingTime = delay - timeSinceLastRun
        timeoutRef.current = setTimeout(() => {
          callback(...args)
          lastRun.current = Date.now()
        }, remainingTime)
      }
    },
    [callback, delay]
  )
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return throttledCallback as T
}

/**
 * Throttle value hook - Returns throttled value
 */
export function useThrottleValue<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastUpdate = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const initialized = useRef(false)
  
  // Initialize lastUpdate on first render using useEffect
  useEffect(() => {
    if (!initialized.current) {
      lastUpdate.current = Date.now()
      initialized.current = true
    }
  }, [])
  
  useEffect(() => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdate.current
    
    if (timeSinceLastUpdate >= delay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThrottledValue(value)
      lastUpdate.current = now
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      const remainingTime = delay - timeSinceLastUpdate
      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value)
        lastUpdate.current = Date.now()
      }, remainingTime)
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay])
  
  return throttledValue
}

