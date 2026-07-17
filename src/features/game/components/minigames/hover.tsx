"use client";

import { useEffect, useRef, useState } from "react";

import styles from "../pollination-minigame.module.css";
import type { MinigameProps } from "./types";

/**
 * Settle inside the ring and hold still.
 *
 * The flower head sways on two sines, and chasing it is the game. Mechanically
 * unchanged from the version that lived inside the shell: this is the extraction,
 * not the redesign.
 */
export function HoverGame({ duration, reportScore }: MinigameProps) {
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const [holding, setHolding] = useState(false);
  const held = useRef(0);

  useEffect(() => {
    let raf = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const t = (now - started) / 1000;

      setDrift({
        x: Math.sin(t * 1.7) * 34 + Math.sin(t * 0.7) * 16,
        y: Math.cos(t * 1.3) * 26 + Math.sin(t * 2.1) * 10,
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  // Accumulate held time while the pointer is inside the ring.
  useEffect(() => {
    if (!holding) {
      return;
    }

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      held.current += (now - last) / 1000;
      last = now;
      reportScore(Math.min(1, held.current / (duration * 0.75)));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [duration, holding, reportScore]);

  return (
    <>
      <div className={styles.stage} data-minigame="hover">
        <div
          className={styles.ring}
          data-holding={holding}
          data-target="hover"
          onPointerEnter={() => setHolding(true)}
          onPointerLeave={() => setHolding(false)}
          style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}
        >
          <span className={styles.ringCore} />
        </div>
      </div>

      <p className={styles.hint}>
        {holding ? "Holding steady…" : "Get inside the ring"}
      </p>
    </>
  );
}
