import { useEffect, useState } from 'react';

/** The current time, refreshed every 15 seconds. */
export function useNow(intervalMs = 15000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
