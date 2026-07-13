"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { PLANT_PHOTOS } from "../data/plant-photos";
import { PLANTS_BY_ID } from "../data/plants";
import { useGameStore } from "../state/game-store";
import { AREAS, RAVINE_AREA } from "../world/terrain";
import styles from "./plant-entry.module.css";

const AREA_LABEL = new Map(
  [...AREAS, RAVINE_AREA].map((area) => [area.id, area.label]),
);

/**
 * What you get for finding a plant.
 *
 * Deliberately not the shared Modal primitive. That gives a stark white card, a
 * hard-edged Close button and a black scrim — the rhythm of an error dialog,
 * which is the wrong note entirely for a bee finding a flower. This eases in,
 * leaves the park visible behind it, and reads like a page from a naturalist's
 * journal rather than a record being filed.
 */
export function PlantEntry() {
  const activePlantId = useGameStore((state) => state.ui.activePlantId);
  const closePlantEntry = useGameStore((state) => state.closePlantEntry);
  const pollinatedPlants = useGameStore((state) => state.pollinatedPlants);

  const cardRef = useRef<HTMLElement>(null);
  const plant = activePlantId ? PLANTS_BY_ID.get(activePlantId) : undefined;

  useEffect(() => {
    if (plant) {
      cardRef.current?.focus();
    }
  }, [plant]);

  // Space also dismisses, so you can carry on without reaching for the mouse.
  // Escape is handled in the scene, alongside releasing the pointer.
  useEffect(() => {
    if (!plant) {
      return;
    }

    // The card is opened by a Space keydown. Dismissing on keyup would let that
    // very same press close it again the moment the player lifted their finger —
    // the card would flash up and vanish. So: dismiss on the NEXT keydown, and
    // hold a short grace window in case the events arrive out of order.
    const openedAt = performance.now();

    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      if (performance.now() - openedAt < 250) {
        return;
      }

      event.preventDefault();
      closePlantEntry();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [plant, closePlantEntry]);

  if (!plant) {
    return null;
  }

  const photo = PLANT_PHOTOS[plant.id];
  const pollinated = Boolean(pollinatedPlants[plant.id]);
  const where = AREA_LABEL.get(plant.area) ?? "Frick Park";

  return (
    <div
      className={styles.scrim}
      onClick={closePlantEntry}
      role="presentation"
    >
      <section
        aria-labelledby="plant-entry-name"
        aria-modal="true"
        className={styles.card}
        // The card itself shouldn't dismiss when clicked — only the park around it.
        onClick={(event) => event.stopPropagation()}
        ref={cardRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <p className={styles.eyebrow}>
            {pollinated ? "Pollinated" : "Found"} in the {where}
          </p>
          <h2 className={styles.name} id="plant-entry-name">
            {plant.commonName}
          </h2>
          <p className={styles.scientific}>{plant.scientificName}</p>
        </header>

        {/* Photograph beside the text, not stacked above it. Stacked, the card
            outgrew the viewport and the reader was left scrolling a dialogue
            mid-flight. Side by side it simply fits. */}
        <div className={styles.columns}>
          {photo ? (
            <figure className={styles.figure}>
              <Image
                alt={`${plant.commonName} (${plant.scientificName}) in flower`}
                className={styles.photo}
                height={520}
                sizes="(max-width: 760px) 90vw, 300px"
                src={photo.src}
                width={900}
              />
              <figcaption className={styles.credit}>
                <a href={photo.sourceUrl} rel="noreferrer" target="_blank">
                  {photo.author}
                </a>
                {" · "}
                <a href={photo.licenseUrl} rel="noreferrer" target="_blank">
                  {photo.license}
                </a>
              </figcaption>
            </figure>
          ) : null}

          <div className={styles.text}>
            <p className={styles.bloom}>
              Blooms <strong>{plant.bloom}</strong>
            </p>

            <p className={styles.fact}>{plant.fact}</p>

            <p className={styles.note}>{plant.pollinatorNote}</p>
          </div>
        </div>

        <footer className={styles.footer}>
          {/* No autoFocus: it stamps a hard blue focus ring on the button the
              instant the card appears, which is exactly the jolt we're avoiding.
              The card itself takes focus instead, so keyboard users land here
              and Esc still works. */}
          <button className={styles.dismiss} onClick={closePlantEntry} type="button">
            Keep flying
          </button>
          <a
            className={styles.wiki}
            href={plant.wikipedia}
            rel="noreferrer"
            target="_blank"
          >
            Read on Wikipedia ↗
          </a>
          <span className={styles.hint}>
            <kbd>Esc</kbd>
          </span>
        </footer>
      </section>
    </div>
  );
}
