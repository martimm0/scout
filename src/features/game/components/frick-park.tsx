"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  InstancedMesh,
  MeshDepthMaterial,
  MeshLambertMaterial,
  Object3D,
  type BufferGeometry,
} from "three";

import { useQuality } from "../hooks/use-quality";
import { useProgressive } from "../hooks/use-progressive";
import { useSurface } from "../hooks/use-surface";
import {
  buildFoliageKind,
  buildFoliageShadow,
  FOLIAGE_KINDS,
  foliageVariants,
  SWAY,
  type FoliageKind,
} from "../models/foliage";
import { buildCoverGeometry, COVER_KINDS } from "../models/ground-cover";
import { buildShoreGeometry } from "../models/shore";
import { scatterCover } from "../world/ground-cover";
import { scatterShore } from "../world/shoreline";
import { LOOKS, surface, type Look } from "../world/surface";
import { creek, REFLECTED_ONLY, UNREFLECTED } from "../world/water";
import { sway as swayMaterial } from "../world/wind";
import { buildLandmark } from "../models/landmarks";
import { sharedDetail, type Quality } from "../models/quality";
import { scatterFoliage, scatterGrass, scatterGrassNear, type Placement } from "../world/scatter";
import { seasonLook } from "../world/season";
import { buildTerrainGeometry, type Shade } from "../world/terrain-mesh";
import {
  activePark,
  groundDrop,
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

/** What each kind of foliage is made of, with its lean in the wind. */
const SOFT: ReadonlySet<FoliageKind> = new Set(["fern", "grass", "cattail", "clover", "knotweed", "leafLitter"]);
const LEAFY: ReadonlySet<FoliageKind> = new Set(["hemlock", "oak", "shrub"]);

const FOLIAGE_LOOK = Object.fromEntries(
  FOLIAGE_KINDS.map((kind) => {
    const base: Look =
      kind === "mushroom" ? LOOKS.fungus : SOFT.has(kind) ? LOOKS.blade : LEAFY.has(kind) ? LOOKS.tree : LOOKS.hard;

    return [kind, SWAY[kind] ? { ...base, sway: SWAY[kind] } : base];
  }),
) as Record<FoliageKind, Look>;

/** The wildflowers and tufts between the real flowers. */
const COVER_LOOK: Look = { ...LOOKS.blade, sway: [3.2, 0.1] };

/** One building, bridge or bench. */
function Landmark({
  geometry,
  position,
  rotation,
}: {
  geometry: BufferGeometry | undefined;
  position: [number, number, number];
  rotation: number;
}) {
  const material = useSurface(LOOKS.built, geometry);

  return (
    <mesh
      castShadow
      geometry={geometry}
      material={material}
      position={position}
      receiveShadow
      rotation={[0, rotation, 0]}
    />
  );
}

/** The kinds big enough to throw shade worth drawing. */
const SHADE_TREES: ReadonlySet<FoliageKind> = new Set(["hemlock", "oak", "snag", "shrub"]);

/** Instanced copies of one prop, placed once and never touched again. */
function Instances({
  aside = false,
  castShadow = false,
  geometry,
  look = LOOKS.hard,
  mirrored = false,
  placements,
  shadowOnly = false,
}: {
  /** Left out of the water's reflection on Ultra: see `creek`. */
  aside?: boolean;
  /** Drawn ONLY in the water's reflection: a tree's cheap stand-in. */
  mirrored?: boolean;
  castShadow?: boolean;
  geometry: BufferGeometry;
  /** What it is made of, and whether it moves in the wind. A stable object. */
  look?: Look;
  placements: Placement[];
  /** Drawn into the shadow map and nowhere else. */
  shadowOnly?: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const quality = useQuality();
  const material = useMemo(() => {
    if (shadowOnly) {
      // Writes nothing to the screen: no colour and no depth. It is in the
      // scene so the light can see it.
      return new MeshLambertMaterial({ colorWrite: false, depthWrite: false });
    }

    // In a reflection cut into two-unit blocks nobody can tell a bevel from a
    // flat face, so what only the water sees gets the plain matte material.
    return mirrored ? new MeshLambertMaterial({ vertexColors: true }) : surface(quality, look, geometry);
  }, [geometry, look, mirrored, quality, shadowOnly]);

  // On Ultra a shadow leans with the thing that throws it. The light draws
  // the scene with a material of its own, which knows nothing about the wind,
  // so anything that sways and casts hands it one that does.
  const shade = useMemo(
    () =>
      quality === "ultra" && castShadow && look.sway
        ? swayMaterial(new MeshDepthMaterial(), look.sway[0], look.sway[1], look.sway[2])
        : undefined,
    [castShadow, look, quality],
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => shade?.dispose(), [shade]);

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
    // The geometry too: the mesh is remounted when its model sharpens (see the
    // key below), and a new mesh starts with every instance at the origin.
    // Grass passes the same placements array each render, so without this the
    // whole lawn was left stacked on one spot as soon as the fine blade came in.
    // And the material, for the same reason: it is rebuilt when the quality
    // changes, and with it the mesh. The pebbles and the ground cover never
    // change their geometry or their placements, so switching Ultra on or off
    // left every one of them at the origin until this was in the list.
  }, [geometry, material, placements]);

  if (placements.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      castShadow={castShadow}
      customDepthMaterial={shade}
      layers={quality !== "ultra" ? 0 : mirrored ? REFLECTED_ONLY : aside ? UNREFLECTED : 0}
      // Remounted with its geometry: an instanced mesh keeps the count it was
      // built with, and a variant's share of the placements can change.
      key={`${geometry.uuid}-${material.uuid}-${placements.length}`}
      receiveShadow={!shadowOnly}
      ref={meshRef}
      // `planted` is for the specs: they find what stands on the ground by it.
      userData={{ planted: true, shadowOnly }}
    />
  );
}

/**
 * The same placements, standing on the ground as this quality draws it.
 *
 * Every scatter plants on the real height. The fine park's ground is stepped,
 * a whole unit at a time, and sits up to a unit under that: left alone, the
 * trees, the rocks and every blade of grass hovered over it.
 */
function standing(placements: Placement[], quality: Quality): Placement[] {
  if (quality === "low") {
    return placements;
  }

  return placements.map((placement) => {
    const [x, y, z] = placement.position;

    return { ...placement, position: [x, y + groundDrop(x, z, quality), z] };
  });
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

const TERRAIN = ["ground"] as const;

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
  const parkId = activePark().id;
  const built = useProgressive(
    TERRAIN,
    (_key, level) => {
      const look = lookForMonth(seasonKey);

      return tintGeometry(
        buildTerrainGeometry(level, groundShade()),
        look.groundTint,
        look.groundMix,
        0,
      );
    },
    sharedDetail(quality),
    `${parkId}:${seasonKey}`,
  );
  const geometry = built.get("ground");
  const material = useSurface(LOOKS.ground, geometry);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

/**
 * One flat sheet across the whole map. It only shows through where the ground
 * drops below it, which (by construction) is exactly the creek at the bottom
 * of the ravine. No spline, no ribbon mesh, no seams.
 */
export function Creek() {
  const quality = useQuality();
  const fine = quality !== "low";
  const parkId = activePark().id;
  const water = useMemo(
    () => creek(quality, world().maxX - world().minX, world().maxZ - world().minZ),
    // The park too: on Ultra the water knows how deep its own bed is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parkId, quality],
  );
  // The waterline is dressed on high only: it is a few hundred small models,
  // and low has no triangles to spare for pebbles.
  const shore = useMemo(() => {
    if (!fine) {
      return null;
    }

    const scattered = scatterShore();

    // The pebbles lie on the bank; the lily pads float and stay where they are.
    return { ...scattered, pebbles: standing(scattered.pebbles, "high") };
  }, [fine]);
  const pebbles = useMemo(() => (fine ? buildShoreGeometry("pebbles", true) : null), [fine]);
  const lilyPad = useMemo(() => (fine ? buildShoreGeometry("lilyPad", true) : null), [fine]);

  useEffect(() => () => water.dispose(), [water]);
  useEffect(() => () => pebbles?.dispose(), [pebbles]);
  useEffect(() => () => lilyPad?.dispose(), [lilyPad]);

  return (
    <>
      {water.mirror ? (
        // Ultra: the sheet is a mirror, with the water's material on it.
        <primitive
          object={water.mirror}
          position={[0, waterLevel(), 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ water: true }}
        />
      ) : (
        <mesh
          material={water.material}
          position={[0, waterLevel(), 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ water: true }}
        >
          <planeGeometry
            args={[world().maxX - world().minX, world().maxZ - world().minZ]}
          />
        </mesh>
      )}
      {shore && pebbles ? <Instances aside geometry={pebbles} placements={shore.pebbles} /> : null}
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
  const variants = foliageVariants(quality);
  const keys = useMemo(
    () =>
      FOLIAGE_KINDS.flatMap((kind) =>
        // Grass is one model however fine: its variety is in how it is scattered.
        Array.from({ length: kind === "grass" ? 1 : variants }, (_, variant) => `${kind}:${variant}`),
      ),
    [variants],
  );
  const geometry = useProgressive(
    keys,
    (key, level) => {
      const [kind, variant] = key.split(":");
      const look = lookForMonth(seasonKey);

      return tintGeometry(
        buildFoliageKind(kind as FoliageKind, level, Number(variant)),
        look.foliageTint,
        look.foliageMix,
        look.snow * 0.4,
      );
    },
    sharedDetail(quality),
    String(seasonKey),
  );
  const placements = useMemo(() => {
    const scattered = scatterFoliage();

    for (const kind of Object.keys(scattered) as (keyof typeof scattered)[]) {
      scattered[kind] = standing(scattered[kind], quality);
    }

    return scattered;
  }, [quality]);
  // A thicker lawn on the fine park: nearly twice the blades.
  const grass = useMemo(
    () => standing(scatterGrass(quality !== "low" ? 5.4 : undefined), quality),
    [quality],
  );
  // What throws the trees' shadows: see `buildFoliageShadow`.
  const shadows = useMemo(
    () =>
      quality !== "low"
        ? keys
            .filter((key) => SHADE_TREES.has(key.split(":")[0] as FoliageKind))
            .map((key) => {
              const [kind, variant] = key.split(":") as [FoliageKind, string];

              const look = lookForMonth(seasonKey);

              // Tinted like the trees they stand in for: the sun does not care
              // what colour a shadow's caster is, but the water reflects them.
              return {
                key,
                kind,
                variant: Number(variant),
                geometry: tintGeometry(
                  buildFoliageShadow(kind, Number(variant)),
                  look.foliageTint,
                  look.foliageMix,
                  look.snow * 0.4,
                ),
              };
            })
        : [],
    [keys, quality, seasonKey],
  );

  useEffect(
    () => () => {
      for (const shadow of shadows) {
        shadow.geometry.dispose();
      }
    },
    [shadows],
  );

  return (
    <>
      {shadows.map((shadow) => (
        <Instances
          castShadow
          geometry={shadow.geometry}
          key={`shadow-${shadow.key}`}
          look={FOLIAGE_LOOK[shadow.kind]}
          placements={placements[shadow.kind].filter((_, index) => index % variants === shadow.variant)}
          shadowOnly
        />
      ))}
      {/* The same stand-ins again, in colour, for the water to reflect in
          place of the trees themselves. Ultra only: nothing else has a mirror. */}
      {quality === "ultra"
        ? shadows.map((shadow) => (
            <Instances
              geometry={shadow.geometry}
              key={`mirror-${shadow.key}`}
              mirrored
              placements={placements[shadow.kind].filter((_, index) => index % variants === shadow.variant)}
            />
          ))
        : null}
      {quality !== "low" ? <GroundCover /> : null}
      {keys
        .filter((key) => !key.startsWith("grass:"))
        .map((key) => {
          const [kind, variant] = key.split(":") as [FoliageKind, string];
          const part = geometry.get(key);

          return part ? (
            <Instances
              // Not in the water's reflection: its stand-in is, below.
              aside
              geometry={part}
              key={key}
              // Each variant takes every nth placement, so three oaks are spread
              // through the wood rather than standing in three groves.
              look={FOLIAGE_LOOK[kind]}
              placements={placements[kind].filter((_, index) => index % variants === Number(variant))}
            />
          ) : null;
        })}
      {/* Thousands of blades, one draw call. This is what tells the player how
          small they are, so it has to be everywhere and it has to be cheap. */}
      {geometry.get("grass:0") ? (
        <Instances
          aside
          geometry={geometry.get("grass:0") as BufferGeometry}
          look={FOLIAGE_LOOK.grass}
          placements={grass}
        />
      ) : null}
      {quality === "ultra" && geometry.get("grass:0") ? (
        <NearGrass geometry={geometry.get("grass:0") as BufferGeometry} />
      ) : null}
    </>
  );
}

/**
 * More grass, round the bee. Ultra only.
 *
 * The lawn is one blade every five units, which is a meadow from the air and
 * a sparse one from a flower. Close to, where the lens is, the ground wants to
 * be thick with it. So Ultra plants a second, much denser set of small blades
 * within thirty-odd units of the bee and re-plants it as the bee moves on. The
 * cells are fixed to the world (`scatterGrassNear`), so the grass is where it
 * was when the bee comes back, and it thins toward the edge of the circle so
 * that it grows in rather than appearing.
 */
const NEAR = { radius: 36, cell: 1.9, move: 10, most: 1500 };

function NearGrass({ geometry }: { geometry: BufferGeometry }) {
  const scene = useThree((state) => state.scene);
  const mesh = useRef<InstancedMesh>(null);
  const material = useSurface(FOLIAGE_LOOK.grass, geometry);
  const last = useRef<{ bee: Object3D | null; x: number; z: number }>({ bee: null, x: Infinity, z: Infinity });
  const dummy = useMemo(() => new Object3D(), []);

  // A new mesh (the blade sharpened, the quality changed) starts empty.
  useEffect(() => {
    last.current.x = Infinity;
  }, [geometry, material]);

  useFrame(() => {
    const state = last.current;
    const blades = mesh.current;

    if (!blades) {
      return;
    }

    if (!state.bee) {
      scene.traverse((node) => {
        if (node.userData.playerBee) {
          state.bee = node;
        }
      });
    }

    if (!state.bee) {
      return;
    }

    const { x, z } = state.bee.position;

    if (Math.hypot(x - state.x, z - state.z) < NEAR.move) {
      return;
    }

    state.x = x;
    state.z = z;

    // One pool of blades, laid out again in place. It was a fresh mesh each
    // time at first, which at flying speed was four new meshes a second.
    const near = scatterGrassNear(x, z, NEAR.radius, NEAR.cell);
    const count = Math.min(near.length, NEAR.most);

    for (let index = 0; index < count; index += 1) {
      const blade = near[index];
      const [bx, by, bz] = blade.position;
      const away = Math.hypot(bx - x, bz - z) / NEAR.radius;

      dummy.position.set(bx, by + groundDrop(bx, bz, "ultra"), bz);
      dummy.rotation.set(0, blade.rotation, 0);
      // Half the height of the lawn's, and less toward the edge.
      dummy.scale.setScalar(blade.scale * 0.5 * Math.min(1, (1 - away) * 3.2));
      dummy.updateMatrix();
      blades.setMatrixAt(index, dummy.matrix);
    }

    blades.count = count;
    blades.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, NEAR.most]}
      // Wherever the bee is, which is not where an empty buffer says.
      frustumCulled={false}
      key={`${geometry.uuid}-${material.uuid}`}
      layers={UNREFLECTED}
      receiveShadow
      ref={mesh}
      userData={{ nearGrass: true }}
    />
  );
}

/** Wildflowers, tufts, fallen leaves and stones: the fine park's ground. */
function GroundCover() {
  const placements = useMemo(() => scatterCover(), []);
  const geometry = useMemo(
    () => new Map(COVER_KINDS.map((kind) => [kind, buildCoverGeometry(kind)])),
    [],
  );

  useEffect(
    () => () => {
      for (const part of geometry.values()) {
        part.dispose();
      }
    },
    [geometry],
  );

  return (
    <>
      {COVER_KINDS.map((kind) => (
        <Instances
          aside
          geometry={geometry.get(kind) as BufferGeometry}
          key={kind}
          look={kind === "stone" || kind === "leaves" ? LOOKS.hard : COVER_LOOK}
          placements={placements[kind]}
        />
      ))}
    </>
  );
}

/**
 * The things that make a park itself and nowhere else. Each is placed by hand:
 * they are landmarks, and a landmark you scattered randomly is not one.
 */
export function Landmarks() {
  const quality = useQuality();
  const parkId = activePark().id;
  const props = PROPS_BY_PARK[parkId] ?? [];
  // Only what this park actually has standing in it. Every park used to
  // compile all three parks' landmarks and throw two thirds of them away.
  const kinds = useMemo(
    () => [...new Set((PROPS_BY_PARK[parkId] ?? []).map((prop) => prop.kind))],
    [parkId],
  );
  const geometry = useProgressive(kinds, (kind, level) => buildLandmark(kind, level), sharedDetail(quality), "");

  return (
    <>
      {props.map((prop, index) => {
        const [x, z] = prop.at;
        // A bridge spans the hollow rather than sitting on the floor of it, so
        // anything with a hang height ignores the terrain underneath entirely.
        const y =
          prop.hangAt ?? terrainHeight(x, z) - (prop.sink ?? 1);

        return (
          <Landmark
            geometry={geometry.get(prop.kind)}
            key={`${prop.kind}-${x}-${z}-${index}`}
            position={[x, y, z]}
            rotation={prop.rotation ?? 0}
          />
        );
      })}
    </>
  );
}
