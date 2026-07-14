"use client";

import { Sky } from "@react-three/drei";
import { createRoot, extend, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { DirectionalLight, Group } from "three";
import { Vector3 } from "three";
import {
  countUnlocked,
  parkUnlocked,
  useGameStore,
  type Pollinator,
  type PlayerMovementState,
} from "@/features/game/state/game-store";
import { trackEvent } from "@/lib/analytics";
import { playSound, setAreaAmbience } from "../audio/sound";
import { speciesFor } from "../models/pollinators";
import { PollinatorModel } from "./pollinator-model";
import { Creek, Foliage, Landmarks, Terrain } from "./frick-park";
import { SpeciesField } from "./species-field";
import { LandingMenu } from "./landing-menu";
import { Quiz } from "./quiz";
import { SpeciesTag } from "./species-tag";
import { FirstFlight } from "./first-flight";
import { PlantEntry } from "./plant-entry";
import { PollinationMinigame } from "./pollination-minigame";
import { ProgressionWatcher } from "./progression-watcher";
import { SoundToggle } from "./sound-toggle";
import { CloudSyncBadge } from "./cloud-sync-badge";
import { MAX_PHOTOS, usePhotoStore } from "../state/photo-store";
import { PLANTS } from "../data/plants";
import {
  scatterSpecies,
  landingHeight,
  DISCOVERY_RADIUS,
  type SpeciesInstance,
} from "../world/species-scatter";
import { resolveCollision } from "../world/collision";
import {
  daylightAt,
  daylightForHour,
  isActive,
  type Daylight,
} from "../world/daylight";
import {
  areaAt,
  ceiling,
  setActivePark,
  startPosition,
  terrainHeight,
  world,
  GROUND_CLEARANCE,
  PARKS,
  PARK_LIST,
  type ParkId,
} from "../world/terrain";
import styles from "./game-scene.module.css";

extend(THREE as unknown as Parameters<typeof extend>[0]);

type DebugState = {
  areaId: string;
  area: string;
  altitude: number;
  heading: number;
  movement: PlayerMovementState;
  speed: number;
  x: number;
  z: number;
  /** Which physical keys the game is currently seeing held. */
  input: string;
};

/**
 * The bee is now roughly bee-sized — under a unit long against seventy-unit
 * trees — so everything that used to be tuned against a bee the size of a shrub
 * has to be retuned. It flies faster because the park is enormous, and the
 * camera sits close because at this scale a few units back is already a long way.
 */
const BASE_SPEED = 26;
const BOOST_MULTIPLIER = 2.2;
const ALTITUDE_SPEED = 17;
const MOUSE_SENSITIVITY = 0.0024;
/** Radians per second when steering with the arrow keys. */
const TURN_SPEED = 2;
const CAMERA_DISTANCE = 4.4;
const CAMERA_HEIGHT = 1.5;

/**
 * The control scheme, as physical keys.
 *
 *   turn     Mouse, or Left / Right, or A / D
 *   fly      Up / Down, or W / S
 *   climb    E / Q, or the scroll wheel
 *   boost    Shift
 *   act      Space
 *   read     R
 *   greet    F
 *   dance    G
 *
 * The mouse and the turn keys drive one and the same yaw. The bee points where
 * you're looking, and that is also the direction it flies.
 */
const TURN_LEFT = ["ArrowLeft", "KeyA"];
const TURN_RIGHT = ["ArrowRight", "KeyD"];
const FLY_FORWARD = ["ArrowUp", "KeyW"];
const FLY_BACK = ["ArrowDown", "KeyS"];
const CLIMB = ["KeyE"];
const DIVE = ["KeyQ"];
const BOOST = ["ShiftLeft", "ShiftRight"];
const GREET_KEY = "KeyF";
const DANCE_KEY = "KeyG";
const READ_KEY = "KeyR";
const PHOTO_KEY = "KeyP";

const STEER_CODES = new Set([
  ...TURN_LEFT,
  ...TURN_RIGHT,
  ...FLY_FORWARD,
  ...FLY_BACK,
  ...CLIMB,
  ...DIVE,
]);

const ACTION_CODES = new Set([
  ...BOOST,
  "Space",
  GREET_KEY,
  DANCE_KEY,
  READ_KEY,
  PHOTO_KEY,
]);

export type Gesture = "none" | "greet" | "dance";

/** How long the bee holds an about-face before turning back to fly on. */
const GESTURE_DURATION: Record<Gesture, number> = {
  none: 0,
  greet: 1.7,
  dance: 3.4,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** True if any of these physical keys is currently held. */
function held(keys: Set<string>, codes: string[]) {
  return codes.some((code) => keys.has(code));
}

/** -1, 0 or 1 from an opposing pair of keys. */
function axis(keys: Set<string>, negative: string[], positive: string[]) {
  return (held(keys, positive) ? 1 : 0) - (held(keys, negative) ? 1 : 0);
}

function R3FViewport({
  canvasRef,
  daylight,
  onDebugChange,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  daylight: Daylight;
  onDebugChange: (state: DebugState) => void;
}) {
  /**
   * The scene lives in an imperative R3F root, so it does not re-render when the
   * outer component does. When the hour ticks over, the new daylight has to be
   * pushed into the tree by hand, or the sun would be frozen at whatever time
   * the page happened to load.
   */
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    const root = createRoot(canvas);
    rootRef.current = root;
    let mounted = true;

    const configure = async () => {
      const rect = container.getBoundingClientRect();

      if (!mounted || rect.width <= 0 || rect.height <= 0) {
        return;
      }

      // Do NOT touch canvas.width/height here. Those are the drawing buffer, and
      // three sizes it as CSS size x pixel ratio. Forcing it to the CSS size on a
      // retina screen leaves the GL viewport twice the buffer, so you render the
      // bottom-left quadrant blown up 2x — the bee ends up in the top-right
      // corner instead of centred, and only on HiDPI displays.
      await root.configure({
        camera: { fov: 52, position: [0, 4.8, 8.2] },
        dpr: Math.min(window.devicePixelRatio, 2),
        gl: { antialias: true, preserveDrawingBuffer: true },
        shadows: true,
        size: {
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        },
      });

      if (mounted) {
        root.render(<ScoutScene daylight={daylight} onDebugChange={onDebugChange} />);
      }
    };

    void configure();

    const observer = new ResizeObserver(() => {
      void configure();
    });
    observer.observe(container);

    return () => {
      mounted = false;
      observer.disconnect();
      rootRef.current = null;
      root.unmount();
    };
    // Deliberately NOT depending on daylight: rebuilding the whole WebGL root
    // every minute would regenerate the terrain and every prop in the park.
    // The hour is pushed in separately, below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDebugChange]);

  // Push the new hour into the existing tree. React reconciles; nothing is torn
  // down, and the scatter and geometry stay memoised across the re-render.
  useEffect(() => {
    rootRef.current?.render(
      <ScoutScene daylight={daylight} onDebugChange={onDebugChange} />,
    );
  }, [daylight, onDebugChange]);

  return <canvas className={styles.canvas} ref={canvasRef} />;
}

function ScoutScene({
  daylight,
  onDebugChange,
}: {
  daylight: Daylight;
  onDebugChange: (state: DebugState) => void;
}) {
  const playerMovement = useGameStore((state) => state.player.movement);
  const selectedPollinator = useGameStore((state) => state.pollinator);
  const pollinatedCount = useGameStore((state) =>
    countUnlocked(state.pollinatedPlants),
  );
  // This scene's own canvas. A document-wide query would grab whichever canvas
  // mounted first, which is the preview modal's as soon as that opens.
  const canvas = useThree((state) => state.gl.domElement);
  const pollinatorRef = useRef<Group>(null);
  const keysRef = useRef(new Set<string>());
  const lastDebugUpdate = useRef(0);
  const movementState = useRef<PlayerMovementState>("Hovering");
  const pollinatorYawRef = useRef(0);
  const scrollAltitudeRef = useRef(0);
  /**
   * One yaw for everything: where you look, where the bee points, and where it
   * flies. The mouse turns it and the arrow keys turn it, and both mean the
   * same thing.
   *
   * An earlier version split this into a separate heading and camera-look. That
   * is a two-stick idea, and on a mouse and keyboard it just means the bee can
   * fly one way while facing another. What you are looking at IS forward.
   */
  const yawRef = useRef(0);
  const pitchRef = useRef(0.18);
  /** Last pointer position, for engines that don't give us movementX outside pointer lock. */
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  /** An in-progress gesture: the bee turning to face the player. */
  const gestureRef = useRef<{ kind: Gesture; time: number }>({
    kind: "none",
    time: 0,
  });
  const cameraTargetRef = useRef(new Vector3());
  const cameraPositionRef = useRef(new Vector3());
  const directionRef = useRef(new Vector3());
  const forwardRef = useRef(new Vector3());
  const renderPositionRef = useRef(new Vector3());
  const rightRef = useRef(new Vector3());
  const targetPositionRef = useRef(new Vector3(...startPosition()));
  const velocityRef = useRef(new Vector3());
  /** Scratch vector for the collision slide. Reused so the loop allocates nothing. */
  const pushOutRef = useRef(new Vector3());
  const sunRef = useRef<DirectionalLight>(null);

  // How the chosen species handles. A hoverfly darts and stops dead; a butterfly
  // floats and drifts. Without this the species picker is a costume change.
  const flight = speciesFor(selectedPollinator.type).flight;

  // Laid out once. Deterministic, so the park is the same park every session.
  const species = useMemo(() => scatterSpecies(), []);
  /** What the floating card is attached to. */
  const [nearbyInstance, setNearbyInstance] = useState<SpeciesInstance | null>(
    null,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Keyed off event.code — the physical key — rather than event.key, which
      // is whatever the OS layout decided to produce. On a Dvorak or AZERTY
      // layout, or with a modifier held, event.key for the D key is not "d".
      const code = event.code;

      if (STEER_CODES.has(code) || ACTION_CODES.has(code)) {
        event.preventDefault();
      }

      if (code === "Escape") {
        useGameStore.getState().closeEntry();
      }

      // Gestures. Ignore auto-repeat, and don't let one interrupt another
      // mid-spin — otherwise leaning on the key leaves the bee stuck facing you.
      if (
        (code === GREET_KEY || code === DANCE_KEY) &&
        !event.repeat &&
        gestureRef.current.kind === "none"
      ) {
        gestureRef.current = {
          kind: code === GREET_KEY ? "greet" : "dance",
          time: 0,
        };
      }

      // Space LANDS on whatever you are beside. Landing is the interaction now:
      // you settle onto the thing and it asks what you want to do with it.
      if (code === "Space" && !event.repeat) {
        const store = useGameStore.getState();
        const { landedOn, minigamePlantId, nearby, quiz, activeEntry } = store.ui;

        if (nearby && !landedOn && !minigamePlantId && !quiz && !activeEntry) {
          document.exitPointerLock();
          store.land(nearby);
        }
      }

      // R goes straight to the entry, without landing.
      if (code === READ_KEY && !event.repeat) {
        const store = useGameStore.getState();
        const nearby = store.ui.nearby;

        if (nearby && !store.ui.activeEntry) {
          document.exitPointerLock();
          store.openEntry(nearby);
        }
      }

      keysRef.current.add(code);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };

    /**
     * Drop every held key.
     *
     * Without this, losing focus mid-press strands that key in the set forever:
     * alt-tab while turning and the bee turns for the rest of the session, with
     * no keyup ever arriving to stop it. Steering feels dead or possessed and
     * only a reload clears it.
     */
    const releaseAll = () => {
      keysRef.current.clear();
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Look on plain mouse movement over the scene. Requiring a held button
      // (or a click into pointer lock) first meant that simply moving the mouse
      // did nothing at all — so the view never turned, and the bee dutifully
      // following a view that never moved looked exactly like a bee that
      // followed nothing.
      //
      // Movement over the HUD panels is ignored: their event target isn't the
      // canvas, so reaching for a button doesn't spin the camera.
      const locked = document.pointerLockElement === canvas;

      if (!locked && event.target !== canvas) {
        lastPointerRef.current = null;

        return;
      }

      // Don't swing the camera around behind anything that is open.
      const modal = useGameStore.getState().ui;

      if (
        modal.activeEntry ||
        modal.minigamePlantId ||
        modal.landedOn ||
        modal.quiz
      ) {
        return;
      }

      let deltaX: number;
      let deltaY: number;

      if (locked) {
        deltaX = event.movementX;
        deltaY = event.movementY;
      } else {
        // WebKit only populates movementX/movementY while the pointer is LOCKED.
        // Outside pointer lock it reports 0, so hover-to-look — which is how the
        // game is actually played — simply does nothing in Safari. Deriving the
        // delta from clientX/clientY ourselves works in every engine.
        const last = lastPointerRef.current;

        deltaX = last ? event.clientX - last.x : 0;
        deltaY = last ? event.clientY - last.y : 0;

        lastPointerRef.current = { x: event.clientX, y: event.clientY };
      }

      // The mouse turns you. Yaw grows clockwise — forward is (sin y, 0, -cos y)
      // — so moving the mouse right must ADD, or the world comes out mirrored.
      yawRef.current += deltaX * MOUSE_SENSITIVITY;
      // Positive pitch lifts the camera and tips the view DOWN at the park, so
      // pushing the mouse forward (negative delta) has to lower it, i.e. look up.
      // Getting this backwards inverts the vertical axis.
      pitchRef.current = clamp(
        pitchRef.current + deltaY * MOUSE_SENSITIVITY,
        -0.55,
        1.05,
      );
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      scrollAltitudeRef.current += clamp(-event.deltaY * 0.006, -1, 1);
    };

    const handleCanvasClick = () => {
      if (document.pointerLockElement === null) {
        void canvas?.requestPointerLock();
      }
    };

    // Entering or leaving pointer lock switches which source the delta comes
    // from. Drop the anchor, or the first move afterwards is a wild jump.
    const handlePointerLockChange = () => {
      lastPointerRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    canvas?.addEventListener("click", handleCanvasClick);

    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", handleWheel);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      canvas?.removeEventListener("click", handleCanvasClick);
    };
  }, [canvas]);

  useFrame(({ camera, clock }, delta) => {
    const pollinator = pollinatorRef.current;

    if (!pollinator) {
      return;
    }

    const elapsed = clock.getElapsedTime();

    // While anything is up on screen, the bee holds still. Otherwise you would
    // carry on flying blind behind it and surface somewhere else entirely.
    const ui = useGameStore.getState().ui;
    const paused = Boolean(
      ui.activeEntry || ui.minigamePlantId || ui.landedOn || ui.quiz,
    );

    if (paused) {
      keysRef.current.clear();
    }

    const keys = keysRef.current;
    const cameraTarget = cameraTargetRef.current;
    const cameraPosition = cameraPositionRef.current;
    const direction = directionRef.current.set(0, 0, 0);
    const forward = forwardRef.current;
    const renderPosition = renderPositionRef.current;
    const right = rightRef.current;
    const targetPosition = targetPositionRef.current;
    const velocity = velocityRef.current;
    const pushOut = pushOutRef.current;

    // Arrows turn the same yaw the mouse turns. There is only one.
    const turnInput = axis(keys, TURN_LEFT, TURN_RIGHT);

    yawRef.current += turnInput * TURN_SPEED * flight.turn * delta;

    const yaw = yawRef.current;
    const throttle = axis(keys, FLY_BACK, FLY_FORWARD);

    // Forward is wherever you are looking.
    forward.set(Math.sin(yaw), 0, Math.cos(yaw) * -1).normalize();
    right.set(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
    direction.copy(forward).multiplyScalar(throttle);

    const hasMovementInput = throttle !== 0;
    const isBoosting = held(keys, BOOST) && hasMovementInput;
    const isPollinating = keys.has("Space");
    const speed =
      BASE_SPEED * flight.speed * (isBoosting ? BOOST_MULTIPLIER : 1);
    const altitudeInput = axis(keys, DIVE, CLIMB) + scrollAltitudeRef.current;

    scrollAltitudeRef.current *= 0.82;

    if (hasMovementInput) {
      direction.normalize().multiplyScalar(speed);
    }

    // Responsiveness is what actually separates the species in the hand. A
    // hoverfly snaps to its target velocity; a butterfly drifts toward it and
    // keeps drifting after you let go.
    velocity.lerp(direction, 1 - Math.exp(-delta * 8 * flight.responsiveness));
    targetPosition.addScaledVector(velocity, delta);
    targetPosition.y += altitudeInput * ALTITUDE_SPEED * delta;

    targetPosition.x = clamp(targetPosition.x, world().minX + 2, world().maxX - 2);
    targetPosition.z = clamp(targetPosition.z, world().minZ + 2, world().maxZ - 2);

    // The floor follows the ground rather than sitting at a fixed altitude, so
    // the bee can drop all the way down into the ravine and skim the creek.
    const ground = terrainHeight(targetPosition.x, targetPosition.z);
    targetPosition.y = clamp(
      targetPosition.y,
      ground + GROUND_CLEARANCE,
      ceiling(),
    );

    // The park is solid. Push out of anything the bee is inside, then re-clamp
    // to the ground: a push-out can shove you sideways into a hillside, and the
    // terrain has to win that argument or you end up buried.
    const resolved = resolveCollision(
      targetPosition.x,
      targetPosition.y,
      targetPosition.z,
    );

    if (resolved.hit) {
      // Which way the world had to shove us. That is the surface normal, near
      // enough, and it is the only direction the bee is not allowed to travel.
      pushOut
        .set(
          resolved.x - targetPosition.x,
          resolved.y - targetPosition.y,
          resolved.z - targetPosition.z,
        )
        .normalize();

      targetPosition.set(resolved.x, resolved.y, resolved.z);
      targetPosition.y = Math.max(
        targetPosition.y,
        terrainHeight(targetPosition.x, targetPosition.z) + GROUND_CLEARANCE,
      );

      // Kill only the velocity going INTO the wall, and keep whatever was
      // running along it, so the bee slides down a trunk rather than sticking to
      // it. Damping the whole vector instead would cut your speed by two thirds
      // for every frame you so much as brushed a leaf.
      const into = velocity.dot(pushOut);

      if (into < 0) {
        velocity.addScaledVector(pushOut, -into);
      }
    }

    const bob = Math.sin(elapsed * (hasMovementInput ? 9 : 3.2)) * 0.08;
    renderPosition.set(targetPosition.x, targetPosition.y + bob, targetPosition.z);
    pollinator.position.lerp(
      renderPosition,
      1 - Math.exp(-delta * 12),
    );

    // Run down any gesture in progress.
    const gesture = gestureRef.current;

    if (gesture.kind !== "none") {
      gesture.time += delta;

      // Flying cancels it — you shouldn't be stuck admiring the bee's back while
      // trying to get somewhere.
      if (gesture.time >= GESTURE_DURATION[gesture.kind] || throttle !== 0) {
        gestureRef.current = { kind: "none", time: 0 };
      }
    }

    const activeGesture = gestureRef.current.kind;

    // The bee faces where you're looking — which is also where it flies. During
    // a gesture it swings a half-turn to face the camera instead, then comes
    // back on its own.
    //
    // Note the NEGATED yaw. three's rotation.y = t sends the model's -Z nose to
    // (-sin t, 0, -cos t), while the camera's forward is (+sin t, 0, -cos t).
    // The X components have opposite signs, so feeding yaw in directly turns the
    // bee the wrong way — mirrored about the view axis. At yaw 0 the two agree,
    // which is exactly why this survived so long: every screenshot taken facing
    // straight ahead looks perfect, and the bee only peels away once you turn.
    const facing = activeGesture === "none" ? -yaw : -yaw + Math.PI;
    const turnDelta = Math.atan2(
      Math.sin(facing - pollinatorYawRef.current),
      Math.cos(facing - pollinatorYawRef.current),
    );
    pollinatorYawRef.current += turnDelta * (1 - Math.exp(-delta * 9));

    pollinator.rotation.y = pollinatorYawRef.current;

    // Bank into the turn. Roll comes from how hard you're steering, not from
    // sideways velocity — there is no sideways velocity any more.
    pollinator.rotation.z =
      clamp(-turnInput * 0.2 * (hasMovementInput ? 1 : 0.45), -0.24, 0.24) +
      (hasMovementInput ? 0 : Math.sin(elapsed * 3) * 0.03);

    movementState.current = isPollinating
      ? "Pollinating"
      : isBoosting
      ? "Boosting"
      : hasMovementInput
        ? "Flying"
        : "Hovering";

    // The camera orbits the bee on a sphere. It used to only shift its HEIGHT by
    // a few units with pitch, which meant you could never actually tilt the view
    // down and look at the park you were flying over — the horizon stayed pinned
    // at the bee no matter what you did with the mouse.
    const pitch = pitchRef.current;
    const cosPitch = Math.cos(pitch);

    cameraTarget.copy(pollinator.position);
    cameraPosition.set(
      pollinator.position.x - Math.sin(yaw) * CAMERA_DISTANCE * cosPitch,
      pollinator.position.y + CAMERA_HEIGHT + Math.sin(pitch) * CAMERA_DISTANCE,
      pollinator.position.z + Math.cos(yaw) * CAMERA_DISTANCE * cosPitch,
    );
    // Delta-scaled, like every other smoothing term in this loop. A flat 0.08
    // ties camera follow speed to frame rate.
    camera.position.lerp(cameraPosition, 1 - Math.exp(-delta * 5));

    // Never let the camera clip through a hillside behind the bee.
    const cameraGround =
      terrainHeight(camera.position.x, camera.position.z) + 0.7;

    if (camera.position.y < cameraGround) {
      camera.position.y = cameraGround;
    }

    camera.lookAt(cameraTarget);

    // The sun rides along with the bee. A directional light's shadow camera can
    // only cover a small box, and the world is 140x110 — parking it at the
    // origin would leave the bee shadowless almost everywhere.
    const sun = sunRef.current;

    if (sun) {
      // The light rides along with the bee (a directional light's shadow camera
      // covers only a small box, and the world is 700x520), but its DIRECTION is
      // the real sun's: low and long at dawn, overhead at noon, gone at night.
      const [sx, sy, sz] = daylight.sun;

      sun.position.set(
        pollinator.position.x + sx * 140,
        pollinator.position.y + sy * 140,
        pollinator.position.z + sz * 140,
      );
      sun.target.position.copy(pollinator.position);
      sun.target.updateMatrixWorld();
      sun.intensity = daylight.sunIntensity;
      sun.color.set(daylight.sunColor);
    }

    if (elapsed - lastDebugUpdate.current > 0.15) {
      lastDebugUpdate.current = elapsed;

      // The nearest thing within reach that is actually OUT right now. A closed
      // flower and a fungus that is not fruiting are both unreachable, which is
      // the entire point of the clock.
      const hour = daylight.hour;

      let nearestInstance: SpeciesInstance | null = null;
      let nearestDistance = DISCOVERY_RADIUS;

      for (const instance of species) {
        if (!isActive(instance.window, hour)) {
          continue;
        }

        // Measure to the BLOOM or the cap, not the base. A Joe-Pye weed is twenty
        // units tall and its base is nowhere near where a bee would visit it.
        const top = landingHeight(instance) * 0.88;

        const distance = Math.hypot(
          instance.position[0] - pollinator.position.x,
          top - pollinator.position.y,
          instance.position[2] - pollinator.position.z,
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestInstance = instance;
        }
      }

      const store = useGameStore.getState();

      store.setNearby(
        nearestInstance
          ? {
              kind: nearestInstance.species.kind,
              id: nearestInstance.id,
              key: nearestInstance.key,
            }
          : null,
      );

      if (nearestInstance?.key !== nearbyInstance?.key) {
        setNearbyInstance(nearestInstance);
      }

      // Getting close logs it. Landing is what lets you do something with it.
      if (nearestInstance) {
        const id = nearestInstance.id;

        if (nearestInstance.species.kind === "plant") {
          if (!store.discoveredPlants[id]) {
            store.discoverPlant(id);
            playSound("discover");
            trackEvent({ name: "plant_discovered", plant: id });
          }
        } else if (!store.discoveredFungi[id]) {
          store.discoverFungus(id);
          playSound("discover");
          trackEvent({ name: "plant_discovered", plant: id });
        }
      }

      // Which times of day the player has actually seen. Badge fodder, and a
      // gentle nudge that the park is different at other hours.
      store.seePhase(daylight.phase);

      const area = areaAt(pollinator.position.x, pollinator.position.z);
      const areaId = area.id;
      const nextPlayerState = {
        areaId,
        altitude: Number(pollinator.position.y.toFixed(1)),
        heading: Number(((yawRef.current * 180) / Math.PI).toFixed(0)),
        movement: movementState.current,
        position: {
          x: Number(pollinator.position.x.toFixed(1)),
          z: Number(pollinator.position.z.toFixed(1)),
        },
        speed: Number(velocity.length().toFixed(1)),
      };

      store.setPlayerFlightState(nextPlayerState);

      if (!store.unlockedMapAreas[areaId]) {
        trackEvent({ name: "area_entered", area: areaId });
      }

      store.unlockMapArea(areaId);
      setAreaAmbience(areaId);

      onDebugChange({
        areaId,
        area: area.label,
        altitude: nextPlayerState.altitude,
        heading: nextPlayerState.heading,
        movement: nextPlayerState.movement,
        speed: nextPlayerState.speed,
        x: nextPlayerState.position.x,
        z: nextPlayerState.position.z,
        input:
          [...keys]
            .map((code) => code.replace(/^(Key|Arrow|Shift)/, ""))
            .join(" ") || "none",
      });
    }
  });

  return (
    <>
      {/* The sky is the real Pittsburgh sky: the sun's position, the turbidity
          and the rayleigh scattering all come from the hour. Dawn is long and
          red because the light is coming through more atmosphere, which is true. */}
      <Sky
        distance={450000}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        rayleigh={daylight.rayleigh}
        sunPosition={[
          daylight.sun[0] * 100,
          daylight.sun[1] * 100,
          daylight.sun[2] * 100,
        ]}
        turbidity={daylight.turbidity}
      />
      <ambientLight
        color={daylight.ambientColor}
        intensity={daylight.ambientIntensity}
      />
      <directionalLight
        castShadow
        color={daylight.sunColor}
        intensity={daylight.sunIntensity}
        ref={sunRef}
        shadow-bias={-0.0012}
        shadow-camera-bottom={-70}
        shadow-camera-far={300}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight
        args={[
          daylight.ambientColor,
          daylight.groundColor,
          daylight.hemiIntensity,
        ]}
      />
      {/* Haze at the far edge of the park, so the map ends in distance rather
          than at a hard border. Night closes in tighter. */}
      <fogExp2 args={[daylight.fogColor, daylight.fogDensity]} attach="fog" />

      <Terrain />
      <Creek />
      <Landmarks />
      <Foliage />
      <SpeciesField hour={daylight.hour} instances={species} />

      {/* Anchored over the thing itself, not pinned to the screen. */}
      {nearbyInstance ? (
        <SpeciesTag daylight={daylight} instance={nearbyInstance} />
      ) : null}

      {/* Actual bee size, near enough. The world grew around it instead. */}
      <group ref={pollinatorRef} position={startPosition()} scale={1}>
        <PollinatorModel
          animationState={
            playerMovement === "Pollinating"
              ? "pollinating"
              : playerMovement === "Flying" || playerMovement === "Boosting"
                ? "flying"
                : "hovering"
          }
          gestureRef={gestureRef}
          // Pollen baskets on the hind legs, once you're actually carrying some.
          hasPollen={pollinatedCount > 0}
          pollinator={selectedPollinator}
        />
      </group>
    </>
  );
}

function PollinatorPreviewScene({ pollinator }: { pollinator: Pollinator }) {
  const pollinatorRef = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    const pollinatorGroup = pollinatorRef.current;

    if (!pollinatorGroup) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    // The bee models face -Z (the flight loop's forward vector), and the preview
    // camera sits on +Z, so turn it around to show its face rather than its back.
    pollinatorGroup.rotation.y = Math.PI - 0.34 + Math.sin(elapsed * 0.55) * 0.12;
    pollinatorGroup.position.y = Math.sin(elapsed * 1.8) * 0.045;
    camera.position.set(0.7, 0.36, 3.55);
    camera.lookAt(0, 0.04, 0);
  });

  return (
    <>
      <color attach="background" args={["#fff6dc"]} />
      <ambientLight intensity={1.7} />
      <directionalLight intensity={2.5} position={[-2, 3, -4]} />
      <hemisphereLight args={["#f2fbff", "#f1d68e", 1.2]} />
      <group ref={pollinatorRef} scale={1.45}>
        <PollinatorModel animationState="hovering" pollinator={pollinator} />
      </group>
    </>
  );
}

function PollinatorPreviewViewport({ pollinator }: { pollinator: Pollinator }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    const root = createRoot(canvas);
    let mounted = true;

    const configure = async () => {
      const rect = container.getBoundingClientRect();

      if (!mounted || rect.width <= 0 || rect.height <= 0) {
        return;
      }

      // Same as the main viewport: three owns the drawing buffer. Setting it by
      // hand desyncs the GL viewport from the buffer on retina screens.
      await root.configure({
        camera: { fov: 38, position: [0.7, 0.36, 3.55] },
        dpr: Math.min(window.devicePixelRatio, 2),
        gl: { antialias: false, alpha: false, preserveDrawingBuffer: true },
        size: {
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        },
      });

      if (mounted) {
        root.render(<PollinatorPreviewScene pollinator={pollinator} />);
      }
    };

    void configure();

    const observer = new ResizeObserver(() => {
      void configure();
    });
    observer.observe(container);

    return () => {
      mounted = false;
      observer.disconnect();
      root.unmount();
    };
  }, [pollinator]);

  return <canvas className={styles.previewCanvas} ref={canvasRef} />;
}

export function GameScene({
  debug = false,
  hour,
  park: forcedPark,
}: {
  debug?: boolean;
  /** Pins the park's clock. Test hook; undefined in every real session. */
  hour?: number;
  /** Pins the park. Test hook, same as `hour`. */
  park?: ParkId;
}) {
  const debugVisible = debug;

  const storedPark = useGameStore((state) => state.currentPark);
  const currentPark = forcedPark ?? storedPark;
  const unlockedParks = useGameStore((state) => state.unlockedParks);
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const enterPark = useGameStore((state) => state.enterPark);

  /**
   * Point the world module at the right park BEFORE anything under it renders.
   *
   * This runs during render on purpose, not in an effect. Every piece of the
   * scene (the terrain mesh, the scatter, the collision grid) reads the active
   * park at build time, and children render before a parent's effects fire. Do
   * this in a useEffect and the first frame builds Frick's world and then hears
   * about Schenley afterwards.
   */
  useMemo(() => setActivePark(currentPark), [currentPark]);

  const park = PARKS[currentPark];
  const elsewhere = PARK_LIST.filter(
    (other) =>
      other.id !== currentPark &&
      parkUnlocked({ unlockedParks, discoveredPlants }, other.id),
  );

  const selectedPollinator = useGameStore((state) => state.pollinator);
  const discoveredPlantCount = useGameStore((state) =>
    countUnlocked(state.discoveredPlants),
  );
  const pollinatedPlantCount = useGameStore((state) =>
    countUnlocked(state.pollinatedPlants),
  );
  const unlockedAreaCount = useGameStore((state) =>
    countUnlocked(state.unlockedMapAreas),
  );
  const unlockedBadgeCount = useGameStore((state) =>
    countUnlocked(state.unlockedBadges),
  );
  const unlockedJournalCount = useGameStore((state) =>
    countUnlocked(state.unlockedJournalEntries),
  );
  const isPreviewOpen = useGameStore(
    (state) => state.ui.pollinatorPreviewOpen,
  );
  const openModal = useGameStore((state) => state.openModal);
  const closeModal = useGameStore((state) => state.closeModal);
  const [controlsOpen, setControlsOpen] = useState(true);
  // The scene generates terrain, scatters thousands of props and compiles all the
  // geometry before its first frame. Without this the player stares at a blank
  // canvas and assumes it is broken.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 900);

    return () => window.clearTimeout(timer);
  }, []);

  /**
   * The park's own clock.
   *
   * Pittsburgh time, not the player's. If it is dusk in Squirrel Hill then it is
   * dusk in the game, whether you are in Tokyo or Toronto. Ticked once a minute,
   * which is far more often than the light visibly changes but cheap enough not
   * to care, and it means the hour rolls over while you are flying rather than
   * only when you reload.
   */
  const [daylight, setDaylight] = useState(() =>
    hour === undefined ? daylightAt() : daylightForHour(hour),
  );

  useEffect(() => {
    // A pinned hour does not tick. It was already set when the state was seeded.
    if (hour !== undefined) {
      return;
    }

    const tick = window.setInterval(() => setDaylight(daylightAt()), 60_000);

    return () => window.clearInterval(tick);
  }, [hour]);

  /**
   * The shutter.
   *
   * The canvas is reached by ref, never by `document.querySelector("canvas")`.
   * There is a second canvas on this page (the pollinator preview), and a
   * querySelector grabs whichever one happens to be first in the document. That
   * exact bug has already been in this file once.
   *
   * The capture works at all only because the GL context is created with
   * `preserveDrawingBuffer: true`. Without it the drawing buffer is thrown away
   * after each frame and `toDataURL` hands back a blank rectangle.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capturePhoto = usePhotoStore((state) => state.capture);
  const [flashing, setFlashing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [debugState, setDebugState] = useState<DebugState>({
    areaId: "environmental-center",
    area: "Environmental Center",
    altitude: 2.1,
    heading: 0,
    movement: "Hovering",
    speed: 0,
    x: 0,
    z: 0,
    input: "none",
  });

  const takePhoto = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    // Downscale on the way out. A full retina buffer is a 2560px JPEG, which is
    // most of a megabyte of base64, and about four of those would fill the whole
    // localStorage budget for the origin.
    const width = 720;
    const ratio = canvas.clientHeight / (canvas.clientWidth || 1);
    const height = Math.max(1, Math.round(width * (ratio || 0.5625)));

    const scaled = document.createElement("canvas");
    scaled.width = width;
    scaled.height = height;

    const context = scaled.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(canvas, 0, 0, width, height);

    // Deliberately NOT fire-and-forget. The flash is a promise that the picture
    // was kept, and firing it before the album has accepted the photograph would
    // make that promise on the album's behalf without asking.
    void capturePhoto({
      src: scaled.toDataURL("image/jpeg", 0.72),
      area: debugState.area,
      clock: daylight.clock,
      phase: daylight.label,
    }).then((result) => {
      if (result === "album-full") {
        playSound("pollinateFail");
        setNotice(
          `Your album is full at ${MAX_PHOTOS}. Delete one in your journal to make room, and download it first if you want to keep it.`,
        );
        window.setTimeout(() => setNotice(null), 5200);

        return;
      }

      playSound("ui");
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 240);
    });
  }, [capturePhoto, daylight.clock, daylight.label, debugState.area]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== PHOTO_KEY || event.repeat) {
        return;
      }

      event.preventDefault();
      takePhoto();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [takePhoto]);

  return (
    <section className={styles.shell} aria-label="Scout 3D game scene">
      <div className={styles.canvasWrap}>
        {/* Keyed by park: changing park tears the WebGL root down and builds the
            new world from scratch. The scatter, the terrain geometry and the
            collision grid are all memoised for the life of the scene, so
            anything less than a remount would leave one park's trees standing in
            another park's ground. */}
        <R3FViewport
          canvasRef={canvasRef}
          daylight={daylight}
          key={currentPark}
          onDebugChange={setDebugState}
        />
        {flashing ? <div className={styles.flash} aria-hidden /> : null}

        {notice ? (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        ) : null}

        {ready ? null : (
          <div className={styles.loading} role="status">
            <span className={styles.loadingBee} aria-hidden>
              🐝
            </span>
            <p className={styles.loadingTitle}>Growing {park.label}…</p>
            <p className={styles.loadingNote}>
              One blade of grass at a time.
            </p>
          </div>
        )}
      </div>

      {/* Not shown to players. Open /play?debug=1 to bring it back — the e2e
          suite reads flight state (area, heading, position) out of this panel,
          and deleting it outright would blind the tests as well as tidy the HUD. */}
      {debugVisible ? (
      <aside className={styles.debugPanel} aria-label="Debug flight readout">
        <p className={styles.debugLabel}>Debug Overlay</p>
        <dl>
          <div>
            <dt>Area</dt>
            <dd>{debugState.area}</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>
              x {debugState.x}, z {debugState.z}
            </dd>
          </div>
          <div>
            <dt>Altitude</dt>
            <dd>{debugState.altitude}</dd>
          </div>
          <div>
            <dt>Heading</dt>
            <dd>{debugState.heading} deg</dd>
          </div>
          <div>
            <dt>Movement</dt>
            <dd>{debugState.movement}</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{debugState.speed}</dd>
          </div>
          <div>
            <dt>Input</dt>
            <dd>{debugState.input}</dd>
          </div>
        </dl>
      </aside>
      ) : null}

      <aside className={styles.controlsPanel} aria-label="Flight controls">
        <button
          aria-expanded={controlsOpen}
          className={styles.controlsToggle}
          onClick={() => setControlsOpen((open) => !open)}
          type="button"
        >
          <span className={styles.debugLabel}>Controls</span>
          <span aria-hidden className={styles.controlsChevron} data-open={controlsOpen}>
            ▾
          </span>
        </button>

        {controlsOpen ? (
          <>
            <ul>
              <li>Move the mouse to look, and the bee turns to follow</li>
              <li>Up / Down or W / S fly forward and back</li>
              <li>Left / Right or A / D also turn</li>
              <li>E / Q or scroll changes altitude</li>
              <li>Shift boosts</li>
              <li>Space lands you on a nearby plant or fungus</li>
              <li>
                <kbd>R</kbd> reads its full entry
              </li>
              <li>
                <kbd>P</kbd> takes a photograph, kept in your journal
              </li>
              <li>
                <kbd>F</kbd> look at me · <kbd>G</kbd> dance
              </li>
              <li>
                <kbd>Esc</kbd> releases the mouse cursor
              </li>
              <li>Follow the drifting motes to find flora</li>
            </ul>
            <p className={styles.pollinatorStatus}>
              {selectedPollinator.name} the {selectedPollinator.type}
            </p>
            <button
              className={styles.previewButton}
              onClick={() => openModal("pollinatorPreviewOpen")}
              type="button"
            >
              View pollinator
            </button>
            <button
              className={styles.shutter}
              onClick={takePhoto}
              type="button"
            >
              Take a photo <kbd>P</kbd>
            </button>

            {/* The warp. You do not have to go back to a menu to cross the city:
                a park you have earned is somewhere you can simply go. */}
            {elsewhere.map((other) => (
              <button
                className={styles.travel}
                key={other.id}
                onClick={() => enterPark(other.id)}
                type="button"
              >
                Fly to {other.label}
              </button>
            ))}
            <SoundToggle />
            <CloudSyncBadge />
          </>
        ) : null}
      </aside>

      <aside className={styles.statePanel} aria-label="Scout stats">
        <p className={styles.debugLabel}>Scout Stats</p>
        <dl>
          <div>
            <dt>Areas</dt>
            <dd>{unlockedAreaCount}</dd>
          </div>
          <div>
            <dt>Found</dt>
            <dd>
              {discoveredPlantCount} / {PLANTS.length}
            </dd>
          </div>
          <div>
            <dt>Pollinated</dt>
            <dd>{pollinatedPlantCount}</dd>
          </div>
          <div>
            <dt>Badges</dt>
            <dd>{unlockedBadgeCount}</dd>
          </div>
          <div>
            <dt>Journal</dt>
            <dd>{unlockedJournalCount}</dd>
          </div>
          <div>
            <dt>Pittsburgh</dt>
            <dd className={styles.clock}>
              {daylight.clock}
              <span>{daylight.label}</span>
            </dd>
          </div>
        </dl>
      </aside>

      <PlantEntry />
      <LandingMenu />
      <Quiz />
      <PollinationMinigame />
      <ProgressionWatcher />
      <FirstFlight />

      {isPreviewOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            aria-label="Pollinator face-on preview"
            aria-modal="true"
            className={styles.previewModal}
            role="dialog"
          >
            <div className={styles.previewHeader}>
              <div>
                <p className={styles.debugLabel}>Character Preview</p>
                <h2>Your Pollinator</h2>
              </div>
              <button
                aria-label="Close pollinator preview"
                className={styles.closeButton}
                onClick={() => closeModal("pollinatorPreviewOpen")}
                type="button"
              >
                Close
              </button>
            </div>
            <div className={styles.previewStage}>
              <div className={styles.previewCanvasWrap}>
                <PollinatorPreviewViewport pollinator={selectedPollinator} />
              </div>
              <dl className={styles.previewDetails}>
                <div>
                  <dt>Name</dt>
                  <dd>{selectedPollinator.name}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{selectedPollinator.type}</dd>
                </div>
                <div>
                  <dt>Wings</dt>
                  <dd>{selectedPollinator.wingStyle}</dd>
                </div>
                <div>
                  <dt>Trail</dt>
                  <dd>{selectedPollinator.trailEffect}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
