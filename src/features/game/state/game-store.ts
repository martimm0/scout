import { create } from "zustand";
import { accessoryUnlocked } from "../data/accessories";
import type { Accessory } from "../models/species";
import { PLANTS_BY_ID, SOLO_PLANTS } from "../data/plants";
import { isInSeason, seasonWindow } from "../world/season";
import { addSeedling, seedSpot, type Seedling } from "../world/seedlings";
import { addMark, type Mark } from "../world/marks";
import {
  activePark,
  PARKS,
  PARK_LIST,
  setActivePark,
  type ParkId,
} from "../world/terrain";
import { createJSONStorage, persist } from "zustand/middleware";

export type PollinatorType = "bee" | "hoverfly" | "butterfly" | "moth";

export type Pollinator = {
  type: PollinatorType;
  name: string;
  bodyColor: string;
  wingColor: string;
  wingStyle: string;
  /** Which trail follows you: "pollen", "sparkle", or "none". */
  trailEffect: string;
  /** The colour of that trail. Picked apart from the accent, so a gold hat and
   *  a pink trail are yours to have. */
  trailColor: string;
  /** Hat, flower, scarf, or nothing. */
  accessory: string;
  /** The colour of the accessory. */
  accentColor: string;
  /** The colour of the raincoat, worn only when it rains. Its own colour, like
   *  the trail: a yellow slicker and a pink trail are both yours to have. */
  raincoatColor: string;
};

export type PlayerMovementState =
  | "Hovering"
  | "Flying"
  | "Boosting"
  | "Pollinating";

export type PlayerState = {
  areaId: string;
  altitude: number;
  heading: number;
  movement: PlayerMovementState;
  position: {
    x: number;
    z: number;
  };
  speed: number;
};

export type OfflineRunState = {
  active: boolean;
  durationSeconds: number;
  elapsedSeconds: number;
  startedAt: number | null;
};

export type SpeciesKind = "plant" | "fungus";

/** A thing in the world, identified by what it is and which one it is. */
export type SpeciesRef = {
  kind: SpeciesKind;
  id: string;
  /** The specific instance, so the card hangs over the right one. */
  key: string;
  /**
   * When you arrived, in milliseconds.
   *
   * Set by `land`, and only by `land`. Whether another insect is on a flower is
   * a function of the wall clock, and the landing card has to answer that on its
   * very first paint or it flashes a Pollinate button for one frame before
   * replacing it. Reading the clock in render is impure and the linter says so,
   * quite correctly, so the moment is stamped here in the event handler where
   * reading it is exactly the right thing to do.
   */
  at?: number;
  /**
   * Where the instance stands, in world X and Z.
   *
   * Carried so that a flower which takes can set seed NEAR ITSELF. Optional
   * because plenty of refs are built for things that never need it (an entry
   * opened from the journal has no position and does not want one).
   */
  x?: number;
  z?: number;
};

export type UIModalState = {
  pollinatorPreviewOpen: boolean;
  /** What the bee is close enough to interact with, if anything. */
  nearby: SpeciesRef | null;
  /** Whose entry is open on screen, if any. */
  activeEntry: SpeciesRef | null;
  /** Landed on something: the interaction menu is up. */
  landedOn: SpeciesRef | null;
  /** The plant being pollinated. Fungi never appear here; nothing pollinates a mushroom. */
  minigamePlantId: string | null;
  /**
   * WHICH plant, not just which species.
   *
   * The scatter key of the stalk you are standing on. Only co-op needs it: two
   * players are working the same flower when they are on the same instance, and
   * two asters forty units apart are two different jobs.
   */
  minigameInstance: string | null;
  /**
   * WHERE that flower stands.
   *
   * Kept beside the instance key because a flower that takes sets seed where it
   * is, and by the time the minigame resolves the landing card is long gone.
   */
  minigameSpot: { x: number; z: number } | null;
  /** The species whose quiz is running. */
  quiz: SpeciesRef | null;
  /** The plant being named from its winter form, if any. */
  winterId: SpeciesRef | null;
};

export type Settings = {
  /** Audio starts off. Browsers block sound before a gesture anyway, and a game
   *  that shouts at you the moment it loads is a game people mute forever. */
  soundOn: boolean;
  volume: number;
};

/** Counters the badge rules need that aren't derivable from the boolean records. */
export type Stats = {
  pollinationAttempts: number;
  pollinationSuccesses: number;
  /** Consecutive successes. Resets on a failure. */
  streak: number;
  bestStreak: number;
  quizzesTaken: number;
  quizzesPassed: number;
  /** Total questions answered correctly, across every quiz. */
  questionsCorrect: number;
};

type BooleanRecord = Record<string, boolean>;

export type GameState = {
  player: PlayerState;
  pollinator: Pollinator;
  discoveredPlants: BooleanRecord;
  discoveredFungi: BooleanRecord;
  /** Species whose quiz you have passed. Plants and fungi alike. */
  quizPassed: BooleanRecord;
  /** Which phases of the day you have visited the park in. */
  seenPhases: BooleanRecord;
  /** Which seasons of the year you have visited the park in. */
  seenSeasons: BooleanRecord;
  /**
   * Rare skies you have actually been out in.
   *
   * Never granted, never rolled: the real observation put you in a thunderstorm
   * or it did not. See `world/weather-moments.ts`.
   */
  seenWeather: BooleanRecord;
  /**
   * Plants you have named from their winter form, with nothing to go on but the
   * shape, the height and the place. A second pass over the same species, on the
   * real calendar. See `world/winter.ts`.
   */
  winterKnown: BooleanRecord;
  /**
   * You worked a flower alongside somebody else and it took.
   *
   * A flag rather than a count, because it marks a thing that happened rather
   * than a tally to grow, and there is no leaderboard for a number to feed.
   */
  coopPollinated: boolean;
  pollinatedPlants: BooleanRecord;
  /**
   * Seed you have set, and where.
   *
   * The one part of the save that changes the WORLD rather than the record of
   * it. Every other field here is a note about what you have seen; this puts
   * plants in the park that were not there before, because you pollinated the
   * flowers that made them.
   *
   * Keyed by the instance that set it, which caps it: pollinating the same
   * stalk twice replaces its seedling rather than stacking a thicket on one
   * spot. See `world/seedlings.ts`.
   */
  seedlings: Record<string, Seedling>;
  /**
   * Patches you have danced about.
   *
   * A list rather than a record, because these are ordered by when and capped:
   * newest first, oldest dropped. See `world/marks.ts` for why they expire at
   * all, which is the same reason a real dance is over in a minute.
   */
  marks: Mark[];
  unlockedMapAreas: BooleanRecord;
  /** The park you are flying. Not progress: just where you are. */
  currentPark: ParkId;
  /**
   * Schenley is earned, not given. It opens when you have found half of Frick's
   * plants, which is a real threshold rather than a timer: it means you have
   * actually learned to look, and it gives the second park something to be a
   * reward FOR.
   */
  unlockedParks: BooleanRecord;
  unlockedBadges: BooleanRecord;
  unlockedJournalEntries: BooleanRecord;
  offlineRun: OfflineRunState;
  ui: UIModalState;
  settings: Settings;
  stats: Stats;
  /**
   * The last minigame score, 0 to 1. Session-only, deliberately not persisted
   * and deliberately not in `partialize`: it is a window onto the difficulty,
   * not progress.
   */
  lastMinigameScore: number;
  /**
   * Whether the raincoat is on. Session-only and not persisted: it only means
   * anything while it is raining, and it defaults to worn, so a bee caught in the
   * rain is dry and quick unless the player chooses to take the coat off.
   */
  wearingRaincoat: boolean;
  /**
   * Bumped each time a successful pollination's popover is dismissed. Session-
   * only, never persisted: it is a one-shot cue for the scene to play the
   * celebration once the panel is out of the way, not a fact about the save.
   */
  pollinationCue: number;
  /** Has the player been shown the first-flight tutorial? */
  tutorialSeen: boolean;
  /** Badges earned but not yet announced on screen. */
  pendingBadges: string[];
};

/** Only the on/off flags in the UI state — not the plant ids alongside them. */
export type ToggleableModal = {
  [Key in keyof UIModalState]: UIModalState[Key] extends boolean ? Key : never;
}[keyof UIModalState];

export type GameActions = {
  setPlayerFlightState: (player: Partial<PlayerState>) => void;
  updatePollinator: (pollinator: Partial<Pollinator>) => void;
  discoverPlant: (plantId: string) => void;
  enterPark: (park: ParkId) => void;
  pollinatePlant: (plantId: string) => void;
  /** A flower took: record the seed it set, and where. */
  setSeed: (instance: string, plantId: string, x: number, z: number) => void;
  /** Dance about a patch, so you can find it again. */
  markPatch: (mark: Omit<Mark, "at" | "park">) => void;
  unlockMapArea: (areaId: string) => void;
  unlockBadge: (badgeId: string) => void;
  unlockJournalEntry: (entryId: string) => void;
  discoverFungus: (fungusId: string) => void;
  setNearby: (ref: SpeciesRef | null) => void;
  openEntry: (ref: SpeciesRef) => void;
  closeEntry: () => void;
  land: (ref: SpeciesRef) => void;
  takeOff: () => void;
  startMinigame: (
    plantId: string,
    month: number,
    instance?: string,
  ) => void;
  endMinigame: () => void;
  startQuiz: (ref: SpeciesRef) => void;
  endQuiz: () => void;
  recordQuiz: (ref: SpeciesRef, correct: number, total: number) => void;
  seePhase: (phase: string) => void;
  seeSeason: (season: string) => void;
  /** Remember a rare sky. Ids from `WEATHER_MOMENTS`, several at once. */
  seeWeather: (moments: string[]) => void;
  /** Named from its winter form. Monotonic, like every other discovery. */
  recordWinterId: (plantId: string) => void;
  /** Monotonic, like every other discovery: it happened or it has not yet. */
  recordCoopPollination: () => void;
  startWinterId: (ref: SpeciesRef) => void;
  endWinterId: () => void;
  toggleRaincoat: () => void;
  recordPollinationAttempt: (succeeded: boolean) => void;
  /** Ask the scene to celebrate: the bee just pollinated and the panel closed. */
  signalPollinationCue: () => void;
  /**
   * The last minigame score, 0 to 1.
   *
   * Session-only and never persisted: it exists so the difficulty is observable
   * from outside. Every game caps at 1.0 for any awake player today, which means
   * the real failure rate is 8% rather than the 20% the whole game claims, and
   * nobody noticed because there was no way to look.
   */
  recordMinigameScore: (score: number) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  completeTutorial: () => void;
  queueBadges: (badgeIds: string[]) => void;
  dismissBadge: (badgeId: string) => void;
  openModal: (modal: ToggleableModal) => void;
  closeModal: (modal: ToggleableModal) => void;
  startOfflineRun: () => void;
  tickOfflineRun: (elapsedSeconds: number) => void;
  resetOfflineRun: () => void;
  resetSessionProgress: () => void;
};

export type GameStore = GameState & GameActions;

export const DEFAULT_POLLINATOR: Pollinator = {
  type: "bee",
  name: "Scout",
  bodyColor: "#f2bb42",
  wingColor: "#dcefff",
  wingStyle: "round",
  // Fly clean by default; a trail is something the player opts into. The colour
  // is still set, so choosing a trail later starts on a sensible gold.
  trailEffect: "none",
  trailColor: "#f6d15a",
  accessory: "none",
  accentColor: "#c0413b",
  // The classic slicker yellow, until the player repaints it.
  raincoatColor: "#f7e07a",
};

const initialPlayer: PlayerState = {
  areaId: "environmental-center",
  altitude: 2.1,
  heading: 0,
  movement: "Hovering",
  position: {
    x: 0,
    z: 0,
  },
  speed: 0,
};

const initialOfflineRun: OfflineRunState = {
  active: false,
  durationSeconds: 600,
  elapsedSeconds: 0,
  startedAt: null,
};

const initialUi: UIModalState = {
  pollinatorPreviewOpen: false,
  nearby: null,
  activeEntry: null,
  landedOn: null,
  minigameSpot: null,
  minigamePlantId: null,
  minigameInstance: null,
  quiz: null,
  winterId: null,
};

const initialSettings: Settings = {
  soundOn: false,
  volume: 0.6,
};

const initialStats: Stats = {
  pollinationAttempts: 0,
  pollinationSuccesses: 0,
  streak: 0,
  bestStreak: 0,
  quizzesTaken: 0,
  quizzesPassed: 0,
  questionsCorrect: 0,
};

/**
 * May this player work this flower, this month?
 *
 * Two gates, and they fail for different reasons.
 *
 * **The season.** There has to be a flower on it. A plant out of its bloom can be
 * landed on, read and quizzed, which is the whole point of letting it be found all
 * year, but there is nothing on it to pollinate. Passing the month is not
 * optional: an omitted month used to mean "any month", and that is exactly the
 * silent yes this function exists to prevent.
 *
 * **The quiz.** A handful in every park are difficult, and a difficult flower will
 * not let you at it until you have passed its quiz. That is not a lock for the
 * sake of one: every plant marked demanding has a real mechanism that a real
 * insect has to learn, and failing at it is what an inexperienced bee actually
 * does.
 */
export function canPollinate(
  state: { quizPassed: BooleanRecord },
  plantId: string,
  month: number,
): boolean {
  const plant = PLANTS_BY_ID.get(plantId);

  if (!plant) {
    return false;
  }

  if (!isInSeason(seasonWindow(plant.bloom), month)) {
    return false;
  }

  if (!plant.demanding) {
    return true;
  }

  return Boolean(state.quizPassed[plantId]);
}

/**
 * How many of a park's plants you have found, and how many you need.
 *
 * Both derived from the park's own `requires`, so the chain (Frick opens
 * Schenley, Schenley opens Highland) is declared next to the parks rather than
 * hard-coded here. Adding a fourth park is a data change.
 */
/**
 * The plants of a park that count towards unlocking the next one.
 *
 * SOLO_PLANTS, not PLANTS. Frick has sixteen and Schenley opens at half of
 * them, so counting the two garden party species would push that to nine for
 * every player mid-way through the game: a door they were walking towards
 * moving further away, over a feature they may never have opened. And party
 * plants would count towards satisfying it, so the second park could open
 * without the first being half-learned.
 */
export function plantsIn(park: ParkId) {
  return SOLO_PLANTS.filter((plant) =>
    plant.homes.some((home) => home.park === park),
  );
}

export function plantsFoundIn(discovered: BooleanRecord, park: ParkId) {
  return plantsIn(park).filter((plant) => discovered[plant.id]).length;
}

/** What this park asks of you, or null if it is where you start. */
export function requirementFor(park: ParkId, discovered: BooleanRecord) {
  const requires = PARKS[park]?.requires;

  if (!requires) {
    return null;
  }

  return {
    from: PARKS[requires.park],
    // Pinned, not derived. See the comment on `requires` in `world/park.ts`:
    // a door computed from the current species count moves under a player
    // every time content is added.
    needed: requires.needed,
    found: plantsFoundIn(discovered, requires.park),
  };
}

/**
 * May this player fly this park?
 *
 * Deliberately OR'd with the derived check rather than trusting the stored flag
 * alone. Every save file that existed before the parks were added has no
 * `unlockedParks` in it, and a player who has already found twelve of Frick's
 * sixteen plants must not be shut out of a park they earned months ago because a
 * field was added after they earned it. The stored flag is a record of the moment
 * it happened; the derived check is the truth.
 */
export function parkUnlocked(
  state: { unlockedParks: BooleanRecord; discoveredPlants: BooleanRecord },
  park: ParkId,
): boolean {
  const requirement = requirementFor(park, state.discoveredPlants);

  if (!requirement) {
    return true;
  }

  return (
    Boolean(state.unlockedParks[park]) || requirement.found >= requirement.needed
  );
}

/** Every park this player has just earned but does not yet have the flag for. */
function earnedParks(
  state: { unlockedParks: BooleanRecord; discoveredPlants: BooleanRecord },
): BooleanRecord {
  let next = state.unlockedParks;

  for (const park of PARK_LIST) {
    if (!next[park.id] && parkUnlocked(state, park.id)) {
      next = { ...next, [park.id]: true };
    }
  }

  return next;
}

const initialProgress = {
  lastMinigameScore: 0,
  pollinationCue: 0,
  wearingRaincoat: true,
  discoveredPlants: {},
  discoveredFungi: {},
  quizPassed: {},
  seenPhases: {},
  seenSeasons: {},
  seenWeather: {},
  winterKnown: {},
  coopPollinated: false,
  pollinatedPlants: {},
  seedlings: {},
  marks: [],
  currentPark: "frick" as ParkId,
  // Frick is where you start. Schenley has to be earned.
  unlockedParks: { frick: true } as BooleanRecord,
  unlockedMapAreas: {
    // Where the player starts: the lawn outside the Frick Environmental Center.
    "environmental-center": true,
  },
  unlockedBadges: {},
  unlockedJournalEntries: {},
  stats: initialStats,
  pendingBadges: [] as string[],
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
  player: initialPlayer,
  pollinator: DEFAULT_POLLINATOR,
  offlineRun: initialOfflineRun,
  ui: initialUi,
  settings: initialSettings,
  tutorialSeen: false,
  ...initialProgress,

  setPlayerFlightState: (player) =>
    set((state) => ({
      player: {
        ...state.player,
        ...player,
        position: {
          ...state.player.position,
          ...player.position,
        },
      },
    })),

  updatePollinator: (pollinator) =>
    set((state) => {
      const next = { ...state.pollinator, ...pollinator };

      /**
       * You cannot wear what you have not earned.
       *
       * Enforced here rather than only by disabling the button, for the same
       * reason the pollination gate is: a disabled button is a suggestion. This
       * also catches the case nobody clicks, which is a save file that arrives
       * from the cloud, or from an older version, wearing something this player
       * has no badge for. It falls back to bare rather than refusing the whole
       * update, because losing your hat is a smaller surprise than losing your
       * name.
       */
      if (!accessoryUnlocked(state.unlockedBadges, next.accessory as Accessory)) {
        next.accessory = "none";
      }

      return { pollinator: next };
    }),

  discoverPlant: (plantId) =>
    set((state) => {
      if (state.discoveredPlants[plantId]) {
        return state;
      }

      const discoveredPlants = { ...state.discoveredPlants, [plantId]: true };

      // Crossing halfway through a park's plants opens the next one, in the same
      // update that discovered the flower. Anywhere else and the player finds
      // their eighth and is told about it later, or worse, on the next reload.
      const unlockedParks = earnedParks({
        unlockedParks: state.unlockedParks,
        discoveredPlants,
      });

      return {
        discoveredPlants,
        unlockedParks,
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          [`plant:${plantId}`]: true,
        },
      };
    }),

  /**
   * Change park.
   *
   * The world module is told first and the store second, because everything the
   * scene builds on mount (terrain, scatter, collision) reads the active park at
   * build time. Setting the store first would render one frame of Schenley's bee
   * standing in Frick.
   */
  enterPark: (park) =>
    set((state) => {
      if (!parkUnlocked(state, park)) {
        return state;
      }

      setActivePark(park);

      return { currentPark: park };
    }),

  /**
   * A flower took, so it sets seed.
   *
   * Keyed by the instance that set it, so working the same stalk every day
   * leaves one seedling beside it rather than a thicket. Deliberately separate
   * from `pollinatePlant`, which is monotonic and fires only the FIRST time you
   * pollinate a species: seed is set every time a flower takes, and a player who
   * has already met goldenrod should still be able to sow more of it.
   */
  setSeed: (instance, plantId, x, z) =>
    set((state) => {
      if (!PLANTS_BY_ID.has(plantId)) {
        return state;
      }

      const spot = seedSpot(instance, x, z);

      return {
        seedlings: addSeedling(state.seedlings, instance, {
          plant: plantId,
          /**
           * The park you are FLYING, not the one your save prefers.
           *
           * These are not the same, and assuming they were was a real bug. The
           * scene builds `partyPark ?? forcedPark ?? storedPark` and points the
           * world module at it, but `currentPark` is only ever written by
           * `enterPark`: join a party at Highland with a save that says Frick
           * and every seed you set was filed under Frick, at Highland's
           * coordinates. It would then either surface in the wrong park in a
           * nonsense spot or be silently dropped by the waterline check, and
           * nothing anywhere would report a problem.
           *
           * `activePark()` is the ground truth by construction: it is the
           * terrain that is actually built under you.
           */
          park: activePark().id,
          x: spot.x,
          z: spot.z,
          at: Date.now(),
        }),
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          "concept:seed-set": true,
        },
      };
    }),

  markPatch: (mark) =>
    set((state) => ({
      // The park is taken from the world, not from the caller, for the same
      // reason as `setSeed` above: two callers would each have to remember, and
      // one of them (a mark arriving from a party) had it wrong.
      marks: addMark(
        state.marks,
        { ...mark, park: activePark().id, at: Date.now() },
        Date.now(),
      ),
      unlockedJournalEntries: {
        ...state.unlockedJournalEntries,
        "concept:waggle-dance": true,
      },
    })),

  pollinatePlant: (plantId) =>
    set((state) => {
      if (state.pollinatedPlants[plantId]) {
        return state;
      }

      return {
        discoveredPlants: {
          ...state.discoveredPlants,
          [plantId]: true,
        },
        pollinatedPlants: {
          ...state.pollinatedPlants,
          [plantId]: true,
        },
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          [`plant:${plantId}`]: true,
          "concept:mutualism": true,
        },
      };
    }),

  unlockMapArea: (areaId) =>
    set((state) => {
      if (state.unlockedMapAreas[areaId]) {
        return state;
      }

      return {
        currentPark: "frick" as ParkId,
  // Frick is where you start. Schenley has to be earned.
  unlockedParks: { frick: true } as BooleanRecord,
  unlockedMapAreas: {
          ...state.unlockedMapAreas,
          [areaId]: true,
        },
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          [`area:${areaId}`]: true,
        },
      };
    }),

  unlockBadge: (badgeId) =>
    set((state) => {
      if (state.unlockedBadges[badgeId]) {
        return state;
      }

      return {
        unlockedBadges: {
          ...state.unlockedBadges,
          [badgeId]: true,
        },
      };
    }),

  unlockJournalEntry: (entryId) =>
    set((state) => {
      if (state.unlockedJournalEntries[entryId]) {
        return state;
      }

      return {
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          [entryId]: true,
        },
      };
    }),

  discoverFungus: (fungusId) =>
    set((state) => {
      if (state.discoveredFungi[fungusId]) {
        return state;
      }

      return {
        discoveredFungi: { ...state.discoveredFungi, [fungusId]: true },
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          [`fungus:${fungusId}`]: true,
        },
      };
    }),

  setNearby: (ref) =>
    set((state) =>
      // Written from the flight loop, so bail out unless it actually changed, or
      // every subscriber re-renders continuously.
      state.ui.nearby?.key === ref?.key
        ? state
        : { ui: { ...state.ui, nearby: ref } },
    ),

  openEntry: (ref) => set((state) => ({ ui: { ...state.ui, activeEntry: ref } })),

  closeEntry: () => set((state) => ({ ui: { ...state.ui, activeEntry: null } })),

  land: (ref) =>
    set((state) => ({
      ui: { ...state.ui, landedOn: { ...ref, at: ref.at ?? Date.now() } },
    })),

  takeOff: () => set((state) => ({ ui: { ...state.ui, landedOn: null } })),

  startMinigame: (plantId, month, instance) =>
    set((state) => {
      // The gate is enforced HERE, not only on the button.
      //
      // A disabled button is a suggestion. This is the rule: a flower out of its
      // bloom, or a demanding one whose quiz has not been passed, does not open
      // its minigame, no matter who calls this or from where. The season half of
      // that arrived late and lived only on the button for a while, which is the
      // arrangement this comment already said was not good enough.
      if (!canPollinate(state, plantId, month)) {
        return state;
      }

      /**
       * The spot comes from the landing, not from the caller.
       *
       * You are standing on the flower when this is called, and `landedOn`
       * already knows where it is. Taking it from there rather than adding two
       * more arguments means no caller can forget to pass it and quietly get a
       * seedling at the world origin. Matched on the key so a stale landing
       * cannot lend its position to a different flower.
       */
      const landed = state.ui.landedOn;
      const spot =
        landed && landed.key === instance && landed.x !== undefined
          ? { x: landed.x, z: landed.z ?? 0 }
          : null;

      return {
        ui: {
          ...state.ui,
          minigamePlantId: plantId,
          minigameInstance: instance ?? null,
          minigameSpot: spot,
          landedOn: null,
        },
      };
    }),

  endMinigame: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        minigamePlantId: null,
        minigameInstance: null,
        minigameSpot: null,
      },
    })),

  startQuiz: (ref) =>
    set((state) => ({ ui: { ...state.ui, quiz: ref, landedOn: null } })),

  /**
   * Leave the quiz.
   *
   * If you just unlocked a demanding flower, you land back ON it rather than back
   * in the air. Otherwise passing the quiz for the one flower that required it
   * would dump you into the sky and make you fly down and land again, which is a
   * dead end dressed up as a reward.
   */
  endQuiz: () =>
    set((state) => {
      const ref = state.ui.quiz;
      const opened =
        ref?.kind === "plant" &&
        Boolean(PLANTS_BY_ID.get(ref.id)?.demanding) &&
        Boolean(state.quizPassed[ref.id]);

      return { ui: { ...state.ui, quiz: null, landedOn: opened ? ref : null } };
    }),

  recordQuiz: (ref, correct, total) =>
    set((state) => {
      // Two out of three is a pass. Getting one wrong should not wipe the round.
      const passed = correct >= Math.ceil((total * 2) / 3);

      return {
        stats: {
          ...state.stats,
          quizzesTaken: state.stats.quizzesTaken + 1,
          quizzesPassed: state.stats.quizzesPassed + (passed ? 1 : 0),
          questionsCorrect: state.stats.questionsCorrect + correct,
        },
        quizPassed: passed
          ? { ...state.quizPassed, [ref.id]: true }
          : state.quizPassed,
      };
    }),

  seePhase: (phase) =>
    set((state) =>
      state.seenPhases[phase]
        ? state
        : { seenPhases: { ...state.seenPhases, [phase]: true } },
    ),

  seeSeason: (season) =>
    set((state) =>
      state.seenSeasons[season]
        ? state
        : { seenSeasons: { ...state.seenSeasons, [season]: true } },
    ),

  seeWeather: (moments) =>
    set((state) => {
      const fresh = moments.filter((id) => !state.seenWeather[id]);

      if (fresh.length === 0) {
        return state;
      }

      const seenWeather = { ...state.seenWeather };

      for (const id of fresh) {
        seenWeather[id] = true;
      }

      return { seenWeather };
    }),

  recordCoopPollination: () =>
    set((state) => (state.coopPollinated ? state : { coopPollinated: true })),

  startWinterId: (ref) =>
    set((state) => ({ ui: { ...state.ui, winterId: ref, landedOn: null } })),

  endWinterId: () => set((state) => ({ ui: { ...state.ui, winterId: null } })),

  recordWinterId: (plantId) =>
    set((state) =>
      state.winterKnown[plantId]
        ? state
        : { winterKnown: { ...state.winterKnown, [plantId]: true } },
    ),

  toggleRaincoat: () => set((state) => ({ wearingRaincoat: !state.wearingRaincoat })),

  recordMinigameScore: (score) =>
    set({ lastMinigameScore: Math.max(0, Math.min(1, score)) }),

  recordPollinationAttempt: (succeeded) =>
    set((state) => {
      const streak = succeeded ? state.stats.streak + 1 : 0;

      return {
        stats: {
          ...state.stats,
          pollinationAttempts: state.stats.pollinationAttempts + 1,
          pollinationSuccesses:
            state.stats.pollinationSuccesses + (succeeded ? 1 : 0),
          streak,
          bestStreak: Math.max(state.stats.bestStreak, streak),
        },
        // Failing is part of the game and worth learning from, so it unlocks
        // its own ecology concept rather than being a dead end.
        unlockedJournalEntries: succeeded
          ? state.unlockedJournalEntries
          : {
              ...state.unlockedJournalEntries,
              "concept:pollination-failure": true,
            },
      };
    }),

  signalPollinationCue: () =>
    set((state) => ({ pollinationCue: state.pollinationCue + 1 })),

  updateSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),

  completeTutorial: () => set({ tutorialSeen: true }),

  queueBadges: (badgeIds) =>
    set((state) => {
      const fresh = badgeIds.filter((id) => !state.unlockedBadges[id]);

      if (fresh.length === 0) {
        return state;
      }

      const unlockedBadges = { ...state.unlockedBadges };

      for (const id of fresh) {
        unlockedBadges[id] = true;
      }

      return {
        unlockedBadges,
        pendingBadges: [...state.pendingBadges, ...fresh],
      };
    }),

  dismissBadge: (badgeId) =>
    set((state) => ({
      pendingBadges: state.pendingBadges.filter((id) => id !== badgeId),
    })),

  openModal: (modal) =>
    set((state) => ({
      ui: {
        ...state.ui,
        [modal]: true,
      },
    })),

  closeModal: (modal) =>
    set((state) => ({
      ui: {
        ...state.ui,
        [modal]: false,
      },
    })),

  startOfflineRun: () =>
    set({
      offlineRun: {
        active: true,
        durationSeconds: initialOfflineRun.durationSeconds,
        elapsedSeconds: 0,
        startedAt: Date.now(),
      },
    }),

  tickOfflineRun: (elapsedSeconds) =>
    set((state) => ({
      offlineRun: {
        ...state.offlineRun,
        active: elapsedSeconds < state.offlineRun.durationSeconds,
        elapsedSeconds: Math.min(elapsedSeconds, state.offlineRun.durationSeconds),
      },
    })),

  resetOfflineRun: () =>
    set({
      offlineRun: initialOfflineRun,
      player: initialPlayer,
      ...initialProgress,
      stats: initialStats,
      pendingBadges: [],
    }),

  resetSessionProgress: () =>
    set({
      player: initialPlayer,
      ...initialProgress,
      stats: initialStats,
      pendingBadges: [],
    }),
    }),
    {
      name: "scout-game-state",
      // Progress persists locally. Server autosave is Milestone 14 and out of
      // scope, but a journal and a badge shelf that empty themselves on every
      // reload aren't worth building — so they live in localStorage for now.
      partialize: (state) => ({
        pollinator: state.pollinator,
        discoveredPlants: state.discoveredPlants,
        discoveredFungi: state.discoveredFungi,
        quizPassed: state.quizPassed,
        seenPhases: state.seenPhases,
        seenSeasons: state.seenSeasons,
        seenWeather: state.seenWeather,
        winterKnown: state.winterKnown,
        coopPollinated: state.coopPollinated,
        pollinatedPlants: state.pollinatedPlants,
        seedlings: state.seedlings,
        marks: state.marks,
        unlockedMapAreas: state.unlockedMapAreas,
        unlockedParks: state.unlockedParks,
        currentPark: state.currentPark,
        unlockedBadges: state.unlockedBadges,
        unlockedJournalEntries: state.unlockedJournalEntries,
        settings: state.settings,
        stats: state.stats,
        tutorialSeen: state.tutorialSeen,
      }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const countUnlocked = (record: BooleanRecord) =>
  Object.values(record).filter(Boolean).length;
