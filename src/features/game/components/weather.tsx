"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { Weather } from "../world/weather";

/**
 * Weather you can see.
 *
 * Everything here follows the bee rather than filling the park. A rain volume the
 * size of Frick Park would be a million particles, and 999,900 of them would be
 * falling somewhere you are not looking. So the rain is a box about the bee, it
 * moves with her, and each drop that falls out of the bottom is put back on top:
 * a treadmill, which is what every rain effect in every game has always been.
 *
 * The drops are also NOT points. At bee scale a raindrop is not a speck, it is a
 * falling marble bigger than your head, and the one thing this game has been about
 * from the beginning is that scale is the story.
 */

const RAIN_BOX = 90;
const SNOW_BOX = 110;

function useFallingField(count: number, box: number, height: number) {
  return useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * box;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * box;
      // Not all the same speed, or it reads as a texture scrolling rather than as
      // weather.
      speeds[i] = 0.7 + Math.random() * 0.6;
    }

    return { positions, speeds };
  }, [count, box, height]);
}

/** Rain, as instanced streaks, leaning with the wind. */
function Rain({ weather }: { weather: Weather }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = Math.round(240 + weather.intensity * 900);
  const { positions, speeds } = useFallingField(count, RAIN_BOX, 70);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.09, 1.5, 0.09), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#c9dbe8",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    [],
  );

  // Wind, in world units per second, and the lean it puts on every drop.
  const drift = Math.min(26, weather.wind * 0.6);
  const lean = Math.atan2(drift, 70);

  useFrame((state, delta) => {
    const instanced = mesh.current;

    if (!instanced) {
      return;
    }

    const camera = state.camera.position;
    const fall = (55 + weather.intensity * 60) * delta;

    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 1] -= fall * speeds[i];
      positions[i * 3] += drift * delta * speeds[i];

      // Out of the bottom, back on the top. A treadmill.
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 70;
        positions[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
        positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
      }

      // Wrap the box around the bee, so the rain is always where she is and never
      // has to be drawn where she is not.
      let x = positions[i * 3];
      let z = positions[i * 3 + 2];
      const dx = x - camera.x;
      const dz = z - camera.z;

      if (Math.abs(dx) > RAIN_BOX / 2) {
        x -= Math.sign(dx) * RAIN_BOX;
        positions[i * 3] = x;
      }

      if (Math.abs(dz) > RAIN_BOX / 2) {
        z -= Math.sign(dz) * RAIN_BOX;
        positions[i * 3 + 2] = z;
      }

      dummy.position.set(x, positions[i * 3 + 1] + camera.y - 35, z);
      dummy.rotation.set(0, 0, -lean);
      dummy.scale.set(1, 1 + weather.intensity * 1.4, 1);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, count]}
      frustumCulled={false}
      key={count}
      ref={mesh}
    />
  );
}

/** Snow. Slower, bigger, and it wanders on the way down. */
function Snow({ weather }: { weather: Weather }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = Math.round(200 + weather.intensity * 600);
  const { positions, speeds } = useFallingField(count, SNOW_BOX, 70);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.5, 0.5, 0.5), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fbfdff",
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );

  const drift = Math.min(14, weather.wind * 0.35);

  useFrame((state, delta) => {
    const instanced = mesh.current;

    if (!instanced) {
      return;
    }

    const camera = state.camera.position;
    const fall = (7 + weather.intensity * 6) * delta;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 1] -= fall * speeds[i];
      positions[i * 3] += drift * delta * speeds[i];

      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 70;
        positions[i * 3] = (Math.random() - 0.5) * SNOW_BOX;
        positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW_BOX;
      }

      let x = positions[i * 3];
      let z = positions[i * 3 + 2];
      const dx = x - camera.x;
      const dz = z - camera.z;

      if (Math.abs(dx) > SNOW_BOX / 2) {
        x -= Math.sign(dx) * SNOW_BOX;
        positions[i * 3] = x;
      }

      if (Math.abs(dz) > SNOW_BOX / 2) {
        z -= Math.sign(dz) * SNOW_BOX;
        positions[i * 3 + 2] = z;
      }

      // Snow does not fall straight. It faffs about.
      const wander = Math.sin(time * 0.8 + i) * 1.6;

      dummy.position.set(
        x + wander,
        positions[i * 3 + 1] + camera.y - 35,
        z + Math.cos(time * 0.6 + i) * 1.6,
      );
      dummy.rotation.set(time * 0.4 + i, time * 0.3 + i, 0);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, material, count]}
      frustumCulled={false}
      key={count}
      ref={mesh}
    />
  );
}

/**
 * Cloud, as slabs, high up.
 *
 * Voxel clouds for a voxel park: flat lumps of white that drift on the wind and
 * throw the sky into shadow. There are more of them the more cloud there really
 * is over Pittsburgh, and on a clear day there are none.
 */
function Clouds({ weather }: { weather: Weather }) {
  const group = useRef<THREE.Group>(null);
  const count = Math.round(weather.cloudCover * 26);

  const slabs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic-ish per index, so they do not reshuffle every render.
        const angle = i * 2.399;
        const radius = 60 + ((i * 37) % 260);

        return {
          position: [
            Math.cos(angle) * radius,
            190 + ((i * 13) % 50),
            Math.sin(angle) * radius,
          ] as [number, number, number],
          scale: [
            60 + ((i * 17) % 90),
            8 + ((i * 7) % 10),
            50 + ((i * 23) % 80),
          ] as [number, number, number],
        };
      }),
    [count],
  );

  const drift = Math.min(9, weather.wind * 0.25);

  useFrame((state, delta) => {
    if (!group.current) {
      return;
    }

    group.current.position.x += drift * delta;

    // Wrap them round, so the sky never runs out of cloud.
    if (group.current.position.x > 340) {
      group.current.position.x = -340;
    }
  });

  if (count === 0) {
    return null;
  }

  return (
    <group ref={group}>
      {slabs.map((slab, index) => (
        <mesh key={index} position={slab.position} scale={slab.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial
            color={weather.condition === "clear" ? "#ffffff" : "#c8ccd2"}
            opacity={0.55 + weather.cloudCover * 0.35}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

export function WeatherLayer({ weather }: { weather: Weather }) {
  return (
    <>
      <Clouds weather={weather} />
      {weather.falling === "rain" ? <Rain weather={weather} /> : null}
      {weather.falling === "snow" ? <Snow weather={weather} /> : null}
    </>
  );
}
