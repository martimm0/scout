"use client";

import { useState } from "react";

import { pinnedQuality, type Quality } from "../models/quality";
import { useGameStore } from "../state/game-store";
import { coarsePointerNow } from "./use-media-query";

/**
 * The quality the park is being drawn at.
 *
 * A pin from the address bar wins, then what the player chose, then the device:
 * high for a mouse, low for a thumb. The device is asked once, synchronously,
 * the same way the renderer's own budget is: a phone that started on the
 * desktop answer and corrected itself would build the fine park first, which is
 * exactly the work the low setting exists to spare it.
 */
export function useQuality(): Quality {
  const chosen = useGameStore((state) => state.settings.quality);
  const [byDevice] = useState<Quality>(() => (coarsePointerNow() ? "low" : "high"));

  return pinnedQuality() ?? chosen ?? byDevice;
}
