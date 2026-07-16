import type { Metadata } from "next";

import { FUNGI } from "@/features/game/data/fungi";
import { FUNGUS_PHOTOS } from "@/features/game/data/fungus-photos";
import { PLANT_PHOTOS } from "@/features/game/data/plant-photos";
import { PLANTS } from "@/features/game/data/plants";
import { SCHENLEY_PHOTOS } from "@/features/game/data/schenley-photos";
import styles from "./credits.module.css";

type Credit = {
  id: string;
  commonName: string;
  scientificName: string;
  photo: { author: string; license: string; licenseUrl: string; sourceUrl: string };
};

/** One row per photograph. Plants and fungi are credited by the same code. */
function PhotoTable({ heading, rows }: { heading: string; rows: Credit[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{heading}</th>
            <th scope="col">Photographer</th>
            <th scope="col">Licence</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.commonName}
                <span className={styles.latin}>{row.scientificName}</span>
              </td>
              <td>{row.photo.author}</td>
              <td>
                <a href={row.photo.licenseUrl} rel="noreferrer" target="_blank">
                  {row.photo.license}
                </a>
              </td>
              <td>
                <a href={row.photo.sourceUrl} rel="noreferrer" target="_blank">
                  Commons
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Credits · Scout",
  description:
    "Photograph credits and licences for every plant and fungus in Scout, plus what the game is built from.",
};

/**
 * Credits.
 *
 * This page is not a courtesy. Most of the photographs are CC BY or CC BY-SA,
 * and attribution is a *term of the licence*: the images may not be used without
 * it. Every one of the eight fungus photographs requires it. The page is
 * generated from the same data the game reads, so a photo cannot appear in the
 * journal without appearing here.
 */
export default function CreditsPage() {
  const plants: Credit[] = PLANTS.filter((plant) => PLANT_PHOTOS[plant.id]).map(
    (plant) => ({
      id: plant.id,
      commonName: plant.commonName,
      scientificName: plant.scientificName,
      photo: PLANT_PHOTOS[plant.id],
    }),
  );

  const fungi: Credit[] = FUNGI.filter((fungus) => FUNGUS_PHOTOS[fungus.id]).map(
    (fungus) => ({
      id: fungus.id,
      commonName: fungus.commonName,
      scientificName: fungus.scientificName,
      photo: FUNGUS_PHOTOS[fungus.id],
    }),
  );

  // Schenley's species. Nearly every one of these photographs is CC BY-SA, so
  // shipping them uncredited would be a licence breach rather than an oversight.
  const schenley: Credit[] = [...PLANTS, ...FUNGI]
    .filter((species) => SCHENLEY_PHOTOS[species.id])
    .map((species) => ({
      id: species.id,
      commonName: species.commonName,
      scientificName: species.scientificName,
      photo: SCHENLEY_PHOTOS[species.id],
    }));

  return (
    <main className="page-container">
      <p className="eyebrow">Credits</p>
      <h1>Who made what</h1>
      <p className="lead">
        Scout is set in the real parks of Pittsburgh, and every plant and fungus
        in it is real. The photographs are other people&apos;s work, used under licences
        that require them to be credited. So here they are.
      </p>

      <section>
        <h2>Plant photographs</h2>
        <p className={styles.note}>
          All from{" "}
          <a
            href="https://commons.wikimedia.org"
            rel="noreferrer"
            target="_blank"
          >
            Wikimedia Commons
          </a>
          . Each is Public Domain, CC0, CC BY, or CC BY-SA. Images were resized to
          about 900px wide and re-encoded as JPEG; nothing else was changed.
        </p>

        <PhotoTable heading="Plant" rows={plants} />

        <p className={styles.note}>
          <strong>CC BY-SA</strong> requires that a modified version of the{" "}
          <em>image itself</em> be released under the same licence. Displaying
          them unmodified in the game, credited as above, is within terms.
        </p>
      </section>

      <section>
        <h2>Fungus photographs</h2>
        <p className={styles.note}>
          Also from{" "}
          <a
            href="https://commons.wikimedia.org"
            rel="noreferrer"
            target="_blank"
          >
            Wikimedia Commons
          </a>
          . Unlike the plants, <strong>every one of these requires attribution</strong>:
          there is no public-domain photograph in this set. Resized to about 900px
          wide and re-encoded as JPEG; nothing else was changed.
        </p>

        <PhotoTable heading="Fungus" rows={fungi} />
      </section>

      <section>
        <h2>Schenley Park photographs</h2>
        <p className={styles.note}>
          The species Schenley shares with Frick Park reuse the photographs above,
          because they are the same organism. These are the ones you will only
          find in Schenley. Two are public domain; every other one on this list
          requires attribution.
        </p>

        <PhotoTable heading="Species" rows={schenley} />
      </section>

      <section>
        <h2>The park</h2>
        <p className={styles.note}>
          Frick, Schenley and Highland are real places, run by the City of
          Pittsburgh and the{" "}
          <a
            href="https://pittsburghparks.org"
            rel="noreferrer"
            target="_blank"
          >
            Pittsburgh Parks Conservancy
          </a>
          . Nine Mile Run was buried under industrial slag for most of the
          twentieth century and dug back out in one of the largest urban stream
          restorations ever attempted in the United States. The Environmental
          Center, the Blue Slide, the lawn bowling green and the clay courts are
          all there. Go and see them.
        </p>
      </section>

      <section>
        <h2>Built with</h2>
        <ul className={styles.list}>
          <li>Next.js, React, TypeScript</li>
          <li>three.js, React Three Fiber, drei</li>
          <li>Zustand</li>
          <li>
            All models (the bee, the flora, the fungi, the trees, the
            landmarks) are voxel geometry generated in code. No 3D assets were
            used.
          </li>
          <li>
            All sound is synthesized in the browser with the Web Audio API. No
            audio files were used.
          </li>
        </ul>
      </section>
    </main>
  );
}
