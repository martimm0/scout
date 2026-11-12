"use client";

import { useMemo } from "react";

import { useAutoFold } from "../hooks/use-auto-fold";
import { useCoarsePointer } from "../hooks/use-media-query";
import type { Daylight } from "../world/daylight";
import { fieldNotesFor } from "../world/field-notes";
import { usePartyStore } from "../state/party-store";
import type { Park } from "../world/park";
import type { Weather } from "../world/weather";
import styles from "./field-notes.module.css";
import { PanelPin } from "./panel-pin";

/**
 * The "what's out today" panel.
 *
 * A quiet HUD island that tells the player what the park is like right now: the
 * sky, what is open, and one thing to look for. It reads the same derived notes
 * the picker does (`fieldNotesFor`), so the words never drift between the two.
 *
 * It folds itself away a few seconds after it opens, unless pinned, because a
 * player who has read it once does not need it shouting over the meadow. It
 * folds to a single word rather than vanishing, so it can always be called back.
 */
export function FieldNotes({
  park,
  daylight,
  month,
  weather,
  discoveredPlants,
  unlockedBadges,
  coaching = false,
}: {
  park: Park;
  daylight: Daylight;
  month: number;
  weather: Weather;
  discoveredPlants: Record<string, boolean>;
  unlockedBadges: Record<string, boolean>;
  /** The first flight is running: start folded, so its card is the only text. */
  coaching?: boolean;
}) {
  /**
   * Open on a desktop, folded on a phone.
   *
   * The card is the best thing to read when you arrive and the worst thing to
   * have covering a third of a landscape phone while you fly. Folded, it is still
   * one tap away, and the title still says what it is.
   */
  const coarsePointer = useCoarsePointer();
  const fold = useAutoFold("fieldNotes", !coarsePointer && !coaching);
  const shown = fold.open;

  const notes = useMemo(
    () =>
      fieldNotesFor({
        inParty: usePartyStore.getState().status === "in",
        park,
        daylight,
        month,
        weather,
        discoveredPlants,
        unlockedBadges,
      }),
    [park, daylight, month, weather, discoveredPlants, unlockedBadges],
  );

  return (
    <aside
      className={styles.panel}
      aria-label="Field notes"
      data-open={shown}
      {...fold.holdProps}
    >
      <div className={styles.headerRow}>
        <button
          className={styles.header}
          onClick={fold.toggle}
          type="button"
          aria-expanded={shown}
        >
          <span className={styles.label}>Field Notes</span>
          <span aria-hidden className={styles.chevron} data-open={shown}>
            ›
          </span>
        </button>
        <PanelPin label="Field Notes" pinned={fold.pinned} onToggle={fold.togglePin} />
      </div>

      {shown ? (
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
