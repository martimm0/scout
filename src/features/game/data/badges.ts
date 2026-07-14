import type { GameState } from "../state/game-store";
import { schenleyUnlocked } from "../state/game-store";
import { PARKS } from "../world/terrain";
import { allAreas } from "../world/park";
import { FUNGI } from "./fungi";
import { PLANTS } from "./plants";

const FRICK_AREAS = allAreas(PARKS.frick).map((area) => area.id);
const SCHENLEY_AREAS = allAreas(PARKS.schenley).map((area) => area.id);

/**
 * Badges.
 *
 * Non-competitive by design: there is no leaderboard and there never will be.
 * Nothing here is scored against another player, and nothing is timed. They mark
 * what you've seen and what you've learned, and a few of them reward simply
 * being curious.
 */

export type Badge = {
  id: string;
  name: string;
  /** Shown once earned. */
  description: string;
  /** Shown while locked — intriguing, but not a walkthrough. */
  hint: string;
  earned: (state: GameState) => boolean;
};

const count = (record: Record<string, boolean>) =>
  Object.values(record).filter(Boolean).length;

/**
 * Counting, per park.
 *
 * "Find all sixteen" quietly became "find all twenty-six" the moment Schenley
 * landed, and "visit all six areas" became "visit six of fourteen", which two
 * parks would satisfy between them without either being finished. A badge that
 * silently changes what it means is worse than no badge.
 */
const speciesOf = (park: "frick" | "schenley") => ({
  plants: PLANTS.filter((p) => p.homes.some((h) => h.park === park)),
  fungi: FUNGI.filter((f) => f.homes.some((h) => h.park === park)),
});

const foundAll = (
  record: Record<string, boolean>,
  species: { id: string }[],
) => species.every((s) => record[s.id]);

export const BADGES: Badge[] = [
  {
    id: "first-flight",
    name: "First Flight",
    description: "You left the lawn and went looking.",
    hint: "Go somewhere.",
    earned: (state) => count(state.unlockedMapAreas) >= 2,
  },
  {
    id: "first-bloom",
    name: "First Bloom",
    description: "Your first successful pollination.",
    hint: "Pollinate anything at all.",
    earned: (state) => count(state.pollinatedPlants) >= 1,
  },
  {
    id: "ten-pollinated",
    name: "Ten Plants Pollinated",
    description: "Ten flowers will set seed because of you.",
    hint: "Keep going. Ten of them.",
    earned: (state) => count(state.pollinatedPlants) >= 10,
  },
  {
    id: "frick-park-explorer",
    name: "Frick Park Explorer",
    description: "You have flown every corner of Frick Park.",
    hint: "Visit all six areas.",
    earned: (state) =>
      FRICK_AREAS.every((area) => state.unlockedMapAreas[area]),
  },
  {
    id: "blue-slide-visitor",
    name: "Blue Slide Visitor",
    description: "You found the most famous thing in the park.",
    hint: "Somewhere out east there's a hill that isn't a hill.",
    earned: (state) => Boolean(state.unlockedMapAreas["blue-slide"]),
  },
  {
    id: "creekside-visitor",
    name: "Creekside Visitor",
    description: "You followed Nine Mile Run through the valley.",
    hint: "Follow the water down.",
    earned: (state) => Boolean(state.unlockedMapAreas["nine-mile-run"]),
  },
  {
    id: "fern-hollow-wanderer",
    name: "Fern Hollow Wanderer",
    description: "You went into the deep shade and came back out.",
    hint: "There's a darker wood than the one you know.",
    earned: (state) => Boolean(state.unlockedMapAreas["fern-hollow"]),
  },
  {
    id: "native-plant-friend",
    name: "Native Plant Friend",
    description: "You have found every native plant in Frick Park.",
    hint: "Find all sixteen in Frick.",
    earned: (state) =>
      foundAll(state.discoveredPlants, speciesOf("frick").plants),
  },
  {
    id: "meadow-scout",
    name: "Meadow Scout",
    description: "Five plants discovered.",
    hint: "Discovery is just getting close enough to look.",
    earned: (state) => count(state.discoveredPlants) >= 5,
  },
  {
    id: "steady-wings",
    name: "Steady Wings",
    description: "Five successful pollinations in a row.",
    hint: "String some good visits together.",
    earned: (state) => state.stats.bestStreak >= 5,
  },
  {
    id: "persistent",
    name: "Persistent",
    description:
      "You kept going after a failed visit. Most of pollinating is trying again.",
    hint: "Fail, and don't stop.",
    earned: (state) =>
      state.stats.pollinationAttempts - state.stats.pollinationSuccesses >= 1 &&
      state.stats.pollinationSuccesses >= 3,
  },
  {
    id: "well-read",
    name: "Well Read",
    description: "Fifteen journal entries unlocked.",
    hint: "The journal fills itself as you learn.",
    earned: (state) => count(state.unlockedJournalEntries) >= 15,
  },
  {
    id: "first-fungus",
    name: "First Fungus",
    description: "You found something that is not a plant and not an animal.",
    hint: "Not everything in the wood is a flower.",
    earned: (state) => count(state.discoveredFungi) >= 1,
  },
  {
    id: "mycologist",
    name: "Mycologist",
    description: "Every fungus in Frick Park, found.",
    hint: "All eight of them. Some only come out at night.",
    earned: (state) =>
      foundAll(state.discoveredFungi, speciesOf("frick").fungi),
  },
  {
    id: "night-shift",
    name: "Night Shift",
    description: "You came to the park after dark, when the flowers were shut.",
    hint: "The park does not close.",
    earned: (state) => Boolean(state.seenPhases.night),
  },
  {
    id: "glow",
    name: "Something Glowing",
    description: "You found the jack-o'-lantern, and it was lit.",
    hint: "There is one thing in this wood that makes its own light.",
    earned: (state) => Boolean(state.discoveredFungi["jack-o-lantern"]),
  },
  {
    id: "dawn-chorus",
    name: "Dawn Chorus",
    description: "You were out at first light, when the ephemerals open.",
    hint: "Some flowers are shut by lunchtime.",
    earned: (state) => Boolean(state.seenPhases.dawn),
  },
  {
    id: "all-hours",
    name: "All Hours",
    description: "Dawn, morning, midday, afternoon, dusk and night. The whole clock.",
    hint: "The park is a different place at every hour. See them all.",
    earned: (state) => count(state.seenPhases) >= 6,
  },
  {
    id: "quick-study",
    name: "Quick Study",
    description: "You passed your first quiz.",
    hint: "Land on something and let it test you.",
    earned: (state) => state.stats.quizzesPassed >= 1,
  },
  {
    id: "top-of-the-class",
    name: "Top of the Class",
    description: "Ten quizzes passed. You have actually been reading.",
    hint: "Keep landing, keep reading.",
    earned: (state) => state.stats.quizzesPassed >= 10,
  },
  {
    id: "second-park",
    name: "A Second Park",
    description: "Half of Frick's flowers found, and Schenley opened.",
    hint: "There is another park in this city.",
    earned: (state) => schenleyUnlocked(state),
  },
  {
    id: "schenley-explorer",
    name: "Schenley Park Explorer",
    description: "Phipps, the hill, the Oval, the lake and the hollow. All of it.",
    hint: "Fly every corner of the second park.",
    earned: (state) =>
      SCHENLEY_AREAS.every((area) => state.unlockedMapAreas[area]),
  },
  {
    id: "schenley-botanist",
    name: "Schenley Botanist",
    description: "Every plant Schenley has, found.",
    hint: "The lake, the hollow, the hill and the ravine below the glasshouse.",
    earned: (state) =>
      foundAll(state.discoveredPlants, speciesOf("schenley").plants),
  },
  {
    id: "under-the-bridge",
    name: "Under the Panthers",
    description: "You went down into Panther Hollow, where the city cannot follow.",
    hint: "In Schenley the ground opens. Go down.",
    earned: (state) => Boolean(state.unlockedMapAreas["panther-hollow"]),
  },
  {
    id: "foxfire",
    name: "Foxfire",
    description:
      "You found the bitter oyster after dark, and the old wood was glowing.",
    hint: "Something else in this city makes its own light.",
    earned: (state) => Boolean(state.discoveredFungi["bitter-oyster"]),
  },
  {
    id: "both-parks",
    name: "Two Parks, One City",
    description: "Every plant and every fungus in both parks. All of it.",
    hint: "Everything. Everywhere. Both of them.",
    earned: (state) =>
      foundAll(state.discoveredPlants, PLANTS) &&
      foundAll(state.discoveredFungi, FUNGI),
  },
  {
    id: "ecologist",
    name: "Ecologist",
    description: "You unlocked every ecology concept.",
    hint: "There is more to learn than the names of flowers.",
    earned: (state) =>
      Object.keys(state.unlockedJournalEntries).filter(
        (key) => key.startsWith("concept:") && state.unlockedJournalEntries[key],
      ).length >= 9,
  },
];

export const BADGES_BY_ID = new Map(BADGES.map((badge) => [badge.id, badge]));

/** Every badge whose condition is met but which isn't yet unlocked. */
export function evaluateBadges(state: GameState): string[] {
  return BADGES.filter(
    (badge) => !state.unlockedBadges[badge.id] && badge.earned(state),
  ).map((badge) => badge.id);
}
