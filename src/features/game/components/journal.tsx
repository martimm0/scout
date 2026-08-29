"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { BADGES } from "../data/badges";
import { CONNECTIONS, needsParty } from "../data/connections";
import { bearingFrom, type Mark } from "../world/marks";
import { EDIBILITY_LABEL, FUNGI, FUNGI_BY_ID } from "../data/fungi";
import { CONCEPTS, POLLINATOR_ENTRIES } from "../data/journal";
import { photoFor } from "../data/plant-photos";
import { describeHomes, PLANTS, PLANTS_BY_ID } from "../data/plants";
import { countUnlocked, useGameStore } from "../state/game-store";
import { MAX_PHOTOS, usePhotoStore } from "../state/photo-store";
import { WEATHER_MOMENTS } from "../world/weather-moments";
import { standsInWinter } from "../world/winter";
import { ParkPicker } from "./park-picker";
import { PARK_LIST, PARKS } from "../world/terrain";
import { allAreas } from "../world/park";
import { AREA_BLURB } from "../data/areas";
import type { Home } from "../data/plants";
import styles from "./journal.module.css";

/** Every area in every park. The journal spans both. */
const ALL_AREAS = PARK_LIST.flatMap((park) => allAreas(park));

type Tab =
  | "plants"
  | "fungi"
  | "photos"
  | "pollinators"
  | "areas"
  | "concepts"
  | "connections"
  | "marks"
  | "weather"
  | "badges";

const TABS: { id: Tab; label: string }[] = [
  { id: "plants", label: "Plants" },
  { id: "fungi", label: "Fungi" },
  { id: "photos", label: "Photos" },
  { id: "pollinators", label: "Pollinators" },
  { id: "areas", label: "Map areas" },
  { id: "concepts", label: "Ecology" },
  { id: "connections", label: "Connections" },
  { id: "marks", label: "Danced about" },
  { id: "weather", label: "Weather" },
  { id: "badges", label: "Badges" },
];

/**
 * The player's record of the park.
 *
 * Locked entries show their hint rather than a row of question marks. A locked
 * entry that says nothing teaches nothing and tempts nobody; a locked entry that
 * says "there's a darker wood than the one you know" sends somebody flying.
 */
/**
 * The common name of a plant or a fungus, whichever it is.
 *
 * Connections cross between the two kingdoms, so a lookup that knew about only
 * one of them would render half the names as raw ids.
 */
/**
 * The park's name, and never a crash.
 *
 * `PARKS[id].label` throws on an id the game no longer has, and this is a LIST:
 * one stale mark would take the whole journal page down rather than rendering
 * one odd row. A save is allowed to be older than the code, which the seedlings
 * already assume and which this had quietly not.
 *
 * Marks are always written with the park you are flying, so reaching this needs
 * a park to have been removed from the data, or a save to have been edited by
 * hand. Both are cheap to survive and neither is worth a blank page.
 */
function parkLabel(id: string): string {
  return (PARKS as Record<string, { label: string }>)[id]?.label ??
    "A park that is no longer here";
}

/**
 * A mark, said in a way somebody can act on.
 *
 * Measured from the world origin, which is the middle of the park to within a
 * few units: Frick and Schenley are centred on it exactly and Highland is ten
 * out of a span of five hundred and forty. Raw world coordinates would be
 * honest and useless, since nobody can fly toward "z -61".
 *
 * The origin rather than the start point on purpose. Where you spawn is a
 * corner of the park you happen to arrive at, so a bearing from it would be
 * relative to a spot with no name and no visible presence; the middle is at
 * least somewhere you can orient against from the air.
 */
function describeMark(mark: Mark): string {
  const { distance, compass } = bearingFrom(mark, 0, 0);

  return `about ${Math.round(distance)} out, ${compass} of the middle`;
}

function nameOf(id: string): string {
  return (
    PLANTS_BY_ID.get(id)?.commonName ?? FUNGI_BY_ID.get(id)?.commonName ?? id
  );
}

export function Journal() {
  const [tab, setTab] = useState<Tab>("plants");

  const discovered = useGameStore((state) => state.discoveredPlants);
  const foundFungi = useGameStore((state) => state.discoveredFungi);
  const quizPassed = useGameStore((state) => state.quizPassed);
  const pollinated = useGameStore((state) => state.pollinatedPlants);
  const areas = useGameStore((state) => state.unlockedMapAreas);
  const entries = useGameStore((state) => state.unlockedJournalEntries);
  const badges = useGameStore((state) => state.unlockedBadges);
  const weatherSeen = useGameStore((state) => state.seenWeather);
  const winterKnown = useGameStore((state) => state.winterKnown);
  const stats = useGameStore((state) => state.stats);
  const marks = useGameStore((state) => state.marks);
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

      <section className={styles.parks} aria-label="Parks">
        <ParkPicker />
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
            const photo = photoFor(plant.id);

            return (
              <li className={styles.card} data-locked={!found} key={plant.id}>
                {/**
                 * An undiscovered species that needs company says so.
                 *
                 * Six plants and six fungi only come up in a garden party, and
                 * the counters legitimately include them: a party player can
                 * reach all of them, and a denominator that shrank for solo
                 * players would read "40 / 37" for anybody who joined one.
                 *
                 * What was missing is the reason. A solo completionist stalled
                 * at 37 of 43 with nothing anywhere to say why, hunting a wood
                 * that does not contain them. The connections layer already
                 * says "Only in a garden party" for exactly this, and the
                 * species it was built to protect did not.
                 *
                 * Only while undiscovered: once you have met it in a party, how
                 * you got there stops being the useful fact about it.
                 */}
                {!found && plant.partyOnly ? (
                  <p className={styles.partyOnly}>Only in a garden party</p>
                ) : null}

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
                        {/* The winter half of knowing it. Only shown for the
                            plants that actually stand through one, so a trout
                            lily is not quietly marked as incomplete forever for
                            a thing it cannot do. */}
                        {standsInWinter(plant)
                          ? winterKnown[plant.id]
                            ? " · Known in winter"
                            : " · Not yet named in winter"
                          : ""}
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
            const photo = photoFor(fungus.id);

            return (
              <li className={styles.card} data-locked={!found} key={fungus.id}>
                {/* Same as the plants: six of these only fruit in company. */}
                {!found && fungus.partyOnly ? (
                  <p className={styles.partyOnly}>Only in a garden party</p>
                ) : null}

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

      {/**
        * What the species have to do with each other.
        *
        * Locked ones show WHICH species are still missing rather than a coy
        * "???". A locked entry that teaches nothing tempts nobody, and here the
        * missing names are themselves the hint: "you have the milkweed, go and
        * find the swamp milkweed" is a reason to go back out.
        */}
      {tab === "connections" ? (
        // A stable hook for the suite, like `data-minigame` on the games. The
        // class name is hashed by CSS Modules and the parks panel above uses
        // `data-locked` too, so a test reaching for either finds the wrong list.
        <ul className={styles.list} data-journal-tab="connections">
          {CONNECTIONS.map((connection) => {
            const missing = connection.between.filter(
              (id) => !discovered[id] && !foundFungi[id],
            );
            const unlocked = missing.length === 0;

            return (
              <li
                className={styles.row}
                data-locked={!unlocked}
                key={connection.id}
              >
                <p className={styles.rowTitle}>{connection.title}</p>
                <p className={styles.rowMeta}>
                  {connection.between.map((id) => nameOf(id)).join(" · ")}
                  {/* Said out loud rather than left to be discovered. A solo
                      player who can never open this should know that is why,
                      not think they missed something in the wood. */}
                  {needsParty(connection) ? " · Only in a garden party" : ""}
                </p>
                {unlocked ? (
                  <>
                    <p className={styles.rowText}>{connection.body}</p>
                    <p className={styles.rowText}>
                      <a
                        href={connection.source}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Read more
                      </a>
                    </p>
                  </>
                ) : (
                  <p className={styles.rowText}>
                    Still to find:{" "}
                    {missing.map((id) => nameOf(id)).join(", ")}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/**
        * Patches you or somebody else danced about.
        *
        * Bearings rather than coordinates, because "x 182, z -61" is not
        * something anybody can fly toward, and the park is measured from a
        * corner nobody can see. They expire, which is the point of them: a
        * dance is about where the forage is now.
        */}
      {tab === "marks" ? (
        <ul className={styles.list} data-journal-tab="marks">
          {marks.length === 0 ? (
            <li className={styles.row} data-locked="true">
              <p className={styles.rowTitle}>Nothing danced about yet</p>
              <p className={styles.rowText}>
                Fly up to something worth coming back to and press{" "}
                <kbd>G</kbd>. A honeybee that finds good forage goes home and
                dances the direction and the distance, and the hive flies out to
                a flower it has never seen. In a garden party, everybody sees
                where you danced.
              </p>
            </li>
          ) : (
            marks.map((mark) => (
              <li className={styles.row} key={`${mark.at}-${mark.species}`}>
                <p className={styles.rowTitle}>{mark.commonName}</p>
                <p className={styles.rowMeta}>
                  {parkLabel(mark.park)} · {describeMark(mark)}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === "weather" ? (
        /**
         * Skies you were actually out in.
         *
         * Reads like the badges because it is the same kind of thing, with one
         * difference worth the page: a badge is something you did and a weather
         * moment is something that happened to you. None of these can be earned
         * by playing better or longer. Pittsburgh has to do it, and you have to
         * be here.
         */
        <ul className={styles.badges}>
          {WEATHER_MOMENTS.map((moment) => {
            const seen = Boolean(weatherSeen[moment.id]);

            return (
              <li className={styles.badge} data-locked={!seen} key={moment.id}>
                <span className={styles.badgeIcon} aria-hidden>
                  {seen ? "✦" : "○"}
                </span>
                <div>
                  <p className={styles.rowTitle}>{moment.name}</p>
                  <p className={styles.rowText}>
                    {seen ? moment.description : moment.hint}
                  </p>
                </div>
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
