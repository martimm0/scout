"use client";

import { useMemo, useRef, useState } from "react";

import { ANAGRAM_TARGET, ANAGRAM_MIN_LENGTH } from "../../data/anagram";
import { ANAGRAM_WORDS } from "../../data/anagram-words";
import { playSound } from "../../audio/sound";
import styles from "./anagram.module.css";
import type { MinigameProps } from "./types";

/**
 * Make words from the flower's name.
 *
 * A word puzzle, framed as exactly that, and NOT dressed up as the waggle dance.
 * The real dance encodes distance and bearing to a food source; a bee does not
 * spell, and this game's first rule is that it does not tell fibs. It is here
 * because the game is already about learning the names of plants, and there is a
 * quiet pleasure in finding that Wild Bergamot has a marble and a tiger hidden in
 * it.
 *
 * Three words of four letters or more scores 1.0. The accepted set is precomputed
 * per plant, real words common enough to be guessed, so any valid word the player
 * finds counts, which is the only version that does not feel rigged. Only plants
 * whose names can make enough words get this game at all: `minigameFor` sends the
 * rest to memory, so `ANAGRAM_WORDS[plant.id]` is always present here.
 */
export function AnagramGame({ finishEarly, plant, reportScore }: MinigameProps) {
  const accepted = useMemo(
    () => new Set(ANAGRAM_WORDS[plant.id] ?? []),
    [plant.id],
  );
  const letters = useMemo(
    () => plant.commonName.toUpperCase().replace(/[^A-Z]/g, ""),
    [plant.commonName],
  );

  const [entry, setEntry] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [flash, setFlash] = useState<"none" | "good" | "bad" | "again">("none");
  const foundRef = useRef<Set<string>>(new Set());

  const submit = () => {
    const word = entry.trim().toUpperCase();
    setEntry("");

    if (word.length < ANAGRAM_MIN_LENGTH) {
      setFlash("bad");

      return;
    }

    if (foundRef.current.has(word)) {
      setFlash("again");

      return;
    }

    if (!accepted.has(word)) {
      setFlash("bad");
      playSound("pollinateFail");

      return;
    }

    foundRef.current.add(word);
    const next = [...found, word];
    setFound(next);
    setFlash("good");
    playSound("tap");
    reportScore(Math.min(1, next.length / ANAGRAM_TARGET));

    if (next.length >= ANAGRAM_TARGET) {
      finishEarly(1);
    }
  };

  return (
    <>
      <div className={styles.stage} data-minigame="anagram">
        <p className={styles.letters} aria-hidden>
          {letters.split("").map((letter, index) => (
            <span className={styles.letter} key={index}>
              {letter}
            </span>
          ))}
        </p>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            aria-label={`A word made from the letters of ${plant.commonName}`}
            autoFocus
            className={styles.input}
            data-flash={flash}
            maxLength={letters.length}
            onChange={(event) => {
              setEntry(event.target.value.replace(/[^a-zA-Z]/g, ""));
              setFlash("none");
            }}
            placeholder="a word"
            spellCheck={false}
            value={entry}
          />
          <button className={styles.go} type="submit">
            Add
          </button>
        </form>

        <ul className={styles.found}>
          {Array.from({ length: ANAGRAM_TARGET }).map((_, index) => (
            <li className={styles.slot} data-filled={Boolean(found[index])} key={index}>
              {found[index] ?? ""}
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.hint}>
        {found.length} of {ANAGRAM_TARGET} words
        {flash === "bad" ? " · not a word you can make" : ""}
        {flash === "again" ? " · already found" : ""}
      </p>
    </>
  );
}
