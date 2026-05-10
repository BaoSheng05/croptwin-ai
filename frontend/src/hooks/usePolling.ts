import { useEffect, useRef } from "react";

/**
 * Repeatedly calls `fetcher` every `intervalMs` milliseconds.
 * Automatically cleans up on unmount or when dependencies change.
 *
 * @param fetcher - Async or sync function to invoke on each tick.
 * @param intervalMs - Polling interval in milliseconds. Pass 0 or null to disable.
 */
export function usePolling(
  fetcher: () => void | Promise<void>,
  intervalMs: number | null,
): void {
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;

    const tick = () => {
      void fetcherRef.current();
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
