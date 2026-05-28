"use client";

import { Sky, Text } from "@react-three/drei";
import { createRoot, extend, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import { Vector3 } from "three";
import {
  countUnlocked,
  useGameStore,
  type PlayerMovementState,
} from "@/features/game/state/game-store";
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
};

type MapArea = {
  id: string;
  label: string;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
};

const MAP_AREAS: MapArea[] = [
  {
    id: "environmental-center",
    label: "Environmental Center",
    color: "#9fcb83",
    position: [0, 0.03, 0],
    size: [12, 0.08, 9],
  },
  {
    id: "woodland-trail",
    label: "Woodland Trail",
    color: "#5f9a5b",
    position: [-13, 0.02, -4],
    size: [15, 0.08, 15],
  },
  {
    id: "meadow",
    label: "Sunny Meadow",
    color: "#d9c767",
    position: [12, 0.025, 6],
    size: [16, 0.08, 12],
  },
  {
    id: "ravine-creek",
    label: "Ravine Creek",
    color: "#7e9d8d",
    position: [4, 0.015, -13],
    size: [22, 0.08, 8],
  },
  {
    id: "dense-canopy",
    label: "Dense Canopy",
    color: "#3f7244",
    position: [18, 0.02, -10],
    size: [12, 0.08, 15],
  },
];

const TREE_POSITIONS: [number, number, number][] = [
  [-18, 0, -9],
  [-16, 0, -1],
  [-12, 0, -12],
  [-8, 0, -6],
  [-6, 0, 4],
  [4, 0, 8],
  [9, 0, 13],
  [15, 0, 2],
  [17, 0, -7],
  [22, 0, -13],
  [11, 0, -16],
  [-2, 0, -15],
];

const FLOWER_POSITIONS: [number, number, number][] = [
  [8, 0.25, 5],
  [11, 0.25, 7],
  [14, 0.25, 4],
  [6, 0.25, 10],
  [15, 0.25, 9],
];

const MAP_BOUNDS = {
  minX: -21,
  maxX: 24,
  minZ: -18,
  maxZ: 16,
  minY: 1.1,
  maxY: 7.2,
};

const BASE_SPEED = 8.2;
const BOOST_MULTIPLIER = 1.75;
const ALTITUDE_SPEED = 4.4;
const MOUSE_SENSITIVITY = 0.0024;
const CAMERA_DISTANCE = 7.8;
const CAMERA_HEIGHT = 2.7;

function getCurrentArea(position: Vector3) {
  const match = MAP_AREAS.find((area) => {
    const [x, , z] = area.position;
    const [width, , depth] = area.size;

    return (
      position.x >= x - width / 2 &&
      position.x <= x + width / 2 &&
      position.z >= z - depth / 2 &&
      position.z <= z + depth / 2
    );
  });

  return match?.label ?? "Open Trail";
}

function getCurrentAreaId(position: Vector3) {
  const match = MAP_AREAS.find((area) => {
    const [x, , z] = area.position;
    const [width, , depth] = area.size;

    return (
      position.x >= x - width / 2 &&
      position.x <= x + width / 2 &&
      position.z >= z - depth / 2 &&
      position.z <= z + depth / 2
    );
  });

  return match?.id ?? "open-trail";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);

      await root.configure({
        camera: { fov: 52, position: [0, 4.8, 8.2] },
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

function PollinatorModel() {
  return (
    <>
      <mesh castShadow>
        <sphereGeometry args={[0.34, 24, 16]} />
        <meshStandardMaterial color="#f2bb42" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0, 0.36]}>
        <sphereGeometry args={[0.25, 20, 12]} />
        <meshStandardMaterial color="#322b21" roughness={0.6} />
      </mesh>
      <mesh position={[-0.32, 0.16, -0.08]} rotation={[0.5, -0.15, -0.55]}>
        <sphereGeometry args={[0.2, 16, 10]} />
        <meshStandardMaterial color="#dcefff" opacity={0.66} transparent />
      </mesh>
      <mesh position={[0.32, 0.16, -0.08]} rotation={[0.5, 0.15, 0.55]}>
        <sphereGeometry args={[0.2, 16, 10]} />
        <meshStandardMaterial color="#dcefff" opacity={0.66} transparent />
      </mesh>
      <mesh position={[0, -0.04, -0.38]}>
        <sphereGeometry args={[0.13, 16, 10]} />
        <meshStandardMaterial color="#2d251b" roughness={0.6} />
      </mesh>
      <mesh position={[-0.12, 0.1, -0.28]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#191510" roughness={0.45} />
      </mesh>
      <mesh position={[0.12, 0.1, -0.28]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#191510" roughness={0.45} />
      </mesh>
    </>
  );
}

function ScoutScene({
  onDebugChange,
}: {
  onDebugChange: (state: DebugState) => void;
}) {
  const pollinatorRef = useRef<Group>(null);
  const keysRef = useRef(new Set<string>());
  const lastDebugUpdate = useRef(0);
  const movementState = useRef<PlayerMovementState>("Hovering");
  const mouseDownRef = useRef(false);
  const pollinatorYawRef = useRef(0);
  const scrollAltitudeRef = useRef(0);
  const yawRef = useRef(0);
  const pitchRef = useRef(0.18);
  const cameraTargetRef = useRef(new Vector3());
  const cameraPositionRef = useRef(new Vector3());
  const directionRef = useRef(new Vector3());
  const forwardRef = useRef(new Vector3());
  const renderPositionRef = useRef(new Vector3());
  const rightRef = useRef(new Vector3());
  const targetPositionRef = useRef(new Vector3(0, 2.15, 0));
  const velocityRef = useRef(new Vector3());

  useEffect(() => {
    const normalizeKey = (key: string) => key.toLowerCase();

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key);

      if (
        [
          " ",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "w",
          "a",
          "s",
          "d",
          "e",
          "q",
          "shift",
        ].includes(key)
      ) {
        event.preventDefault();
      }

      keysRef.current.add(key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(normalizeKey(event.key));
    };

    const handleMouseDown = () => {
      mouseDownRef.current = true;
    };

    const handleMouseUp = () => {
      mouseDownRef.current = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseDownRef.current && document.pointerLockElement === null) {
        return;
      }

      yawRef.current -= event.movementX * MOUSE_SENSITIVITY;
      pitchRef.current = clamp(
        pitchRef.current - event.movementY * MOUSE_SENSITIVITY,
        -0.35,
        0.72,
      );
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      scrollAltitudeRef.current += clamp(-event.deltaY * 0.006, -1, 1);
    };

    const canvas = document.querySelector("canvas");
    const handleCanvasClick = () => {
      if (document.pointerLockElement === null) {
        void canvas?.requestPointerLock();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("wheel", handleWheel, { passive: false });
    canvas?.addEventListener("click", handleCanvasClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", handleWheel);
      canvas?.removeEventListener("click", handleCanvasClick);
    };
  }, []);

  useFrame(({ camera, clock }, delta) => {
    const pollinator = pollinatorRef.current;

    if (!pollinator) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const keys = keysRef.current;
    const cameraTarget = cameraTargetRef.current;
    const cameraPosition = cameraPositionRef.current;
    const direction = directionRef.current.set(0, 0, 0);
    const forward = forwardRef.current;
    const renderPosition = renderPositionRef.current;
    const right = rightRef.current;
    const targetPosition = targetPositionRef.current;
    const velocity = velocityRef.current;
    const yaw = yawRef.current;

    forward.set(Math.sin(yaw), 0, Math.cos(yaw) * -1).normalize();
    right.set(Math.cos(yaw), 0, Math.sin(yaw)).normalize();

    if (keys.has("w") || keys.has("arrowup")) {
      direction.add(forward);
    }

    if (keys.has("s") || keys.has("arrowdown")) {
      direction.sub(forward);
    }

    if (keys.has("d") || keys.has("arrowright")) {
      direction.add(right);
    }

    if (keys.has("a") || keys.has("arrowleft")) {
      direction.sub(right);
    }

    const hasMovementInput = direction.lengthSq() > 0;
    const isBoosting = keys.has("shift") && hasMovementInput;
    const speed = BASE_SPEED * (isBoosting ? BOOST_MULTIPLIER : 1);
    const altitudeInput =
      (keys.has("e") ? 1 : 0) -
      (keys.has("q") ? 1 : 0) +
      scrollAltitudeRef.current;

    scrollAltitudeRef.current *= 0.82;

    if (hasMovementInput) {
      direction.normalize().multiplyScalar(speed);
    }

    velocity.lerp(direction, 1 - Math.exp(-delta * 8));
    targetPosition.addScaledVector(velocity, delta);
    targetPosition.y += altitudeInput * ALTITUDE_SPEED * delta;

    targetPosition.x = clamp(targetPosition.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
    targetPosition.y = clamp(targetPosition.y, MAP_BOUNDS.minY, MAP_BOUNDS.maxY);
    targetPosition.z = clamp(targetPosition.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);

    const bob = Math.sin(elapsed * (hasMovementInput ? 9 : 3.2)) * 0.08;
    renderPosition.set(targetPosition.x, targetPosition.y + bob, targetPosition.z);
    pollinator.position.lerp(
      renderPosition,
      1 - Math.exp(-delta * 12),
    );

    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);

    if (horizontalSpeed > 0.18) {
      const desiredYaw = Math.atan2(velocity.x, -velocity.z);
      const turnDelta = Math.atan2(
        Math.sin(desiredYaw - pollinatorYawRef.current),
        Math.cos(desiredYaw - pollinatorYawRef.current),
      );
      pollinatorYawRef.current += turnDelta * (1 - Math.exp(-delta * 10));
    }

    pollinator.rotation.y = pollinatorYawRef.current;
    pollinator.rotation.z = hasMovementInput
      ? clamp(-velocity.x * 0.018, -0.22, 0.22)
      : Math.sin(elapsed * 3) * 0.035;

    movementState.current = isBoosting
      ? "Boosting"
      : hasMovementInput
        ? "Flying"
        : "Hovering";

    cameraTarget.copy(pollinator.position);
    cameraPosition.set(
      pollinator.position.x - Math.sin(yaw) * CAMERA_DISTANCE,
      pollinator.position.y + CAMERA_HEIGHT + pitchRef.current * 4,
      pollinator.position.z + Math.cos(yaw) * CAMERA_DISTANCE,
    );
    camera.position.lerp(cameraPosition, 0.08);
    camera.lookAt(cameraTarget);

    if (elapsed - lastDebugUpdate.current > 0.2) {
      lastDebugUpdate.current = elapsed;
      const areaId = getCurrentAreaId(pollinator.position);
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

      const store = useGameStore.getState();
      store.setPlayerFlightState(nextPlayerState);
      store.unlockMapArea(areaId);

      onDebugChange({
        areaId,
        area: getCurrentArea(pollinator.position),
        altitude: nextPlayerState.altitude,
        heading: nextPlayerState.heading,
        movement: nextPlayerState.movement,
        speed: nextPlayerState.speed,
        x: nextPlayerState.position.x,
        z: nextPlayerState.position.z,
      });
    }
  });

  return (
    <>
      <Sky
        azimuth={0.25}
        distance={450000}
        inclination={0.49}
        mieCoefficient={0.006}
        mieDirectionalG={0.78}
        rayleigh={1.6}
        turbidity={5}
      />
      <ambientLight intensity={0.62} />
      <directionalLight
        castShadow
        intensity={2.4}
        position={[8, 12, 6]}
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={["#dcefff", "#5d7a42", 1.2]} />

      <group>
        <mesh position={[0, -0.05, 0]} receiveShadow>
          <boxGeometry args={[42, 0.08, 34]} />
          <meshStandardMaterial color="#7fab66" roughness={0.92} />
        </mesh>

        {MAP_AREAS.map((area) => (
          <group key={area.id}>
            <mesh position={area.position} receiveShadow>
              <boxGeometry args={area.size} />
              <meshStandardMaterial color={area.color} roughness={0.9} />
            </mesh>
            <Text
              anchorX="center"
              anchorY="middle"
              color="#20301d"
              fontSize={0.55}
              position={[area.position[0], 0.16, area.position[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {area.label}
            </Text>
          </group>
        ))}

        <mesh position={[3, 0.12, -13]} rotation={[0, -0.12, 0]}>
          <boxGeometry args={[20, 0.1, 1.1]} />
          <meshStandardMaterial color="#579bc0" roughness={0.45} />
        </mesh>

        <mesh position={[-4, 0.18, -1]} rotation={[0, -0.24, 0]}>
          <boxGeometry args={[22, 0.08, 0.6]} />
          <meshStandardMaterial color="#8c7651" roughness={0.85} />
        </mesh>
      </group>

      {TREE_POSITIONS.map((position, index) => (
        <group key={`${position[0]}-${position[2]}`} position={position}>
          <mesh castShadow position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 1.7, 8]} />
            <meshStandardMaterial color="#6d4f35" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, 2, 0]}>
            <coneGeometry args={[0.85 + (index % 3) * 0.08, 1.8, 9]} />
            <meshStandardMaterial color={index % 2 ? "#2f6b3d" : "#3f7b46"} />
          </mesh>
        </group>
      ))}

      {FLOWER_POSITIONS.map((position, index) => (
        <group key={`${position[0]}-${position[2]}`} position={position}>
          <mesh>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial color={index % 2 ? "#f3c84f" : "#e4759b"} />
          </mesh>
          <mesh position={[0, -0.28, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.55, 6]} />
            <meshStandardMaterial color="#3d743b" />
          </mesh>
        </group>
      ))}

      <group ref={pollinatorRef} position={[0, 2.15, 0]}>
        <PollinatorModel />
      </group>
    </>
  );
}

function PollinatorPreviewScene() {
  const pollinatorRef = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    const pollinator = pollinatorRef.current;

    if (!pollinator) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    pollinator.rotation.y = Math.sin(elapsed * 0.7) * 0.18;
    pollinator.rotation.x = Math.sin(elapsed * 1.1) * 0.04;
    pollinator.position.y = Math.sin(elapsed * 1.8) * 0.08;
    camera.position.set(0, 0.45, -2.65);
    camera.lookAt(0, 0.05, 0);
  });

  return (
    <>
      <color attach="background" args={["#fff4ce"]} />
      <ambientLight intensity={1.8} />
      <directionalLight intensity={2.2} position={[-2, 3, -4]} />
      <hemisphereLight args={["#eaf6ff", "#f0d58e", 1.2]} />
      <group ref={pollinatorRef} scale={2.35}>
        <PollinatorModel />
      </group>
    </>
  );
}

function PollinatorPreviewViewport() {
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

      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);

      await root.configure({
        camera: { fov: 42, position: [0, 0.45, -2.65] },
        gl: { antialias: true, alpha: false, preserveDrawingBuffer: true },
        size: {
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        },
      });

      if (mounted) {
        root.render(<PollinatorPreviewScene />);
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
  }, []);

  return <canvas className={styles.previewCanvas} ref={canvasRef} />;
}

export function GameScene() {
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
  const discoverPlant = useGameStore((state) => state.discoverPlant);
  const pollinatePlant = useGameStore((state) => state.pollinatePlant);
  const unlockBadge = useGameStore((state) => state.unlockBadge);
  const resetOfflineRun = useGameStore((state) => state.resetOfflineRun);
  const openModal = useGameStore((state) => state.openModal);
  const closeModal = useGameStore((state) => state.closeModal);
  const [debugState, setDebugState] = useState<DebugState>({
    areaId: "environmental-center",
    area: "Environmental Center",
    altitude: 2.1,
    heading: 0,
    movement: "Hovering",
    speed: 0,
    x: 0,
    z: 0,
  });

  return (
    <section className={styles.shell} aria-label="Scout 3D game scene">
      <div className={styles.canvasWrap}>
        <R3FViewport onDebugChange={setDebugState} />
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
        </dl>
      </aside>

      <aside className={styles.controlsPanel} aria-label="Flight controls">
        <p className={styles.debugLabel}>Controls</p>
        <ul>
          <li>WASD / Arrows move</li>
          <li>Mouse drag or click to look</li>
          <li>E / Q or scroll changes altitude</li>
          <li>Shift boosts</li>
        </ul>
        <button
          className={styles.previewButton}
          onClick={() => openModal("pollinatorPreviewOpen")}
          type="button"
        >
          View pollinator
        </button>
      </aside>

      <aside className={styles.statePanel} aria-label="Game state debug">
        <p className={styles.debugLabel}>Game State</p>
        <dl>
          <div>
            <dt>Areas</dt>
            <dd>{unlockedAreaCount}</dd>
          </div>
          <div>
            <dt>Plants</dt>
            <dd>
              {discoveredPlantCount} / {pollinatedPlantCount}
            </dd>
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
        <div className={styles.stateActions}>
          <button onClick={() => discoverPlant("mock-goldenrod")} type="button">
            Discover mock plant
          </button>
          <button onClick={() => pollinatePlant("mock-goldenrod")} type="button">
            Pollinate mock plant
          </button>
          <button onClick={() => unlockBadge("first-flight")} type="button">
            Unlock mock badge
          </button>
          <button onClick={resetOfflineRun} type="button">
            Reset offline state
          </button>
        </div>
      </aside>

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
              <PollinatorPreviewViewport />
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
