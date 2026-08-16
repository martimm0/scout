"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from "three";

import { useGameStore } from "../state/game-store";
import { MAX_MARKS, marksIn } from "../world/marks";
import { activePark, terrainHeight } from "../world/terrain";

/**
 * Where somebody said the good forage was.
 *
 * A dance puts a mark on the map, and a mark you cannot see from the air is a
 * list of coordinates, which is not how anybody finds a flower. So each one is
 * a tall thin column of light standing over the patch: visible across the park,
 * unmistakably not a plant, and cheap.
 *
 * Additive and unlit on purpose. It is a note left on the world rather than a
 * thing in it, and a mark that took shadow would read as a structure somebody
 * had built in the meadow.
 */

/** How tall the column stands, in world units. An oak is about eighty. */
const HEIGHT = 130;

export function PatchMarks() {
  const mesh = useRef<InstancedMesh>(null);
  const marks = useGameStore((state) => state.marks);

  /**
   * No clock in render at all.
   *
   * The obvious shape is to filter the expired ones out during render and size
   * the pool to what is left, and it is wrong twice: reading `Date.now()` in
   * render is impure, and setting it from an effect to work around that is a
   * setState-in-effect. Both are lint errors and both are lint errors for good
   * reasons.
   *
   * So the pool is a constant. `MAX_MARKS` is twelve, which is nothing, and the
   * frame loop (where a clock is perfectly fine to read) decides which of them
   * are live and parks the rest out of sight.
   */
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#ffe9a8",
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
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

    const time = frame.clock.elapsedTime;

    /**
     * The park being FLOWN, from the world, not `state.currentPark`.
     *
     * They disagree in a garden party: the save still names your own park while
     * you are standing in the room's. Marks are recorded against the park you
     * are actually in, so filtering by the save's meant a party drew none of
     * them, and a dance shared with nine other people put a column of light on
     * nobody's screen including your own.
     */
    const live = marksIn(marks, activePark().id, Date.now());

    for (let i = 0; i < MAX_MARKS; i += 1) {
      const mark = live[i];

      if (!mark) {
        // Parked below the world at zero scale. An instance the loop leaves
        // alone keeps its identity matrix and draws a unit box at the origin,
        // which here would be a small bright cube in the middle of the park.
        dummy.position.set(0, -10_000, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const ground = terrainHeight(mark.x, mark.z);

      // A slow breathe, so it reads as a signal rather than as scenery.
      const pulse = 0.85 + Math.sin(time * 1.4 + i) * 0.15;

      dummy.position.set(mark.x, ground + HEIGHT / 2, mark.z);
      dummy.scale.set(2.4 * pulse, HEIGHT, 2.4 * pulse);
      dummy.rotation.set(0, time * 0.25 + i, 0);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, MAX_MARKS]}
      frustumCulled={false}
      ref={mesh}
    />
  );
}
