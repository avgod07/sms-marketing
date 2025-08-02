import { useState, useEffect } from "react";

/**
 * Simple timeout hook for authentication loading states
 * Helps detect when Clerk authentication hangs on iOS Safari
 */
export function useTimeout(delay: number) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn(`Authentication timeout reached after ${delay}ms`);
      setHasTimedOut(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return hasTimedOut;
}
