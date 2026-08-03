"use client";

import { useMemo, useState } from "react";

import { playSound } from "../audio/sound";
import { PLANTS_BY_ID } from "../data/plants";
import { useGameStore } from "../state/game-store";
import { winterEvidence, winterOptions } from "../world/winter";
import styles from "./quiz.module.css";

/**
 * Name it from its winter form.
 *
 * The other half of the seasonal game. In summer the card over a plant tells you
 * what it is, which is the right way round for learning a meadow. In winter there
 * is nothing to read off it: the flowers are gone, the leaves are gone, and what
 * is left is a shape of a certain height standing in a certain place.
 *
 * That is genuinely how winter identification works, and it is why the evidence
 * here is structural rather than a paragraph somebody wrote per species. The
 * game already holds all three facts for every plant, sourced, and already draws
 * them: `winterEvidence` is only saying out loud what is standing in front of you.
 *
 * Borrows the quiz's stylesheet on purpose. It is the same shape of thing (a
 * question, some options, a kind answer either way) and a second stylesheet
 * saying the same thing would be a second stylesheet to keep in step.
 */
export function WinterId() {
  const ref = useGameStore((state) => state.ui.winterId);

  if (!ref) {
    return null;
  }

  return <WinterIdRun key={ref.key} plantId={ref.id} />;
}

function WinterIdRun({ plantId }: { plantId: string }) {
  const endWinterId = useGameStore((state) => state.endWinterId);
  const recordWinterId = useGameStore((state) => state.recordWinterId);
  const park = useGameStore((state) => state.currentPark);

  const plant = PLANTS_BY_ID.get(plantId);

  const options = useMemo(
    () => (plant ? winterOptions(plant, park) : []),
    [plant, park],
  );
  const evidence = useMemo(
    () => (plant ? winterEvidence(plant, park) : []),
    [plant, park],
  );

  const [picked, setPicked] = useState<string | null>(null);

  if (!plant) {
    return null;
  }

  const answered = picked !== null;
  const right = picked === plant.id;

  const choose = (id: string) => {
    if (answered) {
      return;
    }

    setPicked(id);

    if (id === plant.id) {
      recordWinterId(plant.id);
      playSound("discover");
    } else {
      playSound("pollinateFail");
    }
  };

  return (
    <div className={styles.scrim} role="presentation">
      <section
        aria-label="Name it from its winter form"
        aria-modal="true"
        className={styles.card}
        role="dialog"
      >
        <p className={styles.eyebrow}>Winter form</p>
        <p className={styles.question}>
          Nothing in flower, nothing in leaf. What is standing here?
        </p>

        <div className={styles.because}>
          {evidence.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className={styles.options}>
          {options.map((option) => (
            <button
              className={styles.option}
              data-state={
                !answered
                  ? undefined
                  : option.id === plant.id
                    ? "right"
                    : option.id === picked
                      ? "wrong"
                      : "muted"
              }
              disabled={answered}
              key={option.id}
              onClick={() => choose(option.id)}
              type="button"
            >
              {option.commonName}
            </button>
          ))}
        </div>

        {answered ? (
          <>
            <div className={styles.result} data-passed={String(right)}>
              <p className={styles.name}>
                {right ? "That is the one." : plant.commonName}
              </p>
              <p className={styles.resultNote}>
                {right
                  ? "Named from a bare stalk, which is the harder half of knowing a plant."
                  : "Not this time. It keeps standing there all winter, so you can come back and try it again."}
              </p>
            </div>
            <button
              className={styles.primary}
              onClick={endWinterId}
              type="button"
            >
              Done
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
