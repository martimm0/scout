"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, MeshLambertMaterial, type BufferGeometry, type Group } from "three";

import {
  accessoryOffset,
  BEE_OFFSETS,
  buildBeeGeometry,
  disposeBeeGeometry,
  type Accessory,
  type WingStyle,
} from "../models/bee";
import type { Pollinator } from "../state/game-store";

export type PollinatorAnimationState =
  | "idle"
  | "hovering"
  | "flying"
  | "pollinating";

type Tuning = {
  /** Wingbeat in radians per second. Nowhere near a real bee's 200Hz — that
   *  would just strobe. Fast enough to read as a blur, slow enough to see. */
  wingSpeed: number;
  wingAmplitude: number;
  /** How far the bee tips nose-down, as it would when driving forward. */
  pitch: number;
  bobSpeed: number;
  bobAmount: number;
  /** 0 = legs dangling, 1 = fully tucked. */
  legTuck: number;
};

const TUNING: Record<PollinatorAnimationState, Tuning> = {
  idle: {
    wingSpeed: 9,
    wingAmplitude: 0.3,
    pitch: 0,
    bobSpeed: 2.4,
    bobAmount: 0.035,
    legTuck: 0,
  },
  hovering: {
    wingSpeed: 24,
    wingAmplitude: 0.52,
    pitch: 0.04,
    bobSpeed: 3.6,
    bobAmount: 0.022,
    legTuck: 0.15,
  },
  flying: {
    wingSpeed: 30,
    wingAmplitude: 0.62,
    pitch: 0.26,
    bobSpeed: 9,
    bobAmount: 0.014,
    legTuck: 1,
  },
  pollinating: {
    wingSpeed: 34,
    wingAmplitude: 0.44,
    pitch: -0.18,
    bobSpeed: 12,
    bobAmount: 0.03,
    legTuck: 0,
  },
};

/** Wings sit slightly above horizontal at rest. */
const WING_REST = 0.12;

function approach(current: number, target: number, delta: number, rate: number) {
  return current + (target - current) * (1 - Math.exp(-delta * rate));
}

function wingMaterial(color: string, opacity: number) {
  return new MeshLambertMaterial({
    color,
    depthWrite: false,
    opacity,
    side: DoubleSide,
    transparent: true,
    vertexColors: true,
  });
}

/**
 * A wing and its mirror, sharing one material instance so the pair can be faded
 * together. The left group is scaled -1 on X, so callers must negate its
 * rotation to keep the two sweeping symmetrically rather than in opposition.
 */
function WingPair({
  geometry,
  leftRef,
  material,
  offset,
  rightRef,
}: {
  geometry: BufferGeometry;
  leftRef: React.RefObject<Group | null>;
  material: MeshLambertMaterial;
  offset: readonly [number, number, number];
  rightRef: React.RefObject<Group | null>;
}) {
  return (
    <>
      <group position={[offset[0], offset[1], offset[2]]} ref={rightRef}>
        <mesh geometry={geometry} material={material} />
      </group>
      <group
        position={[-offset[0], offset[1], offset[2]]}
        ref={leftRef}
        scale={[-1, 1, 1]}
      >
        <mesh geometry={geometry} material={material} />
      </group>
    </>
  );
}

export type Gesture = "none" | "greet" | "dance";

export function BeeModel({
  animationState = "hovering",
  gestureRef,
  hasPollen = false,
  pollinator,
}: {
  animationState?: PollinatorAnimationState;
  /**
   * Passed as a ref rather than a prop value: the gesture changes mid-frame and
   * reading it here keeps the whole thing out of React's render path.
   */
  gestureRef?: React.RefObject<{ kind: Gesture; time: number }>;
  hasPollen?: boolean;
  pollinator: Pollinator;
}) {
  const geometry = useMemo(
    () =>
      buildBeeGeometry(
        pollinator.bodyColor,
        pollinator.wingColor,
        pollinator.wingStyle as WingStyle,
        pollinator.accessory as Accessory,
        pollinator.accentColor,
      ),
    [
      pollinator.bodyColor,
      pollinator.wingColor,
      pollinator.wingStyle,
      pollinator.accessory,
      pollinator.accentColor,
    ],
  );

  const materials = useMemo(
    () => ({
      wing: wingMaterial(pollinator.wingColor, 0.62),
      hindWing: wingMaterial(pollinator.wingColor, 0.5),
    }),
    [pollinator.wingColor],
  );

  useEffect(() => () => disposeBeeGeometry(geometry), [geometry]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) {
        material.dispose();
      }
    },
    [materials],
  );

  const rootRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const abdomenRef = useRef<Group>(null);
  const antennaeRef = useRef<Group>(null);
  const legsRef = useRef<Group>(null);

  const leftWingRef = useRef<Group>(null);
  const rightWingRef = useRef<Group>(null);
  const leftHindRef = useRef<Group>(null);
  const rightHindRef = useRef<Group>(null);

  // Smoothed so flipping state doesn't snap the pose.
  const tuning = useRef<Tuning>({ ...TUNING.hovering });
  const wingPhase = useRef(0);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const target = TUNING[animationState];
    const current = tuning.current;

    const gesture = gestureRef?.current;
    const gestureTime = gesture?.time ?? 0;
    const dancing = gesture?.kind === "dance";

    // Clamp so a backgrounded tab doesn't fling the pose on return.
    const step = Math.min(delta, 0.05);

    // A dancing bee beats its wings hard whatever else it's doing.
    current.wingSpeed = approach(
      current.wingSpeed,
      dancing ? 34 : target.wingSpeed,
      step,
      8,
    );
    current.wingAmplitude = approach(
      current.wingAmplitude,
      target.wingAmplitude,
      step,
      8,
    );
    current.pitch = approach(current.pitch, target.pitch, step, 6);
    current.bobSpeed = approach(current.bobSpeed, target.bobSpeed, step, 6);
    current.bobAmount = approach(current.bobAmount, target.bobAmount, step, 6);
    current.legTuck = approach(current.legTuck, target.legTuck, step, 7);

    // Integrate the phase rather than sampling the clock, so a change in wing
    // speed doesn't teleport the wings to a new position mid-beat.
    wingPhase.current += current.wingSpeed * step;

    const beat = Math.sin(wingPhase.current);
    const bob = Math.sin(elapsed * current.bobSpeed) * current.bobAmount;

    if (rootRef.current) {
      const root = rootRef.current;

      root.position.x = 0;
      root.position.y = bob;
      root.rotation.x = current.pitch;
      root.rotation.z = 0;

      if (gesture?.kind === "greet") {
        // Bob up, hold, and nod. It has just spun around to look at you, so the
        // read has to be "hello", not "malfunction".
        const settle = Math.min(1, gestureTime * 2.4);
        root.position.y += settle * 0.16;
        root.rotation.x += Math.sin(gestureTime * 6.5) * 0.13 * settle;
      }

      if (gesture?.kind === "dance") {
        // The waggle: bounce, sway side to side, and wag the abdomen. Real bees
        // dance to tell the hive where the flowers are, which is very much the
        // job here.
        const settle = Math.min(1, gestureTime * 3);
        root.position.y += (Math.abs(Math.sin(gestureTime * 7)) * 0.3 - 0.05) * settle;
        root.position.x += Math.sin(gestureTime * 3.5) * 0.28 * settle;
        root.rotation.z = Math.sin(gestureTime * 7) * 0.4 * settle;
        root.rotation.x += Math.sin(gestureTime * 14) * 0.08 * settle;
      }
    }

    if (bodyRef.current) {
      // Squash and stretch on the downstroke — the bee compresses as it pushes
      // air down. Tiny, but it's most of what makes the thing feel alive.
      const squash =
        1 + beat * 0.035 + (gesture?.kind === "dance" ? Math.sin(gestureTime * 14) * 0.06 : 0);
      bodyRef.current.scale.set(1 / squash, squash, 1 / squash);
    }

    const flap = WING_REST + beat * current.wingAmplitude;

    if (rightWingRef.current && leftWingRef.current) {
      rightWingRef.current.rotation.z = flap;
      leftWingRef.current.rotation.z = -flap;
    }

    if (rightHindRef.current && leftHindRef.current) {
      // Hind wings hook to the forewings in a real bee, so they follow along
      // with a shallower sweep.
      rightHindRef.current.rotation.z = flap * 0.72;
      leftHindRef.current.rotation.z = -flap * 0.72;
    }

    if (abdomenRef.current) {
      // The abdomen lags the thorax and pumps gently, like breathing — and
      // waggles hard when dancing, which is the part a real bee actually does.
      abdomenRef.current.rotation.x =
        Math.sin(wingPhase.current * 0.5) * 0.04 + current.pitch * -0.35;
      abdomenRef.current.rotation.y = dancing
        ? Math.sin(gestureTime * 18) * 0.3
        : 0;
    }

    if (headRef.current) {
      // The head holds level against the body's pitch — animals stabilise gaze.
      headRef.current.rotation.x = current.pitch * -0.55;
    }

    if (antennaeRef.current) {
      // Swept forward off the brow. Vertical antennae read as ears.
      antennaeRef.current.rotation.x = -0.55 + Math.sin(elapsed * 5.5) * 0.12;
    }

    if (legsRef.current) {
      // Tucked back and up at speed, dangling at rest.
      legsRef.current.rotation.x = current.legTuck * -0.85;
      legsRef.current.position.y = BEE_OFFSETS.legs[1] + current.legTuck * 0.045;
    }
  });

  return (
    <group ref={rootRef}>
      <group ref={bodyRef}>
        <mesh castShadow geometry={geometry.thorax} position={BEE_OFFSETS.thorax}>
          <meshLambertMaterial vertexColors />
        </mesh>

        <group position={BEE_OFFSETS.abdomen} ref={abdomenRef}>
          <mesh castShadow geometry={geometry.abdomen}>
            <meshLambertMaterial vertexColors />
          </mesh>
        </group>

        <group position={BEE_OFFSETS.head} ref={headRef}>
          <mesh castShadow geometry={geometry.head}>
            <meshLambertMaterial vertexColors />
          </mesh>
        </group>

        <group position={BEE_OFFSETS.antennae} ref={antennaeRef}>
          <mesh geometry={geometry.antennae}>
            <meshLambertMaterial vertexColors />
          </mesh>
        </group>

        {geometry.accessory ? (
          <mesh
            castShadow
            geometry={geometry.accessory}
            position={accessoryOffset(pollinator.accessory as Accessory)}
          >
            <meshLambertMaterial vertexColors />
          </mesh>
        ) : null}

        <group position={BEE_OFFSETS.legs} ref={legsRef}>
          <mesh geometry={geometry.legs}>
            <meshLambertMaterial vertexColors />
          </mesh>
          {hasPollen ? (
            <mesh geometry={geometry.pollen}>
              <meshLambertMaterial vertexColors />
            </mesh>
          ) : null}
        </group>

        <WingPair
          geometry={geometry.wing}
          leftRef={leftWingRef}
          material={materials.wing}
          offset={BEE_OFFSETS.wing}
          rightRef={rightWingRef}
        />
        <WingPair
          geometry={geometry.hindWing}
          leftRef={leftHindRef}
          material={materials.hindWing}
          offset={BEE_OFFSETS.hindWing}
          rightRef={rightHindRef}
        />
      </group>
    </group>
  );
}
