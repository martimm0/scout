import type { Plant } from "../../data/plants";

/**
 * The contract between the shell and a game.
 *
 * The shell owns the scrim, the panel, the plant's name, the instruction, the
 * clock, the timer bar, the resolve and the outcome. A game owns its playfield,
 * its own inputs, and its own hint. That split exists because the alternative was
 * one 290 line component holding every game's state at once, which was already
 * awkward at three and would be untenable at six.
 *
 * Three deliberate choices in here, each avoiding a specific bug:
 *
 *  - **No `progress` prop.** The shell would have to setState every frame to
 *    provide it, re-rendering the whole board at 60fps to move a bar the game
 *    does not draw. The shell renders its own timer. A game that needs the clock
 *    reads `deadline`.
 *  - **`reportScore` writes a ref**, never state, for the same reason. It is
 *    stable, so it is safe in a dependency array.
 *  - **`finishEarly` takes the score** rather than the shell reading the last
 *    reported value. A game that reports from an effect (after commit) but
 *    finishes from a click handler (before commit) would otherwise resolve on a
 *    stale number.
 */
export type MinigameProps = {
  plant: Plant;
  /**
   * Seconds the round runs for.
   *
   * A plain number rather than a `performance.now()` deadline, because a
   * deadline forces every game that wants the duration to call
   * `performance.now()` during render to recover it, which is impure and which
   * the linter rightly refuses. A game that wants a clock starts one in an
   * effect, where reading the time is fine.
   */
  duration: number;
  /** The latest score, 0 to 1. Call whenever it changes. */
  reportScore: (score: number) => void;
  /**
   * Genuine completion: every pair found, every word made. Resolves immediately
   * rather than waiting the clock out. Idempotent.
   */
  finishEarly: (score: number) => void;
  /**
   * Somebody else is working this same flower.
   *
   * Absent for every solo attempt, which is nearly all of them, so a game that
   * ignores this behaves exactly as it always has.
   *
   * `finds` are opaque tokens whose meaning is the game's own business: a
   * matched floret, a word made. The room keeps the set and passes it around
   * without knowing what any of it means, so a game can decide its own currency
   * without the protocol learning about it.
   *
   * Two games use it and one deliberately does not. Memory and anagram are
   * shared-progress games, where a floret matched by anybody is matched and a
   * word found by anybody is found, so co-operating changes nothing about what
   * they mean. The seeds game is a dodge: its score is what survives the hits,
   * and pooling that would make a careful player's outcome depend on a
   * stranger's reflexes, which is failure used as a punishment. Rule 3 forbids
   * it, so a tree is worked alone even in company.
   */
  shared?: {
    finds: string[];
    found: (token: string) => void;
  };
};
