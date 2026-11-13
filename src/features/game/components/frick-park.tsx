"use client";

import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D, type BufferGeometry } from "three";

import { useQuality } from "../hooks/use-quality";
import { buildFoliageGeometry, SWAY, type FoliageKind } from "../models/foliage";
import { buildShoreGeometry } from "../models/shore";
import { scatterShore } from "../world/shoreline";
import { ripple, sway as swayMaterial } from "../world/wind";
import { buildLandmarkGeometry } from "../models/landmarks";
import { scatterFoliage, scatterGrass, type Placement } from "../world/scatter";
import { seasonLook } from "../world/season";
import { buildTerrainGeometry, type Shade } from "../world/terrain-mesh";
import {
  activePark,
  terrainHeight,
  waterLevel,
  world,
} from "../world/terrain";
import { PROPS_BY_PARK } from "../world/parks/props";

/**
 * The look of a whole month, sampled at its MIDDLE.
 *
 * Terrain and foliage are baked geometry, so they are rebuilt only when the month
 * turns rather than blended day by day: one sample has to stand for the whole
 * month. Taking it on the first of the month reads the very start of every curve,
 * and the winter snow curve is a bump that is zero at both of its ends, so
 * December came out with no snow on the ground at all. Sampling the midpoint is
 * what "the month as a whole" actually means, and it gives December and February
 * their snow while leaving January the deepest.
 */
function lookForMonth(wholeMonth: number) {
  return seasonLook(wholeMonth + 0.5);
}

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
  const normals = geometry.getAttribute("normal");

  for (let i = 0; i < colors.count; i += 1) {
    c.fromBufferAttribute(colors, i);
    if (tintMix > 0) c.lerp(tint, tintMix);

    if (snow > 0) {
      // Snow lies on things; it does not coat their sides. A voxel model has
      // honest tops, so the tops take most of it and the rest gets a dusting.
      const lying = !normals || normals.getY(i) > 0.5;

      c.lerp(SNOW, lying ? Math.min(1, snow * 2.2) : snow * 0.3);
    }

    colors.setXYZ(i, c.r, c.g, c.b);
  }

  colors.needsUpdate = true;

  return geometry;
}

/** The kinds big enough to throw shade worth drawing. */
const SHADE_TREES: ReadonlySet<FoliageKind> = new Set(["hemlock", "oak", "snag", "shrub"]);

/** Instanced copies of one prop, placed once and never touched again. */
function Instances({
  castShadow = false,
  geometry,
  placements,
  sway,
}: {
  castShadow?: boolean;
  geometry: BufferGeometry;
  placements: Placement[];
  /** Moves in the wind: the model's height and how far its top travels. */
  sway?: [height: number, amount: number];
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const swayHeight = sway?.[0];
  const swayAmount = sway?.[1];
  const material = useMemo(() => {
    const lambert = new MeshLambertMaterial({ vertexColors: true });

    return swayHeight && swayAmount ? swayMaterial(lambert, swayHeight, swayAmount) : lambert;
  }, [swayAmount, swayHeight]);

  useEffect(() => () => material.dispose(), [material]);

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
      args={[geometry, material, placements.length]}
      castShadow={castShadow}
      // Remounted with its geometry: an instanced mesh keeps the count it was
      // built with, and a variant's share of the placements can change.
      key={`${geometry.uuid}-${placements.length}`}
      receiveShadow
      ref={meshRef}
    />
  );
}

/**
 * What keeps the light off the ground, and how much: wide and soft under a
 * tree, tight and dark at the foot of a rock.
 */
const SHADE: Partial<Record<FoliageKind, [radius: number, depth: number]>> = {
  hemlock: [24, 0.3],
  oak: [27, 0.3],
  shrub: [10, 0.24],
  snag: [7, 0.18],
  rock: [9, 0.22],
  stump: [9, 0.2],
  log: [14, 0.18],
  knotweed: [9, 0.2],
};

function groundShade(): Shade[] {
  const shades: Shade[] = [];
  const placements = scatterFoliage();

  for (const kind of Object.keys(SHADE) as FoliageKind[]) {
    const [radius, depth] = SHADE[kind] as [number, number];

    for (const placement of placements[kind]) {
      shades.push({
        x: placement.position[0],
        z: placement.position[2],
        radius: radius * placement.scale,
        depth,
      });
    }
  }

  return shades;
}

export function Terrain({ month }: { month: number }) {
  const quality = useQuality();
  // Rebuilt only when the month turns. Snow lies over the ground in winter; the
  // rest of the year the terrain keeps its own colours.
  const seasonKey = Math.floor(month);
  const geometry = useMemo(() => {
    const look = lookForMonth(seasonKey);

    return tintGeometry(
      buildTerrainGeometry(quality, groundShade()),
      look.groundTint,
      look.groundMix,
      0,
    );
  }, [quality, seasonKey]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

/**
 * One flat sheet across the whole map. It only shows through where the ground
 * drops below it, which (by construction) is exactly the creek at the bottom
 * of the ravine. No spline, no ribbon mesh, no seams.
 */
export function Creek() {
  const quality = useQuality();
  const fine = quality === "high";
  const material = useMemo(
    () => ripple(new MeshLambertMaterial({ color: "#4f9ac4", opacity: 0.86, transparent: true })),
    [],
  );
  // The waterline is dressed on high only: it is a few hundred small models,
  // and low has no triangles to spare for pebbles.
  const shore = useMemo(() => (fine ? scatterShore() : null), [fine]);
  const pebbles = useMemo(() => (fine ? buildShoreGeometry("pebbles", true) : null), [fine]);
  const lilyPad = useMemo(() => (fine ? buildShoreGeometry("lilyPad", true) : null), [fine]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => pebbles?.dispose(), [pebbles]);
  useEffect(() => () => lilyPad?.dispose(), [lilyPad]);

  return (
    <>
      <mesh
        material={material}
        position={[0, waterLevel(), 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[world().maxX - world().minX, world().maxZ - world().minZ]}
        />
      </mesh>
      {shore && pebbles ? <Instances geometry={pebbles} placements={shore.pebbles} /> : null}
      {shore && lilyPad ? <Instances geometry={lilyPad} placements={shore.lilyPads} /> : null}
    </>
  );
}

export function Foliage({ month }: { month: number }) {
  const quality = useQuality();
  // The wood itself turns: gold in autumn, bare grey-brown and snow-dusted in
  // winter, fresh green in spring. Rebuilt only when the month turns, or when
  // the player asks for a finer or a coarser park.
  const seasonKey = Math.floor(month);
  const geometry = useMemo(() => {
    const look = lookForMonth(seasonKey);
    const built = buildFoliageGeometry(quality);

    for (const variants of Object.values(built)) {
      for (const part of variants) {
        tintGeometry(part, look.foliageTint, look.foliageMix, look.snow * 0.4);
      }
    }

    return built;
  }, [quality, seasonKey]);
  const placements = useMemo(() => scatterFoliage(), []);
  const grass = useMemo(() => scatterGrass(), []);

  useEffect(
    () => () => {
      for (const variants of Object.values(geometry)) {
        for (const part of variants) {
          part.dispose();
        }
      }
    },
    [geometry],
  );

  return (
    <>
      {(Object.keys(geometry) as FoliageKind[])
        .filter((kind) => kind !== "grass")
        .flatMap((kind) =>
          // Each variant takes every nth placement, so three oaks are spread
          // through the wood rather than standing in three groves.
          geometry[kind].map((part, variant, all) => (
            <Instances
              castShadow={quality === "high" && SHADE_TREES.has(kind)}
              geometry={part}
              key={`${kind}-${variant}`}
              placements={placements[kind].filter((_, index) => index % all.length === variant)}
              sway={SWAY[kind]}
            />
          )),
        )}
      {/* Thousands of blades, one draw call. This is what tells the player how
          small they are, so it has to be everywhere and it has to be cheap. */}
      <Instances geometry={geometry.grass[0]} placements={grass} sway={SWAY.grass} />
    </>
  );
}

/**
 * The things that make a park itself and nowhere else. Each is placed by hand:
 * they are landmarks, and a landmark you scattered randomly is not one.
 */
export function Landmarks() {
  const quality = useQuality();
  const geometry = useMemo(() => buildLandmarkGeometry(quality), [quality]);
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
