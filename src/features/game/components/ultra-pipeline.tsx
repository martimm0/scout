"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { N8AOPostPass } from "n8ao";
import {
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  HueSaturationEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { useEffect, useRef, type RefObject } from "react";

import { ENOUGH_FRAMES, typicalRate } from "../world/pace";
import { still } from "../world/still";
import { TemporalPass } from "./ultra-temporal";
import { UNREFLECTED } from "../world/water";
import {
  Color,
  HalfFloatType,
  Vector2,
  Vector3,
  type Camera,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";

/**
 * Ultra: the park, photographed.
 *
 * Everything up to here draws the scene once, straight to the screen. Ultra
 * draws it into a floating-point picture first and then does to that picture
 * what a camera and an eye would have done to the real thing:
 *
 * - **Ambient occlusion.** Where two blocks meet, less of the sky can see in,
 *   so the crease is darker. It is the single thing that makes a pile of
 *   blocks look like it is sitting on the ground rather than pasted over it.
 * - **Depth of field.** The lens is focused on the bee. What is far behind it
 *   goes soft, and when the bee lands the lens comes in close and the far
 *   bank melts, the way a photograph of something small always looks. That
 *   softness is most of why the park reads as a model on a table.
 * - **Bloom.** Anything brighter than white (the sun, a glint off water or a
 *   wing, a firefly) spills a little into what is next to it.
 * - **Filmic tone and a vignette.**
 *
 * Between the occlusion and the lens the picture is steadied against the
 * frames before it (`ultra-temporal.ts`), which is what does the antialiasing.
 *
 * It takes over drawing the frame (the `1` on `useFrame`), which is why it is
 * a component and not a setting: mounted is on, unmounted is off, and High
 * never pays for any of it.
 */

/**
 * The lens, flying and landed, in world units from the bee.
 *
 * `sharp` is how far either side of it nothing is blurred at all, and `soft`
 * is where the blur is complete. In flight that is a long way: the flowers the
 * player is looking for are tens of units off, and a game cannot blur what it
 * is asking you to find. Landed, the lens comes in and the far bank melts.
 */
const SHARP = { flying: 70, landed: 7 };
const SOFT = { flying: 620, landed: 60 };
const BOKEH = { flying: 2.6, landed: 4 };

/** Everything the photograph is made with, and the one thing done to it each frame. */
function buildPipeline(gl: WebGLRenderer, scene: Scene, camera: Camera) {
  const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType });

  composer.addPass(new RenderPass(scene, camera));

  const occlusion = new N8AOPostPass(scene, camera, 1, 1);

  // In world units: about the height of a flower. Wide enough to ground a
  // tree on the grass, tight enough that a meadow is not one grey smudge.
  occlusion.configuration.aoRadius = 3.2;
  occlusion.configuration.distanceFalloff = 1.2;
  occlusion.configuration.intensity = 2.6;
  // Few samples: the steadying pass after this adds up eight frames of them.
  occlusion.configuration.aoSamples = 8;
  occlusion.configuration.denoiseSamples = 4;
  occlusion.configuration.denoiseRadius = 10;
  occlusion.configuration.halfRes = true;
  // Said out loud, because left unsaid the pass decides for itself: it sees
  // that the scene has transparent things in it (the water, the wings, the
  // dust) and quietly draws the whole park twice more every frame to work out
  // which pixels they cover. Two more scene draws, two more shadow maps and
  // another reflection, for a refinement nobody could see here.
  occlusion.configuration.transparencyAware = false;
  // Shade is not black out of doors. It is the colour of the sky it can
  // still see: a deep cool green here, under leaves.
  occlusion.configuration.color = new Color("#12241c");
  composer.addPass(occlusion);

  // Then steadied against the frames before it: see ultra-temporal.ts. Here,
  // before the lens, so that what the lens blurs is already still.
  const steady = new TemporalPass(camera as PerspectiveCamera);

  composer.addPass(steady);

  const lens = new DepthOfFieldEffect(camera, {
    focusRange: SOFT.flying,
    bokehScale: BOKEH.flying,
    resolutionScale: 0.5,
  });

  lens.target = new Vector3();

  // The library's lens starts to blur the moment anything leaves the focal
  // plane, which softens the bee's own wings. This gives it a zone that is
  // simply sharp, and only then the falloff.
  const circle = lens.cocMaterial;
  const patched = circle.fragmentShader
    .replace("uniform float focusRange;", "uniform float focusRange;uniform float focusSharp;")
    .replace("smoothstep(0.0,focusRange,", "smoothstep(focusSharp,focusRange,");

  if (patched.includes("focusSharp,focusRange")) {
    circle.fragmentShader = patched;
    circle.uniforms.focusSharp = { value: SHARP.flying };
    circle.needsUpdate = true;
  }

  const bloom = new BloomEffect({
    intensity: 0.55,
    luminanceThreshold: 0.98,
    luminanceSmoothing: 0.12,
    mipmapBlur: true,
    radius: 0.72,
  });
  const film = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  // The filmic curve takes some colour out with the glare. This puts a little
  // back, and a little contrast with it: the park is a cheerful place.
  const grade = new HueSaturationEffect({ saturation: 0.16 });
  const punch = new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.08 });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });

  // Shafts of light: the sun, smeared outward from where it stands, wherever
  // the trees leave a gap for it. Only if there is a sun in the scene to smear.
  let sun: Mesh | null = null;

  scene.traverse((node) => {
    if (node.userData.sun) {
      sun = node as Mesh;
    }
  });

  const shafts = sun
    ? new GodRaysEffect(camera, sun, {
        blur: true,
        clampMax: 1,
        decay: 0.93,
        density: 0.9,
        exposure: 0.5,
        resolutionScale: 0.5,
        samples: 36,
        weight: 0.3,
      })
    : null;

  composer.addPass(
    new EffectPass(camera, ...(shafts ? [lens, shafts] : [lens]), bloom, film, grade, punch, vignette),
  );

  const buffer = new Vector2();
  /** One frame: nudge the lens for the steadying pass, then draw. */
  const draw = (delta: number) => {
    gl.getDrawingBufferSize(buffer);
    steady.aim(buffer.x, buffer.y);
    composer.render(delta);
  };

  return {
    composer,
    lens,
    steady,
    bloom,
    occlusion,
    vignette,
    film,
    shafts,
    /**
     * Focus on the bee, with the lens `close` (0 flying, 1 landed), and draw.
     * `clear` is how much direct sun there is to throw shafts: none at night
     * or under a lid of cloud.
     */
    frame(delta: number, bee: Object3D | null, close: number, clear: number) {
      if (shafts) {
        shafts.blendMode.opacity.value = clear;
      }

      if (bee && lens.target) {
        lens.target.copy(bee.position);
      }

      circle.focusRange = SOFT.flying + (SOFT.landed - SOFT.flying) * close;
      lens.bokehScale = BOKEH.flying + (BOKEH.landed - BOKEH.flying) * close;

      if (circle.uniforms.focusSharp) {
        circle.uniforms.focusSharp.value = SHARP.flying + (SHARP.landed - SHARP.flying) * close;
      }

      draw(delta);
    },
    /**
     * One picture to keep: full resolution, the shading sampled properly, the
     * lens at full size. Drawn into the canvas now; call what comes back once
     * the picture has been copied out of it. See `world/still.ts`.
     */
    still() {
      const settings = occlusion.configuration;
      const before = {
        half: settings.halfRes,
        lens: lens.resolution.scale,
        ratio: gl.getPixelRatio(),
        samples: settings.aoSamples,
        smooth: settings.denoiseSamples,
      };
      const { clientHeight: height, clientWidth: width } = gl.domElement;
      const restore = () => {
        gl.setPixelRatio(before.ratio);
        settings.halfRes = before.half;
        settings.aoSamples = before.samples;
        settings.denoiseSamples = before.smooth;
        lens.resolution.scale = before.lens;
        steady.average(null);
        composer.setSize(width, height, false);
        // Resizing clears the canvas: draw it again rather than show a blank frame.
        draw(0);
      };

      try {
        // Two real pixels per pixel, but no wider than a still needs: the
        // picture kept is 720 across, and on a very large window "full
        // resolution" eight times over is more memory than a card has.
        gl.setPixelRatio(Math.max(before.ratio, Math.min(2, STILL_WIDTH / Math.max(1, width))));
        settings.halfRes = false;
        settings.aoSamples = 32;
        settings.denoiseSamples = 12;
        lens.resolution.scale = 1;
        composer.setSize(width, height, false);

        // Eight frames, each a fraction of a pixel from the last, each given
        // the same say in the result: the picture kept has been sampled eight
        // times over.
        for (let frame = 0; frame < 8; frame += 1) {
          steady.average(frame);
          draw(0);
        }
      } catch (error) {
        // Whatever went wrong, the game is not left drawing at a still's settings.
        restore();
        throw error;
      }

      return restore;
    },
  };
}

type Pipeline = ReturnType<typeof buildPipeline>;

function clears(gl: WebGLRenderer, on: boolean) {
  gl.autoClear = on;
}

function seeAll(camera: Camera) {
  camera.layers.enable(UNREFLECTED);
}

/**
 * Hold sixty frames a second by drawing fewer pixels.
 *
 * Nearly everything Ultra adds is paid for per pixel, so the cheapest way to
 * buy back a slow frame is a slightly smaller picture, which the antialiasing
 * at the end mostly hides. Once a second, after the first few: under about
 * fifty-five two seconds running, step the pixel ratio down a quarter; steady for twenty seconds, try one step back up
 * (twice at most, or a machine on the edge would breathe in and out for ever).
 * If a step down does not make it any faster, the screen is the limit and not
 * the card (a fifty hertz display never reaches fifty-five): the pixels are
 * given back and the steering stops.
 * Never below one real pixel per pixel, and never under automation, where the
 * frame rate is the test runner's and not the machine's.
 */
type Pace = {
  time: number;
  /** How long each frame of the second being judged took. */
  frames: number[];
  top: number;
  now: number;
  probes: number;
  steady: number;
  /** The rate just before the last step down, to see whether the step helped. */
  tried: number;
  /** Stepping down did not help: leave the resolution alone from here on. */
  settled: boolean;
  /** Seconds judged so far, while the first few are being let go. */
  warm: number;
  /** Slow seconds in a row. */
  slow: number;
};

const STEP = 0.25;
/** Seconds after the park is whole before the rate is believed. */
const WARM_UP = 5;
const FLOOR = 1;
const TOP = 1.75;
/** A still is drawn no wider than this many real pixels. */
const STILL_WIDTH = 2880;

function steer(
  pace: Pace,
  delta: number,
  setDpr: (dpr: number) => void,
) {
  // A hidden tab, or the park still being built: neither is a slow machine.
  if (delta > 0.5 || pace.top === 0 || pace.settled || document.documentElement.dataset.scoutBuilding !== "0") {
    return;
  }

  pace.time += delta;
  pace.frames.push(delta);

  if (pace.time < 1 || pace.frames.length < ENOUGH_FRAMES) {
    return;
  }

  // The typical frame, not the count of them: a window that is not in front
  // is drawn in bursts, and that is not a slow card. See `world/pace.ts`.
  const rate = typicalRate(pace.frames);

  pace.time = 0;
  pace.frames = [];

  if (navigator.webdriver) {
    return;
  }

  // Not in the first few seconds. Ultra's shaders are built the first time
  // each is drawn, the flowers are rebuilt finer, and for a moment the rate
  // is whatever that leaves: stepping down on it took the resolution from
  // 1.75 to 1.25 on a machine that then drew that at twice the rate asked.
  if (pace.warm < WARM_UP) {
    pace.warm += 1;

    return;
  }

  // The last step down bought nothing: this is a fifty or thirty hertz screen,
  // not a slow card, and fewer pixels will never make it faster. Give the
  // pixels back and stop.
  if (pace.tried > 0) {
    const gained = rate > pace.tried * 1.05;

    pace.tried = 0;

    if (!gained) {
      pace.now = Math.min(pace.top, pace.now + STEP);
      pace.settled = true;
      setDpr(pace.now);

      return;
    }
  }

  // Two slow seconds running, not one: a single one is a hitch.
  pace.slow = rate < 55 ? pace.slow + 1 : 0;

  if (pace.slow >= 2 && pace.now > FLOOR) {
    pace.slow = 0;
    pace.tried = rate;
    pace.now = Math.max(FLOOR, pace.now - STEP);
    pace.steady = 0;
    setDpr(pace.now);
  } else if (rate >= 58) {
    pace.steady += 1;

    if (pace.steady >= 20 && pace.now < pace.top && pace.probes < 2) {
      pace.now = Math.min(pace.top, pace.now + STEP);
      pace.probes += 1;
      pace.steady = 0;
      setDpr(pace.now);
    }
  }
}

export function UltraPipeline({
  clear,
  focus,
  landed,
}: {
  /** How much direct sun there is, 0 to 1: it is what throws the shafts. */
  clear: number;
  /** What the lens is focused on: the bee. */
  focus: RefObject<Object3D | null>;
  /** Feet down on a flower: the lens comes in close. */
  landed: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const setDpr = useThree((state) => state.setDpr);
  const pipeline = useRef<Pipeline | null>(null);
  const pace = useRef<Pace>({ time: 0, frames: [], top: 0, now: 0, probes: 0, steady: 0, tried: 0, settled: false, warm: 0, slow: 0 });
  const close = useRef(0);
  const landedRef = useRef(landed);
  const clearRef = useRef(clear);

  useEffect(() => {
    landedRef.current = landed;
    clearRef.current = clear;
  }, [clear, landed]);

  useEffect(() => {
    // The composer switches off the renderer's own clearing of the frame, for
    // good, and never switches it back. Left like that, High would draw each
    // frame over the last for ever after: put it back when Ultra goes.
    const cleared = gl.autoClear;
    const built = buildPipeline(gl, scene, camera);
    const host = window as unknown as { __scoutUltra?: unknown };
    const root = document.documentElement;

    pipeline.current = built;
    still.take = () => built.still();
    // The small stuff is on a layer of its own on Ultra, so the water can
    // leave it out of its reflection. This camera looks at both.
    seeAll(camera);
    // For the specs: this is how they know the picture came through here.
    root.dataset.scoutUltra = "on";

    // Development only, like the scene handle: the specs read the pipeline
    // through this, and it is how the look gets tuned without a rebuild.
    if (process.env.NODE_ENV !== "production") {
      host.__scoutUltra = { ...built, sharp: SHARP, soft: SOFT, bokeh: BOKEH };
    }

    return () => {
      pipeline.current = null;
      still.take = null;
      delete root.dataset.scoutUltra;
      delete host.__scoutUltra;
      built.composer.dispose();
      clears(gl, cleared);
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    // The renderer is already the right size: it is the fibre root's to manage.
    // (And its pixel ratio, which is why that is in the list: the buffers are
    // sized in real pixels.)
    pipeline.current?.composer.setSize(size.width, size.height, false);
  }, [camera, dpr, gl, scene, size.height, size.width]);

  // Ultra draws at one and three quarter real pixels per pixel at most, where
  // High draws at two. Measured on the machine it was written on: about
  // fifteen milliseconds a frame at two, which is inside the sixteen that
  // sixty a second allows but with nothing to spare, thirteen at one and
  // three quarters, eleven and a half at one and a half. The steadying pass
  // hides most of the difference. Whatever the resolution was before Ultra,
  // it is again after.
  useEffect(() => {
    const before = gl.getPixelRatio();
    const top = Math.min(before, TOP);

    pace.current.top = top;
    pace.current.now = top;

    if (top !== before) {
      setDpr(top);
    }

    return () => setDpr(before);
  }, [gl, setDpr]);

  // The fibre root sets the pixel ratio back to the device's whenever the
  // window is resized. Ultra's is put back, or one resize would leave it
  // drawing at full resolution with the steering convinced it was not.
  useEffect(() => {
    const wanted = pace.current.now;

    if (wanted > 0 && Math.abs(dpr - wanted) > 0.001) {
      setDpr(wanted);
    }
  }, [dpr, setDpr]);

  useFrame((_state, delta) => {
    // The lens eases in when the bee lands, and back out when it leaves.
    close.current += ((landedRef.current ? 1 : 0) - close.current) * (1 - Math.exp(-delta * 2.5));

    steer(pace.current, delta, setDpr);

    if (pipeline.current) {
      pipeline.current.frame(delta, focus.current, close.current, clearRef.current);
    } else {
      // Taking the frame over means drawing it, even before the pipeline is up.
      gl.render(scene, camera);
    }
  }, 1);

  return null;
}
