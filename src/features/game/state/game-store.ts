import { create } from "zustand";

export type PollinatorType = "bee" | "hoverfly" | "butterfly";

export type Pollinator = {
  type: PollinatorType;
  name: string;
  bodyColor: string;
  wingColor: string;
  wingStyle: string;
  trailEffect: string;
};

export type PlayerMovementState = "Hovering" | "Flying" | "Boosting";

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
};

export type GameActions = {
  setPlayerFlightState: (player: Partial<PlayerState>) => void;
  updatePollinator: (pollinator: Partial<Pollinator>) => void;
  discoverPlant: (plantId: string) => void;
  pollinatePlant: (plantId: string) => void;
  unlockMapArea: (areaId: string) => void;
  unlockBadge: (badgeId: string) => void;
  unlockJournalEntry: (entryId: string) => void;
  openModal: (modal: keyof UIModalState) => void;
  closeModal: (modal: keyof UIModalState) => void;
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
  trailEffect: "soft pollen",
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
};

const initialProgress = {
  discoveredPlants: {},
  pollinatedPlants: {},
  unlockedMapAreas: {
    "environmental-center": true,
  },
  unlockedBadges: {},
  unlockedJournalEntries: {},
};

export const useGameStore = create<GameStore>((set) => ({
  player: initialPlayer,
  pollinator: DEFAULT_POLLINATOR,
  offlineRun: initialOfflineRun,
  ui: initialUi,
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
}));

export const countUnlocked = (record: BooleanRecord) =>
  Object.values(record).filter(Boolean).length;
