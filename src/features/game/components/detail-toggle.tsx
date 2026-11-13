"use client";

import { useSyncExternalStore } from "react";

import { useQuality } from "../hooks/use-quality";
import { useGameStore } from "../state/game-store";
import soundStyles from "./sound-toggle.module.css";

/**
 * How finely the park is drawn: High or Low.
 *
 * High is the look the models are authored for. Low is the same shapes in
 * larger blocks, one of each tree, the coarser ground and no tree shadows, and
 * it costs what the park cost before the fine models existed. A phone starts on
 * Low and a desktop on High; this is for the laptop that is struggling, or the
 * tablet that is not.
 *
 * `className` lets the touch tray dress it as one of its own buttons.
 */
export function DetailToggle({ className }: { className?: string }) {
  const quality = useQuality();
  const updateSettings = useGameStore((state) => state.updateSettings);
  // The device's default is only knowable in the browser, so the label waits
  // for it rather than have the server guess and the page correct itself.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!ready) {
    return null;
  }

  const next = quality === "high" ? "low" : "high";

  return (
    <button
      aria-label={`Detail: ${quality}. Switch to ${next}.`}
      className={className ?? soundStyles.button}
      data-quality={quality}
      onClick={() => updateSettings({ quality: next })}
      type="button"
    >
      Detail: {quality === "high" ? "High" : "Low"}
    </button>
  );
}
