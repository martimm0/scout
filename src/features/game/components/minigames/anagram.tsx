"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ANAGRAM_TARGET, ANAGRAM_MIN_LENGTH } from "../../data/anagram";
import { ANAGRAM_WORDS } from "../../data/anagram-words";
import { playSound } from "../../audio/sound";
import { coarsePointerNow } from "../../hooks/use-media-query";
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
export function AnagramGame({
  finishEarly,
  plant,
  reportScore,
  shared,
}: MinigameProps) {
  const accepted = useMemo(
    () => new Set(ANAGRAM_WORDS[plant.id] ?? []),
    [plant.id],
  );
  const letters = useMemo(
    () => plant.commonName.toUpperCase().replace(/[^A-Z]/g, ""),
    [plant.commonName],
  );

  const [entry, setEntry] = useState("");
  const [mine, setMine] = useState<string[]>([]);

  /**
   * Every word on this flower, yours and theirs, in a stable order.
   *
   * A word made by anybody is made: the flower does not care which bee worked
   * out that "SUSAN" was in there. Ordered by arrival so the list does not
   * reshuffle under somebody's eyes as their partner types.
   */
  const found = useMemo(() => {
    if (!shared) {
      return mine;
    }

    const together = [...shared.finds];

    for (const word of mine) {
      if (!together.includes(word)) {
        together.push(word);
      }
    }

    return together;
  }, [mine, shared]);
  const [flash, setFlash] = useState<"none" | "good" | "bad" | "again">("none");
  const foundRef = useRef<Set<string>>(new Set());

  /**
   * Which letters have been spent, by position.
   *
   * Tracked by INDEX rather than by character, because a name like Black-eyed
   * Susan has three of some letters and spending one must not grey out the rest.
   * Only the tap path uses this; typing ignores it, which is why it is cleared on
   * every submit rather than derived from `entry`.
   */
  const [spent, setSpent] = useState<number[]>([]);

  /**
   * Tapping beats typing on a phone, where an `<input>` summons a soft keyboard
   * over the very board you are reading. The letters are tappable everywhere (it
   * is a pleasant way to play on a desktop too), but the text field only appears
   * where there is a real keyboard to fill it.
   *
   * Read ONCE, at mount, rather than through the subscribing hook. The hook
   * settles in an effect, so it answers false for the first render, and one frame
   * of an autofocused input on a phone is enough to throw the soft keyboard up
   * over the board and then yank it away again. This game only ever mounts from a
   * tap, well after hydration, so there is nothing to disagree with.
   */
  const [coarsePointer] = useState(coarsePointerNow);

  const tapLetter = (index: number) => {
    if (spent.includes(index)) {
      return;
    }

    setSpent([...spent, index]);
    setEntry(entry + letters[index]);
    setFlash("none");
    playSound("tap");
  };

  const backspace = () => {
    if (spent.length === 0) {
      return;
    }

    setSpent(spent.slice(0, -1));
    setEntry(entry.slice(0, -1));
    setFlash("none");
  };

  const submit = () => {
    const word = entry.trim().toUpperCase();
    setEntry("");
    setSpent([]);

    if (word.length < ANAGRAM_MIN_LENGTH) {
      setFlash("bad");

      return;
    }

    if (foundRef.current.has(word) || found.includes(word)) {
      setFlash("again");

      return;
    }

    if (!accepted.has(word)) {
      setFlash("bad");
      playSound("pollinateFail");

      return;
    }

    foundRef.current.add(word);
    setMine((was) => [...was, word]);
    setFlash("good");
    playSound("tap");
    shared?.found(word);
  };

  /**
   * Score the flower, not the player.
   *
   * In an effect rather than in the submit handler, because in company the count
   * also goes up when somebody ELSE makes a word, and a score reported only from
   * your own keystrokes would leave a co-op flower resolving on half the work
   * that went into it.
   */
  useEffect(() => {
    reportScore(Math.min(1, found.length / ANAGRAM_TARGET));

    if (found.length >= ANAGRAM_TARGET) {
      finishEarly(1);
    }
  }, [finishEarly, found.length, reportScore]);

  return (
    <>
      <div className={styles.stage} data-minigame="anagram">
        {/* The letters are the keyboard. Tapping one spends it, which is the
            whole game on a phone and a pleasant way to play anywhere. */}
        <p className={styles.letters}>
          {letters.split("").map((letter, index) => (
            <button
              aria-label={`Use the letter ${letter}`}
              className={styles.letter}
              data-spent={spent.includes(index)}
              disabled={spent.includes(index)}
              key={index}
              onClick={() => tapLetter(index)}
              type="button"
            >
              {letter}
            </button>
          ))}
        </p>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {coarsePointer ? (
            // No text field on a phone: it would summon the soft keyboard over
            // the very board you are reading from. The word being built is shown
            // instead, and the letters above do the typing.
            <p
              aria-live="polite"
              className={styles.built}
              data-flash={flash}
            >
              {entry || "tap the letters"}
            </p>
          ) : (
            <input
              aria-label={`A word made from the letters of ${plant.commonName}`}
              autoFocus
              className={styles.input}
              data-flash={flash}
              maxLength={letters.length}
              onChange={(event) => {
                setEntry(event.target.value.replace(/[^a-zA-Z]/g, ""));
                setSpent([]);
                setFlash("none");
              }}
              placeholder="a word"
              spellCheck={false}
              value={entry}
            />
          )}

          {coarsePointer ? (
            <button
              aria-label="Take back the last letter"
              className={styles.go}
              onClick={backspace}
              type="button"
            >
              ←
            </button>
          ) : null}

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
