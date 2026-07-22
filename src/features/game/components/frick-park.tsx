"use client";

import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D, type BufferGeometry } from "three";

import { buildFoliageGeometry, type FoliageKind } from "../models/foliage";
import { buildLandmarkGeometry } from "../models/landmarks";
import { scatterFoliage, scatterGrass, type Placement } from "../world/scatter";
import { seasonLook } from "../world/season";
import { buildTerrainGeometry } from "../world/terrain-mesh";
import {
  activePark,
  terrainHeight,
  waterLevel,
  world,
} from "../world/terrain";
import { PROPS_BY_PARK } from "../world/parks/props";

/**
 * Push a geometry's baked vertex colours toward a target, in place.
 *
 * The park is built out of colour baked into the mesh, so a season is not a light
 * switch: it is the wood itself turning. This mixes every vertex toward a seasonal
 * colour, which is how the canopy goes gold in October and how snow lies white
 * over everything in January. Done once when the month turns, not per frame.
 */
const SNOW = new Color("#eef4fb");

function tintGeometry(
  geometry: BufferGeometry,
  tintHex: string,
  tintMix: number,
  snow: number,
) {
  const colors = geometry.getAttribute("color");

  if (!colors || (tintMix <= 0 && snow <= 0)) {
    return geometry;
  }

  const tint = new Color(tintHex);
  const c = new Color();

  for (let i = 0; i < colors.count; i += 1) {
    c.fromBufferAttribute(colors, i);
    if (tintMix > 0) c.lerp(tint, tintMix);
    if (snow > 0) c.lerp(SNOW, snow);
    colors.setXYZ(i, c.r, c.g, c.b);
  }

  colors.needsUpdate = true;

  return geometry;
}

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

export function Terrain({ month }: { month: number }) {
  // Rebuilt only when the month turns. Snow lies over the ground in winter; the
  // rest of the year the terrain keeps its own colours.
  const seasonKey = Math.floor(month);
  const geometry = useMemo(() => {
    const look = seasonLook(seasonKey);
    return tintGeometry(buildTerrainGeometry(), look.groundTint, look.groundMix, 0);
  }, [seasonKey]);

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

export function Foliage({ month }: { month: number }) {
  // The wood itself turns: gold in autumn, bare grey-brown and snow-dusted in
  // winter, fresh green in spring. Rebuilt only when the month turns.
  const seasonKey = Math.floor(month);
  const geometry = useMemo(() => {
    const look = seasonLook(seasonKey);
    const built = buildFoliageGeometry();

    for (const part of Object.values(built)) {
      tintGeometry(part, look.foliageTint, look.foliageMix, look.snow * 0.4);
    }

    return built;
  }, [seasonKey]);
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
