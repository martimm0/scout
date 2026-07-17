"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { playSound } from "../audio/sound";
import {
  FAILURE_MESSAGES,
  MINIGAME_FOR_ARCHETYPE,
  MINIGAME_SPEC,
  SUCCESS_MESSAGES,
  pickMessage,
  resolvePollination,
} from "../data/pollination";
import { PLANTS_BY_ID, type Plant } from "../data/plants";
import { useGameStore } from "../state/game-store";
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
  const plant = plantId ? PLANTS_BY_ID.get(plantId) : undefined;

  if (!plant) {
    return null;
  }

  // Keyed on the plant so every attempt starts from a clean component rather
  // than a pile of reset effects.
  return <MinigameRun key={plant.id} plant={plant} />;
}

function MinigameRun({ plant }: { plant: Plant }) {
  const endMinigame = useGameStore((state) => state.endMinigame);
  const pollinatePlant = useGameStore((state) => state.pollinatePlant);
  const recordAttempt = useGameStore((state) => state.recordPollinationAttempt);
  const recordScore = useGameStore((state) => state.recordMinigameScore);

  const kind = MINIGAME_FOR_ARCHETYPE[plant.archetype];
  const spec = MINIGAME_SPEC[kind];
  const Game = MINIGAMES[kind];

  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

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

      // Deterministic-ish per attempt, but genuinely variable: this is the one
      // place chance enters the game.
      const roll = Math.random();
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
    [plant.id, kind, recordAttempt, recordScore, pollinatePlant],
  );

  const finishEarly = useCallback(
    (score: number) => finish(score),
    [finish],
  );

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
    if (outcome) {
      return;
    }

    let raf = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      setProgress(Math.min(1, elapsed / spec.duration));

      if (elapsed >= spec.duration) {
        finish(scoreRef.current);

        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [outcome, spec.duration, finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        endMinigame();

        return;
      }

      if (outcome && (event.code === "Space" || event.code === "Enter")) {
        event.preventDefault();
        endMinigame();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [outcome, endMinigame]);

  const body = useMemo(
    () => (
      <Game
        duration={spec.duration}
        finishEarly={finishEarly}
        plant={plant}
        reportScore={reportScore}
      />
    ),
    [Game, spec.duration, finishEarly, plant, reportScore],
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
              onClick={endMinigame}
              type="button"
            >
              {outcome.success ? "Carry on" : "Try another"}
            </button>
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
