"use client";

import { createRoot, extend, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";

import { DEFAULT_POLLINATOR, type Pollinator } from "../state/game-store";
import { PollinatorModel } from "./pollinator-model";
import { PollinatorTrail } from "./pollinator-trail";
import styles from "./pollinator-preview.module.css";

/**
 * Your pollinator, turning slowly, in three dimensions.
 *
 * Lifted out of the game scene, where it was the "View pollinator" modal, so the
 * customize page can show you the actual model rather than a flat drawing of it.
 * The customize page used to carry a 2D approximation and a line of text reading
 * "Fly to see the model", which is a strange thing for a page whose entire job is
 * to let you look at your bee.
 *
 * One component, one preview. Two would drift.
 *
 * The `extend` matters and is not boilerplate. R3F only knows the three.js
 * classes it has been handed, and `<color>`, `<ambientLight>` and the rest of the
 * lower-case JSX here are looked up in that namespace at render time. The scene
 * file calls extend at module scope, so this component worked for as long as it
 * lived there and rendered a blank rectangle the moment it moved out: "Color is
 * not part of the THREE namespace", thrown into a canvas nobody was watching.
 *
 * The box this is dropped into needs a real height of its own, and the canvas is
 * positioned out of the flow so it cannot supply one; the reason that matters is
 * in pollinator-preview.module.css, and it is not a style preference.
 */
extend(THREE as unknown as Parameters<typeof extend>[0]);

function PreviewScene({ pollinator }: { pollinator: Pollinator }) {
  const pollinatorRef = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    const pollinatorGroup = pollinatorRef.current;

    if (!pollinatorGroup) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    // The models face -Z (the flight loop's forward vector) and the preview
    // camera sits on +Z, so turn it around to show its face rather than its back.
    pollinatorGroup.rotation.y = Math.PI - 0.34 + Math.sin(elapsed * 0.55) * 0.12;
    pollinatorGroup.position.y = Math.sin(elapsed * 1.8) * 0.045;
    camera.position.set(0.7, 0.36, 3.55);
    camera.lookAt(0, 0.04, 0);
  });

  return (
    <>
      <color attach="background" args={["#fff6dc"]} />
      <ambientLight intensity={1.7} />
      <directionalLight intensity={2.5} position={[-2, 3, -4]} />
      <hemisphereLight args={["#f2fbff", "#f1d68e", 1.2]} />
      <group ref={pollinatorRef} scale={1.45}>
        <PollinatorModel animationState="hovering" pollinator={pollinator} />
      </group>
      {/* Everything you change shows up here, the trail included. The motes are
          scaled to the blown-up preview model. */}
      <PollinatorTrail
        color={pollinator.trailColor ?? DEFAULT_POLLINATOR.trailColor}
        effect={pollinator.trailEffect}
        scale={1.45}
        sourceRef={pollinatorRef}
      />
    </>
  );
}

export function PollinatorPreview({ pollinator }: { pollinator: Pollinator }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  // Read by `configure`, which is async: by the time it renders, the pollinator
  // may already have changed.
  const pollinatorRef = useRef(pollinator);

  /**
   * Create the GL root ONCE, and push changes into it.
   *
   * This effect used to depend on `pollinator`, which meant every colour change
   * tore down the whole WebGL root and built a new one on the same canvas. R3F
   * says exactly what it thinks of that, quietly, in a console warning nobody was
   * reading: "createRoot should only be called once". React's development double
   * invoke was enough to trigger it on its own, so the preview rendered a
   * transparent rectangle and the browser drew a broken-image icon in the corner
   * of it. There were no errors. It simply did not draw.
   */
  const disposeTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    /**
     * Survive React's development double invoke, the same way the scene does.
     *
     * Dropping `pollinator` from the deps stopped a colour change from rebuilding
     * the root, but it did not fix this: with `reactStrictMode`, React still
     * mounts, tears down and remounts once, and a SYNCHRONOUS `root.unmount()` in
     * the cleanup disposes the context that the immediate remount then reuses. So
     * `createRoot` ran twice on the same canvas, the context was lost, and the
     * preview drew a transparent rectangle with a broken-image icon in the corner
     * and no error anywhere. Opening it from the in-game button is exactly the
     * client-side mount where that bites.
     *
     * Deferring the teardown, and reusing the root if a remount gets there first,
     * collapses the double invoke back to one live root.
     */
    if (disposeTimer.current !== null) {
      window.clearTimeout(disposeTimer.current);
      disposeTimer.current = null;
    }

    const root = rootRef.current ?? createRoot(canvas);
    rootRef.current = root;
    let mounted = true;

    const configure = async () => {
      const rect = container.getBoundingClientRect();

      if (!mounted || rect.width <= 0 || rect.height <= 0) {
        return;
      }

      // Do NOT touch canvas.width/height. three owns the drawing buffer, and
      // setting it by hand desyncs the GL viewport from it on retina screens.
      await root.configure({
        camera: { fov: 38, position: [0.7, 0.36, 3.55] },
        dpr: Math.min(window.devicePixelRatio, 2),
        gl: { antialias: true, preserveDrawingBuffer: true },
        size: {
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        },
      });

      if (mounted) {
        root.render(<PreviewScene pollinator={pollinatorRef.current} />);
      }
    };

    void configure();

    const observer = new ResizeObserver(() => {
      void configure();
    });
    observer.observe(container);

    return () => {
      mounted = false;
      observer.disconnect();

      // Deferred, so a StrictMode remount can cancel it above and keep the root.
      // On a real unmount nothing cancels it and the context is released.
      disposeTimer.current = window.setTimeout(() => {
        disposeTimer.current = null;
        rootRef.current = null;
        root.unmount();
      }, 0);
    };
    // Deliberately empty: the root outlives every change to the bee.
  }, []);

  // The bee changed. Re-render it into the root that already exists; React
  // reconciles, and the context is never touched.
  useEffect(() => {
    pollinatorRef.current = pollinator;
    rootRef.current?.render(<PreviewScene pollinator={pollinator} />);
  }, [pollinator]);

  return <canvas className={styles.canvas} ref={canvasRef} />;
}
