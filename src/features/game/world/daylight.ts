/**
 * The park keeps Pittsburgh time.
 *
 * Not the player's clock. Frick Park is a real place in one real time zone, and
 * if it is dusk in Squirrel Hill then it is dusk in the game, whether you are in
 * Tokyo or Toronto. That is the whole conceit: you are visiting a specific park,
 * not running a simulation on your own schedule.
 *
 * It also means the park changes while you are away from it. Come back in the
 * morning and the spring ephemerals are open; come back after dark and the
 * jack-o'-lanterns are glowing where nothing was before.
 */

export type Phase = "night" | "dawn" | "morning" | "midday" | "afternoon" | "dusk";

export type Daylight = {
  /** Hours since midnight in Pittsburgh, fractional. 13.5 is half past one. */
  hour: number;
  phase: Phase;
  label: string;
  /** "8:42 pm" */
  clock: string;
  /** 0 through the night, 1 in full day, ramping across twilight. */
  brightness: number;
  /**
   * Unit vector toward the key light. Always ABOVE the horizon: in daylight it
   * is the sun on its arc, at night it is the moon. A key light under the floor
   * lights the park from below, which is to say it does not light it at all.
   */
  sun: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  groundColor: string;
  hemiIntensity: number;
  fogColor: string;
  fogDensity: number;
  /** Turbidity and rayleigh for drei's Sky. */
  turbidity: number;
  rayleigh: number;
};

/** Current hour in Pittsburgh, fractional, regardless of where the player is. */
export function pittsburghHour(now = new Date()): number {
  // Intl does the whole job: it knows about daylight saving so we don't have to.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  // Intl renders midnight as 24 in some locales' hour12:false. Fold it back.
  return (hour % 24) + minute / 60;
}

/** "8:42 pm", from a fractional hour. */
export function clockFor(hour: number): string {
  const whole = Math.floor(hour) % 24;
  const minute = Math.floor((hour - Math.floor(hour)) * 60);
  const suffix = whole < 12 ? "am" : "pm";
  const twelve = whole % 12 === 0 ? 12 : whole % 12;

  return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * Rough sunrise and sunset for Pittsburgh, averaged across the year.
 *
 * Deliberately not astronomical. A real solar calculation would be a hundred
 * lines to move the sunrise by forty minutes in February, and nobody would ever
 * notice. What matters is that dawn is dawn and midnight is dark.
 */
const SUNRISE = 6.5;
const SUNSET = 19.5;

export function phaseFor(hour: number): Phase {
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 7.5) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";

  return "dusk";
}

const PHASE_LABEL: Record<Phase, string> = {
  night: "Night",
  dawn: "Dawn",
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  dusk: "Dusk",
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function daylightAt(now = new Date()): Daylight {
  return daylightForHour(pittsburghHour(now));
}

/**
 * The park at a given hour.
 *
 * Split out from the clock so the hour can be pinned. Players never pin it, but
 * the e2e suite has to: half the flowers are shut at night, and a test suite
 * that passes in the afternoon and fails at midnight is not a test suite.
 */
export function daylightForHour(hour: number): Daylight {
  const phase = phaseFor(hour);

  // Where the sun is on its arc: 0 at sunrise, 1 at sunset.
  const day = clamp01((hour - SUNRISE) / (SUNSET - SUNRISE));
  const angle = day * Math.PI;
  const elevation = Math.sin(angle);

  /**
   * How much of the day's light is up, from 0 in the dead of night to 1 in full
   * daylight, ramping across roughly an hour and a half of twilight at each end.
   *
   * Everything visual is a blend between the night look and the day look on this
   * one number, which is what stops the park snapping from noon to midnight at
   * the stroke of a boundary.
   */
  const light = clamp01(
    Math.min(
      (hour - (SUNRISE - 0.8)) / 1.6,
      (SUNSET + 0.8 - hour) / 1.6,
    ),
  );

  const sunDir: [number, number, number] = [
    Math.cos(angle) * -0.9,
    Math.max(0.06, elevation),
    0.35,
  ];

  // The moon. Above the horizon, because its whole job is to make the park
  // visible after dark, and high enough to pick out the tops of things.
  const moonDir: [number, number, number] = [0.42, 0.62, -0.66];

  const sun = normalize([
    lerp(moonDir[0], sunDir[0], light),
    lerp(moonDir[1], sunDir[1], light),
    lerp(moonDir[2], sunDir[2], light),
  ]);

  // Low sun is warm and red because its light comes through more atmosphere.
  // High sun is white.
  const daySun = rgb(255, lerp(168, 248, elevation), lerp(104, 235, elevation));

  return {
    hour,
    phase,
    label: PHASE_LABEL[phase],
    clock: clockFor(hour),
    brightness: light,
    sun,

    // Moonlight is dim and blue, but it is NOT nothing. A night you cannot see
    // in is not a night, it is a bug report.
    sunColor: mix("#a8bcea", daySun, light),
    sunIntensity: lerp(1.0, 2.5, light),

    ambientColor: mix("#8496c4", "#fff2dd", light),
    ambientIntensity: lerp(0.95, 1.3, light),

    groundColor: mix("#3d5045", "#6f8f52", light),
    hemiIntensity: lerp(0.85, 1.35, light),

    fogColor: mix("#2c3757", "#d2e2f0", light),
    // Night closes in around you. It should feel smaller and less certain.
    fogDensity: lerp(0.0022, 0.001, light),
    turbidity: lerp(2, 5, light),
    rayleigh: lerp(0.4, 1.2, light),
  };
}

function normalize([x, y, z]: [number, number, number]): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;

  return [x / length, y / length, z / length];
}

/** Blend two hex colours. `t` of 0 is `a`, 1 is `b`. */
function mix(a: string, b: string, t: number) {
  const parse = (hex: string) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];

  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);

  return rgb(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t));
}

function rgb(r: number, g: number, b: number) {
  const hex = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");

  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * When a species can be found.
 *
 * A window that wraps past midnight (say 20 to 5) is written exactly that way,
 * and `isActive` handles the wrap. Fungi that fruit overnight need it.
 */
export type TimeWindow = {
  from: number;
  to: number;
  /** Shown in the journal when the entry is locked because of the hour. */
  note: string;
};

export function isActive(window: TimeWindow, hour: number) {
  if (window.from <= window.to) {
    return hour >= window.from && hour < window.to;
  }

  // Wraps past midnight.
  return hour >= window.from || hour < window.to;
}

/** "Open from dawn until about eleven." Used in locked journal hints. */
export function describeWindow(window: TimeWindow) {
  return window.note;
}

/** "Mon 14 Jul". The date in Pittsburgh, which is not always the player's date. */
export function pittsburghDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
}
