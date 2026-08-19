/**
 * The park keeps Pittsburgh's calendar, not just its clock.
 *
 * The game already runs on the real hour and the real weather. The one real axis
 * it did not keep was the year: spring ephemerals were modelled as a time-of-day
 * thing (shut by mid-afternoon) when they are really a SPRING thing, and every
 * other flower was open in January. This closes that gap. What blooms changes
 * with the month, because it does: goldenrod in the fall, trout lily in April,
 * nothing at all across the deep of winter but the fungi and the bare wood.
 *
 * Like the hour, this is not a replay mechanic bolted on. It is the deepest
 * come-back reason the game has, and it costs no invented facts: every plant
 * already carries a sourced `bloom` string ("June to August"), and every fungus a
 * `season` ("Autumn to spring"). We read the season out of those rather than
 * making one up.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * When something is out, by month.
 *
 * Months are 1 (January) through 12 (December). A window that wraps the new year
 * is written the way it reads, `{ from: 9, to: 5 }` for autumn-through-spring, and
 * `isInSeason` handles the wrap exactly as `isActive` does for the overnight
 * fungi. `allYear` is its own thing: a few fungi genuinely fruit in every month.
 */
export type SeasonWindow =
  | { allYear: true }
  | { allYear?: false; from: number; to: number };

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** The three months of each season, as [first, last]. Winter wraps. */
const SEASONS: Record<Season, [number, number]> = {
  spring: [3, 5],
  summer: [6, 8],
  autumn: [9, 11],
  winter: [12, 2],
};

const SEASON_LABEL: Record<Season, string> = {
  spring: "spring",
  summer: "summer",
  autumn: "autumn",
  winter: "winter",
};

/**
 * Current Pittsburgh month, fractional, regardless of where the player is.
 *
 * The whole day of the month is folded in (13.5 is the middle of the 15th of a
 * 30-day month) so the visuals can blend across a season boundary instead of
 * snapping from summer to autumn at the stroke of midnight on the 31st.
 */
export function pittsburghMonth(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);

  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 1);

  // Days in this month, in Pittsburgh. Day 0 of next month is the last day here.
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(now),
  );
  const daysInMonth = new Date(year, month, 0).getDate();

  return month + (day - 1) / daysInMonth;
}

export function seasonFor(month: number): Season {
  const m = Math.floor(month);

  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";

  return "winter";
}

/**
 * One end of a written range, resolved to a month.
 *
 * A month name is itself. A season resolves to its first month when it opens a
 * range and its last when it closes one, so "summer to autumn" is June to
 * November. "Late", "early" and "mid" override that: "late summer" is August
 * whichever end it sits on.
 */
function phraseToMonth(phrase: string, isEnd: boolean): number | null {
  const clean = phrase.trim().toLowerCase();
  const late = /\blate\b/.test(clean);
  const early = /\bearly\b/.test(clean);
  const mid = /\bmid\b/.test(clean);
  const word = clean.replace(/\b(late|early|mid)\b/g, "").replace(/-/g, " ").trim();

  if (word in MONTHS) {
    return MONTHS[word];
  }

  const seasonWord = word === "fall" ? "autumn" : word;

  if (seasonWord in SEASONS) {
    const [first, last] = SEASONS[seasonWord as Season];

    if (late) return last;
    if (early) return first;
    if (mid) return first === last ? first : ((first + last) >> 1) || first;

    return isEnd ? last : first;
  }

  return null;
}

/**
 * The season window a sourced `bloom` or `season` string describes.
 *
 * "All year" is its own case. Everything else is "X to Y" or a bare season. If a
 * string cannot be read it falls back to all-year, because a flower quietly
 * hidden the wrong three seasons is worse than one that is merely always shown; a
 * test asserts every real string parses, so a new one that does not is caught
 * rather than silently swallowed.
 */
export function seasonWindow(text: string): SeasonWindow {
  const clean = text.trim().toLowerCase();

  if (/all year|year[- ]round|every month/.test(clean)) {
    return { allYear: true };
  }

  const parts = clean.split(/\s+to\s+/);

  if (parts.length === 2) {
    const from = phraseToMonth(parts[0], false);
    const to = phraseToMonth(parts[1], true);

    if (from !== null && to !== null) {
      return { from, to };
    }
  }

  if (parts.length === 1) {
    // A bare season or month: use its whole span.
    const seasonWord = clean === "fall" ? "autumn" : clean;

    if (seasonWord in SEASONS) {
      const [first, last] = SEASONS[seasonWord as Season];
      return { from: first, to: last };
    }

    const single = phraseToMonth(clean, false);

    if (single !== null) {
      return { from: single, to: single };
    }
  }

  return { allYear: true };
}

/** Whether a season window is open in a given (fractional) month. */
export function isInSeason(window: SeasonWindow, month: number): boolean {
  if (window.allYear) {
    return true;
  }

  const m = Math.floor(month);

  if (window.from <= window.to) {
    return m >= window.from && m <= window.to;
  }

  // Wraps the new year, like autumn-through-spring.
  return m >= window.from || m <= window.to;
}

const MONTH_NAME = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "In bloom July to September. Out of season now; come back in summer." The line
 * a locked journal entry shows when a flower is real but simply not in its month,
 * the seasonal twin of the time-window note.
 */
export function describeSeasonWindow(
  window: SeasonWindow,
  month: number,
): string {
  if (window.allYear || isInSeason(window, month)) {
    return "";
  }

  const start = seasonFor(window.from);

  return `Not in season now. Look for it in ${SEASON_LABEL[start]}, from ${MONTH_NAME[window.from - 1]}.`;
}

/**
 * The same fact in three words, for the badge on the card in the world.
 *
 * That card is a fixed sixteen ems and already carries "Pass the quiz to
 * pollinate" beside this. A sentence there wraps to four lines and pushes Land
 * and Read down out of the card, which on a landscape phone means off the screen.
 * The sentence still gets said in full once you have landed.
 */
export function briefSeasonWindow(
  window: SeasonWindow,
  month: number,
): string {
  if (window.allYear || isInSeason(window, month)) {
    return "";
  }

  return `Blooms in ${SEASON_LABEL[seasonFor(window.from)]}`;
}

/**
 * How the park looks in a given month.
 *
 * Everything visual blends on the fractional month, so the wood turns and the
 * snow comes on over weeks rather than at a stroke. Summer is full green; autumn
 * runs the canopy gold and then thins it; winter strips it near bare and lays
 * snow; spring fills it back in. Kept here so terrain, foliage and the sky all
 * read the season from one place.
 */
export type SeasonLook = {
  season: Season;
  label: string;
  /** A colour the leaves are mixed toward: their own green at 0, this at 1. */
  foliageTint: string;
  foliageMix: number;
  /** How full the canopy is, 1 in leaf and ~0.12 bare in the deep of winter. */
  canopy: number;
  /** Ground snow, 0 through the year and rising across winter. */
  snow: number;
  /** A colour the ground is mixed toward (frost-pale in winter). */
  groundTint: string;
  groundMix: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function seasonLook(month: number): SeasonLook {
  const season = seasonFor(month);
  // Position within the season, 0 at its first day to 1 at its last, so the look
  // can ramp across the three months rather than holding flat.
  const m = ((month - 1) % 12) + 1;

  // Autumn: green in early September, deep gold by late October, thinning into
  // November. Winter: near bare, snow deepening to midwinter and easing off.
  let foliageTint = "#6f8f52";
  let foliageMix = 0;
  let canopy = 1;
  let snow = 0;

  if (season === "autumn") {
    const t = clamp01((m - 9) / 3); // 0 at Sep 1, 1 at end of Nov
    foliageTint = "#c8892f"; // gold and rust
    foliageMix = clamp01(t * 1.3);
    canopy = lerp(1, 0.55, clamp01((t - 0.5) * 2));
  } else if (season === "winter") {
    /**
     * How far through the winter we are: 0 on 1 December, 1 at the end of
     * February. December is 12, then the year turns and January is 1, so the
     * month number goes DOWN in the middle of the season and the index has to be
     * stitched across the join.
     *
     * This was `(m + 1) / 3` on the January side, which is a month out, and the
     * effect was worth more than the arithmetic suggests: the index jumped from
     * 0.32 on 31 December to 0.67 on 1 January, straight over the 0.5 where the
     * sine peaks, so the deepest snow of the year was never drawn at all. Snow
     * topped out at the turn of the year, was gone by the end of January, and
     * February: one of the snowiest months Pittsburgh has, was bare ground for
     * all twenty-eight days of it. The comment above claimed the peak was in
     * January and the code did not do that.
     */
    const w = (m >= 12 ? m - 12 : m) / 3;
    foliageTint = "#8a7f6a"; // bare, grey-brown twigs
    foliageMix = 1;
    canopy = 0.12;
    // A bump: nothing on the first of December, deepest in mid-January, thinning
    // out again through February.
    snow = clamp01(Math.sin(w * Math.PI) * 1.1);
  } else if (season === "spring") {
    const t = clamp01((m - 3) / 3);
    // Bare-ish in early March, filling to full green by late May.
    foliageTint = "#8a7f6a";
    foliageMix = clamp01(1 - t * 1.4);
    canopy = lerp(0.3, 1, clamp01(t * 1.3));
  }

  return {
    season,
    label: SEASON_LABEL[season],
    foliageTint,
    foliageMix,
    canopy,
    snow,
    groundTint: "#e6ecf2",
    groundMix: snow * 0.85,
  };
}
