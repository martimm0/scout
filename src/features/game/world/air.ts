import { Color, Vector2 } from "three";

/**
 * The state of the air, as a handful of numbers every Ultra material shares.
 *
 * The same idea as `wind`: the scene writes these when the hour or the weather
 * changes, and every surface reads them on the graphics card. Nothing here is
 * read on Low or High, which have no shader to read it.
 */
export const air = {
  /** 0 by day, 1 in full dark. Windows light up. */
  night: { value: 0 },
  /** 0 dry, 1 in a downpour. Everything darkens and shines; the ground puddles. */
  wet: { value: 0 },
  /** 0 clear, 1 thick. Lies low: in the ravine, and over the water. */
  mist: { value: 0 },
  mistColor: { value: new Color("#dfe8ee") },
  /** How dark the shadow of a passing cloud is, 0 to about a half. */
  cloud: { value: 0 },
  /** How far the cloud shadows have drifted, in world units. */
  drift: { value: new Vector2() },
  /** The surface of the creek, for what is under it and beside it. */
  water: { value: 0 },
};

/**
 * Cloud shadows only mean something under a broken sky: none on a clear day,
 * and under a full lid the whole park is in one already.
 */
export function cloudShadow(cover: number) {
  const broken = Math.min(1, Math.max(0, (cover - 0.12) / 0.3)) * Math.min(1, Math.max(0, (0.92 - cover) / 0.25));

  return broken * 0.42;
}

/**
 * Mist: at first light after a cool night, in fog, and for a while in rain.
 * `hour` is the park's clock, `fog` and `rain` are 0 to 1.
 */
export function mistiness(hour: number, fog: number, rain: number) {
  // Thickest about six, burned off by nine.
  const dawn = Math.max(0, 1 - Math.abs(hour - 6.2) / 2.6);

  return Math.min(1, dawn * 0.55 + fog * 0.9 + rain * 0.12);
}
