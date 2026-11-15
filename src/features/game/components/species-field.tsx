"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  type BufferGeometry,
} from "three";

import { buildFungusGeometry } from "../models/fungi";
import {
  buildMoteGeometry,
  buildPlantGeometry,
  buildSeedHeadGeometry,
} from "../models/flora";
import { useProgressive } from "../hooks/use-progressive";
import { useQuality } from "../hooks/use-quality";
import { useGameStore } from "../state/game-store";
import type { Quality } from "../models/quality";
import { plantDrop } from "../world/perch";
import { LOOKS, ultraProps } from "../world/surface";
import { sway } from "../world/wind";
import {
  isFindable,
  isOut,
  landingHeight,
  type SpeciesInstance,
} from "../world/species-scatter";

/** The two hooks a material needs to lean with the wind, as JSX props. */
const swayCache = new Map<number, Pick<MeshLambertMaterial, "customProgramCacheKey" | "onBeforeCompile">>();

function swayProps(height: number) {
  let props = swayCache.get(height);

  if (!props) {
    // Borrowed from a throwaway material: only the two hooks are kept.
    const patched = sway(new MeshLambertMaterial(), height, 0.045, 1.7);

    props = {
      customProgramCacheKey: patched.customProgramCacheKey,
      onBeforeCompile: patched.onBeforeCompile,
    };
    swayCache.set(height, props);
  }

  return props;
}

/**
 * Everything you can find, drawn.
 *
 * Two rules, both of which are about time of day:
 *
 *  - **A closed flower is still there.** Plants are always drawn, because they do
 *    not vanish at night or out of season, they shut. Off-hours or off-month they
 *    are dimmed and carry no mote, and you cannot pollinate them: a plant out of
 *    its bloom is a green stalk, and a stalk is what you see.
 *  - **A fungus that is not fruiting is genuinely gone.** Mushrooms come up and
 *    rot away. Drawing a ghost of one would be a lie, so out of its hours or its
 *    season they simply are not there.
 *
 * Two questions, not one, and this file asks both. `isOut` is whether there is a
 * flower on it to work, and it decides what is DRAWN open: a plant out of its
 * bloom is drab, and it wears a seed head instead if you pollinated it earlier in
 * the year. `isFindable` is whether it can be met at all, and it decides the
 * motes, because a mote marks something missing from your journal and a trout lily
 * in July is still a trout lily.
 */
export function SpeciesField({
  hour,
  month,
  instances,
}: {
  hour: number;
  month: number;
  instances: SpeciesInstance[];
}) {
  const nearby = useGameStore((state) => state.ui.nearby);
  const quality = useQuality();

  // One geometry per species, shared across all its placements.
  const byId = useMemo(() => {
    const map = new Map<string, SpeciesInstance>();

    for (const instance of instances) {
      if (!map.has(instance.id)) {
        map.set(instance.id, instance);
      }
    }

    return map;
  }, [instances]);
  const ids = useMemo(() => [...byId.keys()], [byId]);
  const geometry = useProgressive(
    ids,
    (id, level) => {
      const { species } = byId.get(id) as SpeciesInstance;

      return species.kind === "plant"
        ? buildPlantGeometry(species.plant, level)
        : buildFungusGeometry(species.fungus, level);
    },
    quality,
    "",
  );

  const highlight = useMemo(() => new Color("#fff6c9"), []);
  const glow = useMemo(() => new Color("#7dd88a"), []);

  const visible = useMemo(
    () =>
      instances.filter((instance) => {
        if (instance.species.kind === "plant") {
          return true;
        }

        return isOut(instance, hour, month);
      }),
    [instances, hour, month],
  );

  return (
    <>
      {visible.map((instance) => {
        const open = isOut(instance, hour, month);
        const isNearby = nearby?.key === instance.key;
        const fungus =
          instance.species.kind === "fungus" ? instance.species.fungus : null;

        // The jack-o'-lantern is bioluminescent. It is the only thing in the park
        // that lights itself, and finding it in the dark is the reward for coming
        // at night at all.
        const glowing = Boolean(fungus?.glows);

        return (
          <group
            key={instance.key}
            position={[
              instance.position[0],
              instance.position[1] + plantDrop(instance, quality),
              instance.position[2],
            ]}
            rotation={[0, instance.rotation, 0]}
            scale={instance.scale}
            // For the specs, which check that a plant stands on the ground.
            userData={{ plant: instance.key }}
          >
            <mesh castShadow geometry={geometry.get(instance.id)}>
              <SpeciesSurface
                // A closed flower is drab. It has nothing to advertise. A cool
                // dusk wash rather than flat grey, which read as dead.
                color={open ? "#ffffff" : "#aeb0c2"}
                emissive={isNearby ? highlight : glowing ? glow : undefined}
                // Brighter than white on Ultra, where what glows spills light.
                emissiveIntensity={isNearby ? 0.3 : glowing ? (quality === "ultra" ? 2.4 : 0.55) : 0}
                geometry={geometry.get(instance.id)}
                instance={instance}
                quality={quality}
              />
            </mesh>
          </group>
        );
      })}
      <Motes hour={hour} month={month} instances={visible} />
      <SeedHeads hour={hour} month={month} instances={visible} />
    </>
  );
}

/**
 * What one flower or fungus is made of.
 *
 * Matte on Low and High, as ever. On Ultra a petal is waxy and lets the sun
 * through, and a cap is wet. A flower nods in the wind at every quality. A
 * mushroom does not.
 */
function SpeciesSurface({
  color,
  emissive,
  emissiveIntensity,
  geometry,
  instance,
  quality,
}: {
  color: string;
  emissive: Color | undefined;
  emissiveIntensity: number;
  geometry: BufferGeometry | undefined;
  instance: SpeciesInstance;
  quality: Quality;
}) {
  const height = instance.species.kind === "plant" ? instance.species.plant.height : null;
  const ultra = useMemo(
    () =>
      quality === "ultra"
        ? ultraProps(
            height === null ? LOOKS.fungus : { ...LOOKS.flower, sway: [height, 0.045, 1.7] },
            geometry,
          )
        : null,
    [geometry, height, quality],
  );

  if (ultra) {
    return (
      <meshStandardMaterial
        {...ultra}
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        // A different material type from the matte one: never reuse its program.
        key="ultra"
      />
    );
  }

  return (
    <meshLambertMaterial
      {...(height === null ? null : swayProps(height))}
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      vertexColors
    />
  );
}

/**
 * A seed head on every flower you pollinated whose bloom has now passed.
 *
 * It is the world remembering you, on the real calendar: pollinate the milkweed
 * in July and come back in October to a pod that set because you were there. It
 * only shows once the flower is out of its season (or its hours), so a plant is
 * never a bloom and a seed head at once, and there is no mark until your work has
 * actually had time to become one.
 */
function SeedHeads({
  hour,
  month,
  instances,
}: {
  hour: number;
  month: number;
  instances: SpeciesInstance[];
}) {
  const pollinatedPlants = useGameStore((state) => state.pollinatedPlants);
  const quality = useQuality();
  const geometry = useMemo(() => buildSeedHeadGeometry(), []);
  const meshRef = useRef<InstancedMesh>(null);

  const marked = useMemo(
    () =>
      instances.filter(
        (instance) =>
          instance.species.kind === "plant" &&
          pollinatedPlants[instance.id] &&
          !isOut(instance, hour, month),
      ),
    [instances, hour, month, pollinatedPlants],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const dummy = new Object3D();

    marked.forEach((instance, index) => {
      const [x, , z] = instance.position;
      // A dry pod barely moves; a slow nod in the wind, no more.
      const sway = Math.sin(elapsed * 0.8 + index) * 0.04;

      dummy.position.set(x, landingHeight(instance) + plantDrop(instance, quality) - 1, z);
      dummy.rotation.set(sway, instance.rotation, 0);
      dummy.scale.setScalar(instance.scale * 0.9);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (marked.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      args={[geometry, undefined, marked.length]}
      castShadow
      key={marked.length}
      ref={meshRef}
    >
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
}

/**
 * A bobbing mote over everything you have not found yet AND which is open right
 * now. Without it you cannot pick anything out of the undergrowth from flight
 * height; with it, the map is a set of destinations.
 *
 * A mote over a closed flower would be a lie, so there isn't one.
 */
function Motes({
  hour,
  month,
  instances,
}: {
  hour: number;
  month: number;
  instances: SpeciesInstance[];
}) {
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const discoveredFungi = useGameStore((state) => state.discoveredFungi);
  const geometry = useMemo(() => buildMoteGeometry(), []);
  const meshRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);
  // When this set of motes appeared, so they can grow in rather than pop.
  const born = useRef(-1);

  const pending = useMemo(
    () =>
      instances.filter((instance) => {
        // A mote marks something you have not MET, so it follows what can be
        // found rather than what is in bloom. A trout lily in July is still worth
        // walking over to and putting in the journal.
        if (!isFindable(instance, hour, month)) {
          return false;
        }

        const found =
          instance.species.kind === "plant"
            ? discoveredPlants[instance.id]
            : discoveredFungi[instance.id];

        return !found;
      }),
    [instances, hour, month, discoveredPlants, discoveredFungi],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  // The mesh is rebuilt whenever the count changes (an instanced mesh keeps the
  // count it was made with), so that is the moment to start growing again.
  useEffect(() => {
    born.current = -1;
  }, [pending.length]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const halo = haloRef.current;

    if (!mesh) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const dummy = new Object3D();

    if (born.current < 0) {
      born.current = elapsed;
    }

    // Ease out: quick at first, settling into full size.
    const age = Math.min(1, (elapsed - born.current) / 0.5);
    const grow = 1 - (1 - age) * (1 - age);

    pending.forEach((instance, index) => {
      const [x, y, z] = instance.position;
      const bob = Math.sin(elapsed * 1.8 + index * 1.7) * 1.6;

      dummy.position.set(x, y + instance.height * instance.scale + 7 + bob, z);
      dummy.rotation.set(elapsed * 0.6, elapsed * 0.9, 0);
      dummy.scale.setScalar(9 * grow);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      if (halo) {
        // A breath of light round each one, slowly swelling and fading.
        dummy.scale.setScalar(9 * grow * (2.6 + Math.sin(elapsed * 2.2 + index) * 0.5));
        dummy.updateMatrix();
        halo.setMatrixAt(index, dummy.matrix);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;

    if (halo) {
      halo.instanceMatrix.needsUpdate = true;
    }
  });

  if (pending.length === 0) {
    return null;
  }

  return (
    <>
      <instancedMesh
        args={[geometry, undefined, pending.length]}
        key={pending.length}
        ref={meshRef}
      >
        <meshBasicMaterial toneMapped={false} vertexColors />
      </instancedMesh>
      {/* The glow. Added to what is behind it rather than drawn over it, so a
          mote reads as lit from within and not as a bigger, paler cube. */}
      <instancedMesh
        args={[geometry, undefined, pending.length]}
        key={`halo-${pending.length}`}
        ref={haloRef}
      >
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#ffe9a8"
          depthWrite={false}
          opacity={0.1}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
    </>
  );
}
