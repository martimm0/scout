"use client";

import { Sky, Text } from "@react-three/drei";
import { createRoot, extend, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import { Vector3 } from "three";
import styles from "./game-scene.module.css";

extend(THREE as unknown as Parameters<typeof extend>[0]);

type DebugState = {
  area: string;
  altitude: number;
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

function ScoutScene({
  onDebugChange,
}: {
  onDebugChange: (state: DebugState) => void;
}) {
  const pollinatorRef = useRef<Group>(null);
  const lastDebugUpdate = useRef(0);
  const cameraTarget = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);

  useFrame(({ camera, clock }) => {
    const pollinator = pollinatorRef.current;

    if (!pollinator) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const x = Math.sin(elapsed * 0.32) * 3.2;
    const z = Math.cos(elapsed * 0.32) * 2.4;
    const y = 2.15 + Math.sin(elapsed * 3) * 0.13;

    pollinator.position.set(x, y, z);
    pollinator.rotation.y = Math.sin(elapsed * 0.32) * 0.2;
    pollinator.rotation.z = Math.sin(elapsed * 5.4) * 0.06;

    cameraTarget.copy(pollinator.position);
    cameraPosition.set(x, y + 2.5, z + 7.5);
    camera.position.lerp(cameraPosition, 0.08);
    camera.lookAt(cameraTarget);

    if (elapsed - lastDebugUpdate.current > 0.2) {
      lastDebugUpdate.current = elapsed;
      onDebugChange({
        area: getCurrentArea(pollinator.position),
        altitude: Number(y.toFixed(1)),
        x: Number(x.toFixed(1)),
        z: Number(z.toFixed(1)),
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
        <mesh castShadow>
          <sphereGeometry args={[0.34, 24, 16]} />
          <meshStandardMaterial color="#f2bb42" roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0, -0.36]}>
          <sphereGeometry args={[0.25, 20, 12]} />
          <meshStandardMaterial color="#322b21" roughness={0.6} />
        </mesh>
        <mesh position={[-0.32, 0.16, 0.08]} rotation={[0.5, 0.15, -0.55]}>
          <sphereGeometry args={[0.2, 16, 10]} />
          <meshStandardMaterial
            color="#dcefff"
            opacity={0.66}
            transparent
          />
        </mesh>
        <mesh position={[0.32, 0.16, 0.08]} rotation={[0.5, -0.15, 0.55]}>
          <sphereGeometry args={[0.2, 16, 10]} />
          <meshStandardMaterial
            color="#dcefff"
            opacity={0.66}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.04, 0.38]}>
          <sphereGeometry args={[0.13, 16, 10]} />
          <meshStandardMaterial color="#2d251b" roughness={0.6} />
        </mesh>
      </group>
    </>
  );
}

export function GameScene() {
  const [debugState, setDebugState] = useState<DebugState>({
    area: "Environmental Center",
    altitude: 2.1,
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
        </dl>
      </aside>
    </section>
  );
}
