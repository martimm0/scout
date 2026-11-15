import { Pass } from "postprocessing";
import {
  HalfFloatType,
  LinearFilter,
  Matrix4,
  NoBlending,
  PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

/**
 * A steady picture, from an unsteady one.
 *
 * A fine voxel model is thousands of hard edges, many of them narrower than a
 * pixel, and as the bee moves each one lands on a slightly different part of
 * the pixel grid every frame. Smoothing each frame on its own (which is what
 * Ultra did at first) cannot fix that: the edge is smooth in every frame and
 * still crawls from one to the next.
 *
 * So each frame is drawn a fraction of a pixel off from the last, in a fixed
 * pattern, and blended into a running picture of all the frames before it.
 * Over eight frames every pixel has been sampled in eight places, which is
 * real detail a single frame does not have, and the edges hold still. The
 * shading and the shadows, which are each drawn with a little noise, settle
 * for the same reason.
 *
 * The running picture has to follow the camera, or everything would smear as
 * the bee turned. Each pixel's depth says where in the park it is; where that
 * place was on screen last frame is where to read the history. What moved on
 * its own (a wing, a leaf in the wind) cannot be followed that way, so the
 * history is not trusted beyond what the pixels round it look like now: it is
 * held to their range, which keeps a moving thing from leaving a ghost.
 *
 * Blending softens slightly, so the picture is sharpened a touch on the way
 * out. Not on the way into the history, or the sharpening would feed on itself.
 */
const VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const RESOLVE = /* glsl */ `
  uniform sampler2D tNow;
  uniform sampler2D tBefore;
  uniform sampler2D tDepth;
  uniform mat4 uUnproject;
  uniform mat4 uBefore;
  uniform vec2 uTexel;
  uniform float uKeep;
  varying vec2 vUv;

  void main() {
    vec3 now = texture2D(tNow, vUv).rgb;

    // What this pixel's neighbours look like now: the history may not stray
    // outside it.
    vec3 least = now;
    vec3 most = now;

    // The four beside it: the corners add little and cost as much again.
    vec3 east = texture2D(tNow, vUv + vec2(uTexel.x, 0.0)).rgb;
    vec3 west = texture2D(tNow, vUv - vec2(uTexel.x, 0.0)).rgb;
    vec3 north = texture2D(tNow, vUv + vec2(0.0, uTexel.y)).rgb;
    vec3 south = texture2D(tNow, vUv - vec2(0.0, uTexel.y)).rgb;

    least = min(least, min(min(east, west), min(north, south)));
    most = max(most, max(max(east, west), max(north, south)));

    // Where in the park this pixel is, and where that was on screen last frame.
    float depth = texture2D(tDepth, vUv).r;
    vec4 place = uUnproject * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 was = uBefore * vec4(place.xyz / place.w, 1.0);
    vec2 at = was.xy / was.w * 0.5 + 0.5;

    vec3 before = clamp(texture2D(tBefore, at).rgb, least, most);
    // Nothing to remember for what has only just come into view.
    float inside = step(0.0, at.x) * step(at.x, 1.0) * step(0.0, at.y) * step(at.y, 1.0) * step(0.0, was.w);

    gl_FragColor = vec4(mix(now, before, uKeep * inside), 1.0);
  }
`;

const OUTPUT = /* glsl */ `
  uniform sampler2D tPicture;
  uniform vec2 uTexel;
  uniform float uSharpen;
  varying vec2 vUv;

  void main() {
    vec3 here = texture2D(tPicture, vUv).rgb;
    vec3 round =
      texture2D(tPicture, vUv + vec2(uTexel.x, 0.0)).rgb +
      texture2D(tPicture, vUv - vec2(uTexel.x, 0.0)).rgb +
      texture2D(tPicture, vUv + vec2(0.0, uTexel.y)).rgb +
      texture2D(tPicture, vUv - vec2(0.0, uTexel.y)).rgb;

    gl_FragColor = vec4(max(here + (here - round * 0.25) * uSharpen, 0.0), 1.0);
  }
`;

/** Where in the pixel each of eight frames is drawn: a Halton sequence, bases 2 and 3. */
const PATTERN: [number, number][] = Array.from({ length: 8 }, (_, index) => {
  const halton = (base: number) => {
    let result = 0;
    let fraction = 1 / base;

    for (let i = index + 1; i > 0; i = Math.floor(i / base)) {
      result += fraction * (i % base);
      fraction /= base;
    }

    return result - 0.5;
  };

  return [halton(2), halton(3)];
});

export class TemporalPass extends Pass {
  private readonly view: PerspectiveCamera;
  /** The same lens with no jitter on it, for working out where things were. */
  private readonly plain = new PerspectiveCamera();
  private readonly resolve: ShaderMaterial;
  private readonly output: ShaderMaterial;
  private kept: WebGLRenderTarget;
  private fresh: WebGLRenderTarget;
  private readonly unproject = new Matrix4();
  private readonly before = new Matrix4();
  private readonly now = new Matrix4();
  private frame = 0;
  /** No history yet: the first frame, or the first after a resize. */
  private blank = true;
  /** How much of the history to keep, when a still is being added up. */
  private share: number | null = null;

  constructor(view: PerspectiveCamera) {
    super("TemporalPass");

    this.view = view;
    this.needsDepthTexture = true;

    const target = () =>
      new WebGLRenderTarget(1, 1, {
        depthBuffer: false,
        magFilter: LinearFilter,
        minFilter: LinearFilter,
        type: HalfFloatType,
      });

    this.kept = target();
    this.fresh = target();

    const plain = { blending: NoBlending, depthTest: false, depthWrite: false, toneMapped: false, vertexShader: VERTEX };

    this.resolve = new ShaderMaterial({
      ...plain,
      fragmentShader: RESOLVE,
      uniforms: {
        tNow: { value: null },
        tBefore: { value: null },
        tDepth: { value: null },
        uUnproject: { value: this.unproject },
        uBefore: { value: this.before },
        uTexel: { value: new Vector2(1, 1) },
        uKeep: { value: 0.9 },
      },
    });
    this.output = new ShaderMaterial({
      ...plain,
      fragmentShader: OUTPUT,
      uniforms: {
        tPicture: { value: null },
        uTexel: { value: new Vector2(1, 1) },
        uSharpen: { value: 0.35 },
      },
    });
    this.fullscreenMaterial = this.resolve;
  }

  /**
   * Nudge the lens for the frame about to be drawn, and note where everything
   * is. Call before the scene is rendered.
   */
  aim(width: number, height: number) {
    const view = this.view;
    const [x, y] = PATTERN[this.frame % PATTERN.length];

    this.frame += 1;
    view.updateMatrixWorld();

    // Last frame's "now" is this frame's "before".
    this.before.copy(this.now);

    // Only the lens, field by field: copying the whole camera would clone
    // everything hung on it, every frame.
    this.plain.fov = view.fov;
    this.plain.aspect = view.aspect;
    this.plain.near = view.near;
    this.plain.far = view.far;
    this.plain.zoom = view.zoom;
    this.plain.updateProjectionMatrix();
    this.now.multiplyMatrices(this.plain.projectionMatrix, view.matrixWorldInverse);
    this.unproject.copy(this.now).invert();

    view.setViewOffset(width, height, x, y, width, height);
  }

  /** Put the lens back as it was found. */
  release() {
    this.view.clearViewOffset();
  }

  /**
   * For a still: make the next frame the `count`th of an even average (so the
   * first counts for everything, the second for half, the eighth for an
   * eighth), or `null` to go back to the running blend.
   */
  average(count: number | null) {
    this.share = count === null ? null : count / (count + 1);
  }

  /** Forget the history: the next frame stands alone. */
  reset() {
    this.blank = true;
  }

  override setDepthTexture(depthTexture: Texture) {
    this.resolve.uniforms.tDepth.value = depthTexture;
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, outputBuffer: WebGLRenderTarget | null) {
    const { resolve, output } = this;

    resolve.uniforms.tNow.value = inputBuffer.texture;
    resolve.uniforms.tBefore.value = this.kept.texture;
    resolve.uniforms.uKeep.value = this.share ?? (this.blank ? 0 : 0.9);
    this.blank = false;

    this.fullscreenMaterial = resolve;
    renderer.setRenderTarget(this.fresh);
    renderer.render(this.scene, this.camera);

    output.uniforms.tPicture.value = this.fresh.texture;
    this.fullscreenMaterial = output;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);

    // What was just drawn is what the next frame remembers.
    [this.kept, this.fresh] = [this.fresh, this.kept];
  }

  override setSize(width: number, height: number) {
    this.kept.setSize(width, height);
    this.fresh.setSize(width, height);
    this.resolve.uniforms.uTexel.value.set(1 / width, 1 / height);
    this.output.uniforms.uTexel.value.set(1 / width, 1 / height);
    this.blank = true;
  }

  override dispose() {
    this.kept.dispose();
    this.fresh.dispose();
    this.resolve.dispose();
    this.output.dispose();
    this.release();
  }
}
