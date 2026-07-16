"use client";

import {
  parkUnlocked,
  requirementFor,
  useGameStore,
} from "../state/game-store";
import { PARK_LIST } from "../world/terrain";
import styles from "./park-picker.module.css";

/**
 * Which park.
 *
 * Schenley is locked until you have found half of Frick's plants, and the lock
 * SAYS SO, with the count. A locked door that will not tell you what opens it is
 * just a wall, and a player who cannot see the second park has no reason to go
 * looking for the eighth flower.
 */
export function ParkPicker({ onEnter }: { onEnter?: () => void }) {
  const currentPark = useGameStore((state) => state.currentPark);
  const unlockedParks = useGameStore((state) => state.unlockedParks);
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const enterPark = useGameStore((state) => state.enterPark);

  return (
    <ul className={styles.parks} aria-label="Parks">
      {PARK_LIST.map((park) => {
        const unlocked = parkUnlocked(
          { unlockedParks, discoveredPlants },
          park.id,
        );
        const here = park.id === currentPark;
        const requirement = requirementFor(park.id, discoveredPlants);

        return (
          <li
            className={styles.park}
            data-locked={!unlocked}
            data-here={here}
            key={park.id}
          >
            <p className={styles.name}>{park.label}</p>
            <p className={styles.blurb}>{park.blurb}</p>

            {unlocked ? (
              <button
                className={styles.enter}
                onClick={() => {
                  enterPark(park.id);
                  onEnter?.();
                }}
                type="button"
              >
                {here ? "Keep flying" : `Fly ${park.label}`}
              </button>
            ) : (
              <div className={styles.locked}>
                <p className={styles.lockNote}>
                  Find <strong>{requirement!.needed}</strong>{" "}
                  of {requirement!.from.label}&apos;s plants and {park.label}{" "}
                  opens. You have found <strong>{requirement!.found}</strong>.
                </p>
                <div
                  aria-hidden
                  className={styles.bar}
                  style={
                    {
                      "--progress": `${Math.min(100, (requirement!.found / requirement!.needed) * 100)}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
