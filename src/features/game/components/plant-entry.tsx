"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { EDIBILITY_LABEL, FUNGI_BY_ID } from "../data/fungi";
import { photoFor } from "../data/plant-photos";
import { describeHomes, PLANTS_BY_ID } from "../data/plants";
import { useGameStore } from "../state/game-store";
import { PARK_LIST, PARKS } from "../world/terrain";
import { allAreas } from "../world/park";
import styles from "./plant-entry.module.css";

const AREA_LABEL = new Map(
  PARK_LIST.flatMap((park) => allAreas(park)).map((area) => [area.id, area.label]),
);

/**
 * The full entry, for a plant or a fungus.
 *
 * Deliberately not the shared Modal primitive. That gives a stark white card, a
 * hard-edged Close button and a black scrim, which is the rhythm of an error
 * dialog. This eases in, leaves the park visible behind it, and reads like a page
 * from a naturalist's journal rather than a record being filed.
 */
export function PlantEntry() {
  const activeEntry = useGameStore((state) => state.ui.activeEntry);
  const closeEntry = useGameStore((state) => state.closeEntry);
  const pollinatedPlants = useGameStore((state) => state.pollinatedPlants);
  const quizPassed = useGameStore((state) => state.quizPassed);

  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (activeEntry) {
      cardRef.current?.focus();
    }
  }, [activeEntry]);

  useEffect(() => {
    if (!activeEntry) {
      return;
    }

    const openedAt = performance.now();

    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      // The entry can be opened by a Space keydown. Dismissing on keyup would let
      // that same press close it again the instant the player lifted a finger.
      if (performance.now() - openedAt < 250) {
        return;
      }

      event.preventDefault();
      closeEntry();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [activeEntry, closeEntry]);

  if (!activeEntry) {
    return null;
  }

  const plant =
    activeEntry.kind === "plant" ? PLANTS_BY_ID.get(activeEntry.id) : undefined;
  const fungus =
    activeEntry.kind === "fungus" ? FUNGI_BY_ID.get(activeEntry.id) : undefined;

  if (!plant && !fungus) {
    return null;
  }

  const photo = photoFor(activeEntry.id);

  const name = plant?.commonName ?? fungus!.commonName;
  const scientific = plant?.scientificName ?? fungus!.scientificName;
  const homes = plant?.homes ?? fungus!.homes;
  const fact = plant?.fact ?? fungus!.fact;
  const note = plant?.pollinatorNote ?? fungus!.roleNote;
  const wikipedia = plant?.wikipedia ?? fungus!.wikipedia;
  const window_ = plant?.window ?? fungus!.window;

  const pollinated = plant ? Boolean(pollinatedPlants[plant.id]) : false;
  const learned = Boolean(quizPassed[activeEntry.id]);
  const where = describeHomes(
    homes,
    (id) => AREA_LABEL.get(id) ?? "the park",
    (park) => PARKS[park].label,
  );

  const status = plant
    ? pollinated
      ? "Pollinated"
      : "Found"
    : "Found";

  return (
    <div className={styles.scrim} onClick={closeEntry} role="presentation">
      <section
        aria-labelledby="plant-entry-name"
        aria-modal="true"
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        ref={cardRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <p className={styles.eyebrow}>
            {status} in the {where}
            {learned ? " · Quiz passed" : ""}
          </p>
          <h2 className={styles.name} id="plant-entry-name">
            {name}
          </h2>
          <p className={styles.scientific}>{scientific}</p>
        </header>

        <div className={styles.columns}>
          {photo ? (
            <figure className={styles.figure}>
              <Image
                alt={`${name} (${scientific})`}
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
            {plant ? (
              <p className={styles.bloom}>
                Blooms <strong>{plant.bloom}</strong>
              </p>
            ) : (
              <p className={styles.bloom}>
                Fruits <strong>{fungus!.season}</strong>
                {" · "}
                <strong
                  className={styles.edibility}
                  data-risk={fungus!.edibility}
                >
                  {EDIBILITY_LABEL[fungus!.edibility]}
                </strong>
              </p>
            )}

            <p className={styles.when}>{window_.note}</p>

            <p className={styles.fact}>{fact}</p>

            <p className={styles.note}>{note}</p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button className={styles.dismiss} onClick={closeEntry} type="button">
            Keep flying
          </button>
          <a
            className={styles.wiki}
            href={wikipedia}
            rel="noreferrer"
            target="_blank"
          >
            Read on Wikipedia
          </a>
          <span className={styles.hint}>
            <kbd>Esc</kbd>
          </span>
        </footer>
      </section>
    </div>
  );
}
