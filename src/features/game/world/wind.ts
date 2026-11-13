import type { Material } from "three";

/**
 * The wind, as two numbers every swaying thing shares.
 *
 * Nothing in the park moved. Seven thousand blades of grass stood to attention
 * in a thunderstorm. Now anything rooted leans with the wind, and the leaning
 * is done entirely on the graphics card: the scene writes the time and the
 * wind strength here once a frame, and each material bends its own vertices by
 * how high up its model they are. No per-blade work on the CPU, so a phone pays
 * the same for a gale as for a calm.
 *
 * `strength` is 0 in still air and for anybody who has asked for less motion,
 * about 0.3 on an ordinary day, and 1 and over in a storm.
 */
export const wind = {
  time: { value: 0 },
  strength: { value: 0 },
};

/** Miles an hour, as the weather reports it, to a sway strength. */
export function windStrength(mph: number) {
  return Math.min(1.5, 0.22 + mph / 22);
}

const SWAY_VERTEX = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 swayRoot = instanceMatrix[3].xyz;
  #else
    vec3 swayRoot = modelMatrix[3].xyz;
  #endif
  // Every plant keeps its own time, or the whole meadow nods in unison.
  float swayPhase = swayRoot.x * 0.137 + swayRoot.z * 0.171;
  float swayLift = clamp(transformed.y / uSwayHeight, 0.0, 1.2);
  // The root stays put and the tip moves most: bend goes with height squared.
  float swayBend = swayLift * swayLift * uSwayHeight * uSwayAmount * uWindStrength;
  float swayBeat = uWindTime * uSwaySpeed + swayPhase;
  transformed.x += (sin(swayBeat) + 0.4 * sin(swayBeat * 2.3 + 1.7)) * swayBend;
  transformed.z += cos(swayBeat * 0.8) * swayBend * 0.6;
`;

const FLAP_VERTEX = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 flapRoot = instanceMatrix[3].xyz;
  #else
    vec3 flapRoot = modelMatrix[3].xyz;
  #endif
  // How far out along the wing this vertex is: the body does not move at all.
  float flapReach = max(0.0, abs(transformed.x) - uFlapBody);
  transformed.y += flapReach * sin(uWindTime * uFlapSpeed + flapRoot.x * 1.3 + flapRoot.z * 0.7) * uFlapAmount;
`;

const HEADER = /* glsl */ `
  uniform float uWindTime;
  uniform float uWindStrength;
  uniform float uSwayHeight;
  uniform float uSwayAmount;
  uniform float uSwaySpeed;
  uniform float uFlapBody;
  uniform float uFlapSpeed;
  uniform float uFlapAmount;
`;

function patch(material: Material, key: string, body: string, uniforms: Record<string, { value: number }>) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uWindTime: wind.time,
      uWindStrength: wind.strength,
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${HEADER}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${body}`);
  };
  // Patched programs must not be shared with unpatched ones of the same type.
  material.customProgramCacheKey = () => key;

  return material;
}

/**
 * Make a material lean with the wind.
 *
 * `height` is the model's own height, in its own units, and `amount` is how far
 * the very top travels as a fraction of that in a moderate breeze: a few
 * hundredths for an oak, a good deal more for grass.
 */
export function sway<T extends Material>(material: T, height: number, amount: number, speed = 1.3): T {
  return patch(material, "scout-sway", SWAY_VERTEX, {
    uSwayHeight: { value: height },
    uSwayAmount: { value: amount },
    uSwaySpeed: { value: speed },
    uFlapBody: { value: 0 },
    uFlapSpeed: { value: 0 },
    uFlapAmount: { value: 0 },
  }) as T;
}

/**
 * Make a small creature's wings beat.
 *
 * The model is drawn wings out along X. Everything further from the middle than
 * `body` is wing, and rises and falls by how far out it is.
 */
export function flap<T extends Material>(material: T, body: number, speed: number, amount: number): T {
  return patch(material, "scout-flap", FLAP_VERTEX, {
    uSwayHeight: { value: 1 },
    uSwayAmount: { value: 0 },
    uSwaySpeed: { value: 0 },
    uFlapBody: { value: body },
    uFlapSpeed: { value: speed },
    uFlapAmount: { value: amount },
  }) as T;
}
