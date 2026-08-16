/**
 * The other things alive in the park.
 *
 * A real park at a bee's scale is not empty between the flowers: it is thick with
 * other foragers working the same blooms, birds turning over the canopy, and at
 * dusk the fireflies come up out of the grass. Scout used to have exactly one
 * moving thing in it, which is the one way the place was quietly untrue.
 *
 * These are ambience, not content. You do not collect them, they never block
 * you, and they are not pollination targets. They are here so the park reads as
 * inhabited, and so its size lands: something moving at a distance is worth more
 * to the sense of scale than any amount of fog.
 *
 * Every cohort is a real thing that really shares these parks, out when it would
 * really be out. Bees do not fly much below ten degrees or in hard rain; birds
 * shelter from a thunderstorm; fireflies want a calm, dry dusk. Those rules are
 * the same kind of truth the flowers keep, and they double as free atmosphere:
 * a cold, wet park is genuinely emptier.
 */

import type { Phase } from "../world/daylight";
import type { Weather } from "../world/weather";

export type AmbientKind = "pollinator" | "bird" | "firefly" | "moth";

export type AmbientCohort = {
  id: string;
  kind: AmbientKind;
  /** A real species that shares these parks. Kept for a future field note. */
  species: string;
  /** One true line about it, for that same note. */
  note: string;
  /** How many of them are about. Tens, not thousands: this is ambience. */
  count: number;
  color: string;
  /** Rough body size in world units. */
  size: number;
  /**
   * The height they keep to. For pollinators and fireflies it is measured ABOVE
   * the ground they are over; for birds it is an absolute altitude, because a
   * bird over the ravine is not fifty units off the creek, it is up in the sky.
   */
  band: [number, number];
  /** Drift speed, world units per second. */
  speed: number;
  /** Whether this cohort is out at all, given the hour and the sky. */
  active: (phase: Phase, weather: Weather) => boolean;
};

const DAY: Phase[] = ["dawn", "morning", "midday", "afternoon", "dusk"];

export const AMBIENT_COHORTS: AmbientCohort[] = [
  {
    id: "foragers",
    kind: "pollinator",
    species: "Other foragers",
    note: "You are not the only one working this meadow.",
    count: 12,
    color: "#eccf74",
    size: 0.5,
    band: [8, 42],
    speed: 6,
    active: (phase, weather) =>
      DAY.includes(phase) &&
      weather.temperature >= 10 &&
      weather.intensity < 0.5 &&
      weather.condition !== "thunderstorm",
  },
  {
    id: "birds",
    kind: "bird",
    species: "American robin",
    note: "A bird, turning over the canopy.",
    count: 3,
    color: "#332c28",
    size: 1.7,
    band: [155, 225],
    speed: 11,
    // Birds are out in most weather, but a thunderstorm puts them in the trees.
    active: (phase, weather) =>
      DAY.includes(phase) && weather.condition !== "thunderstorm",
  },
  {
    id: "moths",
    kind: "moth",
    species: "Hawk moths and owlet moths",
    note: "The night shift, working the flowers that opened at dusk.",
    /**
     * Fewer than the fireflies and much bigger.
     *
     * A meadow at night is not empty, it is differently occupied: most moth
     * species outnumber most butterfly species several times over, and almost
     * nobody sees them. They are here so the dark reads as a shift change
     * rather than as the park with the lights off.
     */
    count: 22,
    // Pale and dusty, the colour a moth looks in the moment it crosses a torch
    // beam. Not additive: a moth is a body, not a light, which is the whole
    // difference between it and the firefly below.
    color: "#cbb897",
    size: 1.6,
    band: [10, 40],
    speed: 8,
    /**
     * Out from dusk until dawn, and grounded by the same things that ground a
     * bee, plus one of their own: moths cannot fly in much wind at all. Their
     * wing loading is low, which is why a breezy night is a quiet night and why
     * a light trap catches almost nothing when it is gusty.
     */
    active: (phase, weather) =>
      (phase === "dusk" || phase === "night" || phase === "dawn") &&
      weather.temperature >= 8 &&
      weather.wind < 20 &&
      weather.falling === "none",
  },
  {
    id: "fireflies",
    kind: "firefly",
    species: "Common eastern firefly",
    note: "Photinus pyralis, signing its name in the dark.",
    count: 80,
    // A hot yellow-green, so additive light reads as a glint rather than a chip.
    color: "#eaffb4",
    size: 0.8,
    // Above the grass line, where they show against the dark trunks and the sky
    // rather than getting lost in the blades they rose out of.
    band: [8, 34],
    // A firefly wants a still, dry dusk. Wind or rain and they stay down.
    speed: 3,
    active: (phase, weather) =>
      (phase === "dusk" || phase === "night") &&
      weather.wind < 16 &&
      weather.falling === "none",
  },
];
