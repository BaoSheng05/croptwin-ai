/**
 * Hook to group farm layers by area.
 *
 * Eliminates the duplicated `useMemo(() => { const map = new Map... })`
 * pattern from ControlPage, WhatIfPage, and future pages.
 */

import { useMemo } from "react";
import type { FarmLayer } from "../types";

export type AreaGroup = {
  id: string;
  name: string;
  layers: FarmLayer[];
};

/**
 * Groups layers by `area_id` and returns a stable array of area entries.
 */
export function useAreaLayers(layers: FarmLayer[]): AreaGroup[] {
  return useMemo(() => {
    const map = new Map<string, AreaGroup>();
    for (const layer of layers) {
      const key = layer.area_id ?? "default";
      if (!map.has(key)) {
        map.set(key, { id: key, name: layer.area_name ?? key, layers: [] });
      }
      map.get(key)!.layers.push(layer);
    }
    return Array.from(map.values());
  }, [layers]);
}
