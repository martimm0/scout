"use client";

import { useEffect, useRef, useState } from "react";

import { playSound } from "../../audio/sound";
import styles from "../pollination-minigame.module.css";
import type { MinigameProps } from "./types";

const TAP_TARGET = 14;

/**
 * Work the florets one at a time, with Space.
 *
 * Mechanically unchanged from the version inside the shell, deliberately: this
 * is the extraction, not the redesign, so it does not finish early either. Worth
 * naming plainly though: fourteen taps in five seconds is 2.8 a second, so
 * anybody awake scores a flat 1.0. Measured, not guessed. That is the whole
 * reason it is being replaced.
 */
export function TapsGame({ reportScore }: MinigameProps) {
  const [taps, setTaps] = useState(0);
  const count = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      event.preventDefault();
      playSound("tap");

      // Counted in a ref and mirrored into state, rather than scored inside a
      // setState updater. An updater has to be pure: React may call it twice,
      // and reporting a score from inside one is a side effect in a place that
      // forbids side effects.
      count.current += 1;
      reportScore(Math.min(1, count.current / TAP_TARGET));
      setTaps(count.current);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [reportScore]);

  return (
    <>
      <div className={styles.stage} data-minigame="taps">
        <div className={styles.florets}>
          {Array.from({ length: TAP_TARGET }).map((_, index) => (
            <span
              className={styles.floret}
              data-done={index < taps}
              key={index}
            />
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        {taps} of {TAP_TARGET} florets
      </p>
    </>
  );
}
