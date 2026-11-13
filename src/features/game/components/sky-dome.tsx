"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, BufferAttribute, Color, SphereGeometry, type Group } from "three";

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

export function SkyDome({ cloudCover, sky }: { cloudCover: number; sky: Daylight }) {
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
    const horizon = new Color(sky.fogColor);
    const zenith = new Color("#0b1330").lerp(new Color("#3f90e8"), light);

    // Cloud is a lid: the more of it, the more the whole sky is the colour of
    // its own horizon.
    zenith.lerp(horizon, Math.min(0.85, cloudCover * 0.8));

    // A low sun warms the rim of the sky, unless the cloud has hidden it.
    const warmth =
      light > 0.04 ? Math.max(0, 1 - elevation / 0.4) * (1 - cloudCover) * Math.min(1, light * 3) : 0;
    const rim = horizon.clone().lerp(new Color("#f8b888"), warmth * 0.55);

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
  }, [cloudCover, elevation, geometry, light, sky.fogColor]);

  // The sky comes with you. It is a painted bowl, not a place.
  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position);
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} renderOrder={-10} scale={RADIUS}>
        <meshBasicMaterial depthWrite={false} fog={false} side={BackSide} toneMapped={false} vertexColors />
      </mesh>
      {/* The sun by day and the moon by night: the same square, where the light
          is actually coming from. */}
      <mesh
        position={[sky.sun[0] * RADIUS * 0.94, sky.sun[1] * RADIUS * 0.94, sky.sun[2] * RADIUS * 0.94]}
        renderOrder={-9}
        scale={light > 0.3 ? 46 : 30}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={light > 0.3 ? "#fff6cf" : "#dfe8ff"}
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
