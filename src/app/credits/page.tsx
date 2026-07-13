import type { Metadata } from "next";

import { PLANT_PHOTOS } from "@/features/game/data/plant-photos";
import { PLANTS } from "@/features/game/data/plants";
import styles from "./credits.module.css";

export const metadata: Metadata = {
  title: "Credits · Scout",
  description:
    "Photograph credits and licences for every plant in Scout, plus what the game is built from.",
};

/**
 * Credits.
 *
 * This page is not a courtesy. Eleven of the sixteen photographs are CC BY or
 * CC BY-SA, and attribution is a *term of the licence* — the images may not be
 * used without it. It is generated from the same data the game reads, so a photo
 * cannot appear in the journal without appearing here.
 */
export default function CreditsPage() {
  const credited = PLANTS.map((plant) => ({
    plant,
    photo: PLANT_PHOTOS[plant.id],
  })).filter((entry) => entry.photo);

  return (
    <main className="page-container">
      <p className="eyebrow">Credits</p>
      <h1>Who made what</h1>
      <p className="lead">
        Scout is set in Frick Park, Pittsburgh, and every plant in it is real.
        The photographs are other people&apos;s work, used under licences that
        require them to be credited. So here they are.
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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Plant</th>
                <th scope="col">Photographer</th>
                <th scope="col">Licence</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {credited.map(({ photo, plant }) => (
                <tr key={plant.id}>
                  <td>
                    {plant.commonName}
                    <span className={styles.latin}>{plant.scientificName}</span>
                  </td>
                  <td>{photo.author}</td>
                  <td>
                    <a href={photo.licenseUrl} rel="noreferrer" target="_blank">
                      {photo.license}
                    </a>
                  </td>
                  <td>
                    <a href={photo.sourceUrl} rel="noreferrer" target="_blank">
                      Commons
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.note}>
          <strong>CC BY-SA</strong> requires that a modified version of the{" "}
          <em>image itself</em> be released under the same licence. Displaying
          them unmodified in the game, credited as above, is within terms.
        </p>
      </section>

      <section>
        <h2>The park</h2>
        <p className={styles.note}>
          Frick Park is a real place, run by the City of Pittsburgh and the{" "}
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
            All models — the bee, the flora, the trees, the landmarks — are voxel
            geometry generated in code. No 3D assets were used.
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
