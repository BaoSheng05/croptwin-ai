/**
 * Typed localStorage helpers.
 *
 * Extracted from useResolveManager so any hook or component can safely
 * persist small JSON blobs without repeating try/catch boilerplate.
 */

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
