"use client";

import { useEffect } from "react";

import { FUNGI_BY_ID } from "../data/fungi";
import { PLANTS_BY_ID } from "../data/plants";
import { triviaFor } from "../data/trivia";
import { useGameStore } from "../state/game-store";
import styles from "./landing-menu.module.css";

/**
 * What you get for landing on something.
 *
 * Landing is the point. You used to hover next to a flower and press a key; now
 * you settle onto it, and the game asks what you want to do with it. On a flower
 * you can pollinate, which is the job. On a mushroom you cannot, because nothing
 * pollinates a mushroom and pretending otherwise would be teaching a lie.
 *
 * Both offer the quiz, because reading the entry ought to be worth something.
 */
export function LandingMenu() {
  const landedOn = useGameStore((state) => state.ui.landedOn);
  const takeOff = useGameStore((state) => state.takeOff);
  const startMinigame = useGameStore((state) => state.startMinigame);
  const startQuiz = useGameStore((state) => state.startQuiz);
  const openEntry = useGameStore((state) => state.openEntry);
  const pollinatedPlants = useGameStore((state) => state.pollinatedPlants);
  const quizPassed = useGameStore((state) => state.quizPassed);

  useEffect(() => {
    if (!landedOn) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        takeOff();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [landedOn, takeOff]);

  if (!landedOn) {
    return null;
  }

  const isPlant = landedOn.kind === "plant";
  const plant = isPlant ? PLANTS_BY_ID.get(landedOn.id) : undefined;
  const fungus = !isPlant ? FUNGI_BY_ID.get(landedOn.id) : undefined;

  const name = plant?.commonName ?? fungus?.commonName ?? "";
  const scientific = plant?.scientificName ?? fungus?.scientificName ?? "";
  const alreadyPollinated = plant ? Boolean(pollinatedPlants[plant.id]) : false;
  const alreadyQuizzed = Boolean(quizPassed[landedOn.id]);
  const hasQuiz = triviaFor(landedOn.id).length > 0;

  // A difficult flower, and you have not learned it yet. The button stays on the
  // card and stays dead, with the reason next to it, because a control that
  // vanishes teaches nothing: you would never find out the flower was hard, only
  // that the game had quietly stopped offering.
  const locked = Boolean(plant?.demanding) && !alreadyQuizzed;

  return (
    <div className={styles.scrim} onClick={takeOff} role="presentation">
      <section
        aria-label={`Landed on ${name}`}
        aria-modal="true"
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <p className={styles.eyebrow}>Landed on</p>
        <h2 className={styles.name}>{name}</h2>
        <p className={styles.scientific}>{scientific}</p>

        <div className={styles.actions}>
          {isPlant && locked ? (
            <div className={styles.disabled}>
              <span className={styles.actionTitle}>
                Learn it before you work it
              </span>
              <span className={styles.actionNote}>{plant!.demanding}</span>
            </div>
          ) : isPlant ? (
            <button
              className={styles.primary}
              onClick={() => startMinigame(landedOn.id)}
              type="button"
            >
              <span className={styles.actionTitle}>
                {alreadyPollinated ? "Pollinate again" : "Pollinate it"}
              </span>
              <span className={styles.actionNote}>
                Work the flower. About one visit in five comes to nothing.
              </span>
            </button>
          ) : (
            <div className={styles.disabled}>
              <span className={styles.actionTitle}>Cannot be pollinated</span>
              <span className={styles.actionNote}>
                Nothing pollinates a mushroom. It is not a plant, it has no
                flower, and it wants nothing from you.
              </span>
            </div>
          )}

          {hasQuiz ? (
            <button
              className={locked ? styles.primary : styles.secondary}
              onClick={() => startQuiz(landedOn)}
              type="button"
            >
              <span className={styles.actionTitle}>
                {alreadyQuizzed ? "Take the quiz again" : "Take the quiz"}
              </span>
              <span className={styles.actionNote}>
                Three questions. Two right is a pass.
                {locked
                  ? " Pass it and this flower opens."
                  : alreadyQuizzed
                    ? " You have passed this one."
                    : ""}
              </span>
            </button>
          ) : null}

          <button
            className={styles.secondary}
            onClick={() => openEntry(landedOn)}
            type="button"
          >
            <span className={styles.actionTitle}>Read the entry</span>
            <span className={styles.actionNote}>
              The photograph, the facts, and where to read more.
            </span>
          </button>
        </div>

        <footer className={styles.footer}>
          <button className={styles.leave} onClick={takeOff} type="button">
            Take off
          </button>
          <span className={styles.hint}>
            <kbd>Esc</kbd>
          </span>
        </footer>
      </section>
    </div>
  );
}
