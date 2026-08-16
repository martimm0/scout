"use client";

import { useEffect, useState } from "react";

import { FUNGI_BY_ID } from "../data/fungi";
import { PLANTS_BY_ID } from "../data/plants";
import { triviaFor } from "../data/trivia";
import { useGameStore } from "../state/game-store";
import {
  FORAGERS,
  occupancyOf,
  VISIT_SECONDS,
  type Occupancy,
} from "../world/foragers";
import { isInSeason, seasonWindow } from "../world/season";
import { askingWinterName } from "../world/winter";
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
export function LandingMenu({
  busy,
  month,
}: {
  busy?: "on" | "off";
  month: number;
}) {
  const landedOn = useGameStore((state) => state.ui.landedOn);
  const activeEntry = useGameStore((state) => state.ui.activeEntry);
  const takeOff = useGameStore((state) => state.takeOff);
  const startMinigame = useGameStore((state) => state.startMinigame);
  const startWinterId = useGameStore((state) => state.startWinterId);
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const winterKnown = useGameStore((state) => state.winterKnown);
  const startQuiz = useGameStore((state) => state.startQuiz);
  const openEntry = useGameStore((state) => state.openEntry);
  const pollinatedPlants = useGameStore((state) => state.pollinatedPlants);
  const quizPassed = useGameStore((state) => state.quizPassed);

  /**
   * Escape takes off, unless the entry is open on top of this card.
   *
   * The card is the only popover in the game that something else can be layered
   * over: starting the quiz, the minigame or the winter question all clear
   * `landedOn` first, but reading the entry deliberately does not, so that
   * closing it puts you back on the plant you were standing on.
   *
   * Escape used to break that. Two window listeners fired on the one keypress,
   * the scene's closing the entry and this one taking off, so reading an entry
   * and pressing Escape put you in the air rather than back on the card, and you
   * had to find the plant and land on it again to pollinate it. It costs most on
   * the path the winter question offers by name: "Look it up instead" is the
   * game telling you to go and read the entry and come back and name it.
   */
  useEffect(() => {
    if (!landedOn || activeEntry) {
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
  }, [activeEntry, landedOn, takeOff]);

  /**
   * The clock, while you are standing on something.
   *
   * The insect on the flower leaves after about eighteen seconds, and the whole
   * point of saying so is that waiting is a real choice: a card that worked the
   * answer out once would tell you to wait and never notice the wait was over.
   *
   * The clock is read in the timer callback rather than in render, because
   * reading it in render is impure and the linter is right to say so. `land`
   * stamps the arrival in the event handler, where reading a clock is exactly
   * the right thing to do, and this only has to keep up afterwards. One second
   * is plenty for a number on a card.
   */
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!landedOn || busy) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [busy, landedOn]);

  if (!landedOn) {
    return null;
  }

  /**
   * Who is on this flower, if anybody.
   *
   * `busy` pins it for the suite, the same way `hour` pins the clock. Fungi are
   * excluded rather than exempted by accident: this is about a flower's pollen
   * being spent, and nothing about a mushroom works that way.
   */
  const occupancy: Occupancy | null =
    landedOn.kind !== "plant"
      ? null
      : busy === "on"
        ? { forager: FORAGERS[0], freeIn: VISIT_SECONDS }
        : busy === "off"
          ? null
          : occupancyOf(
              landedOn.key,
              /**
               * The later of "when you landed" and "the last tick".
               *
               * `now` starts at zero on every landing and only moves once the
               * interval has fired, so the max is what makes this correct on the
               * first paint AND correct a moment later, without an effect
               * reaching back to reset it.
               */
              Math.max(landedOn.at ?? 0, now) / 1000,
            );

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

  /**
   * Out of its season: there is no flower on it to work.
   *
   * You can still land, read and take the quiz, which is the whole point of
   * letting a plant be found out of bloom. Only the pollinating waits, and it says
   * which month to come back in, the same way a demanding flower says what to
   * learn first.
   */
  const outOfBloom =
    plant !== undefined && !isInSeason(seasonWindow(plant.bloom), month);

  /**
   * The winter question, offered only where it is a question.
   *
   * Needs the plant to be one that actually stands through winter, to be a month
   * it is standing IN, and to be one you have already met in leaf. The last is
   * what keeps this from being a wall for anybody who started playing in January:
   * you are being asked to recognise something, not to guess at a stranger.
   */
  const canAskWinter =
    plant !== undefined &&
    askingWinterName(plant, month, {
      met: Boolean(discoveredPlants[plant.id]),
      named: Boolean(winterKnown[plant.id]),
    });

  return (
    <div className={styles.scrim} onClick={takeOff} role="presentation">
      <section
        aria-label={
          canAskWinter ? "Landed on something you have met" : `Landed on ${name}`
        }
        aria-modal="true"
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <p className={styles.eyebrow}>Landed on</p>
        {/**
         * The card keeps the secret the tag is keeping.
         *
         * This announced the common name and the scientific name in its title,
         * which handed over the answer to the winter question for the price of
         * pressing Space, before the question had even been asked. The tag went
         * to the trouble of withholding it and this gave it away one keystroke
         * later.
         */}
        <h2 className={styles.name}>
          {canAskWinter ? "Something you have met" : name}
        </h2>
        <p className={styles.scientific}>
          {canAskWinter ? "Bare, and standing" : scientific}
        </p>

        <div className={styles.actions}>
          {isPlant && outOfBloom ? (
            <div className={styles.disabled}>
              <span className={styles.actionTitle}>Not in flower</span>
              <span className={styles.actionNote}>
                {/* Says the same thing without the name while a winter question
                    is open on it. Every plant standing in January is out of
                    bloom by definition, so this branch always renders then, and
                    naming the plant here gave the answer away every time. */}
                {canAskWinter
                  ? "Nothing to pollinate on it today. Name it first, and the rest of the card comes back."
                  : `${plant!.commonName} blooms ${plant!.bloom}. There is nothing to pollinate on it today, but the entry and the quiz are here whenever you are.`}
              </span>
            </div>
          ) : isPlant && locked ? (
            <div className={styles.disabled}>
              <span className={styles.actionTitle}>
                Learn it before you work it
              </span>
              <span className={styles.actionNote}>{plant!.demanding}</span>
            </div>
          ) : isPlant && occupancy ? (
            /**
             * Somebody got there first, and for once you can see it.
             *
             * This is a slice of the one visit in five moved out of a dice roll
             * at the end of a minigame and into the world, where it can be read
             * before you spend twelve seconds on it. It is not a punishment and
             * it is not a wall: the flower comes free in under half a minute,
             * the card counts it down, and the button appears by itself when it
             * does. Or fly on, which is what a bee does.
             */
            <div className={styles.disabled}>
              <span className={styles.actionTitle}>
                Somebody is already on it
              </span>
              <span className={styles.actionNote}>
                A {occupancy.forager.species.toLowerCase()} (
                {occupancy.forager.scientificName}) is{" "}
                {occupancy.forager.doing}. Its pollen is spent for the moment.
                Free again in about {Math.ceil(occupancy.freeIn)}s, or fly on:
                there are plenty more.
              </span>
            </div>
          ) : isPlant ? (
            <button
              className={styles.primary}
              onClick={() => startMinigame(landedOn.id, month, landedOn.key)}
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

          {/* Winter, standing, and not yet named from its bare form. The one
              action the summer park never offers. */}
          {canAskWinter ? (
            <button
              className={styles.primary}
              onClick={() => startWinterId(landedOn)}
              type="button"
            >
              <span className={styles.actionTitle}>Name it from its winter form</span>
              <span className={styles.actionNote}>
                No flower, no leaf. Just a shape, a height and a place.
              </span>
            </button>
          ) : null}

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
            {/* Named as a CHOICE while a winter question is open. Reading the
                entry gives the answer away, and hiding it would be the game
                withholding what it knows, which it does not do. Saying plainly
                that this is looking it up leaves the decision with the player
                instead of springing it on them. */}
            <span className={styles.actionTitle}>
              {canAskWinter ? "Look it up instead" : "Read the entry"}
            </span>
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
