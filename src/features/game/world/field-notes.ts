/**
 * Field notes: what the park is like right now, in words.
 *
 * The game already knows a great deal the player never sees: what hour it is in
 * Pittsburgh, what is falling out of the sky, which flowers are open at this
 * hour, how many the player has yet to meet. A returning bee is handed a park
 * that is genuinely different from the one they left and told none of it.
 *
 * This turns that knowledge into two or three short lines, in the game's voice.
 * Every clause is derived, not written: the sky from the real weather, the bloom
 * line from `isActive` over each species' window, the "not met" count from the
 * save, the closing line from an unearned badge's own hint. It never scolds and
 * never sets a quota; it describes the place and trusts the player, the same way
 * the failure messages do.
 *
 * It is deliberately a pure module with no React and no store: it takes plain
 * values and returns plain notes, so the picker and the HUD share it and a test
 * can pin the hour and the sky and read the copy back.
 */

import { BADGES } from "../data/badges";
import { PLANTS } from "../data/plants";
import { isActive, type Daylight } from "./daylight";
import type { Park } from "./park";
import type { Weather } from "./weather";

export type FieldNote = {
  /** Stable key for React and for tests. */
  id: string;
  text: string;
  /** What kind of line it is, so the two surfaces can style them apart. */
  tone: "sky" | "bloom" | "goal";
};

export type FieldNotesInput = {
  park: Park;
  daylight: Daylight;
  weather: Weather;
  discoveredPlants: Record<string, boolean>;
  unlockedBadges: Record<string, boolean>;
};

/** "Morning", "afternoon": the time word that reads naturally in a sentence. */
function timeWord(daylight: Daylight): string {
  switch (daylight.phase) {
    case "night":
      return "night";
    case "dawn":
      return "first light";
    case "morning":
      return "morning";
    case "midday":
      return "midday";
    case "afternoon":
      return "afternoon";
    case "dusk":
      return "evening";
  }
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The plants that grow in this park, in world order. */
function plantsIn(park: Park) {
  return PLANTS.filter((plant) =>
    plant.homes.some((home) => home.park === park.id),
  );
}

/**
 * A soft goal, pulled from an unearned badge's own hint.
 *
 * The hints already exist and are already written to intrigue rather than
 * instruct ("There is another park in this city"). We surface the most relevant
 * one instead of hiding it behind a badge the player cannot see. Preference goes
 * to a hint that fits the hour, because "the ephemerals are shut by lunchtime"
 * lands harder at eleven than at midnight.
 */
function softGoal(input: FieldNotesInput): FieldNote | undefined {
  const { unlockedBadges, daylight } = input;
  const unearned = BADGES.filter((badge) => !unlockedBadges[badge.id]);

  if (unearned.length === 0) {
    return undefined;
  }

  // Hour-fit first: a handful of badges are really about being out at the right
  // time, and their hints are the ones worth leading with when that time is now.
  const byHour: Partial<Record<string, string[]>> = {
    dawn: ["dawn-chorus"],
    night: ["glow", "night-shift", "foxfire"],
    dusk: ["night-shift"],
  };

  const preferred = byHour[daylight.phase] ?? [];

  const pick =
    unearned.find((badge) => preferred.includes(badge.id)) ??
    // Otherwise the earliest unearned badge, which tracks roughly with how far
    // along the player is, so a new bee gets "go somewhere" and a deep one gets
    // something obscure.
    unearned[0];

  return { id: `goal:${pick.id}`, text: pick.hint, tone: "goal" };
}

/**
 * Two or three lines about the park, right now.
 *
 * Order is sky, then what is out, then one thing to look for. Any of them may be
 * dropped: a park with nothing left to meet does not pretend otherwise, and a
 * fully-badged player gets no goal line.
 */
export function fieldNotesFor(input: FieldNotesInput): FieldNote[] {
  const { park, daylight, weather, discoveredPlants } = input;
  const notes: FieldNote[] = [];

  const temperature = Math.round(weather.temperature);

  // 1. The sky. "Fog, 14C. Morning in Frick Park."
  notes.push({
    id: "sky",
    text: `${weather.label}, ${temperature}°C. ${cap(timeWord(daylight))} in ${park.label}.`,
    tone: "sky",
  });

  const here = plantsIn(park);
  const openNow = here.filter((plant) => isActive(plant.window, daylight.hour));

  // 2. What is out. After dark this is a fact, not a disappointment: nothing
  // pollinates anywhere in the park at night, and that is the point of night.
  if (daylight.phase === "night") {
    notes.push({
      id: "bloom",
      text: "Nothing is open to pollinate after dark. The fungi keep their own hours, and something out here is glowing.",
      tone: "bloom",
    });
  } else if (openNow.length === 0) {
    notes.push({
      id: "bloom",
      text: "Nothing is open just now. Come back within the daylight and the flowers will be too.",
      tone: "bloom",
    });
  } else {
    // Ephemerals shut by mid-afternoon in real life; if any open flower closes
    // early, say so, because it is the one bit of timing that actually costs you.
    const closingEarly = openNow.filter((plant) => plant.window.to <= 15);

    if (closingEarly.length > 0 && daylight.hour < 15) {
      notes.push({
        id: "bloom",
        text: `${openNow.length} flowers are open. The spring ephemerals among them shut by mid-afternoon, so those first.`,
        tone: "bloom",
      });
    } else {
      notes.push({
        id: "bloom",
        text: `${openNow.length} flowers are open right now.`,
        tone: "bloom",
      });
    }
  }

  // A cold park is a quiet park: honeybees do not fly much below ten degrees, so
  // on a cold day you may genuinely have the place to yourself.
  if (temperature < 10 && daylight.phase !== "night") {
    notes.push({
      id: "cold",
      text: "Too cold for most bees to be out. You may have the flowers to yourself.",
      tone: "bloom",
    });
  }

  // 3. How much is left to meet here, then one thing to look for.
  const notMet = here.filter((plant) => !discoveredPlants[plant.id]).length;

  if (notMet > 0) {
    notes.push({
      id: "unmet",
      text:
        notMet === 1
          ? "One flower here you have not met yet."
          : `${notMet} flowers here you have not met yet.`,
      tone: "goal",
    });
  }

  const goal = softGoal(input);

  if (goal) {
    notes.push(goal);
  }

  return notes;
}
