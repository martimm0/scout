"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { STARTER_POLLINATORS } from "../data/starter-pollinators";
import { partyPoses, usePartyStore } from "../state/party-store";
import { PollinatorModel } from "./pollinator-model";

/**
 * The other bees in the park.
 *
 * Nine at most, which is what makes this affordable: the same model the player
 * flies, drawn nine more times.
 *
 * Poses are read from a plain Map, not from React state. They arrive eight
 * times a second per player, and routing eighty updates a second through
 * setState would re-render the HUD for data React never draws. The frame loop
 * reads the map directly and moves the groups itself, which is the pattern the
 * rest of the scene already uses for per-frame values.
 *
 * Movement is INTERPOLATED. At eight updates a second, snapping to each new
 * position looks like a slideshow; easing toward it looks like flight. The
 * cost is that a remote bee is a fraction of a second behind where it really
 * is, which nobody can perceive and which matters to nothing: no mechanic in
 * the game is decided by another player's exact position.
 */

const EASE = 6;

export function OtherBees() {
  const others = usePartyStore((state) => state.others);

  return (
    <>
      {others.map((other) => (
        <RemoteBee key={other.sub} sub={other.sub} type={other.pollinator} />
      ))}
    </>
  );
}

function RemoteBee({ sub, type }: { sub: string; type: string }) {
  const group = useRef<THREE.Group>(null);
  const gestureRef = useRef({ kind: "none" as const, time: 0 });

  /**
   * Whether this bee has ever had a position.
   *
   * A `join` message carries no pose, so between somebody arriving and their
   * first update there is a bee with nowhere to be. Easing from the group's
   * default put them at the world origin and then flew them across the park to
   * where they really were: in Frick that is a 240-unit swoop through the trees
   * every single time anybody joined, and the first thing you would ever see a
   * new player do.
   *
   * So the first pose is a placement, not a movement, and until it arrives the
   * bee is not drawn at all. Being briefly absent is honest; being somewhere
   * they are not is not.
   */
  const placed = useRef(false);

  // Their chosen species, drawn in its default colours. The party carries the
  // pollinator type, not the whole customised paint job: a saved bee is a
  // private thing and the wire does not need it to draw a recognisable insect.
  const pollinator = useMemo(
    () =>
      STARTER_POLLINATORS.find((starter) => starter.type === type) ??
      STARTER_POLLINATORS[0],
    [type],
  );

  useFrame((_state, delta) => {
    const pose = partyPoses.get(sub);
    const node = group.current;

    if (!pose || !node) {
      return;
    }

    // The first pose is where they ARE, not somewhere to travel to.
    if (!placed.current) {
      placed.current = true;
      node.position.set(pose.x, pose.altitude, pose.z);
      node.rotation.y = pose.heading;
      node.visible = true;

      return;
    }

    // Ease toward the last known pose. Framerate-independent: the same easing
    // at 30fps and 120fps, which a plain lerp by a constant is not.
    const t = 1 - Math.exp(-EASE * delta);

    node.position.x += (pose.x - node.position.x) * t;
    node.position.y += (pose.altitude - node.position.y) * t;
    node.position.z += (pose.z - node.position.z) * t;

    // Shortest way round, so a bee turning past due south does not spin the
    // long way about.
    let turn = pose.heading - node.rotation.y;

    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;

    node.rotation.y += turn * t;
  });

  return (
    <group
      ref={group}
      scale={1}
      // Hidden until the first pose places it. See `placed`.
      visible={false}
      // Marks this as somebody else's bee, in the scene graph itself. The test
      // counts these rather than counting React state or socket messages: a
      // party where the messages arrive and nothing is drawn is the failure
      // worth catching, and only the graph knows the difference.
      userData={{ remoteBee: sub }}
    >
      <PollinatorModel
        animationState="flying"
        gestureRef={gestureRef}
        pollinator={pollinator}
      />
    </group>
  );
}

/**
 * Hand the live scene to the test harness, outside production only.
 *
 * The alternative was asserting that a `pos` message arrived, which passes
 * happily against a scene that draws nothing. Rather than ship a permanent
 * global to make that testable, this exists in development and is compiled out
 * of the production bundle, and the suite runs the dev server.
 */
export function SceneHandle() {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const holder = window as unknown as { __scoutScene?: unknown };

    holder.__scoutScene = scene;

    return () => {
      delete holder.__scoutScene;
    };
  }, [scene]);

  return null;
}

