"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from "three";

import { COURSES, raceGates } from "@party/games/courses";
import { parkOf, type Gate } from "@party/protocol";

import { outingOf, usePartyStore } from "../state/party-store";
import { ceiling, terrainHeight } from "../world/terrain";

/**
 * A race you can see from the air, and a hiding place with an edge.
 *
 * Gates are columns of light, like the marks a dance leaves, because the same
 * thing is true of them: a place you are meant to fly to has to be visible from
 * across the park, over the trees, and must not look like something that grows
 * there. Only two of a course are ever lit, the gate you are flying at and the
 * one after it, so it is read one turn ahead and never as a forest of posts.
 * A race that is still gathering shows one more, green, at its start.
 *
 * The hiding place is a ring of short posts on the ground. Short, so they mark
 * the edge without being something to hide behind, and so a seeker looking for
 * a bee is not looking through a fence.
 *
 * Nothing here is React state. The rounds, your place in them and the gate you
 * are on are all read from the store inside the frame loop, so a race redraws
 * this component exactly never.
 */

/** Lit gates at once: every race still gathering, plus two of your own. */
const COLUMNS = 14;
const POSTS = 40;

// Strong colours, and not the pale gold of a dance mark. A gate is looked for
// against a noon sky and against a wall of oak, and a pale column is invisible
// against the first and a strong one reads against both.
const NEXT = new Color("#ffae00");
const AFTER = new Color("#1f8fff");
const START = new Color("#12c96a");
const EDGE = new Color("#ff3fa4");

type Column = { gate: Gate; color: Color; width: number };

export function OutingMarks() {
  const columns = useRef<InstancedMesh>(null);
  const posts = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  /**
   * One material each, though they are identical.
   *
   * An instanced mesh gets its colour buffer the first time a colour is set,
   * and the two of these get theirs at different times: the columns when a
   * race is opened, the ring when somebody hides. Sharing a material between
   * a mesh that has the buffer and one that has not makes three rebuild the
   * shader lookup for both on every draw, for the rest of the session.
   */
  const [columnLight, ringLight] = useMemo(() => {
    const light = () =>
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
        // The colour that was asked for, not what the film curve makes of it.
        toneMapped: false,
      });

    return [light(), light()];
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      columnLight.dispose();
      ringLight.dispose();
    },
    [columnLight, ringLight],
  );

  /** Whether anything was drawn last frame. See the early return below. */
  const drawn = useRef(true);

  const dummy = useMemo(() => new Object3D(), []);
  // Asked once. Somebody who wants less motion gets columns that stand still.
  const still = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useFrame((frame) => {
    const gates = columns.current;
    const ring = posts.current;

    if (!gates || !ring) {
      return;
    }

    const state = usePartyStore.getState();

    // Nothing on, and nothing left over from when there was: which is every
    // frame of every flight that is not in a round. Not one allocation, and
    // not fifty-four matrices written to say "still nothing".
    if (
      !drawn.current &&
      (state.status !== "in" || state.outings.length === 0)
    ) {
      return;
    }

    const lit: Column[] = [];
    let edge: { x: number; z: number; radius: number } | null = null;

    if (state.status === "in" && state.party && state.outings.length > 0) {
      const park = parkOf(state.party);
      const you = state.you?.sub;
      const mine = outingOf(state.outings, you);

      for (const outing of state.outings) {
        // Every race that is gathering shows its start to the whole room:
        // that is how anybody finds it to join.
        if (outing.race && outing.phase === "gathering") {
          lit.push({ gate: outing.race.start, color: START, width: 4 });
        }
      }

      if (
        mine?.race &&
        you &&
        (mine.phase === "countdown" || mine.phase === "running")
      ) {
        const lap = raceGates(park, mine.race);
        const total = lap.length * mine.race.laps;
        const passed = Math.max(
          state.sense.gates,
          mine.race.progress[you]?.gates ?? 0,
        );

        if (lap.length > 0 && mine.race.progress[you] && passed < total) {
          lit.push({ gate: lap[passed % lap.length], color: NEXT, width: 5 });

          if (passed + 1 < total && lap.length > 1) {
            lit.push({
              gate: lap[(passed + 1) % lap.length],
              color: AFTER,
              width: 2.4,
            });
          }
        }
      }

      if (
        mine?.hide &&
        mine.hide.area >= 0 &&
        (mine.phase === "hiding" || mine.phase === "seeking")
      ) {
        edge = COURSES[park].hide[mine.hide.area];
      }
    }

    const time = still ? 0 : frame.clock.elapsedTime;
    const roof = ceiling();

    for (let at = 0; at < COLUMNS; at += 1) {
      const column = lit[at];

      if (!column) {
        // Parked under the world at no size. An instance left alone is a unit
        // box at the origin: a small bright cube in the middle of the park.
        dummy.position.set(0, -10_000, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gates.setMatrixAt(at, dummy.matrix);
        continue;
      }

      const { gate } = column;
      const ground = terrainHeight(gate.x, gate.z);
      // A gate under a bridge stops at the height it stops counting at, so
      // the column itself says "under here".
      const top = gate.top ?? roof;
      const height = Math.max(8, top - ground);
      const pulse = 0.88 + Math.sin(time * 2.2 + at) * 0.12;
      /**
       * Thinner as the camera closes on it, and gone before the camera is in
       * it.
       *
       * A column of light you are standing inside is a milky wash over the
       * whole view, and the start of a race is exactly where everybody stands.
       * It is also the right thing to see: a gate that narrows to nothing as
       * you reach it reads as a gate you have taken.
       */
      const away = Math.hypot(
        frame.camera.position.x - gate.x,
        frame.camera.position.z - gate.z,
      );
      const near = Math.min(1, Math.max(0, (away - 12) / 20));
      const width = column.width * pulse * near;

      dummy.position.set(gate.x, ground + height / 2, gate.z);
      dummy.scale.set(width, height, width);
      dummy.rotation.set(0, time * 0.3 + at, 0);
      dummy.updateMatrix();
      gates.setMatrixAt(at, dummy.matrix);
      gates.setColorAt(at, column.color);
    }

    for (let at = 0; at < POSTS; at += 1) {
      if (!edge) {
        dummy.position.set(0, -10_000, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        ring.setMatrixAt(at, dummy.matrix);
        continue;
      }

      const angle = (at / POSTS) * Math.PI * 2;
      const x = edge.x + Math.cos(angle) * edge.radius;
      const z = edge.z + Math.sin(angle) * edge.radius;

      dummy.position.set(x, terrainHeight(x, z) + 11, z);
      dummy.scale.set(2.2, 22, 2.2);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      ring.setMatrixAt(at, dummy.matrix);
      ring.setColorAt(at, EDGE);
    }

    gates.instanceMatrix.needsUpdate = true;
    ring.instanceMatrix.needsUpdate = true;

    if (gates.instanceColor) {
      gates.instanceColor.needsUpdate = true;
    }

    if (ring.instanceColor) {
      ring.instanceColor.needsUpdate = true;
    }

    // What is lit, written where a test can read it. The scene graph is the
    // only thing that knows whether a column was actually drawn.
    gates.userData.outingGates = lit.map((column) => [column.gate.x, column.gate.z]);
    ring.userData.outingEdge = edge ? POSTS : 0;
    drawn.current = lit.length > 0 || edge !== null;
  });

  return (
    <>
      <instancedMesh
        args={[geometry, columnLight, COLUMNS]}
        frustumCulled={false}
        ref={columns}
      />
      <instancedMesh
        args={[geometry, ringLight, POSTS]}
        frustumCulled={false}
        ref={posts}
      />
    </>
  );
}
