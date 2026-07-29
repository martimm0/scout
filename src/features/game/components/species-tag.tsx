"use client";

import { Html } from "@react-three/drei";

import { coarsePointerNow } from "../hooks/use-media-query";
import { useGameStore } from "../state/game-store";
import { type Daylight } from "../world/daylight";
import {
  briefSeasonWindow,
  describeSeasonWindow,
  isInSeason,
} from "../world/season";
import {
  isFindable,
  landingHeight,
  type SpeciesInstance,
} from "../world/species-scatter";
import styles from "./species-tag.module.css";

/**
 * The card that hovers over whatever you are next to, anchored in the world
 * rather than pinned to the middle of the screen.
 *
 * Small and complete: a name, one line, and a way in. It carries no photograph
 * and no attribution, because the moment a card like this tries to hold the
 * whole entry it overflows and the player is left fighting a scrollbar in the
 * middle of a flight. The full story lives one button away.
 */
export function SpeciesTag({
  daylight,
  month,
  instance,
}: {
  daylight: Daylight;
  month: number;
  instance: SpeciesInstance;
}) {
  const land = useGameStore((state) => state.land);
  const openEntry = useGameStore((state) => state.openEntry);
  const pollinated = useGameStore((state) =>
    Boolean(state.pollinatedPlants[instance.id]),
  );
  const quizPassed = useGameStore((state) =>
    Boolean(state.quizPassed[instance.id]),
  );

  const isPlant = instance.species.kind === "plant";
  // Say it from the air. Flying down to a flower to be told you cannot work it is
  // a wasted trip; knowing it is a difficult one before you go is the interesting
  // half of the information.
  const demanding =
    instance.species.kind === "plant" && Boolean(instance.species.plant.demanding);
  /**
   * You can land on anything you can FIND, not only on what is in bloom.
   *
   * A plant out of its season is still worth landing on: there is an entry to
   * read and a quiz to fail. Only the Pollinate button waits for the flower, and
   * the landing menu says so. Gating the whole card on the bloom is what made
   * two thirds of Frick unreachable in July.
   */
  const open = isFindable(instance, daylight.hour, month);
  // Shut for one of two reasons, and they call for different advice: out of its
  // hours (come back at dawn) or out of its season (come back in spring).
  const outOfSeason = !isInSeason(instance.season, month);
  const closedNote = outOfSeason
    ? describeSeasonWindow(instance.season, month)
    : instance.window.note;

  const ref = {
    kind: instance.species.kind,
    id: instance.id,
    key: instance.key,
  };

  /**
   * Where the card floats.
   *
   * Above the top of the plant on a desktop, which reads best. On a touch device
   * it hangs level with the bloom instead, and the reason is not taste: a landscape
   * phone is under four hundred pixels tall, and a card pinned four units above a
   * twenty-unit Joe-Pye weed projects clean off the top of the screen. The card is
   * where Land and Read live, so off the screen means the flower cannot be worked
   * at all. Found by a test that tried to tap it and was told the button was
   * outside the viewport.
   */
  const top = landingHeight(instance);
  const anchor: [number, number, number] = [
    instance.position[0],
    coarsePointerNow()
      ? instance.position[1] + (top - instance.position[1]) * 0.6
      : top + 4,
    instance.position[2],
  ];

  return (
    <Html center distanceFactor={5} position={anchor} zIndexRange={[12, 0]}>
      <div className={styles.tag} data-kind={instance.species.kind}>
        <p className={styles.kind}>{isPlant ? "Flower" : "Fungus"}</p>
        <p className={styles.name}>{instance.commonName}</p>
        <p className={styles.hook}>{instance.hook}</p>

        <div className={styles.badges}>
          {pollinated ? <span className={styles.done}>Pollinated</span> : null}
          {quizPassed ? <span className={styles.done}>Quiz passed</span> : null}
          {/* Out of its bloom, and still worth the trip: this says so from the
              air, the same way the demanding badge does. Without it the only way
              to learn a flower was out of season was to fly down and land on it,
              because the card that used to carry the seasonal note only appeared
              on a plant you could not reach at all. */}
          {isPlant && outOfSeason && open ? (
            <span className={styles.demanding}>
              {briefSeasonWindow(instance.season, month)}
            </span>
          ) : null}
          {demanding && !quizPassed ? (
            <span className={styles.demanding}>Pass the quiz to pollinate</span>
          ) : null}
        </div>

        {open ? (
          <div className={styles.actions}>
            <button
              className={styles.primary}
              onClick={() => land(ref)}
              type="button"
            >
              Land <kbd>Space</kbd>
            </button>
            <button
              className={styles.secondary}
              onClick={() => openEntry(ref)}
              type="button"
            >
              Read <kbd>R</kbd>
            </button>
          </div>
        ) : (
          // Shut. Say when to come back rather than just refusing.
          <p className={styles.closed}>{closedNote}</p>
        )}
      </div>
    </Html>
  );
}
