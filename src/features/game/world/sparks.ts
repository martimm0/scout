/**
 * Where the fireflies are, this frame.
 *
 * They are drawn as one instanced mesh whose positions are worked out in the
 * frame loop and nowhere kept. On Ultra the nearest few light the grass they
 * are over, so the loop that moves them leaves their positions here for the
 * lamps to find. A flat array, written in place: nothing is allocated.
 */
export const sparks = {
  /** x, y, z for each, up to `MAX`. */
  at: new Float32Array(96 * 3),
  count: 0,
};

export const MAX_SPARKS = 96;
