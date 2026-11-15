/**
 * `n8ao` ships no types. This is the part of it the Ultra pipeline uses.
 */
declare module "n8ao" {
  import type { Pass } from "postprocessing";
  import type { Camera, Color, Scene } from "three";

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);

    configuration: {
      aoSamples: number;
      aoRadius: number;
      denoiseSamples: number;
      denoiseRadius: number;
      distanceFalloff: number;
      intensity: number;
      color: Color;
      halfRes: boolean;
      transparencyAware: boolean;
      depthAwareUpsampling: boolean;
      screenSpaceRadius: boolean;
      gammaCorrection: boolean;
      renderMode: 0 | 1 | 2 | 3 | 4;
    };

    setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
  }
}
