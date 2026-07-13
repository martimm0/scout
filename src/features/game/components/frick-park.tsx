"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D, type BufferGeometry } from "three";

import { buildFoliageGeometry, type FoliageKind } from "../models/foliage";
import { buildLandmarkGeometry, type LandmarkKind } from "../models/landmarks";
import { buildMoteGeometry, buildPlantGeometry } from "../models/flora";
import { useGameStore } from "../state/game-store";
import { scatterFoliage, scatterGrass, type Placement } from "../world/scatter";
import type { PlantInstance } from "../world/plant-scatter";
import { buildTerrainGeometry } from "../world/terrain-mesh";
import { LANDMARKS, terrainHeight, WATER_LEVEL, WORLD } from "../world/terrain";

/** Instanced copies of one prop, placed once and never touched again. */
function Instances({
  geometry,
  placements,
}: {
  geometry: BufferGeometry;
  placements: Placement[];
}) {
  const meshRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const dummy = new Object3D();

    placements.forEach((placement, index) => {
      dummy.position.set(...placement.position);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);

  if (placements.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      args={[geometry, undefined, placements.length]}
      receiveShadow
      ref={meshRef}
    >
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
}

export function Terrain() {
  const geometry = useMemo(() => buildTerrainGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

/**
 * One flat sheet across the whole map. It only shows through where the ground
 * drops below it, which — by construction — is exactly the creek at the bottom
 * of the ravine. No spline, no ribbon mesh, no seams.
 */
export function Creek() {
  return (
    <mesh position={[0, WATER_LEVEL, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry
        args={[WORLD.maxX - WORLD.minX, WORLD.maxZ - WORLD.minZ]}
      />
      <meshLambertMaterial
        color="#4d90b8"
        opacity={0.82}
        transparent
      />
    </mesh>
  );
}

export function Foliage() {
  const geometry = useMemo(() => buildFoliageGeometry(), []);
  const placements = useMemo(() => scatterFoliage(), []);
  const grass = useMemo(() => scatterGrass(), []);

  useEffect(
    () => () => {
      for (const part of Object.values(geometry)) {
        part.dispose();
      }
    },
    [geometry],
  );

  return (
    <>
      {(Object.keys(geometry) as FoliageKind[])
        .filter((kind) => kind !== "grass")
        .map((kind) => (
          <Instances
            geometry={geometry[kind]}
            key={kind}
            placements={placements[kind]}
          />
        ))}
      {/* Thousands of blades, one draw call. This is what tells the player how
          small they are, so it has to be everywhere and it has to be cheap. */}
      <Instances geometry={geometry.grass} placements={grass} />
    </>
  );
}

/**
 * The things that make this Frick Park and nowhere else. Each is placed by hand
 * — they're landmarks, and a landmark you scattered randomly isn't one.
 */
export function Landmarks() {
  const geometry = useMemo(() => buildLandmarkGeometry(), []);

  useEffect(
    () => () => {
      for (const part of Object.values(geometry)) {
        part.dispose();
      }
    },
    [geometry],
  );

  const at = (
    kind: LandmarkKind,
    [x, z]: [number, number],
    rotation = 0,
    sink = 1,
  ) => (
    <mesh
      castShadow
      geometry={geometry[kind]}
      key={`${kind}-${x}-${z}`}
      position={[x, terrainHeight(x, z) - sink, z]}
      receiveShadow
      rotation={[0, rotation, 0]}
    >
      <meshLambertMaterial vertexColors />
    </mesh>
  );

  return (
    <>
      {at("blueSlide", LANDMARKS.blueSlide, 0.25)}
      {at("environmentalCenter", LANDMARKS.center, -0.15)}
      {at("gatehouse", LANDMARKS.gatehouse, 0.55)}
      {at("bowlingGreen", LANDMARKS.bowlingGreen)}
      {at("tennisCourts", LANDMARKS.tennisCourts, 0.1)}
      {at("swings", LANDMARKS.swings, -0.3)}
      {at("pavilion", LANDMARKS.pavilion, 0.4)}
      {at("stoneSteps", LANDMARKS.stoneSteps, 1.2)}
      {at("culvert", LANDMARKS.culvert, -1.4, 4)}

      {/* The bridge is the exception: it spans the hollow rather than sitting on
          the ground, so it hangs from a fixed height instead of following the
          terrain under it. */}
      <mesh
        castShadow
        geometry={geometry.fernHollowBridge}
        position={[LANDMARKS.fernHollowBridge[0], 0, LANDMARKS.fernHollowBridge[1]]}
        receiveShadow
        rotation={[0, 0.12, 0]}
      >
        <meshLambertMaterial vertexColors />
      </mesh>

      {/* Benches and trail posts along the way, for orientation. */}
      {at("bench", [-190, 168], 0.4)}
      {at("bench", [150, 120], -0.7)}
      {at("bench", [232, 22], 1.2)}
      {at("trailPost", [-150, 100], 0.2)}
      {at("trailPost", [-60, -120], 1.1)}
      {at("trailPost", [120, -160], -0.4)}

      {/* Stepping stones across Nine Mile Run. */}
      {at("steppingStone", [-6, 40], 0.3, 2)}
      {at("steppingStone", [14, 44], -0.2, 2)}
      {at("steppingStone", [34, 48], 0.5, 2)}
    </>
  );
}

/**
 * A bobbing pollen mote over every plant the player hasn't found yet. This is
 * what turns the map from scenery into a set of destinations — without it you
 * cannot pick a flower out of the undergrowth from flight height.
 */
function Motes({ instances }: { instances: PlantInstance[] }) {
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const geometry = useMemo(() => buildMoteGeometry(), []);
  const meshRef = useRef<InstancedMesh>(null);

  const pending = useMemo(
    () => instances.filter((instance) => !discoveredPlants[instance.plant.id]),
    [instances, discoveredPlants],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const dummy = new Object3D();

    pending.forEach((instance, index) => {
      const [x, y, z] = instance.position;
      // Offset each mote's phase by its index so they don't pulse in unison.
      const bob = Math.sin(elapsed * 1.8 + index * 1.7) * 1.6;

      dummy.position.set(x, y + instance.plant.height * instance.scale + 7 + bob, z);
      dummy.rotation.set(elapsed * 0.6, elapsed * 0.9, 0);
      dummy.scale.setScalar(9);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (pending.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      args={[geometry, undefined, pending.length]}
      key={pending.length}
      ref={meshRef}
    >
      <meshBasicMaterial toneMapped={false} vertexColors />
    </instancedMesh>
  );
}

export function PlantField({ instances }: { instances: PlantInstance[] }) {
  const nearbyPlantId = useGameStore((state) => state.ui.nearbyPlantId);

  // One geometry per species, shared across all its placements.
  const geometry = useMemo(() => {
    const map = new Map<string, BufferGeometry>();

    for (const instance of instances) {
      if (!map.has(instance.plant.id)) {
        map.set(instance.plant.id, buildPlantGeometry(instance.plant));
      }
    }

    return map;
  }, [instances]);

  useEffect(
    () => () => {
      for (const part of geometry.values()) {
        part.dispose();
      }
    },
    [geometry],
  );

  const highlight = useMemo(() => new Color("#fff6c9"), []);

  return (
    <>
      {instances.map((instance) => {
        const isNearby = nearbyPlantId === instance.plant.id;

        return (
          <group
            key={instance.key}
            position={instance.position}
            rotation={[0, instance.rotation, 0]}
            scale={instance.scale}
          >
            <mesh castShadow geometry={geometry.get(instance.plant.id)}>
              <meshLambertMaterial
                // Brighten whatever the bee is hovering next to, so the HUD
                // prompt is unambiguous about which plant it means.
                emissive={isNearby ? highlight : undefined}
                emissiveIntensity={isNearby ? 0.3 : 0}
                vertexColors
              />
            </mesh>
          </group>
        );
      })}
      <Motes instances={instances} />
    </>
  );
}
