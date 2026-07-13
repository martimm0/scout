"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D, type BufferGeometry } from "three";

import { buildFungusGeometry } from "../models/fungi";
import { buildMoteGeometry, buildPlantGeometry } from "../models/flora";
import { useGameStore } from "../state/game-store";
import { isActive } from "../world/daylight";
import type { SpeciesInstance } from "../world/species-scatter";

/**
 * Everything you can find, drawn.
 *
 * Two rules, both of which are about time of day:
 *
 *  - **A closed flower is still there.** Plants are always drawn, because they do
 *    not vanish at night, they shut. Out of hours they are dimmed and carry no
 *    mote, and you cannot pollinate them.
 *  - **A fungus that is not fruiting is genuinely gone.** Mushrooms come up and
 *    rot away. Drawing a ghost of one would be a lie, so out of hours they simply
 *    are not there.
 */
export function SpeciesField({
  hour,
  instances,
}: {
  hour: number;
  instances: SpeciesInstance[];
}) {
  const nearby = useGameStore((state) => state.ui.nearby);

  // One geometry per species, shared across all its placements.
  const geometry = useMemo(() => {
    const map = new Map<string, BufferGeometry>();

    for (const instance of instances) {
      if (map.has(instance.id)) {
        continue;
      }

      map.set(
        instance.id,
        instance.species.kind === "plant"
          ? buildPlantGeometry(instance.species.plant)
          : buildFungusGeometry(instance.species.fungus),
      );
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
  const glow = useMemo(() => new Color("#7dd88a"), []);

  const visible = useMemo(
    () =>
      instances.filter((instance) => {
        if (instance.species.kind === "plant") {
          return true;
        }

        return isActive(instance.window, hour);
      }),
    [instances, hour],
  );

  return (
    <>
      {visible.map((instance) => {
        const open = isActive(instance.window, hour);
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
            position={instance.position}
            rotation={[0, instance.rotation, 0]}
            scale={instance.scale}
          >
            <mesh castShadow geometry={geometry.get(instance.id)}>
              <meshLambertMaterial
                emissive={
                  isNearby ? highlight : glowing ? glow : undefined
                }
                emissiveIntensity={isNearby ? 0.3 : glowing ? 0.55 : 0}
                // A closed flower is drab. It has nothing to advertise.
                color={open ? "#ffffff" : "#8d8d86"}
                vertexColors
              />
            </mesh>
          </group>
        );
      })}
      <Motes hour={hour} instances={visible} />
    </>
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
  instances,
}: {
  hour: number;
  instances: SpeciesInstance[];
}) {
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const discoveredFungi = useGameStore((state) => state.discoveredFungi);
  const geometry = useMemo(() => buildMoteGeometry(), []);
  const meshRef = useRef<InstancedMesh>(null);

  const pending = useMemo(
    () =>
      instances.filter((instance) => {
        if (!isActive(instance.window, hour)) {
          return false;
        }

        const found =
          instance.species.kind === "plant"
            ? discoveredPlants[instance.id]
            : discoveredFungi[instance.id];

        return !found;
      }),
    [instances, hour, discoveredPlants, discoveredFungi],
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
      const bob = Math.sin(elapsed * 1.8 + index * 1.7) * 1.6;

      dummy.position.set(x, y + instance.height * instance.scale + 7 + bob, z);
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
