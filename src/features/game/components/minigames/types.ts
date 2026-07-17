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
};
