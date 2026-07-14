"use client";

import { useEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D, type BufferGeometry } from "three";

import { buildFoliageGeometry, type FoliageKind } from "../models/foliage";
import { buildLandmarkGeometry, type LandmarkKind } from "../models/landmarks";
import { scatterFoliage, scatterGrass, type Placement } from "../world/scatter";
import { buildTerrainGeometry } from "../world/terrain-mesh";
import {
  activePark,
  terrainHeight,
  waterLevel,
  world,
} from "../world/terrain";
import { PROPS_BY_PARK } from "../world/parks/props";

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
    <mesh position={[0, waterLevel(), 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry
        args={[world().maxX - world().minX, world().maxZ - world().minZ]}
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
 * The things that make a park itself and nowhere else. Each is placed by hand:
 * they are landmarks, and a landmark you scattered randomly is not one.
 */
export function Landmarks() {
  const geometry = useMemo(() => buildLandmarkGeometry(), []);
  const props = PROPS_BY_PARK[activePark().id] ?? [];

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
      {props.map((prop, index) => {
        const [x, z] = prop.at;
        // A bridge spans the hollow rather than sitting on the floor of it, so
        // anything with a hang height ignores the terrain underneath entirely.
        const y =
          prop.hangAt ?? terrainHeight(x, z) - (prop.sink ?? 1);

        return (
          <mesh
            castShadow
            geometry={geometry[prop.kind]}
            key={`${prop.kind}-${x}-${z}-${index}`}
            position={[x, y, z]}
            receiveShadow
            rotation={[0, prop.rotation ?? 0, 0]}
          >
            <meshLambertMaterial vertexColors />
          </mesh>
        );
      })}
    </>
  );
}
