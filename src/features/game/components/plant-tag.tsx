"use client";

import { Html } from "@react-three/drei";

import { useGameStore } from "../state/game-store";
import type { PlantInstance } from "../world/plant-scatter";
import styles from "./plant-tag.module.css";

/**
 * The card that hovers over the plant you're next to, anchored in the world
 * rather than pinned to the middle of the screen.
 *
 * It is deliberately small and complete: a name, one line, and two ways out. It
 * carries no photograph, no bloom window, no attribution — the moment a card
 * like this tries to hold the whole entry it overflows and the player is left
 * fighting a scrollbar in the middle of a flight. The full story lives one
 * button away.
 */
export function PlantTag({ instance }: { instance: PlantInstance }) {
  const openPlantEntry = useGameStore((state) => state.openPlantEntry);
  const pollinatePlant = useGameStore((state) => state.pollinatePlant);
  const pollinated = useGameStore(
    (state) => Boolean(state.pollinatedPlants[instance.plant.id]),
  );

  const { plant, position, scale } = instance;

  // Float it just above the bloom. The plant is now fifteen-odd units tall, so
  // this has to be measured from the flower, not from a fixed height.
  const anchor: [number, number, number] = [
    position[0],
    position[1] + plant.height * scale + 4,
    position[2],
  ];

  return (
    // distanceFactor scales the card with distance so it sits in the world
    // rather than floating on the glass. Keep it low — too high and the card
    // swallows the plant it's meant to be pointing at, and the bee with it.
    <Html center distanceFactor={5} position={anchor} zIndexRange={[12, 0]}>
      <div className={styles.tag}>
        <p className={styles.name}>{plant.commonName}</p>
        <p className={styles.hook}>{plant.hook}</p>

        <div className={styles.actions}>
          {pollinated ? (
            <span className={styles.done}>Pollinated</span>
          ) : (
            <button
              className={styles.primary}
              onClick={() => pollinatePlant(plant.id)}
              type="button"
            >
              Pollinate <kbd>Space</kbd>
            </button>
          )}
          <button
            className={styles.secondary}
            onClick={() => openPlantEntry(plant.id)}
            type="button"
          >
            Read more <kbd>R</kbd>
          </button>
        </div>
      </div>
    </Html>
  );
}
