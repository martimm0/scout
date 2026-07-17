"use client";

import { useMemo, useRef, useState } from "react";

import { hash } from "../../world/park";
import { playSound } from "../../audio/sound";
import styles from "./memory.module.css";
import type { MinigameProps } from "./types";

/**
 * Match the florets in pairs.
 *
 * The fiction is real: a bee working an inflorescence has to keep track of which
 * florets it has already visited, because going back to a spent one is a wasted
 * trip. The memory load IS the game, and it is why a spike and an umbel play it:
 * they are dozens of tiny flowers you have to hold in your head.
 *
 * Six pairs on a 3x4 board. Six rather than the ten a 4x5 would hold, because
 * the ceiling has to be reachable in the time: optimal play is about eight turns,
 * ~10 seconds, so a good player genuinely clears it and a careless one gets three
 * or four. Ten pairs cannot be cleared in twelve seconds by anyone, which would
 * quietly cap the score below 1.0 and make umbels harder to pollinate than the
 * rest of the park.
 */
const PAIRS = 6;
const REVEAL_MS = 650;

/** The florets, in the plant's own two colours so each species looks like itself. */
type Tile = { id: number; face: number };

function deal(seed: number): Tile[] {
  const faces = Array.from({ length: PAIRS }, (_, i) => i).flatMap((face) => [
    face,
    face,
  ]);

  // A seeded shuffle, so a given attempt is the same board if it remounts, and
  // no Math.random in a component body.
  for (let i = faces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(hash(seed, i) * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }

  return faces.map((face, id) => ({ id, face }));
}

export function MemoryGame({ finishEarly, plant, reportScore }: MinigameProps) {
  const tiles = useMemo(
    () => deal(plant.commonName.length + plant.height),
    [plant],
  );

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  // A lockout during the reveal window, or a fast clicker turns three cards.
  const locked = useRef(false);
  const [pairs, setPairs] = useState(0);

  // Two tints per species, spread across six faces so the pairs are told apart
  // by shade rather than only by position.
  const palette = useMemo(() => {
    const mix = (hex: string, amount: number) => {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      const to = (c: number) =>
        Math.round(c + (255 - c) * amount)
          .toString(16)
          .padStart(2, "0");

      return `#${to(r)}${to(g)}${to(b)}`;
    };

    return Array.from({ length: PAIRS }, (_, i) =>
      i % 2 === 0
        ? mix(plant.bloomColor, (i / PAIRS) * 0.5)
        : mix(plant.leafColor, (i / PAIRS) * 0.5),
    );
  }, [plant.bloomColor, plant.leafColor]);

  const flip = (tile: Tile) => {
    if (
      locked.current ||
      matched.has(tile.id) ||
      flipped.includes(tile.id) ||
      flipped.length === 2
    ) {
      return;
    }

    playSound("tap");
    const next = [...flipped, tile.id];
    setFlipped(next);

    if (next.length < 2) {
      return;
    }

    const [a, b] = next.map((id) => tiles[id].face);

    if (a === b) {
      const won = pairs + 1;
      setPairs(won);
      reportScore(Math.min(1, won / PAIRS));

      setMatched((was) => new Set(was).add(next[0]).add(next[1]));
      setFlipped([]);

      if (won >= PAIRS) {
        finishEarly(1);
      }

      return;
    }

    // A miss. Show both, then turn them back.
    locked.current = true;
    window.setTimeout(() => {
      setFlipped([]);
      locked.current = false;
    }, REVEAL_MS);
  };

  return (
    <>
      <div className={styles.board} data-minigame="memory">
        {tiles.map((tile) => {
          const isUp = flipped.includes(tile.id) || matched.has(tile.id);

          return (
            <button
              aria-label={isUp ? `Floret ${tile.face + 1}` : "Hidden floret"}
              className={styles.tile}
              data-matched={matched.has(tile.id)}
              data-up={isUp}
              key={tile.id}
              onClick={() => flip(tile)}
              style={
                isUp ? { background: palette[tile.face] } : undefined
              }
              type="button"
            />
          );
        })}
      </div>

      <p className={styles.hint}>
        {pairs} of {PAIRS} pairs
      </p>
    </>
  );
}
