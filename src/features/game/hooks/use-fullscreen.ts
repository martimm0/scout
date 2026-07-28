"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fullscreen, where the browser has it.
 *
 * Worth having on a phone, where the browser's own chrome costs a third of the
 * screen. But it is genuinely unavailable on the most likely device: **iPhone
 * Safari has never supported the Fullscreen API on anything but a `<video>`**.
 * iPad Safari does, Android Chrome does.
 *
 * So this feature-detects and reports `supported`, and the caller simply does not
 * offer the control where there is nothing behind it. The answer for iPhone is Add
 * to Home Screen, which is what the manifest is for, and is handled elsewhere.
 */

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export function useFullscreen() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = document.documentElement as FullscreenElement;
    const doc = document as FullscreenDocument;

    // One subscribe-and-sync, the same shape the media query hook and the
    // particle systems use. Both values are read from the browser rather than
    // remembered, so leaving fullscreen by a system gesture or the Escape key
    // does not leave the button lying about the state.
    const sync = () => {
      setSupported(
        typeof element.requestFullscreen === "function" ||
          typeof element.webkitRequestFullscreen === "function",
      );
      setActive(Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement));
    };

    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  /**
   * Must be called from a user gesture; browsers refuse otherwise.
   *
   * It deliberately does NOT lock the orientation. Locking is only permitted while
   * fullscreen and never works on iOS anyway, so it could not replace the rotate
   * card, and it would have applied on a tablet too, where holding the thing
   * upright is a perfectly good way to play. A lock that solves nothing on phones
   * and takes something away on tablets is not worth having.
   */
  const toggle = useCallback(async () => {
    const element = document.documentElement as FullscreenElement;
    const doc = document as FullscreenDocument;
    const isActive = Boolean(
      doc.fullscreenElement ?? doc.webkitFullscreenElement,
    );

    try {
      if (isActive) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
        return;
      }

      await (element.requestFullscreen?.() ??
        element.webkitRequestFullscreen?.());
    } catch {
      // A refused fullscreen request is not worth breaking the game over.
    }
  }, []);

  return { supported, active, toggle };
}
