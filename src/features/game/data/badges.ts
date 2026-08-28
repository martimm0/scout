import type { GameState } from "../state/game-store";
import { winterStanding } from "../world/winter";
import { parkUnlocked } from "../state/game-store";
import { PARKS } from "../world/terrain";
import { allAreas } from "../world/park";
import { PARTY_FUNGI, SOLO_FUNGI } from "./fungi";
import { PARTY_PLANTS, SOLO_PLANTS } from "./plants";

const FRICK_AREAS = allAreas(PARKS.frick).map((area) => area.id);
const SCHENLEY_AREAS = allAreas(PARKS.schenley).map((area) => area.id);
const HIGHLAND_AREAS = allAreas(PARKS.highland).map((area) => area.id);

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
  /** Shown while locked: intriguing, but not a walkthrough. */
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
/**
 * SOLO_PLANTS and SOLO_FUNGI, not the full lists.
 *
 * "Every plant in Frick" must go on meaning what it meant before garden parties
 * existed. Counting the party species would quietly turn it into "every plant in
 * Frick, plus two you can only reach with other people", which is exactly the
 * thing the note above warns about.
 */
/** The party-only species of a park. The mirror of `speciesOf`. */
const partyOf = (park: "frick" | "schenley" | "highland") => ({
  plants: PARTY_PLANTS.filter((p) => p.homes.some((h) => h.park === park)),
  fungi: PARTY_FUNGI.filter((f) => f.homes.some((h) => h.park === park)),
});

const speciesOf = (park: "frick" | "schenley" | "highland") => ({
  plants: SOLO_PLANTS.filter((p) => p.homes.some((h) => h.park === park)),
  fungi: SOLO_FUNGI.filter((f) => f.homes.some((h) => h.park === park)),
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
    description: "You came to the park after dark, when the day flowers were shut and the night ones were open.",
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
  /**
   * The two weather badges.
   *
   * Unlike every other badge here, these cannot be pursued. A player cannot make
   * it thunder, so the hints say what to wait for rather than what to do, and
   * nothing anywhere is gated behind either of them.
   */
  {
    id: "foul-weather-friend",
    name: "Foul-Weather Friend",
    description:
      "You have been out in three of the skies most people would stay in for.",
    hint: "Come out in the weather nobody else would. Fog, thunder, snow, a hard freeze.",
    earned: (state) => count(state.seenWeather) >= 3,
  },
  {
    id: "whatever-the-sky-does",
    name: "Whatever the Sky Does",
    description:
      "Every rare sky the park has to offer, and every one of them a real afternoon in Pittsburgh.",
    hint: "There are a handful of skies worth being here for. Be here for all of them.",
    earned: (state) => count(state.seenWeather) >= 6,
  },
  /**
   * Winter identification. Only plants that stand through it can be named that
   * way, so the totals count against `winterStanding`, never against every plant:
   * a target nobody can reach is not a badge, it is a bug with a name.
   */
  {
    id: "bare-bones",
    name: "Bare Bones",
    description:
      "You named five plants from nothing but a shape, a height and a place.",
    hint: "In winter the cards stop telling you. Name five of them anyway.",
    earned: (state) => count(state.winterKnown) >= 5,
  },
  {
    id: "reads-the-winter",
    name: "Reads the Winter",
    description:
      "Every plant in this park that stands through the winter, named from its bare form.",
    hint: "There is a whole park still standing in January. Learn all of it.",
    earned: (state) =>
      winterStanding(state.currentPark).every(
        (plant) => state.winterKnown[plant.id],
      ),
  },
  {
    id: "turning-year",
    name: "A Turning Year",
    description:
      "You came back and found the park in a different season than you left it.",
    hint: "The wood does not stay the same colour. Come back when it has turned.",
    earned: (state) => count(state.seenSeasons) >= 2,
  },
  {
    id: "whole-year-round",
    name: "The Whole Year Round",
    description:
      "Spring, summer, autumn and winter. You have kept the park through the whole year.",
    hint: "There are four seasons in Pittsburgh, and the park keeps all of them.",
    earned: (state) => count(state.seenSeasons) >= 4,
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
    description: "Eight of Frick's flowers found, and Schenley opened.",
    hint: "There is another park in this city.",
    earned: (state) => parkUnlocked(state, "schenley"),
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
    name: "Three Parks, One City",
    description: "Every plant and every fungus in all three parks. All of it.",
    hint: "Everything. Everywhere. All of them.",
    earned: (state) =>
      // Solo lists: the completionist badge would otherwise be unobtainable
      // without other people, which is not what it has ever promised.
      foundAll(state.discoveredPlants, SOLO_PLANTS) &&
      foundAll(state.discoveredFungi, SOLO_FUNGI),
  },
  {
    id: "third-park",
    name: "A Third Park",
    description: "Seven of Schenley's flowers found, and Highland opened.",
    hint: "There is a park in this city with a lake on top of a hill.",
    earned: (state) => parkUnlocked(state, "highland"),
  },
  {
    id: "highland-explorer",
    name: "Highland Park Explorer",
    description: "The reservoirs, the fountain, the zoo edge and the river. All of it.",
    hint: "Fly every corner of the third park.",
    earned: (state) =>
      HIGHLAND_AREAS.every((area) => state.unlockedMapAreas[area]),
  },
  {
    id: "highland-botanist",
    name: "Highland Botanist",
    description: "Every plant Highland has, found.",
    hint: "The reservoir walk, the lawns, the slope and the river flats.",
    earned: (state) =>
      foundAll(state.discoveredPlants, speciesOf("highland").plants),
  },
  {
    id: "over-the-wall",
    name: "Over the Wall",
    description:
      "You went over the embankment and found a lake on top of a hill.",
    hint: "In Highland the hill has a wall around it. There is a reason.",
    earned: (state) => Boolean(state.unlockedMapAreas["reservoir-one"]),
  },
  {
    id: "ink-cap",
    name: "Written in Ink",
    description:
      "You found the shaggy mane before it turned itself into a puddle of ink.",
    hint: "One mushroom on the reservoir walk does not last the day.",
    earned: (state) => Boolean(state.discoveredFungi["shaggy-mane"]),
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
  /* ---------------------------------------------------------------- *
   * Garden parties.
   *
   * These mark what you have seen and learned with other people in the park,
   * and like every other badge here they are not competitive: nothing counts
   * somebody else's play against yours, and nothing is awarded for winning a
   * party game. The games are what you do while you are there, not a thing to
   * be ranked at.
   * ---------------------------------------------------------------- */
  {
    id: "garden-party",
    name: "Garden Party",
    description: "You flew a park with other people in it.",
    hint: "Some things only grow where there is somebody to see them.",
    // Derived rather than stored: finding one of the twelve IS the evidence
    // you were in a party, because there is no other way to meet one.
    earned: (state) =>
      PARTY_PLANTS.some((plant) => state.discoveredPlants[plant.id]) ||
      PARTY_FUNGI.some((fungus) => state.discoveredFungi[fungus.id]),
  },
  {
    id: "worked-together",
    name: "Worked It Together",
    description:
      "You and somebody else worked the same flower, and it took for both of you.",
    hint: "Land on a flower a friend is already standing on.",
    earned: (state) => Boolean(state.coopPollinated),
  },
  {
    id: "party-frick",
    name: "Frick, With Company",
    description:
      "Witch-hazel, skunk cabbage, lion's mane and dead man's fingers. All four.",
    hint: "Frick keeps four things back for people who bring a friend.",
    earned: (state) =>
      foundAll(state.discoveredPlants, partyOf("frick").plants) &&
      foundAll(state.discoveredFungi, partyOf("frick").fungi),
  },
  {
    id: "party-schenley",
    name: "Schenley, With Company",
    description:
      "Foxglove beardtongue, white turtlehead, crown-tipped coral and the bleeding fairy helmet.",
    hint: "Panther Hollow has more in it than you can find alone.",
    earned: (state) =>
      foundAll(state.discoveredPlants, partyOf("schenley").plants) &&
      foundAll(state.discoveredFungi, partyOf("schenley").fungi),
  },
  {
    id: "party-highland",
    name: "Highland, With Company",
    description:
      "New York ironweed, cup plant, hemlock varnish shelf and the scarlet elf cup.",
    hint: "The reservoir keeps four of its own.",
    earned: (state) =>
      foundAll(state.discoveredPlants, partyOf("highland").plants) &&
      foundAll(state.discoveredFungi, partyOf("highland").fungi),
  },
  {
    id: "party-all",
    name: "Nobody Finds This Alone",
    description:
      "All twelve species that only come out when there are other people in the park.",
    hint: "Twelve of them, across three parks, and not one on your own.",
    earned: (state) =>
      foundAll(state.discoveredPlants, PARTY_PLANTS) &&
      foundAll(state.discoveredFungi, PARTY_FUNGI),
  },
];

export const BADGES_BY_ID = new Map(BADGES.map((badge) => [badge.id, badge]));

/** Every badge whose condition is met but which isn't yet unlocked. */
export function evaluateBadges(state: GameState): string[] {
  return BADGES.filter(
    (badge) => !state.unlockedBadges[badge.id] && badge.earned(state),
  ).map((badge) => badge.id);
}
