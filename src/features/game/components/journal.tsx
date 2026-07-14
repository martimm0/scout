"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { BADGES } from "../data/badges";
import { EDIBILITY_LABEL, FUNGI } from "../data/fungi";
import { FUNGUS_PHOTOS } from "../data/fungus-photos";
import { CONCEPTS, POLLINATOR_ENTRIES } from "../data/journal";
import { PLANT_PHOTOS } from "../data/plant-photos";
import { describeHomes, PLANTS } from "../data/plants";
import { countUnlocked, useGameStore } from "../state/game-store";
import { MAX_PHOTOS, usePhotoStore } from "../state/photo-store";
import { PARK_LIST, PARKS } from "../world/terrain";
import { allAreas } from "../world/park";
import type { Home } from "../data/plants";
import styles from "./journal.module.css";

/** Every area in every park. The journal spans both. */
const ALL_AREAS = PARK_LIST.flatMap((park) => allAreas(park));

const AREA_BLURB: Record<string, string> = {
  "environmental-center":
    "The way in, off Beechwood Boulevard, through the old stone gates. The Center itself was rebuilt in 2016 as a Living Building: it makes its own energy and harvests its own water. There's a native garden out front, which is where most people's first flower is.",
  "blue-slide": "A long concrete slope that Pittsburgh children have been coming down on flattened cardboard for generations. From up here it's a mountainside. There's rough sunny meadow all around its edges, and the pollinators know it.",
  "bowling-green":
    "The only lawn bowling green in Pittsburgh, clipped to within an inch of its life and hedged on all four sides. Nothing much grows on it, which is rather the point, but the rough at its margins is thick with goldenrod and aster.",
  "nine-mile-run":
    "The creek at the bottom of the valley. It was buried under slag for most of the twentieth century and dug back out again in one of the largest urban stream restorations ever attempted in the United States. Everything wet and green down here is younger than it looks.",
  "falls-ravine":
    "Steep enough that the soil barely holds. Hemlocks, and the spring ephemerals that flower and vanish before the canopy closes over them.",
  "fern-hollow":
    "Deep shade, closed canopy, and ferns that from your height are small trees. Spicebush flowers here before it bothers growing leaves.",
};

type Tab =
  | "plants"
  | "fungi"
  | "photos"
  | "pollinators"
  | "areas"
  | "concepts"
  | "badges";

const TABS: { id: Tab; label: string }[] = [
  { id: "plants", label: "Plants" },
  { id: "fungi", label: "Fungi" },
  { id: "photos", label: "Photos" },
  { id: "pollinators", label: "Pollinators" },
  { id: "areas", label: "Map areas" },
  { id: "concepts", label: "Ecology" },
  { id: "badges", label: "Badges" },
];

/**
 * The player's record of the park.
 *
 * Locked entries show their hint rather than a row of question marks. A locked
 * entry that says nothing teaches nothing and tempts nobody; a locked entry that
 * says "there's a darker wood than the one you know" sends somebody flying.
 */
export function Journal() {
  const [tab, setTab] = useState<Tab>("plants");

  const discovered = useGameStore((state) => state.discoveredPlants);
  const foundFungi = useGameStore((state) => state.discoveredFungi);
  const quizPassed = useGameStore((state) => state.quizPassed);
  const pollinated = useGameStore((state) => state.pollinatedPlants);
  const areas = useGameStore((state) => state.unlockedMapAreas);
  const entries = useGameStore((state) => state.unlockedJournalEntries);
  const badges = useGameStore((state) => state.unlockedBadges);
  const stats = useGameStore((state) => state.stats);
  const photos = usePhotoStore((state) => state.photos);
  const photoMode = usePhotoStore((state) => state.mode);
  const photosLoaded = usePhotoStore((state) => state.loaded);
  const loadPhotos = usePhotoStore((state) => state.load);
  const removePhoto = usePhotoStore((state) => state.remove);

  // The album is on the server, so the journal has to go and get it.
  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const discoveredCount = countUnlocked(discovered);
  const pollinatedCount = countUnlocked(pollinated);

  const successRate =
    stats.pollinationAttempts === 0
      ? null
      : Math.round(
          (stats.pollinationSuccesses / stats.pollinationAttempts) * 100,
        );

  return (
    <div className={styles.wrap}>
      <section className={styles.summary} aria-label="Progress summary">
        <div>
          <dt>Plants found</dt>
          <dd>
            {discoveredCount} <span>/ {PLANTS.length}</span>
          </dd>
        </div>
        <div>
          <dt>Pollinated</dt>
          <dd>
            {pollinatedCount} <span>/ {PLANTS.length}</span>
          </dd>
        </div>
        <div>
          <dt>Areas</dt>
          <dd>
            {countUnlocked(areas)} <span>/ {ALL_AREAS.length}</span>
          </dd>
        </div>
        <div>
          <dt>Fungi found</dt>
          <dd>
            {countUnlocked(foundFungi)} <span>/ {FUNGI.length}</span>
          </dd>
        </div>
        <div>
          <dt>Quizzes passed</dt>
          <dd>{stats.quizzesPassed}</dd>
        </div>
        <div>
          <dt>Photographs</dt>
          <dd>{photos.length}</dd>
        </div>
        <div>
          <dt>Badges</dt>
          <dd>
            {countUnlocked(badges)} <span>/ {BADGES.length}</span>
          </dd>
        </div>
        <div>
          <dt>Visits that took</dt>
          <dd>{successRate === null ? "Not yet" : `${successRate}%`}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{stats.bestStreak}</dd>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Journal sections">
        {TABS.map((entry) => (
          <button
            aria-current={tab === entry.id}
            className={styles.tab}
            key={entry.id}
            onClick={() => setTab(entry.id)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "plants" ? (
        <ul className={styles.grid}>
          {PLANTS.map((plant) => {
            const found = Boolean(discovered[plant.id]);
            const done = Boolean(pollinated[plant.id]);
            const photo = PLANT_PHOTOS[plant.id];

            return (
              <li className={styles.card} data-locked={!found} key={plant.id}>
                {found && photo ? (
                  <Image
                    alt={plant.commonName}
                    className={styles.thumb}
                    height={300}
                    sizes="220px"
                    src={photo.src}
                    width={400}
                  />
                ) : (
                  <div className={styles.thumbEmpty} aria-hidden>
                    ✿
                  </div>
                )}

                <div className={styles.cardBody}>
                  <p className={styles.cardTitle}>
                    {found ? plant.commonName : "Undiscovered"}
                  </p>

                  {found ? (
                    <>
                      <p className={styles.scientific}>{plant.scientificName}</p>
                      <p className={styles.cardText}>{plant.fact}</p>
                      <p className={styles.cardNote}>{plant.pollinatorNote}</p>
                      <p className={styles.meta}>
                        Blooms {plant.bloom}
                        {done ? " · Pollinated" : ""}
                      </p>
                      <a
                        className={styles.link}
                        href={plant.wikipedia}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Read on Wikipedia ↗
                      </a>
                      {photo ? (
                        <p className={styles.credit}>
                          Photo:{" "}
                          <a
                            href={photo.sourceUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {photo.author}
                          </a>{" "}
                          ·{" "}
                          <a
                            href={photo.licenseUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {photo.license}
                          </a>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className={styles.hint}>
                      Somewhere in {WHERE(plant.homes)}. {plant.window.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === "fungi" ? (
        <ul className={styles.grid}>
          {FUNGI.map((fungus) => {
            const found = Boolean(foundFungi[fungus.id]);
            const learned = Boolean(quizPassed[fungus.id]);
            const photo = FUNGUS_PHOTOS[fungus.id];

            return (
              <li className={styles.card} data-locked={!found} key={fungus.id}>
                {found && photo ? (
                  <Image
                    alt={fungus.commonName}
                    className={styles.thumb}
                    height={300}
                    sizes="220px"
                    src={photo.src}
                    width={400}
                  />
                ) : (
                  <div className={styles.thumbEmpty} aria-hidden>
                    ✦
                  </div>
                )}

                <div className={styles.cardBody}>
                  <p className={styles.cardTitle}>
                    {found ? fungus.commonName : "Not yet found"}
                  </p>

                  {found ? (
                    <>
                      <p className={styles.scientific}>{fungus.scientificName}</p>
                      <p className={styles.cardText}>{fungus.fact}</p>
                      <p className={styles.cardNote}>{fungus.roleNote}</p>
                      <p className={styles.meta}>
                        Fruits {fungus.season} ·{" "}
                        <strong data-risk={fungus.edibility}>
                          {EDIBILITY_LABEL[fungus.edibility]}
                        </strong>
                        {learned ? " · Quiz passed" : ""}
                      </p>
                      <a
                        className={styles.link}
                        href={fungus.wikipedia}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Read on Wikipedia
                      </a>
                      {photo ? (
                        <p className={styles.credit}>
                          Photo:{" "}
                          <a href={photo.sourceUrl} rel="noreferrer" target="_blank">
                            {photo.author}
                          </a>{" "}
                          ·{" "}
                          <a href={photo.licenseUrl} rel="noreferrer" target="_blank">
                            {photo.license}
                          </a>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className={styles.hint}>
                      Somewhere in {WHERE(fungus.homes)}. {fungus.window.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === "photos" ? (
        !photosLoaded ? (
          <p className={styles.empty}>Fetching your photographs…</p>
        ) : photos.length === 0 ? (
          <p className={styles.empty}>
            No photographs yet. Press <kbd>P</kbd> while you are flying, or use
            the Take a photo button, and whatever is on screen at that moment
            lands here. The park is worth photographing at dawn, and it is a
            different park entirely after dark.
          </p>
        ) : (
          <>
            <p className={styles.empty}>
              <strong>
                {photos.length} of {MAX_PHOTOS}
              </strong>{" "}
              {photoMode === "cloud"
                ? "kept in your account, so they are here whatever you are sitting at."
                : "kept on this device only, because there is no account to keep them in. They will not follow you to another browser."}{" "}
              {photos.length >= MAX_PHOTOS
                ? "Your album is full. Nothing is thrown away to make room, so to take another you have to delete one of these. Download it first if you want to keep it."
                : "Nothing is ever deleted to make room: when the album is full, you choose what goes."}
            </p>

            <ul className={styles.grid}>
              {photos.map((photo) => (
                <li className={styles.card} key={photo.id}>
                  {/* Not next/image: this is a data URL that exists only in this
                      browser, and there is nothing for the optimiser to do to it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`Frick Park, ${photo.area}, ${photo.clock}`}
                    className={styles.thumb}
                    src={photo.src}
                  />

                  <div className={styles.cardBody}>
                    <p className={styles.cardTitle}>{photo.area}</p>
                    <p className={styles.meta}>
                      {photo.clock} · {photo.phase}
                    </p>

                    <div className={styles.photoActions}>
                      {/* The way out. A photograph you can only look at inside
                          somebody else's website is not really yours, and the
                          delete button below is a great deal less alarming when
                          this one sits next to it. */}
                      <a
                        className={styles.link}
                        download={downloadName(photo)}
                        href={photo.src}
                      >
                        Download
                      </a>
                      <button
                        className={styles.remove}
                        onClick={() => removePhoto(photo.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}

      {tab === "pollinators" ? (
        <ul className={styles.list}>
          {POLLINATOR_ENTRIES.map((entry) => {
            const unlocked = Boolean(entries[`pollinator:${entry.id}`]);

            return (
              <li
                className={styles.row}
                data-locked={!unlocked}
                key={entry.id}
              >
                <p className={styles.rowTitle}>{entry.title}</p>
                <p className={styles.rowText}>
                  {unlocked ? entry.body : entry.hint}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === "areas" ? (
        <ul className={styles.list}>
          {ALL_AREAS.map((area) => {
            const unlocked = Boolean(areas[area.id]);

            return (
              <li className={styles.row} data-locked={!unlocked} key={area.id}>
                <p className={styles.rowTitle}>
                  {unlocked ? area.label : "Somewhere you haven't been"}
                </p>
                <p className={styles.rowText}>
                  {unlocked
                    ? AREA_BLURB[area.id]
                    : "Fly further. The park is bigger than it looks from the lawn."}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === "concepts" ? (
        <ul className={styles.list}>
          {CONCEPTS.map((concept) => {
            const unlocked = Boolean(entries[`concept:${concept.id}`]);

            return (
              <li
                className={styles.row}
                data-locked={!unlocked}
                key={concept.id}
              >
                <p className={styles.rowTitle}>{concept.title}</p>
                <p className={styles.rowText}>
                  {unlocked ? concept.body : concept.hint}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === "badges" ? (
        <ul className={styles.badges}>
          {BADGES.map((badge) => {
            const earned = Boolean(badges[badge.id]);

            return (
              <li className={styles.badge} data-locked={!earned} key={badge.id}>
                <span className={styles.badgeIcon} aria-hidden>
                  {earned ? "✦" : "○"}
                </span>
                <div>
                  <p className={styles.rowTitle}>{badge.name}</p>
                  <p className={styles.rowText}>
                    {earned ? badge.description : badge.hint}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** "scout-falls-ravine-7-12-am.jpg" rather than a UUID. */
function downloadName(photo: { area: string; clock: string }) {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return `scout-${slug(photo.area)}-${slug(photo.clock)}.jpg`;
}

/** "Fern Hollow (Frick Park), and Panther Hollow (Schenley Park)". */
function WHERE(homes: Home[]) {
  return describeHomes(
    homes,
    (id) => AREA_LABEL(id),
    (park) => PARKS[park].label,
  );
}

function AREA_LABEL(id: string) {
  return ALL_AREAS.find((area) => area.id === id)?.label ?? "park";
}
