import type { MinigameKind } from "../../data/pollination";
import { AnagramGame } from "./anagram";
import { MemoryGame } from "./memory";
import { SeedsGame } from "./seeds";
import type { MinigameProps } from "./types";

/**
 * The registry.
 *
 * Typed against the kind union, so adding a kind to `pollination.ts` without
 * building it is a compile error rather than a blank stage.
 */
export const MINIGAMES: Record<
  MinigameKind,
  (props: MinigameProps) => React.ReactNode
> = {
  memory: MemoryGame,
  seeds: SeedsGame,
  anagram: AnagramGame,
};

export type { MinigameProps } from "./types";
