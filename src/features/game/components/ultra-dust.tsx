"use client";

import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, PointsMaterial } from "three";

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
    <points frustumCulled={false} geometry={geometry} renderOrder={3} visible={clear > 0.02}>
      <primitive attach="material" object={material} opacity={0.55 * clear} />
    </points>
  );
}
