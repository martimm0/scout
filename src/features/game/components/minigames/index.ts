import type { MinigameKind } from "../../data/pollination";
import { CueGame } from "./cue";
import { HoverGame } from "./hover";
import { TapsGame } from "./taps";
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
  hover: HoverGame,
  taps: TapsGame,
  cue: CueGame,
};

export type { MinigameProps } from "./types";
