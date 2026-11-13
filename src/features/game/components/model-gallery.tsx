"use client";

import { Html } from "@react-three/drei";
import { Canvas, extend } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";

import { catalog, type ModelSet } from "../models/catalog";
import { pinQuality, type Quality } from "../models/quality";
import { DEFAULT_POLLINATOR, type Pollinator } from "../state/game-store";
import { PollinatorModel } from "./pollinator-model";
import { triangleCount } from "../models/voxel-grid";

extend(THREE as unknown as Parameters<typeof extend>[0]);

const CELL = 3;
const ROW = 3.7;

/**
 * Every model in one picture.
 *
 * Development only. Each model is scaled to fill its cell, so a clover and an
 * oak are the same size here, which is wrong for the park and right for
 * checking that the clover has three leaves.
 */
export function ModelGallery({
  columns: COLUMNS = 6,
  only,
  quality,
  set,
  turn = 0.7,
}: {
  columns?: number;
  /** Just these ids, for a closer look. */
  only?: string[];
  quality: Quality;
  set: ModelSet | "pollinators";
  turn?: number;
}) {
  // The pollinator model asks the store what quality to draw at; pin it here.
  useState(() => pinQuality(quality));

  if (set === "pollinators") {
    return <Pollinators columns={COLUMNS} turn={turn} />;
  }

  return <Models columns={COLUMNS} only={only} quality={quality} set={set} turn={turn} />;
}

const LINEUP: Partial<Pollinator>[] = [
  { type: "bee" },
  { type: "bee", accessory: "cap", wingStyle: "stubby" },
  { type: "bee", accessory: "goggles", bodyColor: "#e06a4a" },
  { type: "bee", accessory: "raincoat" },
  { type: "hoverfly" },
  { type: "hoverfly", accessory: "scarf" },
  { type: "butterfly" },
  { type: "butterfly", accessory: "crown" },
  { type: "moth" },
  { type: "moth", accessory: "lantern" },
];

function Pollinators({ columns, turn }: { columns: number; turn: number }) {
  const rows = Math.ceil(LINEUP.length / columns);

  return (
    <div data-models={LINEUP.length} data-rows={rows} style={{ width: 1260, height: rows * (1560 / columns), background: "#dfe8ee" }}>
      <Canvas camera={{ position: [0, 0, 50], zoom: 420 / columns, near: 0.1, far: 200 }} gl={{ antialias: true, preserveDrawingBuffer: true }} orthographic>
        <ambientLight intensity={0.62} />
        <hemisphereLight args={["#eaf4ff", "#7d8f62", 0.72]} />
        <directionalLight intensity={1.9} position={[6, 10, 8]} />
        {LINEUP.map((look, index) => {
          const x = ((index % columns) - (columns - 1) / 2) * CELL;
          const y = ((rows - 1) / 2 - Math.floor(index / columns)) * ROW;

          return (
            <group key={index} position={[x, y, 0]}>
              <group rotation={[0.32, Math.PI + turn, 0]} scale={2.6}>
                <PollinatorModel animationState="hovering" pollinator={{ ...DEFAULT_POLLINATOR, ...look } as Pollinator} still />
              </group>
              <Html center position={[0, -1.5, 0]} style={{ pointerEvents: "none", width: 200, textAlign: "center" }}>
                <div style={{ font: "600 12px system-ui", color: "#22303a" }}>
                  {look.type} {look.accessory ?? ""}
                </div>
              </Html>
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}

function Models({
  columns: COLUMNS,
  only,
  quality,
  set,
  turn,
}: {
  columns: number;
  only?: string[];
  quality: Quality;
  set: ModelSet;
  turn: number;
}) {
  const models = useMemo(
    () =>
      catalog(set)
        .filter((entry) => !only || only.includes(entry.id))
        .map((entry) => {
        const geometry = entry.build(quality);

        geometry.computeBoundingBox();

        const box = geometry.boundingBox as THREE.Box3;
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());

        return {
          ...entry,
          geometry,
          triangles: triangleCount(geometry),
          scale: 2.3 / Math.max(size.x, size.y, size.z, 1e-6),
          offset: [-centre.x, -box.min.y, -centre.z] as [number, number, number],
        };
      }),
    [only, quality, set],
  );
  const rows = Math.ceil(models.length / COLUMNS);

  return (
    <div
      data-models={models.length}
      data-rows={rows}
      style={{ width: 1260, height: rows * (1560 / COLUMNS), background: "#dfe8ee" }}
    >
      <Canvas
        camera={{ position: [0, 0, 50], zoom: 420 / COLUMNS, near: 0.1, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        orthographic
      >
        {/* The park's own noon, near enough, so a colour here is the colour there. */}
        <ambientLight intensity={0.62} />
        <hemisphereLight args={["#eaf4ff", "#7d8f62", 0.72]} />
        <directionalLight intensity={1.9} position={[6, 10, 8]} />
        {models.map((model, index) => {
          const x = ((index % COLUMNS) - (COLUMNS - 1) / 2) * CELL;
          const y = ((rows - 1) / 2 - Math.floor(index / COLUMNS)) * ROW - 1.2;

          return (
            <group key={model.id} position={[x, y, 0]}>
              <group rotation={[0.32, turn, 0]}>
                <mesh geometry={model.geometry} position={model.offset} scale={model.scale}>
                  <meshLambertMaterial vertexColors />
                </mesh>
              </group>
              <Html center position={[0, -0.45, 0]} style={{ pointerEvents: "none", width: 200, textAlign: "center" }}>
                <div style={{ font: "600 12px system-ui", color: "#22303a" }}>{model.label}</div>
                <div style={{ font: "11px system-ui", color: "#5b6b78" }}>{model.triangles.toLocaleString()} tris</div>
              </Html>
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}
