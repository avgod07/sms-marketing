import { useState, useEffect } from "react"

/**
 * Return a value that only updates after the provided delay.
 * Useful for delaying heavy operations like API requests while typing.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
