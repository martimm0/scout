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
  SphereGeometry,
  type Group,
  type Texture,
} from "three";

import type { Daylight } from "../world/daylight";

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

    room.add(new Mesh(sphere, new MeshBasicMaterial({ side: BackSide, vertexColors: true })));

    return { generator: new PMREMGenerator(gl), room, sphere };
  }, [gl]);

  useEffect(
    () => () => {
      rig.generator.dispose();
      rig.sphere.dispose();
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
      <mesh geometry={geometry} renderOrder={-10} scale={RADIUS}>
        <meshBasicMaterial depthWrite={false} fog={false} side={BackSide} toneMapped={false} vertexColors />
      </mesh>
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
