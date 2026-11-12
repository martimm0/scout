"use client";

import { useEffect, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { setSoundEnabled } from "../audio/sound";
import { useCoarsePointer } from "../hooks/use-media-query";
import { useGameStore, type GameStore } from "../state/game-store";
import styles from "./first-flight.module.css";
import { inputSuspended } from "./game-scene";

/** Where the bee was when a step began. */
type Mark = { x: number; z: number; altitude: number };

type Step = {
  title: string;
  body: string;
  /** The same instruction for two thumbs. Short: it shares a phone with the pad. */
  touch: string;
  keys?: string[];
  /** Has the player done it? `turned` is the heading swept since the step began, in degrees. */
  done?: (state: GameStore, from: Mark, turned: number) => boolean;
};

/** Enough to mean it, little enough that a second of input does it. */
const TURN_DEGREES = 60;
const FLY_DISTANCE = 30;
const CLIMB_DISTANCE = 4;

const STEPS: Step[] = [
  {
    title: "Look around.",
    body: "Click the park, then move the mouse. The bee turns to follow your view, and that is also the way it flies.",
    touch: "Push the FLY circle sideways. The bee turns, and where its nose points is where it goes.",
    keys: ["Mouse", "← →"],
    done: (_state, _from, turned) => turned >= TURN_DEGREES,
  },
  {
    title: "Fly.",
    body: "Up or W flies forward, Down or S backs off, Shift hurries. Trees and rocks are solid, so mind the oaks.",
    touch: "Push the FLY circle forward. FAST hurries you along. Mind the oaks.",
    keys: ["↑ / W", "↓ / S", "Shift"],
    done: (state, from) =>
      Math.hypot(state.player.position.x - from.x, state.player.position.z - from.z) >=
      FLY_DISTANCE,
  },
  {
    title: "Climb, then drop.",
    body: "E takes you up; Q or the scroll wheel brings you down. You are about a centimetre long, so the grass is over your head.",
    touch: "The arrows on the right take you up and down. You are about a centimetre long.",
    keys: ["E", "Q", "Scroll"],
    done: (state, from) => Math.abs(state.player.altitude - from.altitude) >= CLIMB_DISTANCE,
  },
  {
    title: "Find a flower.",
    body: "Follow the drifting pollen motes: they hang over everything you haven't met yet. What blooms is what is in bloom in Pittsburgh this week, at this hour.",
    touch: "Follow the drifting pollen motes. They hang over everything you haven't met yet.",
    done: (state) => state.ui.nearby !== null,
  },
  {
    title: "Land on it.",
    body: "Close enough and its name comes up. Press Space to set down.",
    touch: "Close enough and a card comes up with its name. Tap Land on it.",
    keys: ["Space"],
    done: (state) => state.ui.landedOn !== null,
  },
  {
    title: "That's the job.",
    body: "On a flower you can pollinate it, or let it quiz you. About one visit in five comes to nothing: wind, timing, or somebody got there first. That's not you failing. Fly to the next one. R reads an entry, P takes a photo, and Controls has the rest.",
    touch: "Pollinate it, or let it quiz you. About one visit in five comes to nothing, and that's the job, not you failing. ••• has the camera and the rest.",
  },
];

const LAST = STEPS.length - 1;

/** The shortest way round from one heading to the next, in degrees. */
function swept(from: number, to: number) {
  return Math.abs(((((to - from) % 360) + 540) % 360) - 180);
}

/**
 * First flight.
 *
 * Shown once, skippable, and taught by doing rather than reading: each step
 * waits for the player to actually turn, fly, climb, find and land, then moves
 * on. It sits over the live park rather than in front of it, so the bee flies
 * while it coaches. It closes on the two things nobody guesses: that failing to
 * pollinate is normal rather than a mistake, and whether to have sound.
 */
export function FirstFlight() {
  const showing = useGameStore((state) => !state.tutorialSeen || state.tutorialReplay);

  // Its own component, so a replay starts again from the first step.
  return showing ? <Coach /> : null;
}

function Coach() {
  const completeTutorial = useGameStore((state) => state.completeTutorial);
  const updateSettings = useGameStore((state) => state.updateSettings);
  // A landing menu, a minigame, a quiz: the card waits rather than sit on them.
  const busy = useGameStore((state) => inputSuspended(state.ui));
  // The offline clock has the top of a phone; the card moves down to clear it.
  const offline = useGameStore((state) => state.offlineRun.active);

  const [step, setStep] = useState(0);
  const coarsePointer = useCoarsePointer();
  const current = STEPS[step];
  const last = step === LAST;

  useEffect(() => {
    const done = STEPS[step].done;

    if (!done) {
      return;
    }

    const start = useGameStore.getState();
    const from: Mark = { ...start.player.position, altitude: start.player.altitude };
    let heading = start.player.heading;
    let turned = 0;

    const check = (state: GameStore) => {
      turned += swept(heading, state.player.heading);
      heading = state.player.heading;

      // Somebody who lands early has skipped ahead, not gone wrong.
      if (state.ui.landedOn) {
        setStep(LAST);
      } else if (done(state, from, turned)) {
        setStep((value) => (value === step ? value + 1 : value));
      }
    };

    check(start);

    return useGameStore.subscribe(check);
  }, [step]);

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

  if (busy) {
    return null;
  }

  return (
    <div className={styles.coach} data-offline={offline}>
      <section
        aria-labelledby="first-flight-title"
        className={styles.card}
        data-step={step + 1}
        role="region"
      >
        <p className={styles.progress}>
          First flight · {step + 1} of {STEPS.length}
        </p>

        <div aria-live="polite">
          <h2 className={styles.title} id="first-flight-title">
            {current.title}
          </h2>
          <p className={styles.body}>{coarsePointer ? current.touch : current.body}</p>
        </div>

        {current.keys && !coarsePointer ? (
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
            <button
              className={styles.secondary}
              onClick={() => finish(false)}
              type="button"
            >
              Skip
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
