import {
  MeshLambertMaterial,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from "three";

import { latticeOf, type Lattice } from "../models/lattice";
import type { Quality } from "../models/quality";
import { sway as swayLambert, wind } from "./wind";

/**
 * What a thing in the park is made of, and so how light behaves on it.
 *
 * Low and High draw everything with one flat, matte material: the colour baked
 * into the model, lit by the sun and nothing else. That is the look, and it is
 * cheap. Ultra keeps the same blocks and the same colours and changes only how
 * they answer the light, with four things a real model on a table would do:
 *
 * - **A surface.** Every material has a roughness. Wax and water shine, bark
 *   and soil do not, and all of them now reflect the sky they sit under.
 * - **Blocks with edges.** The corner of a real block is never perfectly
 *   sharp: it is very slightly rounded, and that rounding is what catches the
 *   light. The edges of every voxel are bevelled here in the shader, by
 *   leaning the surface direction over as it nears the edge of its cell, so
 *   a wall of blocks glints along its seams without one more triangle.
 * - **Blocks within blocks.** The same cell arithmetic can cut each voxel
 *   into smaller ones (`split`) and give each its own very slight tone, so
 *   the ground and the trunks read as built from finer pieces than they are.
 * - **Light through thin things.** A leaf or a petal with the sun behind it
 *   glows. Thick things do not.
 *
 * All of it fades out with distance, measured in pixels: a bevel narrower than
 * a pixel is only shimmer.
 */
export type Look = {
  /** 0 is a mirror, 1 is chalk. */
  roughness: number;
  /** How much of the sky it reflects. Soil reflects very little of anything. */
  sky?: number;
  /** How strongly the block edges are bevelled. Zero for none. */
  bevel?: number;
  /** How much each block differs in tone from the next. */
  grain?: number;
  /** Each voxel drawn as this many smaller ones along every edge. */
  split?: number;
  /** How much of the sun comes through from behind: leaves and petals. */
  translucency?: number;
  /** The model's own height and how far its top travels in the wind. */
  sway?: [height: number, amount: number, speed?: number];
};

const VERTEX_HEADER = /* glsl */ `
  uniform float uWindTime;
  uniform float uWindStrength;
  uniform float uSwayHeight;
  uniform float uSwayAmount;
  uniform float uSwaySpeed;
  uniform vec3 uBlockSize;
  uniform vec3 uBlockOffset;
  varying vec2 vBlockUV;
  varying vec3 vBlockCell;
  varying vec3 vBlockU;
  varying vec3 vBlockV;
`;

const SWAY = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 swayRoot = instanceMatrix[3].xyz;
  #else
    vec3 swayRoot = modelMatrix[3].xyz;
  #endif
  float swayPhase = swayRoot.x * 0.137 + swayRoot.z * 0.171;
  float swayLift = clamp(transformed.y / uSwayHeight, 0.0, 1.2);
  float swayBend = swayLift * swayLift * uSwayHeight * uSwayAmount * uWindStrength;
  float swayBeat = uWindTime * uSwaySpeed + swayPhase;
  transformed.x += (sin(swayBeat) + 0.4 * sin(swayBeat * 2.3 + 1.7)) * swayBend;
  transformed.z += cos(swayBeat * 0.8) * swayBend * 0.6;
`;

/**
 * Where on its block each point of a face is.
 *
 * Every face of a voxel model points straight along one axis, so the other two
 * axes are the face's own, and a point's position along them, in cells, says
 * how near it is to the edge of its block. Taken from the model as it was
 * built, before the wind moves it, or the blocks would slide over the leaves.
 */
const BLOCK_VERTEX = /* glsl */ `
  vec3 blockPosition = position / uBlockSize + uBlockOffset;
  vec3 blockU = abs(normal.yzx);
  vec3 blockV = abs(normal.zxy);
  vBlockUV = vec2(dot(blockPosition, blockU), dot(blockPosition, blockV));
  vBlockCell = blockPosition - normal * 0.5;
  #ifdef USE_INSTANCING
    blockU = mat3(instanceMatrix) * blockU;
    blockV = mat3(instanceMatrix) * blockV;
  #endif
  vBlockU = normalize(normalMatrix * blockU);
  vBlockV = normalize(normalMatrix * blockV);
`;

const FRAGMENT_HEADER = /* glsl */ `
  uniform float uBevel;
  uniform float uGrain;
  uniform float uTranslucency;
  varying vec2 vBlockUV;
  varying vec3 vBlockCell;
  varying vec3 vBlockU;
  varying vec3 vBlockV;
`;

const BLOCK_COLOR = /* glsl */ `
  vec2 blockAt = fract(vBlockUV);
  vec2 blockEdge = min(blockAt, 1.0 - blockAt);
  // Gone by the time a block is a few pixels across: finer than that it is noise.
  vec2 blockPixels = fwidth(vBlockUV);
  float blockFade = 1.0 - smoothstep(0.07, 0.24, max(blockPixels.x, blockPixels.y));
  float blockTone = fract(sin(dot(floor(vBlockCell), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  diffuseColor.rgb *= 1.0 + (blockTone - 0.5) * uGrain * blockFade;
  // The seam between two blocks is a crack, and a crack is dark.
  float blockSeam = 1.0 - smoothstep(0.0, 0.05, min(blockEdge.x, blockEdge.y));
  diffuseColor.rgb *= 1.0 - blockSeam * 0.22 * blockFade * step(0.001, uBevel);
`;

const BLOCK_NORMAL = /* glsl */ `
  vec2 blockLean = (1.0 - smoothstep(0.0, 0.16, blockEdge)) * sign(blockAt - 0.5) * (uBevel * blockFade);
  normal = normalize(normal + blockLean.x * vBlockU + blockLean.y * vBlockV);
`;

const BLOCK_ROUGHNESS = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor + (blockTone - 0.5) * 0.18 * blockFade, 0.04, 1.0);
`;

/** The sun, seen through a leaf from behind. The first directional light is the sun. */
const THROUGH = /* glsl */ `
  #if NUM_DIR_LIGHTS > 0
    vec3 throughSun = directionalLights[0].direction;
    float throughBack = max(dot(-geometryNormal, throughSun), 0.0);
    float throughGlow = pow(max(dot(-geometryViewDir, throughSun), 0.0), 4.0);
    reflectedLight.directDiffuse +=
      directionalLights[0].color * material.diffuseColor * RECIPROCAL_PI *
      ((throughBack * 0.55 + throughGlow * 0.9) * uTranslucency);
  #endif
`;

type Patch = Pick<MeshStandardMaterial, "customProgramCacheKey" | "onBeforeCompile">;

function ultraPatch(look: Look, lattice: Lattice): Patch {
  const split = look.split ?? 1;
  const swaying = Boolean(look.sway);
  const uniforms = {
    uWindTime: wind.time,
    uWindStrength: wind.strength,
    uSwayHeight: { value: look.sway?.[0] ?? 1 },
    uSwayAmount: { value: look.sway?.[1] ?? 0 },
    uSwaySpeed: { value: look.sway?.[2] ?? 1.3 },
    uBlockSize: { value: new Vector3(...lattice.size).divideScalar(split) },
    uBlockOffset: { value: new Vector3(...lattice.offset).multiplyScalar(split) },
    uBevel: { value: look.bevel ?? 0 },
    uGrain: { value: look.grain ?? 0 },
    uTranslucency: { value: look.translucency ?? 0 },
  };

  return {
    onBeforeCompile(shader: WebGLProgramParametersWithUniforms) {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_HEADER}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${BLOCK_VERTEX}\n${swaying ? SWAY : ""}`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_HEADER}`)
        .replace("#include <color_fragment>", `#include <color_fragment>\n${BLOCK_COLOR}`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${BLOCK_ROUGHNESS}`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${BLOCK_NORMAL}`)
        .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${THROUGH}`);
    },
    // One program for the swaying and one for the still: everything else is uniforms.
    customProgramCacheKey: () => (swaying ? "scout-ultra-sway" : "scout-ultra"),
  };
}

/**
 * The props that make a standard material one of the park's, on Ultra.
 *
 * For the meshes that declare their material in JSX and need to set other
 * things on it too (a glow, a tint): spread these onto a `meshStandardMaterial`.
 */
export function ultraProps(look: Look, geometry?: BufferGeometry) {
  return {
    ...ultraPatch(look, latticeOf(geometry)),
    envMapIntensity: look.sky ?? 1,
    metalness: 0,
    roughness: look.roughness,
    vertexColors: true,
  };
}

/**
 * A material for one of the park's vertex-coloured models.
 *
 * The plain matte one on Low and High, exactly as before, swaying if asked to.
 * On Ultra, the same colours on a physically based surface. `geometry` is
 * where the block edges come from; without it the blocks are
 * taken to be one unit across, which is right for nothing, so pass it.
 * (Each builder records its lattice on what it returns: `models/lattice.ts`.)
 */
export function surface(quality: Quality, look: Look, geometry?: BufferGeometry): Material {
  if (quality !== "ultra") {
    const lambert = new MeshLambertMaterial({ vertexColors: true });

    return look.sway ? swayLambert(lambert, look.sway[0], look.sway[1], look.sway[2]) : lambert;
  }

  return Object.assign(new MeshStandardMaterial(), ultraProps(look, geometry));
}

/**
 * How each kind of thing answers the light. Roughness first; the rest is how
 * much of a block it looks like and whether the sun comes through it.
 */
export const LOOKS = {
  /** Turf and soil: matte, and built of blocks a quarter the size of its columns. */
  ground: { roughness: 0.96, sky: 0.45, bevel: 0.5, grain: 0.1, split: 4 },
  /** A canopy: leaves let the sun through, bark does not, and they share a mesh. */
  tree: { roughness: 0.84, sky: 0.6, bevel: 0.55, grain: 0.08, split: 2, translucency: 0.5 },
  /** Grass and the small soft plants underfoot. */
  blade: { roughness: 0.72, sky: 0.7, bevel: 0.35, grain: 0.05, translucency: 0.9 },
  /** Rock, logs, stumps, pebbles. */
  hard: { roughness: 0.9, sky: 0.6, bevel: 0.6, grain: 0.1, split: 2 },
  /** A flower: waxy petals that glow when the sun is behind them. */
  flower: { roughness: 0.52, bevel: 0.5, grain: 0.03, translucency: 1 },
  /** A fungus: wet and waxy, and too thick to see through. */
  fungus: { roughness: 0.36, bevel: 0.55, grain: 0.05, translucency: 0.25 },
  /** A building: dressed stone and timber. */
  built: { roughness: 0.86, sky: 0.7, bevel: 0.6, grain: 0.07, split: 2 },
} satisfies Record<string, Look>;
