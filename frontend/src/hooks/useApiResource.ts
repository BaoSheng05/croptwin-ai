import { useCallback, useEffect, useRef, useState } from "react";

export type ApiResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Generic hook for the common loading + data + refresh + error pattern.
 *
 * @param fetcher - Async function that returns the resource data.
 * @param deps - Dependency array that triggers a re-fetch when changed.
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error("[useApiResource]", message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, refresh: load };
}
