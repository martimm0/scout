import { playSound } from "../audio/sound";
import { FUNGI_BY_ID } from "../data/fungi";
import { PLANTS_BY_ID } from "../data/plants";
import { PARKS, type ParkId } from "../world/terrain";
import { plantsFoundIn, plantsIn, type GameStore } from "./game-store";

/**
 * The moments the game used to let pass.
 *
 * Meeting a species for the first time played a three-note chime and nothing
 * else. Opening a whole new park set a flag in the store that no component was
 * listening for. A streak was a number in the journal. Each of those is the
 * player getting somewhere, so each now gets a line at the top of the screen,
 * briefly, and gets out of the way.
 *
 * Not badges. A badge is a thing you keep; these are just the game noticing.
 *
 * Every one is worked out by comparing the store before and after a change, and
 * each has to tell PLAYING apart from LOADING. A save arriving from the cloud
 * adds forty discoveries in one update, and forty "New find" toasts for plants
 * the player met last month would be a lie told forty times. So a find only
 * counts if it is the single new one and the bee is beside it; a park only
 * counts if it opened in the same update as a find; a streak only if it went up
 * by exactly one.
 */
export type Moment = { label: string; title: string; detail?: string };

/** The part of the store a moment is read from. */
export type MomentState = Pick<
  GameStore,
  "discoveredPlants" | "discoveredFungi" | "unlockedParks" | "currentPark" | "stats"
> & { ui: Pick<GameStore["ui"], "nearby"> };

const STREAKS = new Set([3, 5, 10]);

function newKeys(before: Record<string, boolean>, after: Record<string, boolean>) {
  return Object.keys(after).filter((key) => after[key] && !before[key]);
}

export function momentsBetween(before: MomentState, after: MomentState): Moment[] {
  const out: Moment[] = [];
  const plants = newKeys(before.discoveredPlants, after.discoveredPlants);
  const fungi = newKeys(before.discoveredFungi, after.discoveredFungi);
  const found = [...plants, ...fungi];

  // One, and the one the bee is next to: that is a meeting, not a download.
  if (found.length === 1 && after.ui.nearby?.id === found[0]) {
    const id = found[0];
    const name = PLANTS_BY_ID.get(id)?.commonName ?? FUNGI_BY_ID.get(id)?.commonName;

    if (name) {
      out.push({ label: "New find", title: name, detail: "It is in your journal now." });
    }

    for (const park of newKeys(before.unlockedParks, after.unlockedParks)) {
      const opened = PARKS[park as ParkId];

      if (opened) {
        out.push({ label: "A new park is open", title: opened.label, detail: "Pick it from Fly to." });
        playSound("parkUnlock");
      }
    }

    // The last plant of the park you are standing in.
    if (plants.length === 1) {
      const here = after.currentPark;
      const total = plantsIn(here).length;

      if (
        total > 0 &&
        plantsFoundIn(after.discoveredPlants, here) === total &&
        plantsFoundIn(before.discoveredPlants, here) < total
      ) {
        out.push({
          label: "Every plant found",
          title: PARKS[here]?.label ?? "This park",
          detail: `All ${total} of them.`,
        });
        playSound("parkUnlock");
      }
    }
  }

  const streak = after.stats.streak;

  if (streak === before.stats.streak + 1 && STREAKS.has(streak)) {
    out.push({ label: "On a roll", title: `${streak} in a row`, detail: "Every one of them took." });
    playSound("streak");
  }

  return out;
}

