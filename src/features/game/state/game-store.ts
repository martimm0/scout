import { create } from "zustand";
import { accessoryUnlocked } from "../data/accessories";
import type { Accessory } from "../models/species";
import { PLANTS, PLANTS_BY_ID } from "../data/plants";
import { PARKS, PARK_LIST, setActivePark, type ParkId } from "../world/terrain";
import { createJSONStorage, persist } from "zustand/middleware";

export type PollinatorType = "bee" | "hoverfly" | "butterfly";

export type Pollinator = {
  type: PollinatorType;
  name: string;
  bodyColor: string;
  wingColor: string;
  wingStyle: string;
  trailEffect: string;
  /** Hat, flower, scarf, or nothing. */
  accessory: string;
  /** The colour of the accessory and the trail. */
  accentColor: string;
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
  /** The species whose quiz is running. */
  quiz: SpeciesRef | null;
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
  pollinatedPlants: BooleanRecord;
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
  unlockMapArea: (areaId: string) => void;
  unlockBadge: (badgeId: string) => void;
  unlockJournalEntry: (entryId: string) => void;
  discoverFungus: (fungusId: string) => void;
  setNearby: (ref: SpeciesRef | null) => void;
  openEntry: (ref: SpeciesRef) => void;
  closeEntry: () => void;
  land: (ref: SpeciesRef) => void;
  takeOff: () => void;
  startMinigame: (plantId: string) => void;
  endMinigame: () => void;
  startQuiz: (ref: SpeciesRef) => void;
  endQuiz: () => void;
  recordQuiz: (ref: SpeciesRef, correct: number, total: number) => void;
  seePhase: (phase: string) => void;
  recordPollinationAttempt: (succeeded: boolean) => void;
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
  trailEffect: "pollen",
  accessory: "none",
  accentColor: "#c0413b",
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
  minigamePlantId: null,
  quiz: null,
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
 * May this player work this flower?
 *
 * Most flowers: yes, always. A handful in every park are difficult, and a
 * difficult flower will not let you at it until you have passed its quiz. That is
 * not a lock for the sake of one: every plant marked demanding has a real
 * mechanism that a real insect has to learn, and failing at it is what an
 * inexperienced bee actually does.
 */
export function canPollinate(
  state: { quizPassed: BooleanRecord },
  plantId: string,
): boolean {
  const plant = PLANTS_BY_ID.get(plantId);

  if (!plant?.demanding) {
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
export function plantsIn(park: ParkId) {
  return PLANTS.filter((plant) => plant.homes.some((home) => home.park === park));
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
    needed: Math.ceil(plantsIn(requires.park).length * requires.fraction),
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
  discoveredPlants: {},
  discoveredFungi: {},
  quizPassed: {},
  seenPhases: {},
  pollinatedPlants: {},
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

  land: (ref) => set((state) => ({ ui: { ...state.ui, landedOn: ref } })),

  takeOff: () => set((state) => ({ ui: { ...state.ui, landedOn: null } })),

  startMinigame: (plantId) =>
    set((state) => {
      // The gate is enforced HERE, not only on the button.
      //
      // A disabled button is a suggestion. This is the rule: a demanding flower
      // does not open its minigame for somebody who has not passed its quiz, no
      // matter who calls this or from where.
      if (!canPollinate(state, plantId)) {
        return state;
      }

      return {
        ui: { ...state.ui, minigamePlantId: plantId, landedOn: null },
      };
    }),

  endMinigame: () =>
    set((state) => ({ ui: { ...state.ui, minigamePlantId: null } })),

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
        pollinatedPlants: state.pollinatedPlants,
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
