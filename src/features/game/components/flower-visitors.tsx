"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from "three";

import {
  FORAGERS,
  occupancyOf,
  OCCUPIED_FRACTION,
  VISIT_SECONDS,
} from "../world/foragers";
import { isOut, landingHeight, type SpeciesInstance } from "../world/species-scatter";

/**
 * The insects already on the flowers.
 *
 * One visit in five comes to nothing, and a slice of that is now something you
 * can see from the air rather than a dice roll you lose after twelve seconds of
 * minigame. These are the ones sitting on a bloom: fly over, notice the flower
 * is taken, and pick a different one.
 *
 * A sibling of `AmbientLife` and built the same way, for the same reason: one
 * instanced mesh, a fixed pool, written by the frame loop off React's render
 * path. The difference is that these are pinned to real flowers rather than
 * wandering, because the whole point is that they are ON something.
 *
 * They are still not quarry. You cannot collect them, they take nothing from
 * you, and every one of them leaves within about eighteen seconds.
 */
export function FlowerVisitors({
  busy,
  hour,
  instances,
  month,
}: {
  busy?: "on" | "off";
  hour: number;
  instances: SpeciesInstance[];
  month: number;
}) {
  const mesh = useRef<InstancedMesh>(null);

  /**
   * Only flowers, and only ones with a flower on them.
   *
   * A bee does not settle on a mushroom and it does not settle on a closed or
   * out-of-season stalk, so neither do these. Computed once per hour and month
   * rather than per frame: the set changes when the park's clock rolls, not
   * sixty times a second.
   */
  const flowers = useMemo(
    () =>
      instances.filter(
        (instance) => instance.species.kind === "plant" && isOut(instance, hour, month),
      ),
    [hour, instances, month],
  );

  /**
   * The pool, sized generously above the expected count.
   *
   * `OCCUPIED_FRACTION` is an average, and the number busy at any instant is a
   * binomial draw around it. Sizing the pool AT the average would silently drop
   * every visitor above the mean, which is about half of all moments.
   */
  const capacity = useMemo(
    () => Math.max(8, Math.ceil(flowers.length * OCCUPIED_FRACTION * 2.5)),
    [flowers.length],
  );

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: "#e8c15a", transparent: true, opacity: 0.95 }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const dummy = useMemo(() => new Object3D(), []);

  useFrame((frame) => {
    const instanced = mesh.current;

    if (!instanced) {
      return;
    }

    const seconds = Date.now() / 1000;
    const time = frame.clock.elapsedTime;

    let drawn = 0;

    for (const flower of flowers) {
      if (drawn >= capacity) {
        break;
      }

      /**
       * `on` means ALL of them, not "try a couple of moments and hope".
       *
       * This used to ask for occupancy at two arbitrary instants and take
       * whichever answered, which is a schedule, not an override: about a sixth
       * of flowers came out busy. The landing card forces the pin properly, so
       * the two disagreed, and a test could be told "somebody is already on it"
       * while the world drew an empty flower.
       */
      const occupancy =
        busy === "off"
          ? null
          : busy === "on"
            ? { forager: FORAGERS[0], freeIn: VISIT_SECONDS }
            : occupancyOf(flower.key, seconds);

      if (!occupancy) {
        continue;
      }

      const [x, , z] = flower.position;
      const top = landingHeight(flower);

      // A small busy hover right at the head of the flower, not a body parked
      // in the middle of it. The wobble is a function of the clock and the
      // flower's own position, so nothing pops between frames.
      const wobble = time * 3 + x + z;

      dummy.position.set(
        x + Math.sin(wobble) * 0.6,
        top + 1.2 + Math.sin(wobble * 1.7) * 0.4,
        z + Math.cos(wobble * 0.9) * 0.6,
      );
      dummy.scale.setScalar(occupancy.forager.size);
      dummy.rotation.set(0, wobble * 0.4, 0);
      dummy.updateMatrix();
      instanced.setMatrixAt(drawn, dummy.matrix);

      drawn += 1;
    }

    /**
     * Park the rest at zero scale.
     *
     * An instance the loop never writes keeps its identity matrix, which draws a
     * unit box at the world origin. The ambient cohorts learned this the hard
     * way and left a small pile of debris in the middle of the park; here the
     * count changes every few seconds, so it would be a pile that grew and
     * shrank.
     */
    for (let i = drawn; i < capacity; i += 1) {
      dummy.position.set(0, -1000, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, capacity]}
      frustumCulled={false}
      key={capacity}
      ref={mesh}
    />
  );
}
