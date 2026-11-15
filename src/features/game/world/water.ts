import {
  DataTexture,
  Matrix4,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
  Vector2,
  type Camera,
  type Material,
  type ShaderMaterial,
  type Texture,
} from "three";

import { Reflector } from "three/examples/jsm/objects/Reflector.js";

import type { Quality } from "../models/quality";
import { air } from "./air";
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
 *   surface it shows what is across it, and looked down into it shows the bed.
 *   What it shows is the park itself, upside down: `mirror` is a picture of
 *   the scene taken from under the surface each frame (see `ultra-water.tsx`),
 *   and each block looks into it at its own slight angle.
 * - **Rain lands on it.** Blocks here and there kick to a new angle and back.
 * - **Mist lies on it**, as on the low ground beside it.
 */
export type Mirror = { texture: Texture; matrix: Matrix4 };

export function waterMaterial(
  quality: Quality,
  mirror?: Mirror,
): { material: Material; dispose: () => void } {
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
      uMirror: { value: mirror?.texture ?? null },
      uMirrorMatrix: { value: mirror?.matrix ?? new Matrix4() },
      uMirrorOn: { value: mirror ? 1 : 0 },
      uAirWet: air.wet,
      uAirMist: air.mist,
      uAirMistColor: air.mistColor,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vWaterXZ;\nvarying vec4 vMirrorAt;\nuniform mat4 uMirrorMatrix;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
        vMirrorAt = uMirrorMatrix * vec4(position, 1.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vWaterXZ;
        varying vec4 vMirrorAt;
        uniform sampler2D uMirror;
        uniform float uMirrorOn;
        uniform float uAirWet;
        uniform float uAirMist;
        uniform vec3 uAirMistColor;
        float waterHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
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
        vec2 waterTilt = vec2(waterA, waterB) * 0.11 * (1.0 - waterFoam);
        // Rain: a block here and there is knocked to a new angle for a moment.
        float waterBeat = floor(uWaterFlow * 3.0 + waterHash(waterCell) * 9.0);
        float waterStruck = step(0.84, waterHash(waterCell + waterBeat)) * uAirWet;
        waterTilt += (vec2(waterHash(waterCell + 1.0), waterHash(waterCell + 2.0)) - 0.5) * 0.5 * waterStruck;
        normal = normalize(normal + waterTilt.x * waterEast + waterTilt.y * waterSouth);
        // From the side water is a mirror; from above you see into it.
        float waterGlance = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 4.0);
        diffuseColor.a = mix(diffuseColor.a, 1.0, waterGlance);`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        // The park, upside down, seen by each block at its own slight angle.
        vec4 mirrorAt = vMirrorAt;
        mirrorAt.xy += waterTilt * mirrorAt.w * 0.24;
        vec3 mirrorSeen = texture2DProj(uMirror, mirrorAt).rgb;
        float mirrorShare = 0.06 + 0.94 * pow(1.0 - saturate(dot(normal, geometryViewDir)), 4.0);
        reflectedLight.indirectSpecular = mix(
          reflectedLight.indirectSpecular,
          mirrorSeen * mirrorShare * (1.0 - waterFoam * 0.8),
          uMirrorOn
        );`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        #ifdef USE_FOG
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uAirMistColor, uAirMist * (1.0 - exp(-vFogDepth * 0.009)) * 0.6);
        #endif`,
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

/** The layer for what the water does not bother to reflect: see `creek`. */
export const UNREFLECTED = 1;
/** And the layer for what only the water sees: the cheap trees it reflects instead. */
export const REFLECTED_ONLY = 2;

/**
 * The creek as a thing to put in the scene.
 *
 * On Low and High, a material for the flat sheet. On Ultra, the sheet itself:
 * it is a mirror, in three's sense, which is a mesh that before it is drawn
 * takes a picture of the scene from underneath its own surface. That picture
 * is what the water's blocks reflect. The mirror's own flat material is thrown
 * away and the water's put in its place.
 *
 * The picture is a second drawing of the park, and drawn as it stands it cost
 * as much as the whole of High does. So it is drawn cheaply. The grass, the
 * flowers and the small stuff are on a layer of their own (`UNREFLECTED`) that
 * the camera under the water does not look at, and so are the trees, which
 * are most of the triangles in the park. In their place that camera sees the
 * coarse stand-ins the sun already uses to throw the trees' shadows
 * (`REFLECTED_ONLY`), which in a reflection broken into two-unit blocks are
 * the same trees. The ground and the buildings it sees as they are.
 */
export function creek(quality: Quality, width: number, depth: number) {
  if (quality !== "ultra") {
    return { ...waterMaterial(quality), mirror: null };
  }

  const mirror = new Reflector(new PlaneGeometry(width, depth), {
    clipBias: 0.02,
    multisample: 0,
    textureHeight: 640,
    textureWidth: 1024,
  });
  const plain = mirror.material as ShaderMaterial;
  const water = waterMaterial(quality, {
    matrix: plain.uniforms.textureMatrix.value as Matrix4,
    texture: mirror.getRenderTarget().texture,
  });

  mirror.material = water.material;

  // The mirror looks through a copy of the main camera, layers and all, which
  // would have it see exactly what it is meant to leave out. It is handed the
  // right ones each time it asks for its camera.
  // (That method is three's own and not in its types. If it ever goes, the
  // mirror still works: it just reflects more than it needs to.)
  const inner = mirror as unknown as { _getReflectionCamera?: (camera: Camera) => Camera };
  const cameraFor = inner._getReflectionCamera;

  if (cameraFor) {
    inner._getReflectionCamera = function reflectionCamera(camera: Camera) {
      const under = cameraFor.call(this, camera);

      under.layers.mask = (1 << 0) | (1 << REFLECTED_ONLY);

      return under;
    };
  }

  return {
    material: water.material,
    mirror,
    dispose: () => {
      water.dispose();
      plain.dispose();
      mirror.geometry.dispose();
      mirror.getRenderTarget().dispose();
    },
  };
}
