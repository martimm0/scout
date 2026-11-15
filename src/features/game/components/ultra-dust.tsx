"use client";

import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, PointsMaterial } from "three";

import { UNREFLECTED } from "../world/water";
import { wind } from "../world/wind";

/**
 * Pollen and dust, in the light. Ultra only.
 *
 * Air is not empty, and on a bright day you can see that it is not: specks
 * hang in it and catch the sun. There are a few hundred of them here, in a box
 * of air that travels with the camera. Each is a fixed point that drifts on
 * the wind and wraps round when it leaves the box, all of it worked out on the
 * graphics card, so they cost the same whether the bee is still or flying. The
 * near ones sit inside the lens's blur and come out as soft discs, which is
 * the only reason a photograph of a meadow ever sparkles.
 *
 * Square, because everything is. On the water's clock (`wind.flow`), so they
 * hold still for anybody who has asked for less motion.
 */
const COUNT = 320;
const BOX = [46, 22, 46] as const;

export function UltraDust({ clear }: { clear: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    // A fixed scatter: the same specks every time, like every other scatter here.
    let seed = 7;
    const next = () => {
      seed = (seed * 16807) % 2147483647;

      return seed / 2147483647;
    };

    for (let index = 0; index < COUNT; index += 1) {
      positions[index * 3] = next() * BOX[0];
      positions[index * 3 + 1] = next() * BOX[1];
      positions[index * 3 + 2] = next() * BOX[2];
    }

    const points = new BufferGeometry();

    points.setAttribute("position", new BufferAttribute(positions, 3));

    return points;
  }, []);
  const material = useMemo(() => {
    const dust = new PointsMaterial({
      blending: AdditiveBlending,
      // Warm, and brighter than white: it is lit by the sun and it blooms.
      color: new Color("#fff0c8").multiplyScalar(1.5),
      depthWrite: false,
      fog: false,
      size: 0.13,
      sizeAttenuation: true,
      transparent: true,
    });

    dust.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uDustTime: wind.flow, uDustWind: wind.strength });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uDustTime;\nuniform float uDustWind;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec3 dustBox = vec3(${BOX[0].toFixed(1)}, ${BOX[1].toFixed(1)}, ${BOX[2].toFixed(1)});
          // Downwind, slowly, and each on a small wander of its own.
          vec3 dustDrift = vec3(0.9 + uDustWind * 2.4, 0.12, 0.35) * uDustTime;
          dustDrift += 0.6 * sin(position.yzx * 1.7 + uDustTime * 0.5);
          // Kept in a box of air round the camera: what leaves one side comes in at the other.
          transformed = mod(position + dustDrift - cameraPosition, dustBox) - dustBox * 0.5 + cameraPosition;`,
        );
    };
    dust.customProgramCacheKey = () => "scout-ultra-dust";

    return dust;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Never culled: the points are wherever the camera is, not where the buffer
  // says. And only what the sun can light: none at night, few under cloud.
  return (
    <points frustumCulled={false} geometry={geometry} layers={UNREFLECTED} renderOrder={3} visible={clear > 0.02}>
      <primitive attach="material" object={material} opacity={0.55 * clear} />
    </points>
  );
}

/**
 * Leaves, coming down. Ultra only.
 *
 * The same box of air as the dust, with bigger things in it that fall. A few
 * all summer, a great many in October, none once the trees are bare. Each
 * drops at its own rate and slides from side to side as it goes, and is one of
 * the handful of colours the canopy is that month. They wrap round at the
 * bottom of the box, so there are always the same number in the air.
 */
const LEAVES = 90;
const LEAF_BOX = [70, 34, 70] as const;

/** How hard the leaves are falling, 0 to 1, by the month (1 to 12, fractional). */
export function leafFall(month: number) {
  // A trickle from June, the peak in late October, over by December.
  const autumn = Math.max(0, 1 - Math.abs(month - 10.6) / 1.7);
  const summer = month > 5.5 && month < 12 ? 0.12 : 0;

  return Math.min(1, autumn + summer);
}

const LEAF_COLORS: Record<"green" | "turning", string[]> = {
  green: ["#6fa85a", "#86b866", "#5c9650"],
  turning: ["#d9992e", "#c9702a", "#b8452a", "#e0b84a", "#8a9a3a"],
};

export function UltraLeaves({ month }: { month: number }) {
  const falling = leafFall(month);
  const turning = month > 9.2;
  const geometry = useMemo(() => {
    const positions = new Float32Array(LEAVES * 3);
    const colors = new Float32Array(LEAVES * 3);
    const palette = LEAF_COLORS[turning ? "turning" : "green"].map((hex) => new Color(hex));
    let seed = 23;
    const next = () => {
      seed = (seed * 16807) % 2147483647;

      return seed / 2147483647;
    };

    for (let index = 0; index < LEAVES; index += 1) {
      positions[index * 3] = next() * LEAF_BOX[0];
      positions[index * 3 + 1] = next() * LEAF_BOX[1];
      positions[index * 3 + 2] = next() * LEAF_BOX[2];
      palette[Math.floor(next() * palette.length)].toArray(colors, index * 3);
    }

    const points = new BufferGeometry();

    points.setAttribute("position", new BufferAttribute(positions, 3));
    points.setAttribute("color", new BufferAttribute(colors, 3));

    return points;
  }, [turning]);
  const material = useMemo(() => {
    const leaf = new PointsMaterial({ size: 0.5, sizeAttenuation: true, vertexColors: true });

    leaf.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uLeafTime: wind.flow, uLeafWind: wind.strength });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uLeafTime;\nuniform float uLeafWind;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec3 leafBox = vec3(${LEAF_BOX[0].toFixed(1)}, ${LEAF_BOX[1].toFixed(1)}, ${LEAF_BOX[2].toFixed(1)});
          // Its own rate of fall, and its own side-to-side as it goes.
          float leafOwn = fract(position.x * 7.31 + position.z * 3.17);
          vec3 leafDrift = vec3(1.2 + uLeafWind * 5.0, -(1.6 + leafOwn * 1.8), 0.5) * uLeafTime;
          leafDrift.xz += vec2(sin(uLeafTime * (1.1 + leafOwn) + position.y), cos(uLeafTime * 0.9 + position.x)) * 1.3;
          transformed = mod(position + leafDrift - cameraPosition, leafBox) - leafBox * 0.5 + cameraPosition;`,
        );
    };
    leaf.customProgramCacheKey = () => "scout-ultra-leaves";

    return leaf;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Fewer of them when fewer are falling: the buffer is drawn from its start.
  const count = Math.round(LEAVES * falling);

  if (count === 0) {
    return null;
  }

  return (
    <points frustumCulled={false} layers={UNREFLECTED} material={material}>
      <primitive attach="geometry" drawRange={{ start: 0, count }} object={geometry} />
    </points>
  );
}
