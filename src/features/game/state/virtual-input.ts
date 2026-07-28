/**
 * The bridge between the touch controls and the flight loop.
 *
 * The scene lives in its own imperative R3F root (`createRoot` in
 * `game-scene.tsx`), so `ScoutScene` and the HUD around it are in SEPARATE React
 * roots. Context does not cross that boundary, and the flight refs (`keysRef`,
 * `yawRef`, `pitchRef`) are private locals inside the scene. The on-screen sticks
 * have to live in the outer DOM, so they need some other way to reach the loop.
 *
 * A module singleton is that way, and it is the pattern the world module already
 * uses for state the frame loop reads without React knowing (`setActivePark` /
 * `activePark` in `world/terrain.ts`).
 *
 * Zustand would be the wrong tool here and the reason is worth keeping: these are
 * per-frame values, and this project already learned (see the minigame shell's
 * `reportScore`, and ARCHITECTURE section 8) that a per-frame value put in state
 * re-renders its subscribers sixty times a second.
 *
 * Every field is a RATE, held between frames by whichever thumb is on the control,
 * because that is exactly what the loop already consumes: it multiplies by
 * `delta` itself. Nothing here needs draining.
 *
 * **The desktop game is untouched by all of this**, because with no touch layer
 * mounted every field stays at its zero and every read folds to the keyboard's
 * answer.
 */

export type VirtualInput = {
  /** Left stick X. Feeds the same `turnInput` the arrow keys produce. */
  turn: number;
  /** Left stick Y. Feeds the same `throttle` the arrow keys produce. */
  throttle: number;
  /** Right stick Y. Pitches the camera, as the mouse's vertical axis does. */
  lookPitch: number;
  /** The climb and dive buttons. Adds to the E/Q axis. */
  altitude: number;
  boost: boolean;
  /**
   * A one-shot gesture, waiting to be picked up.
   *
   * The gesture ref is private to the scene like the flight refs, but unlike them
   * a gesture is an event rather than a rate: the loop takes it and puts this back
   * to null. Typed as a bare union rather than importing `Gesture` from the model,
   * so state does not have to depend on a component.
   */
  pendingGesture: "greet" | "dance" | null;
};

export const virtualInput: VirtualInput = {
  turn: 0,
  throttle: 0,
  lookPitch: 0,
  altitude: 0,
  boost: false,
  pendingGesture: null,
};

/**
 * Drop everything, at once.
 *
 * Needed whenever a popover takes over, because a touch control does not send a
 * "release" when it is unmounted or covered: a thumb on the throttle when a modal
 * opens would otherwise leave the bee flying forever. This is the touch twin of
 * the frame loop clearing `keysRef` on blur.
 */
export function resetVirtualInput() {
  virtualInput.turn = 0;
  virtualInput.throttle = 0;
  virtualInput.lookPitch = 0;
  virtualInput.altitude = 0;
  virtualInput.boost = false;
  virtualInput.pendingGesture = null;
}

/**
 * A stick axis, from raw travel to something a thumb can steer with.
 *
 * The dead zone stops a resting thumb from drifting the bee, and the curve gives
 * fine control near the middle while still reaching full tilt at the edge. A
 * mouse needs neither, which is why this lives with the touch input and not in
 * the loop.
 */
export function stickAxis(offset: number, radius: number): number {
  const raw = Math.max(-1, Math.min(1, offset / radius));
  const magnitude = Math.abs(raw);
  const DEAD_ZONE = 0.14;

  if (magnitude < DEAD_ZONE) {
    return 0;
  }

  const scaled = (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE);

  return Math.sign(raw) * scaled * scaled;
}
