import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { loadJson, saveJson } from "../utils/storage";

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initialValue === "function"
      ? (initialValue as () => T)()
      : initialValue;
    return loadJson<T>(key, fallback);
  });

  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);

  return [value, setValue];
}
