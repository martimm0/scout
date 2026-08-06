"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { playSound } from "../audio/sound";
import {
  FAILURE_MESSAGES,
  MINIGAME_SPEC,
  SUCCESS_MESSAGES,
  minigameFor,
  pickMessage,
  resolvePollination,
} from "../data/pollination";
import { PLANTS_BY_ID, type Plant } from "../data/plants";
import { useGameStore } from "../state/game-store";
import {
  shareFind,
  stopWorking,
  workOn,
} from "../state/party-client";
import { usePartyStore } from "../state/party-store";
import { MINIGAMES } from "./minigames";
import styles from "./pollination-minigame.module.css";

type Outcome = {
  success: boolean;
  message: string;
};

/**
 * The pollination minigames.
 *
 * One game per plant shape, so a species always plays the same way and you can
 * learn its rhythm. Every one feeds a single 0 to 1 score into one resolver, so
 * the failure rate lives in exactly one place.
 *
 * This file is the SHELL. It owns the frame around the game (the scrim, the
 * panel, the name, the clock, the timer, the resolve, the outcome) and nothing
 * about how any game is played. Each game is its own component under
 * `minigames/`, behind the contract in `minigames/types.ts`.
 *
 * It was one component holding all three games' state at once, which was already
 * awkward at three.
 */
export function PollinationMinigame() {
  const plantId = useGameStore((state) => state.ui.minigamePlantId);
  const instance = useGameStore((state) => state.ui.minigameInstance);
  const plant = plantId ? PLANTS_BY_ID.get(plantId) : undefined;

  if (!plant) {
    return null;
  }

  // Keyed on the plant so every attempt starts from a clean component rather
  // than a pile of reset effects.
  return <MinigameRun key={plant.id} instance={instance} plant={plant} />;
}

function MinigameRun({
  instance,
  plant,
}: {
  instance: string | null;
  plant: Plant;
}) {
  const endMinigame = useGameStore((state) => state.endMinigame);
  const pollinatePlant = useGameStore((state) => state.pollinatePlant);
  const recordAttempt = useGameStore((state) => state.recordPollinationAttempt);
  const recordScore = useGameStore((state) => state.recordMinigameScore);
  const signalPollinationCue = useGameStore(
    (state) => state.signalPollinationCue,
  );

  // minigameFor, not the raw map: it falls back off the anagram for names that
  // cannot make enough words.
  const kind = minigameFor(plant);
  const spec = MINIGAME_SPEC[kind];
  const Game = MINIGAMES[kind];

  /**
   * Working this flower with whoever else is standing on it.
   *
   * Announced on mount and dropped on unmount, so the room only ever thinks you
   * are on a flower while the board is actually open. The session it sends back
   * is only interesting when somebody else is in it: alone, this is a solo
   * attempt that happens to have told the room about itself.
   */
  const coop = usePartyStore((state) => state.coop);
  const inParty = usePartyStore((state) => state.status === "in");

  useEffect(() => {
    if (!inParty || !instance) {
      return;
    }

    workOn(instance, plant.id);

    return () => stopWorking(instance);
  }, [inParty, instance, plant.id]);

  const together =
    coop && coop.instance === instance && coop.members.length > 1
      ? coop
      : null;

  const shared = useMemo(
    () =>
      together && instance
        ? {
            finds: together.finds,
            found: (token: string) => shareFind(instance, token),
          }
        : undefined,
    [instance, together],
  );

  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** Escape asks before it bails, because bailing forfeits the flower. */
  const [confirming, setConfirming] = useState(false);

  /** The latest score a game has reported. Written, never rendered. */
  const scoreRef = useRef(0);
  /**
   * Set synchronously, before anything else, on the first call to `finish`.
   *
   * The old guard read the `outcome` STATE, which was safe only because nothing
   * could call finish twice. Games can end early now, so a deadline tick can race
   * a completion click inside one frame, and React would batch both: two
   * `pollinatePlant` calls and two `recordPollinationAttempt` calls, corrupting
   * the stats and double-counting the streak.
   */
  const resolvedRef = useRef(false);
  /** Seconds already elapsed. Carried across pauses so the confirm dialog does
   *  not hand the clock back to full every time it is opened and cancelled. */
  const elapsedRef = useRef(0);

  useEffect(() => {
    trackEvent({
      name: "pollination_attempted",
      plant: plant.id,
      minigame: kind,
    });
  }, [plant.id, kind]);

  const reportScore = useCallback((score: number) => {
    scoreRef.current = Math.max(0, Math.min(1, score));
  }, []);

  const finish = useCallback(
    (score: number) => {
      if (resolvedRef.current) {
        return;
      }

      resolvedRef.current = true;

      /**
       * One roll. In company, the room's roll.
       *
       * Everybody who worked the flower feeds the same shared score and the
       * same number through the same resolver, so two people who did the same
       * work on the same flower are told the same thing about it. Rolling per
       * player would also quietly change the failure rate the whole game runs
       * on: "at least one of us managed it" is a different number from "one
       * visit in five comes to nothing".
       */
      const roll = together ? together.roll : Math.random();
      const success = resolvePollination(score, roll);

      recordAttempt(success);
      recordScore(score);
      trackEvent({
        name: "pollination_resolved",
        plant: plant.id,
        success,
        minigame: kind,
        score: Number(score.toFixed(3)),
      });

      if (success) {
        pollinatePlant(plant.id);
        playSound("pollinateSuccess");
      } else {
        playSound("pollinateFail");
      }

      setOutcome({
        success,
        message: pickMessage(
          success ? SUCCESS_MESSAGES : FAILURE_MESSAGES,
          Math.random(),
        ),
      });
    },
    [plant.id, kind, recordAttempt, recordScore, pollinatePlant, together],
  );

  const finishEarly = useCallback(
    (score: number) => finish(score),
    [finish],
  );

  /**
   * Close the panel, and if the flower took, ask the scene to celebrate.
   *
   * The cue is bumped HERE, on dismissal, not at `finish`: `finish` shows the
   * "Pollinated" panel, which is exactly what is covering the bee. Firing the
   * hop the moment the panel is gone is the whole point of it.
   */
  const dismiss = useCallback(() => {
    if (outcome?.success) {
      signalPollinationCue();
    }

    endMinigame();
  }, [outcome, signalPollinationCue, endMinigame]);

  /**
   * The clock. It drives the timer bar and nothing else.
   *
   * A game that wants the clock starts its own, so the board is not re-rendered
   * sixty times a second to move a bar it does not draw.
   *
   * The start time lives in this effect rather than a ref stamped on mount:
   * effects run after paint, so the effect IS the start, and a separate ref plus
   * a `running` flag was two pieces of state to say "has the first effect run
   * yet" when the answer is always yes by the time anything reads it.
   */
  useEffect(() => {
    if (outcome || confirming) {
      return;
    }

    let raf = 0;
    const resumed = performance.now();

    const tick = (now: number) => {
      const elapsed = elapsedRef.current + (now - resumed) / 1000;
      setProgress(Math.min(1, elapsed / spec.duration));

      if (elapsed >= spec.duration) {
        /**
         * Let the drained bar paint before the outcome takes the board away.
         *
         * `setProgress(1)` above and `finish` here land in the same React batch,
         * so the frame that would have shown an empty bar is the frame that
         * replaces it with the outcome panel: the bar visibly still had time on
         * it when the game ended, which reads as being cut off early. One frame
         * of delay is the whole fix, and it is why the bar carries no CSS
         * transition either.
         */
        raf = requestAnimationFrame(() => finish(scoreRef.current));

        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      // Bank the time spent this run, so a pause resumes rather than restarts.
      elapsedRef.current += (performance.now() - resumed) / 1000;
    };
  }, [outcome, confirming, spec.duration, finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();

        // Escape does not leave. It asks. Bailing on a hard board used to be a
        // free reroll: no attempt recorded, streak protected, so the smart play
        // was to quit any board you did not like until an easy one came up, and
        // the difficulty would have been decoration. Leaving now forfeits, so it
        // is worth a question first.
        if (outcome) {
          dismiss();
        } else {
          setConfirming((was) => !was);
        }

        return;
      }

      if (outcome && (event.code === "Space" || event.code === "Enter")) {
        event.preventDefault();
        dismiss();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [outcome, dismiss]);

  const body = useMemo(
    () => (
      <Game
        duration={spec.duration}
        finishEarly={finishEarly}
        plant={plant}
        reportScore={reportScore}
        shared={shared}
      />
    ),
    [Game, spec.duration, finishEarly, plant, reportScore, shared],
  );

  return (
    <div className={styles.scrim} role="presentation">
      <section
        aria-label={`Pollinating ${plant.commonName}`}
        aria-modal="true"
        className={styles.panel}
        role="dialog"
      >
        <p className={styles.eyebrow}>Pollinating</p>
        <h2 className={styles.name}>{plant.commonName}</h2>

        {outcome ? (
          <div className={styles.outcome} data-success={outcome.success}>
            <p className={styles.outcomeTitle}>
              {outcome.success ? "Pollinated" : "Not this time"}
            </p>
            <p className={styles.outcomeMessage}>{outcome.message}</p>

            {outcome.success ? (
              <p className={styles.fact}>{plant.fact}</p>
            ) : (
              <p className={styles.fact}>
                About one flower visit in five comes to nothing, even for a good
                bee. It costs you nothing but a moment. Fly to the next one.
              </p>
            )}

            <button
              autoFocus
              className={styles.dismiss}
              onClick={dismiss}
              type="button"
            >
              {outcome.success ? "Carry on" : "Try another"}
            </button>
          </div>
        ) : confirming ? (
          <div className={styles.confirm}>
            <p className={styles.confirmTitle}>Give up on this flower?</p>
            <p className={styles.confirmNote}>
              Leaving now counts as a visit, and most unfinished visits come to
              nothing. You can keep going instead.
            </p>
            <div className={styles.confirmButtons}>
              <button
                className={styles.dismiss}
                onClick={() => setConfirming(false)}
                type="button"
              >
                Keep going
              </button>
              <button
                className={styles.giveUp}
                onClick={() => finish(scoreRef.current)}
                type="button"
              >
                Give up
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.instruction}>{spec.instruction}</p>

            {body}

            <div className={styles.timer}>
              <span style={{ width: `${(1 - progress) * 100}%` }} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
