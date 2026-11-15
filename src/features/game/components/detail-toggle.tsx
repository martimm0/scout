"use client";

import { useSyncExternalStore } from "react";

import { coarsePointerNow } from "../hooks/use-media-query";
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
 * Ultra is not a third stop on this switch. It has its own (`UltraToggle`), so
 * that the laptop looking for Low never has to pass through the heaviest
 * setting to get there. While Ultra is on this reads High, which is the park
 * Ultra is drawing, and pressing it goes to Low.
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

  const next = quality === "low" ? "high" : "low";

  return (
    <button
      // Ultra draws High's park, and that is what this switch reads.
      aria-label={`Detail: ${quality === "low" ? "low" : "high"}. Switch to ${next}.`}
      className={className ?? soundStyles.button}
      data-quality={quality}
      onClick={() => updateSettings({ quality: next })}
      type="button"
    >
      Detail: {quality === "low" ? "Low" : "High"}
    </button>
  );
}

/**
 * Ultra: High's park, lit like a photograph of a model.
 *
 * Its own switch, off until somebody asks. Not offered to a touch device at
 * all: it wants a desktop graphics card, and a thumb that found it by accident
 * would find out why. Turning it off goes back to High.
 */
export function UltraToggle({ className }: { className?: string }) {
  const quality = useQuality();
  const updateSettings = useGameStore((state) => state.updateSettings);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!ready || coarsePointerNow()) {
    return null;
  }

  const on = quality === "ultra";

  return (
    <button
      aria-label={`Ultra: ${on ? "on" : "off"}. Realistic light, for a fast graphics card.`}
      aria-pressed={on}
      className={className ?? soundStyles.button}
      data-ultra={on ? "on" : "off"}
      onClick={() => updateSettings({ quality: on ? "high" : "ultra" })}
      type="button"
    >
      Ultra: {on ? "On" : "Off"}
    </button>
  );
}
