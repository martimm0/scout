"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { coarsePointerNow } from "../hooks/use-media-query";
import { pinnedQuality } from "../models/quality";
import { useGameStore } from "../state/game-store";
import { announce } from "../state/moments";

/**
 * If the fine park is too much for this machine, stop drawing it.
 *
 * A mouse starts on high, and high is several million triangles. That is
 * nothing to a recent laptop and a slideshow on an old one, and the player on
 * the old one should not have to find a setting to make the game playable. So
 * for the first few seconds after the park has finished sharpening, the frame
 * rate is watched, and if it cannot hold about thirty the park drops itself to
 * low and says so.
 *
 * Once, and only when nobody has chosen. A player who picked high gets high. A
 * test that pinned a quality gets that quality. And never under automation,
 * where a slow software renderer would rebuild the park in the middle of a
 * test that was counting on it staying put.
 */
const WATCH_SECONDS = 4;
const SETTLE_SECONDS = 1.2;
const FLOOR_FPS = 28;
const HIDDEN_SECONDS = 2;

export function QualityGuard() {
  const watch = useRef({ waited: 0, time: 0, frames: 0, done: false });

  useFrame((_state, delta) => {
    const state = watch.current;

    if (state.done) {
      return;
    }

    if (
      navigator.webdriver ||
      coarsePointerNow() ||
      pinnedQuality() !== null ||
      useGameStore.getState().settings.quality !== undefined
    ) {
      state.done = true;

      return;
    }

    // Not until the park is whole: the sharpening itself drops frames.
    if (document.documentElement.dataset.scoutBuilding !== "0") {
      return;
    }

    // A frame that took seconds is a tab that was hidden, not a slow machine.
    // The line has to be well above a slow frame: at a quarter of a second it
    // threw away every frame of a machine drawing four a second, which is the
    // one this guard most needs to catch.
    if (delta > HIDDEN_SECONDS) {
      return;
    }

    if (state.waited < SETTLE_SECONDS) {
      state.waited += delta;

      return;
    }

    state.time += delta;
    state.frames += 1;

    if (state.time >= WATCH_SECONDS) {
      state.done = true;

      if (state.frames / state.time < FLOOR_FPS) {
        useGameStore.getState().updateSettings({ quality: "low" });
        announce({
          label: "Detail set to low",
          title: "Keeping it smooth",
          detail: "Change it back in Controls.",
        });
      }
    }
  });

  return null;
}
