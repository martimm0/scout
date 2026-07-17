"use client";

import { useEffect, useRef, useState } from "react";

import { hash } from "../../world/park";
import { playSound } from "../../audio/sound";
import styles from "./seeds.module.css";
import type { MinigameProps } from "./types";

/**
 * Work the flower without getting hit.
 *
 * A woody plant drops things: acorns, twigs, seedlings, leaves. You keep the bee
 * under the bloom while they fall past, moving out of the way of the ones that
 * would hit you. Score starts at 1 and every hit takes a slice, so it is a game
 * you lose rather than win, which is the honest shape for "getting out of the
 * way of a falling acorn". Six hits is a zero.
 *
 * Reduced motion is handled, not ignored. A dodge game IS motion, and the people
 * who ask for less of it are exactly the ones a swarm of fast objects harms, so
 * under `prefers-reduced-motion` the field is fewer objects, slower, and the
 * score curve is kept intact by scaling the hit budget with it. Still winnable,
 * still losable, just calmer.
 */
const FALLERS = ["🌰", "🍂", "🌱", "🪵"] as const;
const MAX_HITS = 6;

export function SeedsGame({ duration, finishEarly, reportScore }: MinigameProps) {
  const [beeX, setBeeX] = useState(0.5);
  const [drops, setDrops] = useState<
    { id: number; x: number; y: number; glyph: string }[]
  >([]);
  const hits = useRef(0);
  const [knocks, setKnocks] = useState(0);
  const beeXRef = useRef(0.5);
  const held = useRef<Set<string>>(new Set());
  const stageRef = useRef<HTMLDivElement>(null);

  const calm = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    reportScore(1);

    const spawnEvery = calm.current ? 900 : 480;
    const fallSpeed = calm.current ? 0.5 : 0.85; // fraction of the stage per second
    const budget = calm.current ? Math.ceil(MAX_HITS / 2) : MAX_HITS;

    let raf = 0;
    let last = performance.now();
    let spawned = 0;
    const started = last;

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      // Steer. Arrows or A/D; the pointer path is handled separately.
      const dir =
        (held.current.has("ArrowRight") || held.current.has("KeyD") ? 1 : 0) -
        (held.current.has("ArrowLeft") || held.current.has("KeyA") ? 1 : 0);

      if (dir !== 0) {
        beeXRef.current = Math.max(
          0.06,
          Math.min(0.94, beeXRef.current + dir * dt * 1.1),
        );
        setBeeX(beeXRef.current);
      }

      if (now - started - spawned * spawnEvery > spawnEvery) {
        spawned += 1;
        const r = hash(spawned, 7);
        setDrops((was) => [
          ...was,
          {
            id: spawned,
            x: 0.08 + hash(spawned, 8) * 0.84,
            y: -0.05,
            glyph: FALLERS[Math.floor(r * FALLERS.length)],
          },
        ]);
      }

      setDrops((was) => {
        const next: typeof was = [];

        for (const drop of was) {
          const y = drop.y + fallSpeed * dt;

          // The bee sits near the bottom. A drop that reaches it within a bee's
          // width is a hit.
          if (y > 0.82 && y < 0.96 && Math.abs(drop.x - beeXRef.current) < 0.1) {
            hits.current += 1;
            setKnocks(hits.current);
            playSound("pollinateFail");
            reportScore(Math.max(0, 1 - hits.current / budget));

            if (hits.current >= budget) {
              finishEarly(0);
            }

            continue; // consumed
          }

          if (y < 1.05) {
            next.push({ ...drop, y });
          }
        }

        return next;
      });

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, [duration, finishEarly, reportScore]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) {
        e.preventDefault();
        held.current.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const onPointer = (event: React.PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    beeXRef.current = Math.max(
      0.06,
      Math.min(0.94, (event.clientX - rect.left) / rect.width),
    );
    setBeeX(beeXRef.current);
  };

  return (
    <>
      <div
        className={styles.stage}
        data-minigame="seeds"
        onPointerMove={onPointer}
        ref={stageRef}
      >
        {drops.map((drop) => (
          <span
            aria-hidden
            className={styles.drop}
            key={drop.id}
            style={{ left: `${drop.x * 100}%`, top: `${drop.y * 100}%` }}
          >
            {drop.glyph}
          </span>
        ))}

        <span
          aria-hidden
          className={styles.bee}
          style={{ left: `${beeX * 100}%` }}
        >
          🐝
        </span>
      </div>

      <p className={styles.hint}>
        {knocks === 0 ? "Stay under the flower" : `${knocks} knocks`}
      </p>
    </>
  );
}
