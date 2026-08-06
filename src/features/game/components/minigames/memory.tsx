"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { hash } from "../../world/park";
import { playSound } from "../../audio/sound";
import styles from "./memory.module.css";
import type { Plant } from "../../data/plants";
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

/**
 * The deal.
 *
 * Exported so a test can know the board rather than guess at it. The round is
 * twelve seconds, which is not enough to brute-force a match by clicking, and
 * the alternative was a test that re-implemented this shuffle: the trivia
 * shuffle was mirrored in its test once and the mirror agreed with a bug for
 * months. A test that wants this board calls this function.
 */
export function deal(seed: number): Tile[] {
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

/** The seed a plant's board is dealt from. One definition, used by both. */
export function memorySeed(plant: Plant): number {
  return plant.commonName.length + plant.height;
}

export function MemoryGame({
  finishEarly,
  plant,
  reportScore,
  shared,
}: MinigameProps) {
  const tiles = useMemo(
    () => deal(memorySeed(plant)),
    [plant],
  );

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  // A lockout during the reveal window, or a fast clicker turns three cards.
  const locked = useRef(false);
  const [pairs, setPairs] = useState(0);

  /**
   * Florets somebody else turned over.
   *
   * The board is dealt from the plant, so two bees on the same flower are
   * looking at the same layout and a face matched by either is matched for
   * both. Shared as the FACE rather than the tile, because that is the thing
   * that was learned: the pair, not the two squares it happened to be under.
   */
  const sharedFaces = useMemo(
    () =>
      new Set(
        (shared?.finds ?? [])
          .filter((token) => token.startsWith("f"))
          .map((token) => Number(token.slice(1))),
      ),
    [shared?.finds],
  );

  const allMatched = useMemo(() => {
    const together = new Set(matched);

    for (const tile of tiles) {
      if (sharedFaces.has(tile.face)) {
        together.add(tile.id);
      }
    }

    return together;
  }, [matched, sharedFaces, tiles]);

  /**
   * The whole flower's progress, not just yours.
   *
   * Everybody on it feeds one score into one roll, so the number reported has
   * to be what the flower has had done to it rather than what you personally
   * managed.
   */
  const donePairs = shared ? allMatched.size / 2 : pairs;

  useEffect(() => {
    if (!shared) {
      return;
    }

    reportScore(Math.min(1, donePairs / PAIRS));

    if (donePairs >= PAIRS) {
      finishEarly(1);
    }
  }, [donePairs, finishEarly, reportScore, shared]);

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
      allMatched.has(tile.id) ||
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
      setMatched((was) => new Set(was).add(next[0]).add(next[1]));
      setFlipped([]);

      // Tell the others. The effect above reports the shared score, so a co-op
      // board never scores from one player's half of the work.
      shared?.found(`f${a}`);

      if (!shared) {
        reportScore(Math.min(1, won / PAIRS));

        if (won >= PAIRS) {
          finishEarly(1);
        }
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
          // allMatched, not matched: a floret somebody else turned over is
          // turned over, and a co-op board that only drew your own half of the
          // work would have two people matching the same pair twice.
          const isUp = flipped.includes(tile.id) || allMatched.has(tile.id);

          return (
            <button
              aria-label={isUp ? `Floret ${tile.face + 1}` : "Hidden floret"}
              className={styles.tile}
              data-matched={allMatched.has(tile.id)}
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
