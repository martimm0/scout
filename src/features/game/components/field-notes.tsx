"use client";

import { useMemo, useState } from "react";

import type { Daylight } from "../world/daylight";
import { fieldNotesFor } from "../world/field-notes";
import type { Park } from "../world/park";
import type { Weather } from "../world/weather";
import styles from "./field-notes.module.css";

/**
 * The "what's out today" panel.
 *
 * A quiet HUD island that tells the player what the park is like right now: the
 * sky, what is open, and one thing to look for. It reads the same derived notes
 * the picker does (`fieldNotesFor`), so the words never drift between the two.
 *
 * It can be folded away, because a player who has read it once does not need it
 * shouting over the meadow. It folds to a single word rather than vanishing, so
 * it can always be called back.
 */
export function FieldNotes({
  park,
  daylight,
  weather,
  discoveredPlants,
  unlockedBadges,
}: {
  park: Park;
  daylight: Daylight;
  weather: Weather;
  discoveredPlants: Record<string, boolean>;
  unlockedBadges: Record<string, boolean>;
}) {
  const [open, setOpen] = useState(true);

  const notes = useMemo(
    () =>
      fieldNotesFor({
        park,
        daylight,
        weather,
        discoveredPlants,
        unlockedBadges,
      }),
    [park, daylight, weather, discoveredPlants, unlockedBadges],
  );

  return (
    <aside className={styles.panel} aria-label="Field notes" data-open={open}>
      <button
        className={styles.header}
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-expanded={open}
      >
        <span className={styles.label}>Field Notes</span>
        <span aria-hidden className={styles.chevron} data-open={open}>
          ›
        </span>
      </button>

      {open ? (
        <ul className={styles.notes}>
          {notes.map((note) => (
            <li className={styles.note} data-tone={note.tone} key={note.id}>
              {note.text}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
