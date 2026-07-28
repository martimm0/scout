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
   * Must be called from a user gesture; browsers refuse otherwise. Landscape is
   * locked at the same time where that is allowed, which is only ever while
   * fullscreen and never on iOS, so the rotate card still has a job.
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

      await screen.orientation?.lock?.("landscape").catch(() => {
        // Not allowed here (iOS never allows it). The rotate card covers it.
      });
    } catch {
      // A refused fullscreen request is not worth breaking the game over.
    }
  }, []);

  return { supported, active, toggle };
}
