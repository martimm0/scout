"use client";

/* eslint-disable react-hooks/immutability --
 * Same as weather.tsx: this is a particle system, a fixed pool of motes the
 * frame loop writes to sixty times a second, and it is deliberately not on
 * React's render path. Copying the pool every frame to satisfy the rule would
 * allocate to change nothing. The pool is built once in a ref and mutated in
 * place, which is the whole design. */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { Group } from "three";

export type TrailKind = "pollen" | "sparkle" | "none";

/**
 * What trail this is, from whatever string carries it.
 *
 * The picker sets bare ids ("pollen", "sparkle", "none"), but a save written
 * before this feature, or a starter from before the ids were tidied, may carry
 * a flavour string ("soft pollen", "silver dash", "petal shimmer"). Read the
 * intent out of the words rather than demanding an exact match, so an old bee
 * still trails something.
 */
export function trailKind(effect: string): TrailKind {
  const value = effect.toLowerCase();

  if (value.includes("none")) {
    return "none";
  }

  if (/spark|shimmer|dash|silver|petal|glitter/.test(value)) {
    return "sparkle";
  }

  return "pollen";
}

const POOL = 64;

/**
 * The trail behind a pollinator.
 *
 * It is a sibling of the model, not a child, on purpose: the motes are dropped
 * into WORLD space at the bee and then left there, so flying away from them is
 * what makes the trail. A child would carry them along and there would be no
 * trail at all, only a cloud pinned to the bee.
 *
 * Pollen sinks and fades; sparkle rises and twinkles. Both take the player's
 * chosen `color`. A successful pollination (`burst`) throws a quick puff of the
 * same colour, so the trail and the celebration are the one gesture.
 */
export function PollinatorTrail({
  burst = 0,
  color,
  effect,
  scale = 1,
  sourceRef,
}: {
  /** Bumped on a successful pollination; each change puffs a burst. */
  burst?: number;
  color: string;
  effect: string;
  /** The preview model is scaled up; size the motes to match. */
  scale?: number;
  sourceRef: RefObject<Group | null>;
}) {
  const kind = trailKind(effect);
  const mesh = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        depthWrite: false,
        opacity: kind === "sparkle" ? 0.95 : 0.8,
        transparent: true,
      }),
    [kind],
  );

  // Follow the player's chosen colour without rebuilding the material.
  useEffect(() => {
    material.color.set(color);
  }, [material, color]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // A calmer trail for anyone who has asked for less motion: the twinkle stops.
  const reduced = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => (reduced.current = query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The pool, and where it last emitted from. Built once, mutated in place.
  const pool = useMemo(
    () => ({
      pos: new Float32Array(POOL * 3),
      age: new Float32Array(POOL).fill(999),
      life: new Float32Array(POOL),
      seed: new Float32Array(POOL),
      cursor: 0,
      last: new THREE.Vector3(),
      sinceEmit: 0,
      primed: false,
    }),
    [],
  );

  // A burst is a level change, not a per-frame value, so latch it and let the
  // next frame (which knows where the bee is) throw the puff.
  const pendingBurst = useRef(false);
  const lastBurst = useRef(burst);
  useEffect(() => {
    if (burst !== lastBurst.current) {
      lastBurst.current = burst;
      pendingBurst.current = true;
    }
  }, [burst]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const here = useMemo(() => new THREE.Vector3(), []);

  const emit = (x: number, y: number, z: number, life: number) => {
    const i = pool.cursor;
    const j = i * 3;
    pool.pos[j] = x;
    pool.pos[j + 1] = y;
    pool.pos[j + 2] = z;
    pool.age[i] = 0;
    pool.life[i] = life;
    pool.seed[i] = Math.random() * Math.PI * 2;
    pool.cursor = (i + 1) % POOL;
  };

  useFrame((frame, delta) => {
    const instanced = mesh.current;
    const source = sourceRef.current;

    if (!instanced || !source) {
      return;
    }

    source.getWorldPosition(here);
    const step = Math.min(delta, 0.05);
    const time = frame.clock.elapsedTime;

    // Don't lay a streak from the origin to wherever the bee spawned.
    if (!pool.primed) {
      pool.last.copy(here);
      pool.primed = true;
    }

    const sparkle = kind === "sparkle";

    // A puff of the trail colour when a flower takes: a small sphere of motes
    // that live a touch longer than the trail itself.
    if (pendingBurst.current) {
      pendingBurst.current = false;
      for (let k = 0; k < 18; k += 1) {
        const dir = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.2,
          Math.random() - 0.5,
        )
          .normalize()
          .multiplyScalar((0.18 + Math.random() * 0.3) * scale);
        emit(here.x + dir.x, here.y + dir.y, here.z + dir.z, 1.1);
      }
    }

    // Emit along the path: by distance when moving, on a slow clock when
    // hovering, so a still bee still shows what its trail looks like.
    pool.sinceEmit += step;
    const moved = here.distanceTo(pool.last);

    if (moved >= 0.32 * scale || pool.sinceEmit >= 0.12) {
      emit(
        here.x + (Math.random() - 0.5) * 0.18 * scale,
        here.y - 0.1 * scale + (Math.random() - 0.5) * 0.14 * scale,
        here.z + (Math.random() - 0.5) * 0.18 * scale,
        (sparkle ? 0.6 : 0.85) * (0.8 + Math.random() * 0.5),
      );
      pool.last.copy(here);
      pool.sinceEmit = 0;
    }

    const baseSize = (sparkle ? 0.15 : 0.13) * scale;
    const rise = sparkle ? 0.35 : -0.5;

    for (let i = 0; i < POOL; i += 1) {
      const j = i * 3;
      pool.age[i] += step;
      const life = pool.life[i];
      const t = life > 0 ? pool.age[i] / life : 1;

      if (t >= 1) {
        // Dead: park it out of sight at zero size.
        dummy.position.set(0, -9999, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const wobble = 0.03;
      const px = pool.pos[j] + Math.sin(time * 1.5 + pool.seed[i]) * wobble;
      const py = pool.pos[j + 1] + rise * pool.age[i];
      const pz = pool.pos[j + 2] + Math.cos(time * 1.3 + pool.seed[i]) * wobble;

      // Fade by shrinking, which reads as motes dissipating. Sparkle twinkles
      // on top, unless motion has been dialled down.
      let size = baseSize * (1 - t);
      if (sparkle && !reduced.current) {
        size *= 0.6 + 0.4 * Math.abs(Math.sin(time * 22 + pool.seed[i]));
      }

      dummy.position.set(px, py, pz);
      dummy.scale.setScalar(Math.max(0, size));
      dummy.rotation.set(
        pool.seed[i],
        time * (sparkle ? 3 : 0.6) + pool.seed[i],
        0,
      );
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  });

  // "Fly clean" means nothing to draw.
  if (kind === "none") {
    return null;
  }

  return (
    <instancedMesh
      args={[geometry, material, POOL]}
      frustumCulled={false}
      ref={mesh}
    />
  );
}
