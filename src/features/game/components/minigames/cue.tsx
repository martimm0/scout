"use client";

import { useEffect, useRef, useState } from "react";

import styles from "../pollination-minigame.module.css";
import type { MinigameProps } from "./types";

const ARROWS = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"] as const;
const ARROW_GLYPH: Record<string, string> = {
  ArrowUp: "↑",
  ArrowRight: "→",
  ArrowDown: "↓",
  ArrowLeft: "←",
};
const CUE_TARGET = 6;

/**
 * Press the arrow the open flower points to.
 *
 * Mechanically unchanged from the version inside the shell. Six arrows in six
 * seconds is one a second, which is not a difficulty.
 */
export function CueGame({ reportScore }: MinigameProps) {
  const [cue, setCue] = useState<string>(ARROWS[0]);
  const [hits, setHits] = useState(0);
  const hitCount = useRef(0);
  const attempts = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!ARROWS.includes(event.code as (typeof ARROWS)[number])) {
        return;
      }

      event.preventDefault();
      attempts.current += 1;

      const correct = event.code === cue;

      // Right or wrong, a new cue: standing still is not a strategy.
      setCue(ARROWS[Math.floor(Math.random() * ARROWS.length)]);

      if (!correct) {
        return;
      }

      // A ref, then state. Reporting a score from inside a setState updater is a
      // side effect in a function that must be pure.
      hitCount.current += 1;
      reportScore(Math.min(1, hitCount.current / CUE_TARGET));
      setHits(hitCount.current);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [cue, reportScore]);

  return (
    <>
      <div className={styles.stage} data-minigame="cue">
        <div className={styles.cue}>
          <span className={styles.cueGlyph}>{ARROW_GLYPH[cue]}</span>
        </div>
      </div>

      <p className={styles.hint}>
        {hits} of {CUE_TARGET} worked
      </p>
    </>
  );
}
