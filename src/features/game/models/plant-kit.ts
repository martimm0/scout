import { MADE, madeOf, type Made } from "./made";
import { shade, tint } from "./voxel";
import { LANCE, type Paint, type PaintFn, type Vec3, type VoxelGrid } from "./voxel-grid";

/**
 * The parts flowers are made of.
 *
 * There were six plant shapes for forty-three plants, so a trillium and a
 * bloodroot were the same model in two whites. A species is now put together
 * from these: a stem that curves, leaves set along it the way that plant sets
 * them, and a bloom built from petals, bells, tubes or clusters. The parts are
 * shared and the arrangements are not, which is roughly how botany works too.
 *
 * Everything is in the plant's own units, base at the origin, Y up.
 */

export const TAU = Math.PI * 2;

/** A point `r` out from `centre` at `angle`, at height `y` above it. */
export function polar(angle: number, r: number, y = 0, centre: Vec3 = [0, 0, 0]): Vec3 {
  return [centre[0] + Math.cos(angle) * r, centre[1] + y, centre[2] + Math.sin(angle) * r];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Where along a stem, 0 at the base to 1 at the tip. */
export type Along = (t: number) => Vec3;

/**
 * A stem from one point to another, bowed by `bend` at its middle.
 *
 * Returns the curve, so leaves and flowers can be hung along the stem that was
 * actually drawn rather than along a straight line it has since left.
 */
export function stem(
  g: VoxelGrid,
  from: Vec3,
  to: Vec3,
  radius: number,
  paint: Paint,
  bend: Vec3 = [0, 0, 0],
  taper = 0.7,
): Along {
  const control = add(mix(from, to, 0.5), bend);
  const at: Along = (t) => {
    const a = mix(from, control, t);
    const b = mix(control, to, t);

    return mix(a, b, t);
  };
  const straight = bend[0] === 0 && bend[1] === 0 && bend[2] === 0;
  const segments = straight ? 1 : 6;

  // A stem is the plant's green, not its bloom: see `models/made.ts`.
  paint = madeOf(paint, MADE.leaf);

  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;

    g.limb(at(t0), at(t1), radius * (1 - (1 - taper) * t0), radius * (1 - (1 - taper) * t1), paint);
  }

  return at;
}

export type LeafOptions = {
  /** How far the tip sits above (or, negative, below) the base. */
  rise?: number;
  profile?: (t: number) => number;
  /** A paler rib down the middle. On by default; off for petals and tiny leaves. */
  rib?: boolean;
  thickness?: number;
  /** What it is made of, when that is not what the plant mostly is. */
  made?: Made;
};

/**
 * One leaf, out from `base` at `angle`. It climbs to two thirds of its length
 * and then the tip relaxes, because a leaf that is one flat slab reads as a
 * plank.
 */
export function leaf(
  g: VoxelGrid,
  base: Vec3,
  angle: number,
  length: number,
  width: number,
  paint: Paint,
  options: LeafOptions = {},
) {
  const rise = options.rise ?? 0;
  const profile = options.profile ?? LANCE;
  const mid = polar(angle, length * 0.62, rise, base);
  const tip = polar(angle, length, rise - Math.abs(length) * 0.14, base);

  // On the fine grid a leaf has a midrib and side veins running off it at a
  // slant, which is most of what makes a green slab read as a leaf.
  if (g.detailed && options.rib !== false && typeof paint === "string" && width > g.size * 4) {
    paint = veined(g, paint, base, angle, length);
  }

  // After the veins, which are worked out on the bare colour.
  if (options.made) {
    paint = madeOf(paint, options.made);
  }

  g.blade(base, mid, width, paint, {
    profile: (t) => profile(t * 0.62),
    thickness: options.thickness,
  });
  g.blade(mid, tip, width, paint, {
    profile: (t) => profile(0.62 + t * 0.38),
    thickness: options.thickness,
  });

}

/** A leaf's colour with its veins drawn in: a pale midrib, darker side veins. */
function veined(g: VoxelGrid, hex: string, base: Vec3, angle: number, length: number): PaintFn {
  const rib = tint(hex, 0.24);
  const vein = shade(hex, 0.12);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pitch = 5 / Math.max(Math.abs(length), 1e-6);

  return (x, _y, z) => {
    const dx = x - base[0];
    const dz = z - base[2];
    const along = dx * cos + dz * sin;
    const across = Math.abs(dz * cos - dx * sin);

    if (across < g.size * 0.7) {
      return rib;
    }

    const stripe = along * pitch - across * pitch * 0.9;

    return stripe - Math.floor(stripe) < 0.2 ? vein : hex;
  };
}

export type LeavesOptions = LeafOptions & {
  /** Where on the stem the leaves start and stop, 0 to 1. */
  from: number;
  to: number;
  /** How many nodes. An opposite pair or a whorl is one node. */
  count: number;
  length: number;
  width: number;
  /** alternate: one a node, spiralling. opposite: pairs, each turned a quarter. */
  pattern?: "alternate" | "opposite" | "whorl";
  /** Leaves per node, for a whorl. */
  whorl?: number;
  /** Leaves at the top are this fraction of the size of those at the bottom. */
  shrink?: number;
};

/** Leaves set along a stem, the way that plant sets them. */
export function leaves(g: VoxelGrid, at: Along, paint: string, options: LeavesOptions) {
  const pattern = options.pattern ?? "alternate";
  const perNode = pattern === "opposite" ? 2 : pattern === "whorl" ? (options.whorl ?? 3) : 1;
  const shrink = options.shrink ?? 0.7;
  const darker = shade(paint, 0.1);

  for (let node = 0; node < options.count; node += 1) {
    const t = options.count === 1 ? 0 : node / (options.count - 1);
    const base = at(options.from + (options.to - options.from) * t);
    const scale = 1 - (1 - shrink) * t;
    // The golden angle for a spiral; a quarter turn between opposite pairs.
    const turn = pattern === "alternate" ? node * 2.4 : node * (Math.PI / perNode) + 0.4;

    for (let i = 0; i < perNode; i += 1) {
      leaf(
        g,
        base,
        turn + (i / perNode) * TAU,
        options.length * scale,
        options.width * scale,
        (node + i) % 2 === 0 ? paint : darker,
        { ...options, made: MADE.leaf },
      );
    }
  }
}

export type PetalOptions = {
  count: number;
  length: number;
  width: number;
  /** Tip height relative to the base: up for a cup, down for a drooping ray. */
  rise?: number;
  /** How far from the centre the petals begin. */
  inner?: number;
  profile?: (t: number) => number;
  phase?: number;
  thickness?: number;
};

/** A ring of petals. `paint` may be two tones, used alternately. */
export function petals(g: VoxelGrid, centre: Vec3, paint: Paint | [Paint, Paint], options: PetalOptions) {
  const reach = (options.inner ?? 0) + options.length;
  // On the fine grid a petal is darker at the throat and paler at the tip.
  const graded = (tone: Paint): Paint =>
    g.detailed && typeof tone === "string" && options.length > g.size * 5
      ? (x, _y, z) => {
          const out = Math.hypot(x - centre[0], z - centre[2]) / reach;

          return out < 0.36 ? shade(tone, 0.14) : out > 0.84 ? tint(tone, 0.14) : tone;
        }
      : tone;
  const tones = (Array.isArray(paint) ? paint : [paint, paint]).map(graded);

  for (let i = 0; i < options.count; i += 1) {
    const angle = (i / options.count) * TAU + (options.phase ?? 0);

    g.blade(
      polar(angle, options.inner ?? 0, 0, centre),
      polar(angle, (options.inner ?? 0) + options.length, options.rise ?? 0, centre),
      options.width,
      tones[i % 2],
      { profile: options.profile, thickness: options.thickness },
    );
  }
}

/** A light and a slightly lighter version of one colour, for alternating petals. */
export function pair(hex: string, amount = 0.14): [string, string] {
  return [hex, tint(hex, amount)];
}

/**
 * A bell hanging from `top`: narrow at the stalk, flaring at the mouth, with a
 * rim in its own colour.
 */
export function bell(g: VoxelGrid, top: Vec3, length: number, radius: number, paint: Paint, rim?: Paint) {
  g.column([top[0], top[1] - length, top[2]], length, radius, radius * 0.4, paint);

  if (rim) {
    g.column([top[0], top[1] - length, top[2]], g.size, radius * 1.15, radius * 1.15, rim);
  }
}

/** A trumpet standing on `base`: narrow at the foot, open at the top, hollowed. */
export function trumpet(
  g: VoxelGrid,
  base: Vec3,
  length: number,
  radius: number,
  paint: Paint,
  throat?: Paint,
) {
  g.column(base, length, radius * 0.28, radius, paint);

  const mouth: Vec3 = [base[0], base[1] + length * 0.72, base[2]];

  g.column(mouth, length * 0.3, radius * 0.3, radius * 0.72, null);

  if (throat) {
    g.column([base[0], base[1] + length * 0.62, base[2]], length * 0.12, radius * 0.45, radius * 0.45, throat);
  }
}

/** A tubular flower pointing out from the stem, with an optional lower lip. */
export function tube(
  g: VoxelGrid,
  base: Vec3,
  angle: number,
  length: number,
  radius: number,
  paint: Paint,
  options: { rise?: number; lip?: Paint; lipLength?: number } = {},
) {
  const tip = polar(angle, length, options.rise ?? 0, base);

  g.limb(base, tip, radius * 0.6, radius, paint);

  if (options.lip) {
    g.blade(tip, polar(angle, options.lipLength ?? length * 0.5, -radius * 1.4, tip), radius * 2.6, options.lip);
  }
}

/**
 * A head of many small florets: a core, with little balls studded over it so it
 * reads as a crowd rather than a lump. Flatten `radius` in Y for a flat-topped
 * cluster, leave it round for a ball.
 */
export function cluster(
  g: VoxelGrid,
  centre: Vec3,
  radius: number | Vec3,
  paint: PaintFn | string,
  options: { florets?: number; floretSize?: number; pale?: string; seed?: number } = {},
) {
  const [rx, ry, rz] = typeof radius === "number" ? [radius, radius, radius] : radius;
  const florets = options.florets ?? 14;
  const size = options.floretSize ?? Math.max(rx, rz) * 0.28;
  const seed = options.seed ?? 0;

  g.ball(centre, [rx * 0.82, ry * 0.82, rz * 0.82], paint, { rough: 0.12 });

  for (let i = 0; i < florets; i += 1) {
    // A sunflower spiral over the upper two thirds, so they never line up.
    const t = (i + 0.5) / florets;
    const tilt = Math.acos(1 - t * 1.5);
    const turn = i * 2.4 + seed;
    const point: Vec3 = [
      centre[0] + Math.sin(tilt) * Math.cos(turn) * rx,
      centre[1] + Math.cos(tilt) * ry,
      centre[2] + Math.sin(tilt) * Math.sin(turn) * rz,
    ];

    g.ball(point, size, options.pale && i % 3 === 0 ? options.pale : paint);
  }
}

/** Florets climbing an axis in a spiral: a spike, a raceme. Thins toward the tip. */
export function spire(
  g: VoxelGrid,
  at: Along,
  options: {
    from: number;
    to: number;
    count: number;
    /** How far a floret stands off the stem at the bottom, and at the top. */
    reach: [number, number];
    /** Draws one floret at a point on the stem, facing `angle`, at size 0 to 1. */
    floret: (base: Vec3, angle: number, size: number, index: number) => void;
  },
) {
  for (let i = 0; i < options.count; i += 1) {
    const t = options.count === 1 ? 0 : i / (options.count - 1);
    const size = options.reach[0] + (options.reach[1] - options.reach[0]) * t;

    options.floret(at(options.from + (options.to - options.from) * t), i * 2.4, size, i);
  }
}

/** A few woody stems fanning from one root, for a shrub. Returns each one's curve. */
export function canes(
  g: VoxelGrid,
  count: number,
  height: number,
  spread: number,
  radius: number,
  paint: Paint,
): Along[] {
  const out: Along[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + 0.5;
    const lean = spread * (0.6 + ((i * 7) % 5) * 0.1);

    out.push(
      stem(
        g,
        polar(angle, radius * 1.5),
        polar(angle, lean, height * (0.82 + ((i * 3) % 4) * 0.06)),
        radius,
        paint,
        polar(angle, lean * 0.25, 0),
        0.5,
      ),
    );
  }

  return out;
}

/** Stripes across a colour by height, for jointed stems and banded caps. */
export function banded(a: string, b: string, period: number, share = 0.5): PaintFn {
  return (_x, y) => (((y % period) + period) % period < period * share ? a : b);
}

/** Speckle: mostly `base`, with `fleck` scattered through at the given rate. */
export function flecked(base: string, fleck: string, rate = 0.12): PaintFn {
  return (_x, _y, _z, h) => (h > 1 - rate ? fleck : base);
}
