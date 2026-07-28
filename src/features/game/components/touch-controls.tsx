"use client";

/* eslint-disable react-hooks/immutability --
 * Writing to the `virtualInput` singleton is the entire job of this file, and the
 * rule is right that it is unusual. The scene runs in a SEPARATE React root
 * (`createRoot` in game-scene.tsx), so no context, prop or store subscription
 * reaches it from out here; a module singleton is the only channel, and it is the
 * same one `world/terrain.ts` uses for the active park. It also has to be a
 * mutation rather than state, because the frame loop reads it sixty times a second
 * and this project already learned what putting a per-frame value in state does
 * (see the minigame shell's `reportScore`, and ARCHITECTURE section 8). */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useFullscreen } from "../hooks/use-fullscreen";
import {
  resetVirtualInput,
  stickAxis,
  virtualInput,
} from "../state/virtual-input";
import styles from "./touch-controls.module.css";

/**
 * The pad: two sticks and a few buttons, overlaid on the park.
 *
 * The two sticks are the two input channels the desktop game already has, one
 * each. The left one is the arrow keys (turn and throttle); the right one is the
 * mouse's vertical axis (pitch). Yaw is unified in this game, so the left thumb
 * owns all turning and the right stick is deliberately one axis only: a right
 * stick that also turned would just be a second, fighting copy of the left one.
 *
 * Everything writes to the `virtualInput` singleton rather than to React state,
 * because the scene reads it inside the frame loop and lives in a different React
 * root. Nothing here re-renders while a thumb is moving; the knobs are positioned
 * by writing to a ref's style directly, which is the same reason the trail and the
 * weather keep their particles off the render path.
 *
 * The root is `pointer-events: none` and each control opts back in, so the parts
 * of the screen between the controls still belong to the game: the Land and Read
 * buttons on a flower's tag stay tappable.
 */

/** How far the knob travels before an axis reads full tilt. */
const STICK_RADIUS = 52;

type Held = { pointerId: number; originX: number; originY: number };

export function TouchControls({
  onPhoto,
  onPreview,
  onRaincoat,
  showRaincoat,
}: {
  onPhoto: () => void;
  /** The Controls panel is hidden on touch, so its buttons live here instead. */
  onPreview: () => void;
  onRaincoat: () => void;
  /** Only offered while it is actually raining; the coat has no other use. */
  showRaincoat: boolean;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  /**
   * Whether a thumb is on the fly stick.
   *
   * The one piece of touch state that IS React state, because it changes once per
   * touch rather than once per frame: it swaps the resting target (which is what
   * tells a new player where to put their thumb) for the live knob.
   */
  const [flying, setFlying] = useState(false);
  const fullscreen = useFullscreen();

  // Everything the thumbs touch is a ref, so a drag never re-renders.
  const moveHeld = useRef<Held | null>(null);
  const pitchHeld = useRef<Held | null>(null);
  const moveZone = useRef<HTMLDivElement>(null);
  const moveKnob = useRef<HTMLDivElement>(null);
  const pitchKnob = useRef<HTMLDivElement>(null);

  // Whatever is held when this unmounts would otherwise stay held forever.
  useEffect(() => resetVirtualInput, []);

  const placeMoveKnob = useCallback((x: number | null, y: number | null) => {
    const zone = moveZone.current;
    const knob = moveKnob.current;

    if (!zone || !knob) {
      return;
    }

    if (x === null || y === null) {
      knob.style.opacity = "0";
      return;
    }

    const rect = zone.getBoundingClientRect();
    knob.style.opacity = "1";
    knob.style.transform = `translate(${x - rect.left}px, ${y - rect.top}px)`;
  }, []);

  /* ----------------------------------------------------------------- *
   * Left stick: turn and throttle. Thumb-anchored, so it appears where
   * the thumb lands rather than making the thumb hunt for it.
   * ----------------------------------------------------------------- */

  const onMoveDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    moveHeld.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
    };
    setFlying(true);
    placeMoveKnob(event.clientX, event.clientY);
  };

  const onMoveMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = moveHeld.current;

    if (!held || held.pointerId !== event.pointerId) {
      return;
    }

    virtualInput.turn = stickAxis(event.clientX - held.originX, STICK_RADIUS);
    // Screen Y grows downward and pushing the stick forward should fly forward,
    // so this one is negated.
    virtualInput.throttle = stickAxis(
      held.originY - event.clientY,
      STICK_RADIUS,
    );

    const clamp = (value: number) =>
      Math.max(-STICK_RADIUS, Math.min(STICK_RADIUS, value));

    placeMoveKnob(
      held.originX + clamp(event.clientX - held.originX),
      held.originY + clamp(event.clientY - held.originY),
    );
  };

  const onMoveUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (moveHeld.current?.pointerId !== event.pointerId) {
      return;
    }

    moveHeld.current = null;
    virtualInput.turn = 0;
    virtualInput.throttle = 0;
    setFlying(false);
    placeMoveKnob(null, null);
  };

  /* ----------------------------------------------------------------- *
   * Right stick: pitch only, on a fixed vertical track.
   * ----------------------------------------------------------------- */

  const onPitchDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pitchHeld.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
    };
  };

  const onPitchMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = pitchHeld.current;

    if (!held || held.pointerId !== event.pointerId) {
      return;
    }

    const travel = event.clientY - held.originY;
    // Down on the track tips the view down, which is the same direction the mouse
    // moves for the same result.
    virtualInput.lookPitch = stickAxis(travel, STICK_RADIUS);

    if (pitchKnob.current) {
      const clamped = Math.max(-STICK_RADIUS, Math.min(STICK_RADIUS, travel));
      pitchKnob.current.style.transform = `translateY(${clamped}px)`;
    }
  };

  const onPitchUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pitchHeld.current?.pointerId !== event.pointerId) {
      return;
    }

    pitchHeld.current = null;
    virtualInput.lookPitch = 0;

    if (pitchKnob.current) {
      pitchKnob.current.style.transform = "translateY(0px)";
    }
  };

  /**
   * A hold button: set on the way down, clear on EVERY way up.
   *
   * `onLostPointerCapture` matters as much as `onPointerUp`. If the browser takes
   * the capture back without sending a release (an interrupting gesture, a system
   * dialog), the button would otherwise stay held forever and the bee would climb
   * out of the park on its own with nothing touching the screen.
   */
  const hold = (set: () => void, clear: () => void) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      set();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onLostPointerCapture: clear,
  });

  return (
    <div aria-hidden={false} className={styles.pad}>
      {/* Left: turn and throttle. */}
      <div
        aria-label="Fly"
        className={styles.moveZone}
        onLostPointerCapture={onMoveUp}
        onPointerCancel={onMoveUp}
        onPointerDown={onMoveDown}
        onPointerMove={onMoveMove}
        onPointerUp={onMoveUp}
        ref={moveZone}
        role="application"
      >
        {/* Where to put your thumb. It is the whole zone, but a target you can
            see is the difference between a control and a secret. It steps aside
            the moment a thumb lands, because from then on the knob is the thing
            to watch. */}
        {flying ? null : (
          <div className={styles.restTarget} aria-hidden>
            <span className={styles.restRing} />
            <span className={styles.restLabel}>fly</span>
          </div>
        )}
        <div className={styles.moveKnob} ref={moveKnob} />
      </div>

      <button
        aria-label="Boost"
        className={styles.boost}
        type="button"
        {...hold(
          () => (virtualInput.boost = true),
          () => (virtualInput.boost = false),
        )}
      >
        fast
      </button>

      {/* Right: pitch, then the altitude pair. */}
      <div className={styles.rightCluster}>
        <div
          aria-label="Tilt the view"
          className={styles.pitchTrack}
          onLostPointerCapture={onPitchUp}
          onPointerCancel={onPitchUp}
          onPointerDown={onPitchDown}
          onPointerMove={onPitchMove}
          onPointerUp={onPitchUp}
          role="application"
        >
          <div className={styles.pitchKnob} ref={pitchKnob} />
        </div>

        <div className={styles.altitude}>
          <button
            aria-label="Climb"
            className={styles.altButton}
            type="button"
            {...hold(
              () => (virtualInput.altitude = 1),
              () => (virtualInput.altitude = 0),
            )}
          >
            ▲
          </button>
          <button
            aria-label="Dive"
            className={styles.altButton}
            type="button"
            {...hold(
              () => (virtualInput.altitude = -1),
              () => (virtualInput.altitude = 0),
            )}
          >
            ▼
          </button>
        </div>
      </div>

      {/* The rest, tucked away: charm and the shutter, not flight. */}
      <div className={styles.tray} data-open={trayOpen}>
        <button
          aria-expanded={trayOpen}
          aria-label={trayOpen ? "Hide actions" : "Show actions"}
          className={styles.trayToggle}
          onClick={() => setTrayOpen((open) => !open)}
          type="button"
        >
          {trayOpen ? "×" : "•••"}
        </button>

        {trayOpen ? (
          <div className={styles.trayItems}>
            <button
              className={styles.trayButton}
              onClick={onPhoto}
              type="button"
            >
              Photo
            </button>
            <button
              className={styles.trayButton}
              onClick={onPreview}
              type="button"
            >
              View pollinator
            </button>
            <button
              className={styles.trayButton}
              onClick={() => (virtualInput.pendingGesture = "greet")}
              type="button"
            >
              Look at me
            </button>
            <button
              className={styles.trayButton}
              onClick={() => (virtualInput.pendingGesture = "dance")}
              type="button"
            >
              Dance
            </button>
            {showRaincoat ? (
              <button
                className={styles.trayButton}
                onClick={onRaincoat}
                type="button"
              >
                Raincoat
              </button>
            ) : null}

            {/* Only where there is something behind it. iPhone Safari has no
                element fullscreen at all, so it simply never appears there. */}
            {fullscreen.supported ? (
              <button
                className={styles.trayButton}
                onClick={() => void fullscreen.toggle()}
                type="button"
              >
                {fullscreen.active ? "Exit full screen" : "Full screen"}
              </button>
            ) : null}

            {/* The scene covers the site header on a touch device, so this is the
                way back to the rest of Scout. */}
            <Link className={styles.trayButton} href="/">
              Leave
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
