"use client";

import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";

import { surface, type Look } from "../world/surface";
import { useQuality } from "./use-quality";

/**
 * The material for one of the park's models, at the quality being drawn.
 *
 * Rebuilt when the model is (a sharpened geometry has a different lattice, and
 * the Ultra material bevels along it) and disposed when it is replaced. `look`
 * must be a stable object: one of `LOOKS`, or something memoised.
 */
export function useSurface(look: Look, geometry?: BufferGeometry) {
  const quality = useQuality();
  const material = useMemo(() => surface(quality, look, geometry), [geometry, look, quality]);

  useEffect(() => () => material.dispose(), [material]);

  return material;
}
