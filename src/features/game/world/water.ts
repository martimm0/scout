import {
  DataTexture,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RedFormat,
  UnsignedByteType,
  Vector2,
  type Material,
} from "three";

import type { Quality } from "../models/quality";
import { GROUND_COLUMN, columnTop, waterLevel, world } from "./terrain";
import { ripple, wind } from "./wind";

/** How deep, in world units, counts as fully deep water. */
const DEEP = 9;

/**
 * How deep the water is over every column of the park's ground, as a picture
 * the water's shader can look things up in: one texel a column, black at the
 * bank and white where the bed is `DEEP` or more under the surface.
 *
 * Read off the ground as it is DRAWN (`columnTop`), so the shallows are exactly
 * the columns that stand just under the surface.
 */
function depthMap() {
  const { minX, minZ, maxX, maxZ } = world();
  const columns = Math.ceil((maxX - minX) / GROUND_COLUMN);
  const rows = Math.ceil((maxZ - minZ) / GROUND_COLUMN);
  const data = new Uint8Array(columns * rows);
  const surface = waterLevel();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const depth =
        surface - columnTop(minX + (column + 0.5) * GROUND_COLUMN, minZ + (row + 0.5) * GROUND_COLUMN);

      data[row * columns + column] = Math.round(Math.min(1, Math.max(0, depth / DEEP)) * 255);
    }
  }

  const texture = new DataTexture(data, columns, rows, RedFormat, UnsignedByteType);

  // Blocks of water, not a gradient: each column is its own depth.
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;

  return { texture, span: new Vector2(columns * GROUND_COLUMN, rows * GROUND_COLUMN) };
}

/**
 * The creek.
 *
 * On Low and High it is the blocky rippling sheet (`ripple`). On Ultra it is
 * still one sheet, cut into the same two-unit blocks, but each block is now
 * water:
 *
 * - **It reflects.** Every block is tilted a few degrees by the two waves that
 *   used to switch its glint on and off, so the sky and the sun break across
 *   the run in facets instead of one mirror.
 * - **It has depth.** Clear and green over the shallows, where the bed shows
 *   through, and dark and opaque over the deep, read from `depthMap`.
 * - **It foams at the bank.** The blocks standing in the thinnest water turn
 *   white and back, a block at a time.
 * - **It is a mirror from the side.** Like any water, looked at along its
 *   surface it shows only the sky, and looked down into it shows the bed.
 */
export function waterMaterial(quality: Quality): { material: Material; dispose: () => void } {
  if (quality !== "ultra") {
    const material = ripple(new MeshLambertMaterial({ color: "#4f9ac4", opacity: 0.86, transparent: true }));

    return { material, dispose: () => material.dispose() };
  }

  const depth = depthMap();
  const material = new MeshStandardMaterial({
    envMapIntensity: 1.15,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uWaterFlow: wind.flow,
      uWaterCell: { value: GROUND_COLUMN },
      uWaterDepth: { value: depth.texture },
      uWaterMin: { value: new Vector2(world().minX, world().minZ) },
      uWaterSpan: { value: depth.span },
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWaterXZ;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vWaterXZ;
        uniform float uWaterFlow;
        uniform float uWaterCell;
        uniform sampler2D uWaterDepth;
        uniform vec2 uWaterMin;
        uniform vec2 uWaterSpan;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 waterCell = floor((vWaterXZ - uWaterMin) / uWaterCell);
        float waterDeep = texture2D(uWaterDepth, (waterCell + 0.5) * uWaterCell / uWaterSpan).r;
        float waterA = sin(waterCell.x * 0.61 + waterCell.y * 0.27 + uWaterFlow * 1.1);
        float waterB = sin(waterCell.x * 0.23 - waterCell.y * 0.71 + uWaterFlow * 0.7 + 2.0);
        diffuseColor.rgb = mix(vec3(0.2, 0.46, 0.38), vec3(0.02, 0.1, 0.15), smoothstep(0.0, 0.8, waterDeep));
        // The thinnest water, a block at a time, coming and going.
        float waterFoam = step(waterDeep, 0.115 + 0.05 * waterA) * step(0.001, waterDeep);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.93, 0.94), waterFoam * 0.8);
        diffuseColor.a = max(mix(0.42, 0.94, smoothstep(0.0, 0.7, waterDeep)), waterFoam * 0.9);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.7, waterFoam);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 waterEast = normalize(mat3(viewMatrix) * vec3(1.0, 0.0, 0.0));
        vec3 waterSouth = normalize(mat3(viewMatrix) * vec3(0.0, 0.0, 1.0));
        normal = normalize(normal + (waterA * waterEast + waterB * waterSouth) * 0.11 * (1.0 - waterFoam));
        // From the side water is a mirror; from above you see into it.
        float waterGlance = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 4.0);
        diffuseColor.a = mix(diffuseColor.a, 1.0, waterGlance);`,
      );
  };
  material.customProgramCacheKey = () => "scout-ultra-water";

  return {
    material,
    dispose: () => {
      material.dispose();
      depth.texture.dispose();
    },
  };
}
