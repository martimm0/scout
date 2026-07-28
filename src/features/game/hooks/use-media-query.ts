"use client";

import { useEffect, useState } from "react";

/**
 * A media query, as React state.
 *
 * The project asks this question in four other places already (the trail, the
 * ambient life, the home gallery and the seeds minigame all watch
 * `prefers-reduced-motion`), each with its own copy of the same eight lines. This
 * is that shape, once, so the touch work does not add a fifth.
 *
 * It starts `false` on the server and settles on the first effect, which is the
 * right way round: a server render cannot know what the device is, and guessing
 * would mean the markup disagreeing with itself on hydration.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);

    sync();
    media.addEventListener("change", sync);

    return () => media.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

/**
 * Whether this is a touch device.
 *
 * `pointer: coarse` asks about the INPUT, not the screen size, which is the
 * question we actually care about: a narrow desktop window should not sprout
 * thumbsticks, and a large tablet should.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/**
 * The same question, asked once, outside React.
 *
 * The renderer is configured imperatively and the shadow map is sized when the
 * scene is built, neither of which can wait for an effect to settle. Safe on the
 * server, where it answers false and the desktop budget applies.
 */
export function coarsePointerNow(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

/**
 * A phone held upright: coarse, portrait, and small. The size test keeps tablets
 * out of it, since a portrait tablet is a perfectly good way to play.
 */
export function usePortraitPhone(): boolean {
  return useMediaQuery(
    "(pointer: coarse) and (orientation: portrait) and (max-width: 560px)",
  );
}
