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
import { air } from "./air";
import { sway as swayLambert, wind } from "./wind";

/**
 * What a thing in the park is made of, and so how light behaves on it.
 *
 * Low and High draw everything with one flat, matte material: the colour baked
 * into the model, lit by the sun and nothing else. That is the look, and it is
 * cheap. Ultra keeps the same blocks and the same colours and changes only how
 * they answer the light, with the things a real model on a table would do:
 *
 * - **A surface.** Every material has a roughness. Wax and water shine, bark
 *   and soil do not, and all of them reflect the sky they sit under. A block
 *   can also say what it is made of on its own account (`models/made.ts`), so
 *   the window in a wall is glass and the trunk under a canopy is wood.
 * - **Blocks with edges.** The corner of a real block is never perfectly
 *   sharp: it is very slightly rounded, and that rounding is what catches the
 *   light. The edges of every voxel are bevelled here in the shader, by
 *   leaning the surface direction over as it nears the edge of its cell, so
 *   a wall of blocks glints along its seams without one more triangle.
 * - **Blocks within blocks.** The same cell arithmetic can cut each voxel
 *   into smaller ones (`split`) and give each its own very slight tone, and
 *   then, where the camera is close enough to see it, cut those in half
 *   again (`fine`). The ground and the trunks read as built from finer
 *   pieces than they are, and finer still as the bee comes down to them.
 * - **Light through thin things.** A leaf or a petal with the sun behind it
 *   glows. Thick things do not.
 * - **Weather.** Rain darkens a surface and makes it shine, and stands in
 *   puddles on flat ground. A passing cloud dims the sun for a moment. Mist
 *   lies in the low ground. At night about half the windows are lit.
 * - **Water's edge.** Ground just above the creek is dark and wet, and ground
 *   under it has the sun's light moving on it.
 *
 * The block detail fades out with distance, measured in pixels: a bevel
 * narrower than a pixel is only shimmer. The weather is read from `air`.
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
  /** Cut the blocks in half once more where the camera is close. For big blocks. */
  fine?: boolean;
  /** How much of the sun comes through from behind: leaves and petals. */
  translucency?: number;
  /** The park's floor: it puddles, and it meets the water. */
  ground?: boolean;
  /** The model's own height and how far its top travels in the wind. */
  sway?: [height: number, amount: number, speed?: number];
};

const VERTEX_HEADER = /* glsl */ `
  attribute float made;
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
  varying float vMade;
  varying float vUp;
  varying vec3 vWorldAt;
`;

export const SWAY_VERTEX = /* glsl */ `
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
  vMade = made;
  // Everything planted is only ever turned about the vertical, so a face that
  // looked up when it was modelled still does.
  vUp = normal.y;
`;

/** Where the point ended up, once the wind has had it. */
const WORLD_VERTEX = /* glsl */ `
  vec4 worldAt = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    worldAt = instanceMatrix * worldAt;
  #endif
  vWorldAt = (modelMatrix * worldAt).xyz;
`;

const FRAGMENT_HEADER = /* glsl */ `
  uniform float uBevel;
  uniform float uGrain;
  uniform float uSplit;
  uniform float uFine;
  uniform float uTranslucency;
  uniform float uGround;
  uniform float uAirTime;
  uniform float uAirNight;
  uniform float uAirWet;
  uniform float uAirMist;
  uniform vec3 uAirMistColor;
  uniform float uAirCloud;
  uniform vec2 uAirDrift;
  uniform float uAirWater;
  varying vec2 vBlockUV;
  varying vec3 vBlockCell;
  varying vec3 vBlockU;
  varying vec3 vBlockV;
  varying float vMade;
  varying float vUp;
  varying vec3 vWorldAt;

  float airHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float airHash3(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  // How much of the sun gets past the clouds at this spot: soft blobs, forty
  // units or so across, going over on the wind.
  float airCloudLight(vec2 xz) {
    vec2 at = (xz + uAirDrift) / 44.0;
    vec2 cell = floor(at);
    vec2 blend = smoothstep(0.0, 1.0, fract(at));
    float shade = mix(
      mix(airHash(cell), airHash(cell + vec2(1.0, 0.0)), blend.x),
      mix(airHash(cell + vec2(0.0, 1.0)), airHash(cell + vec2(1.0, 1.0)), blend.x),
      blend.y
    );

    return 1.0 - uAirCloud * smoothstep(0.42, 0.68, shade);
  }
`;

const BLOCK_COLOR = /* glsl */ `
  vec2 blockAt = fract(vBlockUV);
  vec2 blockEdge = min(blockAt, 1.0 - blockAt);
  // Gone by the time a block is a few pixels across: finer than that it is noise.
  vec2 blockPixels = fwidth(vBlockUV);
  float blockSpan = max(blockPixels.x, blockPixels.y);
  float blockFade = 1.0 - smoothstep(0.07, 0.24, blockSpan);
  float blockTone = airHash3(floor(vBlockCell));
  diffuseColor.rgb *= 1.0 + (blockTone - 0.5) * uGrain * blockFade;
  // The seam between two blocks is a crack, and a crack is dark.
  float blockSeam = 1.0 - smoothstep(0.0, 0.05, min(blockEdge.x, blockEdge.y));
  diffuseColor.rgb *= 1.0 - blockSeam * 0.22 * blockFade * step(0.001, uBevel);

  // And the same again at half the size, where there are the pixels to show it.
  vec2 fineAt = fract(vBlockUV * 2.0);
  vec2 fineEdge = min(fineAt, 1.0 - fineAt);
  float fineFade = uFine * (1.0 - smoothstep(0.03, 0.1, blockSpan));
  float fineTone = airHash3(floor(vBlockCell * 2.0) + 17.0);
  diffuseColor.rgb *= 1.0 + (fineTone - 0.5) * uGrain * 0.8 * fineFade;
  float fineSeam = 1.0 - smoothstep(0.0, 0.07, min(fineEdge.x, fineEdge.y));
  diffuseColor.rgb *= 1.0 - fineSeam * 0.12 * fineFade * step(0.001, uBevel);

  // Rain. Wet things are darker, most of all the faces the rain lands on.
  float airWetHere = uAirWet * (0.4 + 0.6 * max(vUp, 0.0));
  diffuseColor.rgb *= 1.0 - airWetHere * 0.3;

  // Standing water on the flat of the ground: a tread here and there, in
  // patches, never the whole lawn.
  vec2 puddleCell = floor(vWorldAt.xz / 2.0);
  float puddle =
    uGround * step(0.9, vUp) * smoothstep(0.3, 0.75, uAirWet) *
    step(0.55, airHash(floor(puddleCell / 3.0))) * step(0.62, airHash(puddleCell + 3.0));
  diffuseColor.rgb *= 1.0 - puddle * 0.45;

  // The water's edge: dark and soaked just above it.
  float shoreAbove = vWorldAt.y - uAirWater;
  float shoreWet = uGround * step(0.0, shoreAbove) * (1.0 - smoothstep(0.2, 1.9, shoreAbove));
  diffuseColor.rgb *= 1.0 - shoreWet * 0.32;
`;

/**
 * What the block is made of, where it says: see `models/made.ts`. Roughness
 * and metal for each, whether the sun comes through it, and whether it is a
 * window (which is lit, some of them, after dark).
 */
const MADE_FRAGMENT = /* glsl */ `
  float madeIs = floor(vMade + 0.5);
  float madeThrough = 1.0;
  float madeWindow = 0.0;

  if (madeIs > 0.5) {
    if (madeIs < 1.5) {
      roughnessFactor = 0.7;
    } else if (madeIs < 2.5) {
      roughnessFactor = 0.93;
      madeThrough = 0.0;
    } else if (madeIs < 3.5) {
      roughnessFactor = 0.88;
      madeThrough = 0.0;
    } else if (madeIs < 4.5) {
      roughnessFactor = 0.05;
      metalnessFactor = 0.55;
      madeThrough = 0.0;
      madeWindow = 1.0;
    } else if (madeIs < 5.5) {
      roughnessFactor = 0.34;
      metalnessFactor = 1.0;
      madeThrough = 0.0;
    } else {
      roughnessFactor = 0.06;
      metalnessFactor = 0.3;
      madeThrough = 0.0;
    }
  }

  roughnessFactor = clamp(roughnessFactor + (blockTone - 0.5) * 0.18 * blockFade, 0.04, 1.0);
  // Wet is smooth, a puddle is a mirror, and the bank is somewhere between.
  roughnessFactor = mix(roughnessFactor, 0.2, airWetHere * 0.85);
  roughnessFactor = mix(roughnessFactor, 0.32, shoreWet);
  roughnessFactor = mix(roughnessFactor, 0.03, puddle);
`;

const BLOCK_NORMAL = /* glsl */ `
  vec2 blockLean = (1.0 - smoothstep(0.0, 0.16, blockEdge)) * sign(blockAt - 0.5) * (uBevel * blockFade);
  blockLean += (1.0 - smoothstep(0.0, 0.2, fineEdge)) * sign(fineAt - 0.5) * (uBevel * 0.6 * fineFade);
  // A puddle is flat, whatever is under it.
  blockLean *= 1.0 - puddle;
  normal = normalize(normal + blockLean.x * vBlockU + blockLean.y * vBlockV);
`;

/** A lit window: about half of them, warm, once it is dark. A pane is six blocks. */
const WINDOW = /* glsl */ `
  vec3 paneCell = floor(vBlockCell / (6.0 * uSplit));
  totalEmissiveRadiance +=
    vec3(1.0, 0.64, 0.28) * (madeWindow * uAirNight * step(0.45, airHash3(paneCell + 5.0)) * 2.4);
`;

/**
 * After the lights: the cloud going over, the sun through a leaf from behind,
 * and the sun's light moving on the bed of the creek. The first directional
 * light is the sun.
 */
const LIGHT = /* glsl */ `
  float cloudLight = airCloudLight(vWorldAt.xz);
  reflectedLight.directDiffuse *= cloudLight;
  reflectedLight.directSpecular *= cloudLight;

  #if NUM_DIR_LIGHTS > 0
    vec3 sunFrom = directionalLights[0].direction;
    vec3 sunLight = directionalLights[0].color * material.diffuseColor * RECIPROCAL_PI * cloudLight;
    float throughBack = max(dot(-geometryNormal, sunFrom), 0.0);
    float throughGlow = pow(max(dot(-geometryViewDir, sunFrom), 0.0), 4.0);
    reflectedLight.directDiffuse +=
      sunLight * ((throughBack * 0.55 + throughGlow * 0.9) * uTranslucency * madeThrough);

    // Under the water, on faces that look up: bright cells that come and go.
    vec2 causticCell = floor(vWorldAt.xz / 0.5);
    float caustic =
      sin(causticCell.x * 1.3 + causticCell.y * 0.7 + uAirTime * 1.6) *
      sin(causticCell.y * 1.1 - causticCell.x * 0.5 - uAirTime * 1.1);
    reflectedLight.directDiffuse +=
      sunLight * (uGround * step(shoreAbove, 0.0) * max(vUp, 0.0) * smoothstep(0.5, 0.95, caustic) * 1.6);
  #endif
`;

/** Mist lies low: thick at the water, gone a tree's height above it. */
const MIST = /* glsl */ `
  #ifdef USE_FOG
    float mistLow = 1.0 - smoothstep(uAirWater + 1.0, uAirWater + 30.0, vWorldAt.y);
    float mistFar = 1.0 - exp(-vFogDepth * 0.009);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uAirMistColor, uAirMist * mistLow * mistFar * 0.75);
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
    uSplit: { value: split },
    uFine: { value: look.fine ? 1 : 0 },
    uTranslucency: { value: look.translucency ?? 0 },
    uGround: { value: look.ground ? 1 : 0 },
    uAirTime: wind.flow,
    uAirNight: air.night,
    uAirWet: air.wet,
    uAirMist: air.mist,
    uAirMistColor: air.mistColor,
    uAirCloud: air.cloud,
    uAirDrift: air.drift,
    uAirWater: air.water,
  };

  return {
    onBeforeCompile(shader: WebGLProgramParametersWithUniforms) {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_HEADER}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${BLOCK_VERTEX}\n${swaying ? SWAY_VERTEX : ""}\n${WORLD_VERTEX}`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_HEADER}`)
        .replace("#include <color_fragment>", `#include <color_fragment>\n${BLOCK_COLOR}`)
        .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n${MADE_FRAGMENT}`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${BLOCK_NORMAL}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${WINDOW}`)
        .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${LIGHT}`)
        .replace("#include <fog_fragment>", `#include <fog_fragment>\n${MIST}`);
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
 * much of a block it looks like and whether the sun comes through it. What a
 * model says about its own blocks (`models/made.ts`) overrides the roughness
 * here: this is what it is made of where it has not said.
 */
export const LOOKS = {
  /** Turf and soil: matte, and built of blocks a quarter the size of its columns. */
  ground: { roughness: 0.96, sky: 0.45, bevel: 0.5, grain: 0.1, split: 4, fine: true, ground: true },
  /** A canopy: leaves let the sun through. The trunk says it is wood. */
  tree: { roughness: 0.78, sky: 0.6, bevel: 0.55, grain: 0.08, split: 2, fine: true, translucency: 0.6 },
  /** Grass and the small soft plants underfoot. */
  blade: { roughness: 0.72, sky: 0.7, bevel: 0.35, grain: 0.05, translucency: 0.9 },
  /** Rock, logs, stumps, pebbles. */
  hard: { roughness: 0.9, sky: 0.6, bevel: 0.6, grain: 0.1, split: 2, fine: true },
  /** A flower: waxy petals that glow when the sun is behind them. Its leaves say they are leaves. */
  flower: { roughness: 0.5, bevel: 0.5, grain: 0.03, translucency: 1 },
  /** A fungus: wet and waxy, and too thick to see through. */
  fungus: { roughness: 0.36, bevel: 0.55, grain: 0.05, translucency: 0.25 },
  /** A building: dressed stone. Its timber, glass and metal say what they are. */
  built: { roughness: 0.86, sky: 0.8, bevel: 0.6, grain: 0.07, split: 2, fine: true },
} satisfies Record<string, Look>;
