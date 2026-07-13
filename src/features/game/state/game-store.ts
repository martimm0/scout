import { create } from "zustand";
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

export type UIModalState = {
  pollinatorPreviewOpen: boolean;
  /** The plant the bee is currently close enough to interact with, if any. */
  nearbyPlantId: string | null;
  /** The plant whose entry is open on screen, if any. */
  activePlantId: string | null;
  /** The plant currently being pollinated, i.e. the minigame is running. */
  minigamePlantId: string | null;
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
};

type BooleanRecord = Record<string, boolean>;

export type GameState = {
  player: PlayerState;
  pollinator: Pollinator;
  discoveredPlants: BooleanRecord;
  pollinatedPlants: BooleanRecord;
  unlockedMapAreas: BooleanRecord;
  unlockedBadges: BooleanRecord;
  unlockedJournalEntries: BooleanRecord;
  offlineRun: OfflineRunState;
  ui: UIModalState;
  settings: Settings;
  stats: Stats;
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
  pollinatePlant: (plantId: string) => void;
  unlockMapArea: (areaId: string) => void;
  unlockBadge: (badgeId: string) => void;
  unlockJournalEntry: (entryId: string) => void;
  setNearbyPlant: (plantId: string | null) => void;
  openPlantEntry: (plantId: string) => void;
  closePlantEntry: () => void;
  startMinigame: (plantId: string) => void;
  endMinigame: () => void;
  recordPollinationAttempt: (succeeded: boolean) => void;
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
  nearbyPlantId: null,
  activePlantId: null,
  minigamePlantId: null,
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
};

const initialProgress = {
  discoveredPlants: {},
  pollinatedPlants: {},
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
    set((state) => ({
      pollinator: {
        ...state.pollinator,
        ...pollinator,
      },
    })),

  discoverPlant: (plantId) =>
    set((state) => {
      if (state.discoveredPlants[plantId]) {
        return state;
      }

      return {
        discoveredPlants: {
          ...state.discoveredPlants,
          [plantId]: true,
        },
        unlockedJournalEntries: {
          ...state.unlockedJournalEntries,
          [`plant:${plantId}`]: true,
        },
      };
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

  setNearbyPlant: (plantId) =>
    set((state) =>
      // Written from the flight loop every frame, so bail out unless it actually
      // changed — otherwise every subscriber re-renders continuously.
      state.ui.nearbyPlantId === plantId
        ? state
        : { ui: { ...state.ui, nearbyPlantId: plantId } },
    ),

  openPlantEntry: (plantId) =>
    set((state) => ({ ui: { ...state.ui, activePlantId: plantId } })),

  closePlantEntry: () =>
    set((state) => ({ ui: { ...state.ui, activePlantId: null } })),

  startMinigame: (plantId) =>
    set((state) => ({ ui: { ...state.ui, minigamePlantId: plantId } })),

  endMinigame: () =>
    set((state) => ({ ui: { ...state.ui, minigamePlantId: null } })),

  recordPollinationAttempt: (succeeded) =>
    set((state) => {
      const streak = succeeded ? state.stats.streak + 1 : 0;

      return {
        stats: {
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
    }),

  resetSessionProgress: () =>
    set({
      player: initialPlayer,
      ...initialProgress,
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
        pollinatedPlants: state.pollinatedPlants,
        unlockedMapAreas: state.unlockedMapAreas,
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
