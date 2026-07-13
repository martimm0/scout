"use client";

import { useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { setSoundEnabled } from "../audio/sound";
import { useGameStore } from "../state/game-store";
import styles from "./first-flight.module.css";

const STEPS = [
  {
    title: "You are a bee.",
    body: "About a centimetre long, in a park that runs to six hundred acres. The grass comes up past your head and an oak is a mountain. This is the correct scale, and it is the whole point.",
    keys: null,
  },
  {
    title: "Fly.",
    body: "Move the mouse to look. Your nose follows the view, and that is also the way you fly. Up and Down for forward and back. Left and Right to turn. E and Q for altitude. Shift to hurry. Trees and rocks are solid, so mind the oaks.",
    keys: ["↑ ↓", "← →", "E / Q", "Shift"],
  },
  {
    title: "Find the flowers. And the fungi.",
    body: "Pollen motes drift over everything you haven't met yet. The park runs on Pittsburgh time: flowers shut at dusk, some close by lunchtime, and the fungi keep their own hours. Come back at a different hour and you will find different things.",
    keys: null,
  },
  {
    title: "Land on it.",
    body: "Space sets you down. From there you can pollinate the flower, or let it quiz you on what you just read. About one visit in five comes to nothing: wind, timing, or somebody got there first. That's not you failing. That's the job. Fly to the next one. Nothing pollinates a mushroom, but a mushroom will still test you.",
    keys: ["Space to land", "R to read"],
  },
];

/**
 * First flight.
 *
 * Shown once, skippable, and it teaches the two things nobody guesses: that the
 * mouse steers rather than merely looks, and that failing to pollinate is normal
 * rather than a mistake. Everything else the player can find out by flying.
 */
export function FirstFlight() {
  const tutorialSeen = useGameStore((state) => state.tutorialSeen);
  const completeTutorial = useGameStore((state) => state.completeTutorial);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const [step, setStep] = useState(0);

  if (tutorialSeen) {
    return null;
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = (withSound: boolean) => {
    if (withSound) {
      // Starting audio here is deliberate: it's a real user gesture, which is
      // the only moment a browser will let a page make noise.
      updateSettings({ soundOn: true });
      setSoundEnabled(true);
    }

    trackEvent({ name: "tutorial_completed", withSound });
    completeTutorial();
  };

  return (
    <div className={styles.scrim}>
      <section
        aria-labelledby="first-flight-title"
        aria-modal="true"
        className={styles.card}
        role="dialog"
      >
        <p className={styles.progress}>
          {step + 1} of {STEPS.length}
        </p>

        <h2 className={styles.title} id="first-flight-title">
          {current.title}
        </h2>
        <p className={styles.body}>{current.body}</p>

        {current.keys ? (
          <ul className={styles.keys}>
            {current.keys.map((key) => (
              <li key={key}>
                <kbd>{key}</kbd>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.actions}>
          {last ? (
            <>
              <button
                className={styles.primary}
                onClick={() => finish(true)}
                type="button"
              >
                Fly, with sound
              </button>
              <button
                className={styles.secondary}
                onClick={() => finish(false)}
                type="button"
              >
                Fly in silence
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.primary}
                onClick={() => setStep((value) => value + 1)}
                type="button"
              >
                Next
              </button>
              <button
                className={styles.secondary}
                onClick={() => finish(false)}
                type="button"
              >
                Skip
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
