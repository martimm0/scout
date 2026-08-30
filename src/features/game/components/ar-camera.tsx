"use client";

import { createRoot, extend, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Group, Mesh } from "three";

import { Button } from "@/components/ui/button";

import { useCoarsePointer } from "../hooks/use-media-query";
import type { Pollinator } from "../state/game-store";
import { PollinatorModel } from "./pollinator-model";
import styles from "./ar-camera.module.css";

/**
 * Your pollinator, standing in your kitchen.
 *
 * The phone's camera goes behind a transparent WebGL canvas and the two are
 * flattened into one JPEG when you press the button. That is the whole trick,
 * and it is deliberately not WebXR: WebXR AR does not exist in iOS Safari, and
 * an AR feature that does not work on an iPhone is not an AR feature.
 *
 * The video is a plain `<video>` element rather than a `THREE.VideoTexture`.
 * The browser composites video natively for free, so a mid-range phone spends
 * its GPU on the bee instead of uploading thirty texture frames a second; the
 * capture needs the raw frame anyway and `drawImage` takes it at full intrinsic
 * resolution rather than at whatever the GL viewport happens to be. The cost is
 * that the two layers can be a frame apart in the photo, which does not matter
 * for something hovering in place.
 *
 * The GL root below is a deliberate sibling of `pollinator-preview.tsx` rather
 * than a shared hook. Read that file first: it carries four separately hard-won
 * rules (extend at module scope, create the root once, defer the teardown past
 * React's double invoke, never touch canvas.width) and this repeats all four.
 * What differs is that this one is transparent and has no background colour, so
 * the camera shows through. Extracting the lifecycle would save forty lines and
 * put the working Customize page at risk to do it; worth doing if a third
 * surface ever appears, not for the second.
 */
extend(THREE as unknown as Parameters<typeof extend>[0]);

/**
 * The badge, and both lines already ship somewhere else.
 *
 * "Scout" is the app name in `app/manifest.ts` and, as it happens, also the
 * default bee's own name. The second line is the `<h1>` of the about page.
 * Exported because a test can check the words without a GPU.
 */
export const BADGE_LINES: [string, string] = [
  "Scout",
  "A game about being very small",
];

/** Drawn once into a canvas, because there is no text mesh library here. */
function buildBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 288;

  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "rgba(16, 20, 13, 0.82)";
    context.beginPath();

    /**
     * Rounded if the browser can, square if it cannot.
     *
     * `roundRect` is Safari 16.4 and up. Anything older throws, and this runs
     * inside a `useMemo` during render, so on an iPhone from 2022 it would have
     * taken down the entire camera view: the one device the whole passthrough
     * approach exists to support. A square badge is a rounding difference
     * nobody will notice. A blank page is not.
     */
    if (typeof context.roundRect === "function") {
      context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 56);
    } else {
      context.rect(8, 8, canvas.width - 16, canvas.height - 16);
    }

    context.fill();
    context.strokeStyle = "rgba(246, 209, 90, 0.85)";
    context.lineWidth = 6;
    context.stroke();

    context.textAlign = "center";
    context.fillStyle = "#f6d15a";
    context.font = '800 116px system-ui, -apple-system, "Segoe UI", sans-serif';
    context.fillText(BADGE_LINES[0], canvas.width / 2, 138);

    context.fillStyle = "#eef4e6";
    context.font = '500 54px system-ui, -apple-system, "Segoe UI", sans-serif';
    context.fillText(BADGE_LINES[1], canvas.width / 2, 216);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function Badge() {
  const texture = useMemo(() => buildBadgeTexture(), []);
  const mesh = useRef<Mesh>(null);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, -0.78, 0]} ref={mesh}>
      <planeGeometry args={[1.7, 0.48]} />
      {/* Basic, not lambert: the badge is a label, and a label that dims when
          the scene lighting changes is a label somebody cannot read. */}
      <meshBasicMaterial depthWrite={false} map={texture} toneMapped={false} transparent />
    </mesh>
  );
}

type Gesture = { spin: number; zoom: number };

/** How big the bee is before the player pinches it. */
const BASE_SCALE = 1.5;

/**
 * Far enough back that the whole bee fits a portrait frame.
 *
 * The field of view is VERTICAL, so a tall viewfinder is generous downwards and
 * mean sideways, and a bee is wide. At the preview's distance it filled the
 * frame edge to edge with its wings cut off and pushed the badge out of shot.
 */
const CAMERA_DISTANCE = 6;

function ArScene({
  badge,
  gesture,
  pollinator,
}: {
  badge: boolean;
  gesture: { current: Gesture };
  pollinator: Pollinator;
}) {
  const anchor = useRef<Group>(null);
  const spin = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    const elapsed = clock.getElapsedTime();

    if (spin.current) {
      // The models face -Z and the camera sits on +Z, so turn it round to show
      // its face. Same flip as the preview, for the same reason.
      spin.current.rotation.y = Math.PI + gesture.current.spin;
    }

    if (anchor.current) {
      anchor.current.position.y = Math.sin(elapsed * 1.8) * 0.05;
      // Times the base, not instead of it. Setting the scalar outright quietly
      // threw away the `scale` on the group below and the bee came out at two
      // thirds the size it was authored at, next to a badge sized for the
      // other one.
      anchor.current.scale.setScalar(BASE_SCALE * gesture.current.zoom);
    }

    camera.position.set(0, 0.05, CAMERA_DISTANCE);
    camera.lookAt(0, -0.1, 0);
  });

  return (
    <>
      {/* No <color attach="background">. The camera is the background. */}
      <ambientLight intensity={2.1} />
      <directionalLight intensity={2.4} position={[-2, 3, 2]} />
      <hemisphereLight args={["#ffffff", "#8fa07d", 1.1]} />
      <group ref={anchor}>
        <group ref={spin}>
          <PollinatorModel animationState="hovering" pollinator={pollinator} />
        </group>
        {badge ? <Badge /> : null}
      </group>
    </>
  );
}

type CameraState =
  | "idle"
  | "asking"
  | "live"
  | "denied"
  | "missing"
  | "unsupported"
  | "insecure"
  | "ended";

/** What is on screen when the camera is not. */
const SAYS: Record<Exclude<CameraState, "live" | "asking">, string> = {
  idle: "Point it at something. Your pollinator will stand in the frame.",
  denied:
    "The camera is off for this page. Your browser's settings can turn it back on.",
  missing: "There is no camera on this device.",
  unsupported: "This browser will not hand over a camera.",
  insecure:
    "The camera needs a secure connection, and this page is not on one.",
  ended: "The camera stopped.",
};

export function ArCamera({
  badge,
  pollinator,
}: {
  badge: boolean;
  pollinator: Pollinator;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const gesture = useRef<Gesture>({ spin: 0, zoom: 1 });

  // Press and hold is a touch gesture. Telling somebody on a laptop to do it is
  // a small false claim in player-facing copy, which is a thing this project has
  // been bitten by before.
  const touch = useCoarsePointer();
  const [state, setState] = useState<CameraState>("idle");
  const [shot, setShot] = useState<string | null>(null);
  const [saying, setSaying] = useState<string | null>(null);

  /**
   * Whether this component is still on screen.
   *
   * `getUserMedia` is a promise, and the thing it is waiting on is a permission
   * prompt, which is seconds rather than milliseconds on a first visit. Leave
   * the page inside that window and the teardown ran already, found
   * `stream.current` still null, and stopped nothing; then the promise resolved
   * into a component that no longer exists and handed it a live camera nobody
   * holds a reference to. The indicator light stays on until the tab closes.
   */
  const alive = useRef(true);

  const stop = useCallback(() => {
    for (const track of stream.current?.getTracks() ?? []) {
      track.stop();
    }

    stream.current = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setState("insecure");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    setState("asking");

    try {
      // `ideal`, never `exact`: a laptop has no environment-facing camera and
      // should fall back to the one it has rather than throw.
      const opened = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Gone while the prompt was open. Give the camera straight back: there is
      // nothing left to show it on, and nothing else will ever stop it.
      if (!alive.current) {
        for (const track of opened.getTracks()) {
          track.stop();
        }

        return;
      }

      stream.current = opened;

      const element = video.current;

      if (element) {
        element.srcObject = opened;
        await element.play().catch(() => {});
      }

      /**
       * iOS can kill a backgrounded track outright, and the video element keeps
       * showing the last frame it had. Without this the page looks like a
       * working camera pointed at a photograph.
       */
      opened.getVideoTracks()[0]?.addEventListener("ended", () => {
        setState("ended");
      });

      setState("live");
    } catch (error) {
      const name = (error as { name?: string })?.name;

      setState(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "missing"
          : "denied",
      );
    }
  }, []);

  // The GL root. Created once, torn down late. See the note at the top.
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const disposeTimer = useRef<number | null>(null);
  const props = useRef({ badge, pollinator });

  useLayoutEffect(() => {
    const element = canvas.current;
    const container = element?.parentElement;

    if (!element || !container) {
      return;
    }

    if (disposeTimer.current !== null) {
      window.clearTimeout(disposeTimer.current);
      disposeTimer.current = null;
    }

    const root = rootRef.current ?? createRoot(element);
    rootRef.current = root;
    let mounted = true;

    const configure = async () => {
      const rect = container.getBoundingClientRect();

      if (!mounted || rect.width <= 0 || rect.height <= 0) {
        return;
      }

      // Do NOT touch element.width/height. three owns the drawing buffer.
      await root.configure({
        camera: { fov: 45, position: [0, 0.05, CAMERA_DISTANCE] },
        dpr: Math.min(window.devicePixelRatio, 2),
        // alpha, and preserveDrawingBuffer so the shutter can read the pixels
        // back on a click rather than having to fire inside the render loop.
        gl: { alpha: true, antialias: true, preserveDrawingBuffer: true },
        size: { height: rect.height, left: rect.left, top: rect.top, width: rect.width },
      });

      if (mounted) {
        root.render(
          <ArScene
            badge={props.current.badge}
            gesture={gesture}
            pollinator={props.current.pollinator}
          />,
        );
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

      disposeTimer.current = window.setTimeout(() => {
        disposeTimer.current = null;
        rootRef.current = null;
        root.unmount();
      }, 0);
    };
    // Deliberately empty: the root outlives every change to the bee.
  }, []);

  // Something changed. Re-render it into the root that already exists, and keep
  // the ref fresh so a resize re-configure does not reach for a stale bee.
  useEffect(() => {
    props.current = { badge, pollinator };
    rootRef.current?.render(
      <ArScene badge={badge} gesture={gesture} pollinator={pollinator} />,
    );
  }, [badge, pollinator]);

  // Give the camera back when the page goes away or is hidden. A live track on
  // a backgrounded tab is a light left on in a room nobody is in.
  useEffect(() => {
    // Set here rather than only at declaration, because React's development
    // double invoke mounts, tears down and mounts again on the same instance.
    alive.current = true;

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        stop();
        setState((was) => (was === "live" ? "ended" : was));
      }
    };

    document.addEventListener("visibilitychange", onHide);

    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  /**
   * One JPEG out of two layers.
   *
   * The video is `object-fit: cover`, so what is on screen is a CROP of the
   * intrinsic frame. Reproducing that crop here is the whole job: get it wrong
   * and the photo is not the picture the player framed, and a camera that does
   * not give you what you saw is not a camera.
   */
  const capture = useCallback(() => {
    const element = video.current;
    const gl = canvas.current;
    const box = stage.current?.getBoundingClientRect();

    if (!element || !gl || !box || !element.videoWidth) {
      return;
    }

    const width = 1080;
    const height = Math.max(1, Math.round((width * box.height) / box.width));
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;

    const context = out.getContext("2d");

    if (!context) {
      return;
    }

    const boxAspect = box.width / box.height;
    const videoAspect = element.videoWidth / element.videoHeight;
    let sw = element.videoWidth;
    let sh = element.videoHeight;

    if (videoAspect > boxAspect) {
      sw = element.videoHeight * boxAspect;
    } else {
      sh = element.videoWidth / boxAspect;
    }

    context.drawImage(
      element,
      (element.videoWidth - sw) / 2,
      (element.videoHeight - sh) / 2,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );
    context.drawImage(gl, 0, 0, width, height);

    // 1080 at 0.85, not the album's 720 at 0.72. Those numbers exist because
    // /api/photos posts to Postgres under a 400kB ceiling. This never leaves
    // the phone, and somebody is going to look at it full screen.
    setShot(out.toDataURL("image/jpeg", 0.85));
    setSaying(null);
  }, []);

  const save = useCallback(async () => {
    if (!shot) {
      return;
    }

    const blob = await (await fetch(shot)).blob();
    const file = new File([blob], "scout.jpg", { type: "image/jpeg" });

    // The share sheet first. On iOS it is the only reliable route to the
    // camera roll, and a download link there mostly is not one.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: BADGE_LINES[0] });
        return;
      } catch {
        // Cancelled, or refused. Fall through to the download.
      }
    }

    // A blob URL rather than the data URL: better supported for downloads.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scout.jpg";
    link.click();
    URL.revokeObjectURL(url);
    setSaying(
      touch
        ? "Saved, or in your downloads. You can also press and hold the photo."
        : "It is in your downloads.",
    );
  }, [shot, touch]);

  const drag = useRef<number | null>(null);
  const pinch = useRef<number | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = event.clientX;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (drag.current === null) {
      return;
    }

    gesture.current.spin += (event.clientX - drag.current) * 0.01;
    drag.current = event.clientX;
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length < 2) {
      return;
    }

    const [a, b] = [event.touches[0], event.touches[1]];
    const spread = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    if (pinch.current !== null) {
      const next = gesture.current.zoom * (spread / pinch.current);
      gesture.current.zoom = Math.min(3, Math.max(0.5, next));
    }

    pinch.current = spread;
  };

  const onTouchEnd = () => {
    pinch.current = null;
  };

  return (
    <div className={styles.stage} ref={stage}>
      <video
        aria-hidden="true"
        className={styles.video}
        muted
        playsInline
        ref={video}
      />
      <div
        className={styles.layer}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
      >
        <canvas className={styles.canvas} ref={canvas} />
      </div>

      {state === "live" ? null : (
        <div className={styles.says} role="status">
          <p>{state === "asking" ? "Asking for the camera." : SAYS[state]}</p>
          {state === "asking" || state === "insecure" || state === "unsupported" ? null : (
            <Button onClick={() => void start()}>
              {state === "idle" ? "Turn the camera on" : "Try again"}
            </Button>
          )}
        </div>
      )}

      {state === "live" && !shot ? (
        <div className={styles.controls}>
          <Button aria-label="Take the photo" onClick={capture}>
            Take the photo
          </Button>
        </div>
      ) : null}

      {shot ? (
        <div className={styles.review}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Your pollinator, in the world" data-shot="" src={shot} />
          <p className={styles.hint}>
            {saying ??
              (touch
                ? "Press and hold the photo to keep it, or save it below."
                : "Save it below to keep it.")}
          </p>
          <div className={styles.actions}>
            <Button onClick={() => void save()}>Save it</Button>
            <Button onClick={() => setShot(null)} variant="secondary">
              Take another
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
