import { PROPS_BY_PARK } from "./parks/props";
import { activePark, landmarks, terrainHeight } from "./terrain";

/**
 * The Blue Slide, as a line you can ride.
 *
 * The slide is authored in `models/landmarks.ts` as a stack of blue slabs from a
 * high back wall down to a run-out, and placed by `parks/props.ts` at Frick's
 * `blueSlide` landmark, turned a quarter radian. This traces the centre lane
 * down the slabs' top faces so the ride sits ON the slide, not beside it.
 *
 * It reads the position, rotation and sink from the SAME prop the scene renders,
 * so moving or turning the slide moves the ride with it. The one thing that
 * still has to match `blueSlide()` by hand is the slab shape below; the comment
 * there marks the numbers this depends on.
 */

// From blueSlide() in models/landmarks.ts: the slabs run local z -46 (the top,
// at y 34) to z +46 (the bottom, at y 2), each 4 units tall, so a slab's top
// face is 2 above its centre. The bee rides a touch above that.
const TOP_Z = -46;
const BOTTOM_Z = 46;
const TOP_Y = 34;
const DROP = 32;
const SURFACE = 2 + 0.6;

export type SlidePoint = { x: number; y: number; z: number };

export type SlideRide = {
  /** A point on the slide, t running 0 (top) to 1 (bottom of the slope). */
  at: (t: number) => SlidePoint;
  /** Flight yaw pointing down the slope, in the loop's convention where
   *  forward is (sin yaw, 0, -cos yaw). */
  yaw: number;
  top: SlidePoint;
};

/** The active park's Blue Slide as a rideable line, or null if it has none. */
export function slideRide(): SlideRide | null {
  if (activePark().id !== "frick") {
    return null;
  }

  const spot = landmarks().blueSlide;
  const prop = PROPS_BY_PARK.frick.find((entry) => entry.kind === "blueSlide");

  if (!spot || !prop) {
    return null;
  }

  const [x0, z0] = spot;
  const rotation = prop.rotation ?? 0;
  // The prop settles `sink` into the ground (default 1), exactly as it renders.
  const base = terrainHeight(x0, z0) - (prop.sink ?? 1);

  const at = (t: number): SlidePoint => {
    const clamped = Math.max(0, Math.min(1, t));
    const lz = TOP_Z + clamped * (BOTTOM_Z - TOP_Z);
    const ly = TOP_Y - clamped * DROP + SURFACE;

    return {
      x: x0 + lz * Math.sin(rotation),
      y: base + ly,
      z: z0 + lz * Math.cos(rotation),
    };
  };

  const a = at(0);
  const b = at(0.05);

  return { at, yaw: Math.atan2(b.x - a.x, -(b.z - a.z)), top: a };
}
