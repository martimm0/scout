"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BufferAttribute,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Group,
  type Texture,
} from "three";

import type { Daylight } from "../world/daylight";
import { wind } from "../world/wind";

/**
 * The sky, in bands.
 *
 * This was a physical sky model, and at noon over Pittsburgh a physical sky
 * model is a pale haze the colour of the fog under it: correct, and a white
 * rectangle behind everything. A summer sky in a game about being a bee should
 * be blue. So the sky is now painted: the horizon is the fog's own colour, so
 * the far edge of the park still dissolves into it, and it climbs to a real
 * blue overhead in ten flat bands, because a smooth gradient would be the one
 * smooth thing in a park made of blocks. It warms at the horizon when the sun
 * is low, greys over under cloud, and goes to navy at night.
 *
 * The sun is a square. Of course it is.
 */
const BANDS = 10;
/** Inside the camera's far plane, which is a thousand units out. */
const RADIUS = 900;

/** The colours the sky is painted from, at this hour under this much cloud. */
function skyPaint(sky: Daylight, cloudCover: number) {
  const light = sky.brightness;
  const horizon = new Color(sky.fogColor);
  const zenith = new Color("#0b1330").lerp(new Color("#3f90e8"), light);

  // Cloud is a lid: the more of it, the more the whole sky is the colour of
  // its own horizon.
  zenith.lerp(horizon, Math.min(0.85, cloudCover * 0.8));

  // A low sun warms the rim of the sky, unless the cloud has hidden it.
  const warmth =
    light > 0.04 ? Math.max(0, 1 - sky.sun[1] / 0.4) * (1 - cloudCover) * Math.min(1, light * 3) : 0;
  const rim = horizon.clone().lerp(new Color("#f8b888"), warmth * 0.55);

  return { rim, zenith };
}

/**
 * The sky as a light, for Ultra.
 *
 * On Low and High the sky is a picture behind the park and the "sky light" is
 * two flat lamps. On Ultra every surface is lit by the sky it can actually
 * see: blue from above, the warm rim from the side at dusk, and green thrown
 * back up from the ground. That is this: a small copy of the painted sky, with
 * the ground under it, blurred into an environment the materials sample.
 * Smooth, where the visible sky is banded, because light does not come in
 * stripes. Rebuilt only when the sky's own colours change, which is when the
 * hour moves or the weather does.
 */
/** How much of the sky's light the surfaces take. Under 1: the lamps are still on, low. */
const ENVIRONMENT = 0.5;

function light(scene: Scene, texture: Texture | null, intensity: number) {
  scene.environment = texture;
  scene.environmentIntensity = intensity;
}

function SkyLight({ cloudCover, sky }: { cloudCover: number; sky: Daylight }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const brightness = sky.brightness;
  const elevation = sky.sun[1];
  const rig = useMemo(() => {
    const sphere = new SphereGeometry(40, 24, 16);

    sphere.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(sphere.getAttribute("position").count * 3), 3),
    );

    const room = new Scene();
    const paint = new MeshBasicMaterial({ side: BackSide, vertexColors: true });

    room.add(new Mesh(sphere, paint));

    return { generator: new PMREMGenerator(gl), paint, room, sphere };
  }, [gl]);

  useEffect(
    () => () => {
      rig.generator.dispose();
      rig.sphere.dispose();
      rig.paint.dispose();
    },
    [rig],
  );

  useEffect(() => {
    const { rim, zenith } = skyPaint(sky, cloudCover);
    // What the park throws back up: the ground's own colour, as lit as the day is.
    const ground = new Color(sky.groundColor).multiplyScalar(0.35 + brightness * 0.4);
    const position = rig.sphere.getAttribute("position");
    const color = rig.sphere.getAttribute("color");
    const mixed = new Color();

    for (let i = 0; i < position.count; i += 1) {
      const up = position.getY(i) / 40;

      if (up >= 0) {
        mixed.copy(rim).lerp(zenith, up ** 0.62);
      } else {
        mixed.copy(rim).lerp(ground, Math.min(1, -up * 4));
      }

      color.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }

    color.needsUpdate = true;

    const target = rig.generator.fromScene(rig.room, 0.04, 0.1, 100);
    const before = scene.environment;

    light(scene, target.texture, ENVIRONMENT);

    return () => {
      light(scene, before, 1);
      target.dispose();
    };
    // `sky` is a new object every minute; these are what the paint reads from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brightness, cloudCover, elevation, rig, scene, sky.fogColor, sky.groundColor]);

  return null;
}

/**
 * The sky itself, on Ultra.
 *
 * The banded sky is a painting, and a good one for a park of flat colours. A
 * photograph of the same park has a sky that is brightest and palest near the
 * sun, deepens away from it and overhead, glows along the horizon the sun is
 * setting behind, and at night has stars in it. This draws that, per pixel:
 * the same three colours the painting is mixed from, a glow round wherever the
 * light is coming from, and stars.
 *
 * The stars are squares, on a grid, a few of them brighter than the rest, and
 * they twinkle on the water's clock so they hold still for anybody who asked.
 * Brighter than white where it should flare, since the picture is
 * floating-point here and the lens at the end knows what to do with that.
 */
const SKY_VERTEX = /* glsl */ `
  varying vec3 vSkyDirection;

  void main() {
    vSkyDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uRim;
  uniform vec3 uZenith;
  uniform vec3 uGlow;
  uniform vec3 uSun;
  uniform float uDay;
  uniform float uClear;
  uniform float uTime;
  varying vec3 vSkyDirection;

  float skyHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 direction = normalize(vSkyDirection);
    float up = max(direction.y, 0.0);
    float toSun = max(dot(direction, uSun), 0.0);

    // Pale at the rim, deep overhead, and deeper still away from the sun.
    vec3 color = mix(uRim, uZenith, pow(up, 0.55));
    color *= 1.0 - 0.16 * uDay * (1.0 - toSun) * up;

    // The light in the sky round the sun: a tight bright core, a wide soft
    // one, and a band along the horizon under it when it is low.
    float low = 1.0 - smoothstep(0.0, 0.45, uSun.y);
    vec3 glow = uGlow * uClear;
    color += glow * (pow(toSun, 90.0) * 1.6 + pow(toSun, 9.0) * 0.32);
    color += glow * low * pow(toSun, 2.5) * (1.0 - smoothstep(0.0, 0.3, up)) * 0.55;

    // Stars: one to a cell of sky, most cells empty, square because they are.
    vec2 chart = vec2(atan(direction.z, direction.x) * 64.0, direction.y * 96.0);
    vec2 cell = floor(chart);
    float seed = skyHash(cell);
    vec2 inside = abs(fract(chart) - 0.5);
    float size = 0.07 + 0.12 * skyHash(cell + 9.0);
    // About one cell in fifty: a sky with stars in it, not a sky made of them.
    float star = step(0.98, seed) * step(max(inside.x, inside.y), size);
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.0 + seed * 3.0) + seed * 40.0);
    color += vec3(0.9, 0.94, 1.0) * star * twinkle * (1.0 - uDay) * uClear * smoothstep(0.03, 0.2, up) * (0.9 + 1.6 * skyHash(cell + 3.0));

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Set the sky's shader to this hour and this much cloud. */
function tuneSky(material: ShaderMaterial, sky: Daylight, cloudCover: number) {
  const { rim, zenith } = skyPaint(sky, cloudCover);
  const { uniforms } = material;

  (uniforms.uRim.value as Color).copy(rim);
  // A touch deeper than the painting's: the lens lifts everything a little.
  (uniforms.uZenith.value as Color).copy(zenith).multiplyScalar(0.86);
  (uniforms.uGlow.value as Color).set(sky.sunColor).multiplyScalar(0.5 + sky.brightness * 1.3);
  (uniforms.uSun.value as Vector3).set(...sky.sun).normalize();
  uniforms.uDay.value = Math.min(1, Math.max(0, (sky.brightness - 0.12) / 0.3));
  uniforms.uClear.value = Math.max(0, 1 - cloudCover * 1.05);
}

function PhotographedSky({
  cloudCover,
  geometry,
  sky,
}: {
  cloudCover: number;
  geometry: SphereGeometry;
  sky: Daylight;
}) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        depthWrite: false,
        fog: false,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        toneMapped: false,
        uniforms: {
          uRim: { value: new Color() },
          uZenith: { value: new Color() },
          uGlow: { value: new Color() },
          uSun: { value: new Vector3(0, 1, 0) },
          uDay: { value: 1 },
          uClear: { value: 1 },
          uTime: wind.flow,
        },
        vertexShader: SKY_VERTEX,
      }),
    [],
  );
  const brightness = sky.brightness;
  const [sunX, sunY, sunZ] = sky.sun;

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    tuneSky(material, sky, cloudCover);
    // `sky` is a new object every minute; these are what the paint reads from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brightness, cloudCover, material, sky.fogColor, sky.sunColor, sunX, sunY, sunZ]);

  return <mesh geometry={geometry} material={material} renderOrder={-10} scale={RADIUS} />;
}

export function SkyDome({
  cloudCover,
  lit = false,
  sky,
}: {
  cloudCover: number;
  /** Ultra: the sky also lights the park, and the sun is brighter than white. */
  lit?: boolean;
  sky: Daylight;
}) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => {
    // Few faces on purpose: it is ten flat bands, and low detail counts every triangle.
    const sphere = new SphereGeometry(1, 16, 14);

    sphere.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(sphere.getAttribute("position").count * 3), 3),
    );

    return sphere;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const light = sky.brightness;
  const elevation = sky.sun[1];

  useEffect(() => {
    const { rim, zenith } = skyPaint(sky, cloudCover);
    const position = geometry.getAttribute("position");
    const color = geometry.getAttribute("color");
    const mixed = new Color();

    for (let i = 0; i < position.count; i += 1) {
      // Height up the dome, eased so the blue arrives quickly, then banded.
      const up = Math.max(0, position.getY(i)) ** 0.62;
      const band = Math.min(1, Math.floor(up * BANDS + 0.5) / BANDS);

      mixed.copy(rim).lerp(zenith, band);
      color.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }

    color.needsUpdate = true;
    // `sky` is a new object every minute; these are what the paint reads from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudCover, elevation, geometry, light, sky.fogColor]);

  // The sky comes with you. It is a painted bowl, not a place.
  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position);
  });

  return (
    <group ref={group}>
      {lit ? <SkyLight cloudCover={cloudCover} sky={sky} /> : null}
      {lit ? (
        <PhotographedSky cloudCover={cloudCover} geometry={geometry} sky={sky} />
      ) : (
        <mesh geometry={geometry} renderOrder={-10} scale={RADIUS}>
          <meshBasicMaterial depthWrite={false} fog={false} side={BackSide} toneMapped={false} vertexColors />
        </mesh>
      )}
      {/* The sun by day and the moon by night: the same square, where the light
          is actually coming from. */}
      <mesh
        position={[sky.sun[0] * RADIUS * 0.94, sky.sun[1] * RADIUS * 0.94, sky.sun[2] * RADIUS * 0.94]}
        renderOrder={-9}
        scale={light > 0.3 ? 46 : 30}
        // The Ultra pipeline finds the sun by this, to throw its shafts.
        userData={{ sun: true }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          // Brighter than white on Ultra, so the sun flares the way a sun does.
          // (A colour may be: the picture is floating-point there.)
          color={
            lit
              ? new Color(light > 0.3 ? "#fff6cf" : "#dfe8ff").multiplyScalar(light > 0.3 ? 5 : 1.6)
              : light > 0.3
                ? "#fff6cf"
                : "#dfe8ff"
          }
          depthWrite={false}
          fog={false}
          opacity={Math.max(0, 1 - cloudCover * 1.1)}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}
