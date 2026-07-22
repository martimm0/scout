"use client";

// Like the trail and the weather, each cohort is a fixed pool of instances the
// frame loop writes to sixty times a second, held in a ref and mutated in place
// off React's render path. That is the whole design.

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { AMBIENT_COHORTS, type AmbientCohort } from "../data/ambient";
import type { Daylight } from "../world/daylight";
import { hash } from "../world/park";
import { terrainHeight, world } from "../world/terrain";
import type { Weather } from "../world/weather";

/**
 * The living park.
 *
 * One instanced mesh per cohort that is out right now. Each is deterministic:
 * homes are seeded from `hash` so the same bees are over the same meadow every
 * visit, and the motion is a function of the clock and a per-instance offset,
 * never `Math.random`, so nothing pops or teleports between frames.
 *
 * It is a sibling of the bee and the trail, in world space, and it reads nothing
 * back from the player: ambience does not chase you.
 */
export function AmbientLife({
  daylight,
  weather,
}: {
  daylight: Daylight;
  weather: Weather;
}) {
  return (
    <>
      {AMBIENT_COHORTS.filter((cohort) =>
        cohort.active(daylight.phase, weather),
      ).map((cohort) => (
        <Cohort cohort={cohort} key={cohort.id} />
      ))}
    </>
  );
}

/** A stable seed per cohort, so its homes do not move when others come and go. */
function seedOf(id: string): number {
  let h = 2166136261;

  for (let i = 0; i < id.length; i += 1) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }

  return h >>> 0;
}

function Cohort({ cohort }: { cohort: AmbientCohort }) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: cohort.color,
        transparent: true,
        // Fireflies glow: they add their light to the night rather than sitting
        // on it as a flat chip. The others are just small bodies.
        blending:
          cohort.kind === "firefly"
            ? THREE.AdditiveBlending
            : THREE.NormalBlending,
        depthWrite: cohort.kind !== "firefly",
        opacity: cohort.kind === "pollinator" ? 0.9 : 1,
      }),
    [cohort.color, cohort.kind],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Calmer for anyone who has asked for less motion: the firefly twinkle steadies
  // and everything drifts a little more slowly.
  const reduced = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => (reduced.current = query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Homes and per-instance phase, seeded once. A home is where an instance lives;
  // it wanders around it rather than roaming the whole park, which keeps a meadow
  // of foragers a meadow rather than a swarm crossing the map.
  const homes = useMemo(() => {
    const seed = seedOf(cohort.id);
    const bounds = world();
    const out: {
      x: number;
      z: number;
      phase: number;
      radius: number;
      band: number;
    }[] = [];

    for (let i = 0; i < cohort.count; i += 1) {
      const hx = hash(i + seed, seed);
      const hz = hash(seed, i + seed);
      const hp = hash(i + seed, i + seed);

      out.push({
        x: bounds.minX + hx * (bounds.maxX - bounds.minX),
        z: bounds.minZ + hz * (bounds.maxZ - bounds.minZ),
        phase: hp * Math.PI * 2,
        // Birds circle wide; foragers and fireflies keep a small patch.
        radius:
          cohort.kind === "bird" ? 40 + hp * 40 : 3 + hp * (cohort.size * 8),
        band: cohort.band[0] + hp * (cohort.band[1] - cohort.band[0]),
      });
    }

    return out;
  }, [cohort]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((frame) => {
    const instanced = mesh.current;

    if (!instanced) {
      return;
    }

    const time = frame.clock.elapsedTime;
    const slow = reduced.current ? 0.5 : 1;

    for (let i = 0; i < homes.length; i += 1) {
      const home = homes[i];
      const t = time * slow * (cohort.speed / 20) + home.phase;

      let x = home.x;
      let z = home.z;
      let y = home.band;
      let size = cohort.size;

      if (cohort.kind === "bird") {
        // A slow, wide circle high over the park, banking into the turn.
        x = home.x + Math.cos(t) * home.radius;
        z = home.z + Math.sin(t) * home.radius;
        y = home.band + Math.sin(t * 0.5) * 6;
      } else if (cohort.kind === "firefly") {
        // Drift a little and rise, then settle: the lazy bob of a firefly, kept
        // just above whatever ground it is over.
        x = home.x + Math.sin(t * 0.7 + home.phase) * home.radius;
        z = home.z + Math.cos(t * 0.6 + home.phase) * home.radius;
        const ground = terrainHeight(x, z);
        y = ground + home.band + Math.sin(t + home.phase) * 3;
        // The twinkle: a slow pulse so the meadow blinks rather than glows flat.
        // It never dips all the way out, or half the field vanishes in any given
        // frame and the dark looks empty instead of full of quiet lights.
        const pulse = reduced.current
          ? 0.8
          : 0.4 + 0.6 * Math.pow(Math.max(0, Math.sin(t * 1.6 + home.phase)), 2);
        size = cohort.size * pulse;
      } else {
        // A forager, wandering its patch a bloom's height off the ground.
        x = home.x + Math.sin(t + home.phase) * home.radius;
        z = home.z + Math.cos(t * 1.3 + home.phase) * home.radius;
        const ground = terrainHeight(x, z);
        y = ground + home.band * 0.5 + Math.sin(t * 2 + home.phase) * 2;
      }

      dummy.position.set(x, y, z);

      if (cohort.kind === "bird") {
        // Wide and flat: a silhouette with a wingspan, turned along its arc.
        dummy.scale.set(cohort.size, cohort.size * 0.28, cohort.size * 0.7);
        dummy.rotation.set(0, -t, 0);
      } else {
        dummy.scale.setScalar(Math.max(0, size));
        dummy.rotation.set(0, t, 0);
      }

      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, cohort.count]}
      frustumCulled={false}
      ref={mesh}
    />
  );
}
