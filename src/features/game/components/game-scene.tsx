"use client";

import { Sky } from "@react-three/drei";
import { createRoot, extend, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { DirectionalLight, Group } from "three";
import { Vector3 } from "three";
import {
  countUnlocked,
  useGameStore,
  type Pollinator,
  type PlayerMovementState,
} from "@/features/game/state/game-store";
import { playSound, setAreaAmbience } from "../audio/sound";
import { BeeModel } from "./bee-model";
import { Creek, Foliage, Landmarks, PlantField, Terrain } from "./frick-park";
import { FirstFlight } from "./first-flight";
import { PlantEntry } from "./plant-entry";
import { PlantTag } from "./plant-tag";
import { PollinationMinigame } from "./pollination-minigame";
import { ProgressionWatcher } from "./progression-watcher";
import { SoundToggle } from "./sound-toggle";
import { PLANTS } from "../data/plants";
import {
  scatterPlants,
  DISCOVERY_RADIUS,
  type PlantInstance,
} from "../world/plant-scatter";
import {
  areaAt,
  terrainHeight,
  CEILING,
  GROUND_CLEARANCE,
  START_POSITION,
  WORLD,
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
  onDebugChange,
}: {
  onDebugChange: (state: DebugState) => void;
}) {
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
        root.render(<ScoutScene onDebugChange={onDebugChange} />);
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
  }, [onDebugChange]);

  return <canvas className={styles.canvas} ref={canvasRef} />;
}

function ScoutScene({
  onDebugChange,
}: {
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
  const targetPositionRef = useRef(new Vector3(...START_POSITION));
  const velocityRef = useRef(new Vector3());
  const sunRef = useRef<DirectionalLight>(null);

  // Laid out once. Deterministic, so the park is the same park every session.
  const plants = useMemo(() => scatterPlants(), []);
  /** The plant the floating card is currently attached to. */
  const [nearbyInstance, setNearbyInstance] = useState<PlantInstance | null>(null);

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
        useGameStore.getState().closePlantEntry();
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

      // Space starts the pollination minigame on the plant you're beside. It no
      // longer just succeeds — that was the hole in the middle of the game.
      if (code === "Space" && !event.repeat) {
        const store = useGameStore.getState();
        const nearby = store.ui.nearbyPlantId;

        if (nearby && !store.ui.activePlantId && !store.ui.minigamePlantId) {
          document.exitPointerLock();
          store.discoverPlant(nearby);
          store.startMinigame(nearby);
        }
      }

      // R is the way in to the full entry.
      if (code === READ_KEY && !event.repeat) {
        const store = useGameStore.getState();
        const nearby = store.ui.nearbyPlantId;

        if (nearby && !store.ui.activePlantId) {
          document.exitPointerLock();
          store.openPlantEntry(nearby);
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
        return;
      }

      // Don't swing the camera around behind an open card or minigame.
      const modal = useGameStore.getState().ui;

      if (modal.activePlantId || modal.minigamePlantId) {
        return;
      }

      // The mouse turns you. Yaw grows clockwise — forward is (sin y, 0, -cos y)
      // — so moving the mouse right must ADD, or the world comes out mirrored.
      yawRef.current += event.movementX * MOUSE_SENSITIVITY;
      // Positive pitch lifts the camera and tips the view DOWN at the park, so
      // pushing the mouse forward (negative movementY) has to lower it, i.e.
      // look up. Getting this backwards inverts the vertical axis.
      pitchRef.current = clamp(
        pitchRef.current + event.movementY * MOUSE_SENSITIVITY,
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("wheel", handleWheel, { passive: false });
    canvas?.addEventListener("click", handleCanvasClick);

    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", handleWheel);
      canvas?.removeEventListener("click", handleCanvasClick);
    };
  }, [canvas]);

  useFrame(({ camera, clock }, delta) => {
    const pollinator = pollinatorRef.current;

    if (!pollinator) {
      return;
    }

    const elapsed = clock.getElapsedTime();

    // While a card or a minigame is up, the bee holds still. Otherwise you'd
    // carry on flying blind behind it and surface somewhere else entirely.
    const ui = useGameStore.getState().ui;

    if (ui.activePlantId || ui.minigamePlantId) {
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

    // Arrows turn the same yaw the mouse turns. There is only one.
    const turnInput = axis(keys, TURN_LEFT, TURN_RIGHT);

    yawRef.current += turnInput * TURN_SPEED * delta;

    const yaw = yawRef.current;
    const throttle = axis(keys, FLY_BACK, FLY_FORWARD);

    // Forward is wherever you are looking.
    forward.set(Math.sin(yaw), 0, Math.cos(yaw) * -1).normalize();
    right.set(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
    direction.copy(forward).multiplyScalar(throttle);

    const hasMovementInput = throttle !== 0;
    const isBoosting = held(keys, BOOST) && hasMovementInput;
    const isPollinating = keys.has("Space");
    const speed = BASE_SPEED * (isBoosting ? BOOST_MULTIPLIER : 1);
    const altitudeInput = axis(keys, DIVE, CLIMB) + scrollAltitudeRef.current;

    scrollAltitudeRef.current *= 0.82;

    if (hasMovementInput) {
      direction.normalize().multiplyScalar(speed);
    }

    velocity.lerp(direction, 1 - Math.exp(-delta * 8));
    targetPosition.addScaledVector(velocity, delta);
    targetPosition.y += altitudeInput * ALTITUDE_SPEED * delta;

    targetPosition.x = clamp(targetPosition.x, WORLD.minX + 2, WORLD.maxX - 2);
    targetPosition.z = clamp(targetPosition.z, WORLD.minZ + 2, WORLD.maxZ - 2);

    // The floor follows the ground rather than sitting at a fixed altitude, so
    // the bee can drop all the way down into the ravine and skim the creek.
    const ground = terrainHeight(targetPosition.x, targetPosition.z);
    targetPosition.y = clamp(
      targetPosition.y,
      ground + GROUND_CLEARANCE,
      CEILING,
    );

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
      sun.position.set(
        pollinator.position.x + 60,
        pollinator.position.y + 110,
        pollinator.position.z + 45,
      );
      sun.target.position.copy(pollinator.position);
      sun.target.updateMatrixWorld();
    }

    if (elapsed - lastDebugUpdate.current > 0.15) {
      lastDebugUpdate.current = elapsed;

      // Closest plant within reach, if any. Fifty-odd plants at ~7Hz is nothing,
      // and it saves keeping a spatial index in sync with the scatter.
      //
      // The specific INSTANCE matters, not just the species: the card is anchored
      // over the one you're actually beside, and there are several of each.
      let nearestInstance: PlantInstance | null = null;
      let nearestDistance = DISCOVERY_RADIUS;

      for (const instance of plants) {
        // Measure to the BLOOM, not the base. A Joe-Pye weed is now twenty units
        // tall; its base is nowhere near where a bee would visit it.
        const bloomHeight =
          instance.position[1] + instance.plant.height * instance.scale * 0.88;

        const distance = Math.hypot(
          instance.position[0] - pollinator.position.x,
          bloomHeight - pollinator.position.y,
          instance.position[2] - pollinator.position.z,
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestInstance = instance;
        }
      }

      const nearest = nearestInstance?.plant.id ?? null;
      const store = useGameStore.getState();
      store.setNearbyPlant(nearest);

      // Re-render only when the anchored card needs to move to a different plant.
      if (nearestInstance?.key !== nearbyInstance?.key) {
        setNearbyInstance(nearestInstance);
      }

      // Getting close is enough to log it in the journal. Pressing Space is what
      // pollinates it.
      if (nearest && !store.discoveredPlants[nearest]) {
        store.discoverPlant(nearest);
        playSound("discover");
      }

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
      {/* A high sun. The default inclination sits it on the horizon, which
          washes the whole park in sunset orange and reads as dusk. */}
      <Sky
        distance={450000}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        rayleigh={0.9}
        sunPosition={[60, 45, 30]}
        turbidity={4}
      />
      <ambientLight intensity={1.05} />
      <directionalLight
        castShadow
        intensity={2.1}
        ref={sunRef}
        shadow-bias={-0.0012}
        shadow-camera-bottom={-70}
        shadow-camera-far={300}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight args={["#e2f2ff", "#6f8f52", 1.35]} />
      {/* Haze at the far edge of the park, so the map ends in distance rather
          than in a hard border. */}
      <fogExp2 args={["#cfe4f2", 0.0009]} attach="fog" />

      <Terrain />
      <Creek />
      <Landmarks />
      <Foliage />
      <PlantField instances={plants} />

      {/* Anchored over the plant itself, not pinned to the screen. */}
      {nearbyInstance ? <PlantTag instance={nearbyInstance} /> : null}

      {/* Actual bee size, near enough. The world grew around it instead. */}
      <group ref={pollinatorRef} position={START_POSITION} scale={1}>
        <BeeModel
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
        <BeeModel animationState="hovering" pollinator={pollinator} />
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

export function GameScene() {
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

  return (
    <section className={styles.shell} aria-label="Scout 3D game scene">
      <div className={styles.canvasWrap}>
        <R3FViewport onDebugChange={setDebugState} />
        {ready ? null : (
          <div className={styles.loading} role="status">
            <span className={styles.loadingBee} aria-hidden>
              🐝
            </span>
            <p className={styles.loadingTitle}>Growing Frick Park…</p>
            <p className={styles.loadingNote}>
              Six hundred acres, one blade of grass at a time.
            </p>
          </div>
        )}
      </div>

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
              <li>Move the mouse to look — the bee turns to follow</li>
              <li>Up / Down or W / S fly forward and back</li>
              <li>Left / Right or A / D also turn</li>
              <li>E / Q or scroll changes altitude</li>
              <li>Shift boosts</li>
              <li>Space pollinates a nearby plant</li>
              <li>
                <kbd>R</kbd> reads its full entry
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
            <SoundToggle />
          </>
        ) : null}
      </aside>

      <aside className={styles.statePanel} aria-label="Game state debug">
        <p className={styles.debugLabel}>Game State</p>
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
        </dl>
      </aside>

      <PlantEntry />
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
