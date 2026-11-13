import type { Plant } from "../data/plants";
import {
  add,
  banded,
  bell,
  canes,
  cluster,
  flecked,
  leaf,
  leaves,
  mix,
  pair,
  petals,
  polar,
  spire,
  stem,
  TAU,
  trumpet,
  tube,
  type Along,
} from "./plant-kit";
import { shade, tint } from "./voxel";
import { HEART, LANCE, SPOON, TAPER, type Paint, type Vec3, type VoxelGrid } from "./voxel-grid";

/**
 * Every plant, as itself.
 *
 * A form draws one species into a grid and says where a bee would set down on
 * it. Each is built from what that plant is known by in the field, the thing
 * you would point at to tell it from its neighbour: the milkweed's ball of
 * flowers and its warty pod, the three-three-three of a trillium, the mayapple
 * hiding its one flower under two umbrellas, the Dutchman's breeches hanging
 * upside down on a line.
 *
 * They are caricatures, the way the bee is. The proportions are pushed until
 * the feature reads at flying distance, because a botanically exact jewelweed
 * at this size is an orange dot.
 */
export type PlantForm = (g: VoxelGrid, plant: Plant) => Vec3;

const STEM = "#4a7a3f";
const WOOD = "#6b5136";

/** Broad and rounded: a milkweed leaf, a trillium petal. */
const OVAL = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.45;
/** Parallel-sided, like a strap: grass, spiderwort, a witch-hazel ribbon. */
const STRAP = (t: number) => (t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1) ** 0.6;

/** A hand-shaped leaf: lobes fanning from one point. Geranium, maple, bloodroot. */
function palmate(
  g: VoxelGrid,
  base: Vec3,
  angle: number,
  length: number,
  width: number,
  paint: Paint,
  lobes = 5,
  spread = 1.1,
  rise = 0,
) {
  for (let i = 0; i < lobes; i += 1) {
    const t = lobes === 1 ? 0 : i / (lobes - 1) - 0.5;
    // The middle lobe is the longest; the outer ones fall away.
    const reach = length * (1 - Math.abs(t) * 0.5);

    g.blade(base, polar(angle + t * spread * 2, reach, rise, base), width, paint);
  }
}

/** A feather-shaped leaf: leaflets in pairs down a rib, and one at the end. */
function pinnate(
  g: VoxelGrid,
  base: Vec3,
  angle: number,
  length: number,
  paint: string,
  pairs = 3,
  rise = 0,
) {
  const tip = polar(angle, length, rise, base);

  g.limb(base, tip, 0, 0, shade(paint, 0.15));

  for (let i = 0; i < pairs; i += 1) {
    const at = mix(base, tip, 0.3 + (i / pairs) * 0.6);

    for (const side of [-1, 1]) {
      g.blade(at, polar(angle + side * 1.15, length * 0.34, 0, at), length * 0.17, i % 2 === 0 ? paint : shade(paint, 0.08));
    }
  }

  g.blade(tip, polar(angle, length * 0.3, -length * 0.05, tip), length * 0.18, paint);
}

/** A composite flower head: rays round a raised centre. Returns the top of it. */
function rayHead(
  g: VoxelGrid,
  centre: Vec3,
  rays: Paint | [Paint, Paint],
  options: {
    count: number;
    length: number;
    width: number;
    rise?: number;
    disc: number;
    dome: number;
    discPaint: Paint;
    profile?: (t: number) => number;
  },
): Vec3 {
  petals(g, centre, rays, {
    count: options.count,
    length: options.length,
    width: options.width,
    rise: options.rise ?? 0,
    inner: options.disc * 0.5,
    profile: options.profile ?? SPOON,
  });
  g.ball(centre, [options.disc, options.dome, options.disc], options.discPaint, { half: "upper", rough: 0.1 });

  return [centre[0], centre[1] + options.dome, centre[2]];
}

/** The highest of a set of points: where a bee comes down. */
function highest(...points: Vec3[]): Vec3 {
  return points.reduce((best, point) => (point[1] > best[1] ? point : best));
}

const commonMilkweed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.05, H * 0.9, 0], 0.065, STEM, [0.06, 0, 0.03]);
  const pale = tint(B, 0.35);

  // Big, thick, opposite leaves: the monarch's nursery.
  leaves(g, at, L, { from: 0.16, to: 0.78, count: 4, length: 0.66, width: 0.34, pattern: "opposite", rise: 0.1, profile: OVAL, shrink: 0.8 });

  // Balls of flowers, one at the top and more nodding from the upper leaves.
  const top = add(at(1), [0, 0.1, 0]);

  cluster(g, top, [0.3, 0.25, 0.3], B, { florets: 18, pale });

  for (const side of [-1, 1]) {
    const hang = add(at(0.8), [side * 0.36, 0.02, side * 0.12]);

    stem(g, at(0.8), hang, 0.02, STEM, [0, 0.12, 0]);
    cluster(g, add(hang, [0, -0.12, 0]), 0.2, B, { florets: 12, pale, seed: side });
  }

  // The pod: fat, grey-green and warty, pointing at the sky.
  g.limb(at(0.52), add(at(0.52), [-0.2, 0.1, 0.12]), 0.025, 0.025, STEM);
  g.ball(add(at(0.52), [-0.26, 0.3, 0.14]), [0.085, 0.24, 0.085], flecked("#8ba36a", "#a3b986", 0.3), { rough: 0.15 });

  return add(top, [0, 0.25, 0]);
};

const wildBergamot: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.9, 0], 0.05, "#5a6f48", [0.04, 0, -0.03]);

  leaves(g, at, L, { from: 0.2, to: 0.82, count: 5, length: 0.4, width: 0.15, pattern: "opposite", rise: 0.06 });

  const centre = add(at(1), [0, 0.04, 0]);

  // A collar of pink-flushed bracts, and a ragged mop of tubes exploding from it.
  petals(g, add(centre, [0, -0.05, 0]), ["#9a8fa8", "#7f8f6a"], { count: 7, length: 0.24, width: 0.12, rise: -0.04 });
  g.ball(centre, [0.13, 0.1, 0.13], "#6a5560");

  for (let i = 0; i < 16; i += 1) {
    const lift = 0.02 + (i % 4) * 0.07;

    tube(g, add(centre, [0, 0.04, 0]), i * 2.4, 0.3 - lift * 0.5, 0.03, i % 3 === 0 ? tint(B, 0.2) : B, {
      rise: lift,
      lip: tint(B, 0.3),
      lipLength: 0.07,
    });
  }

  return add(centre, [0, 0.26, 0]);
};

const canadaGoldenrod: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.12, H, 0], 0.05, STEM, [-0.08, 0, 0.04]);

  // Dozens of narrow leaves, all the way up.
  leaves(g, at, L, { from: 0.1, to: 0.7, count: 11, length: 0.38, width: 0.09, rise: 0.05, rib: false });

  // The plume: arching sprays that all carry their flowers along the top side.
  for (let i = 0; i < 7; i += 1) {
    const t = 0.62 + (i / 6) * 0.36;
    const base = at(t);
    const angle = i * 2.4;
    const reach = 0.56 * (1.15 - (i / 6) * 0.6);
    const tip = polar(angle, reach, 0.02, base);
    const spray = stem(g, base, tip, 0.018, STEM, [0, reach * 0.42, 0]);

    for (let k = 1; k <= 6; k += 1) {
      g.ball(add(spray(k / 6), [0, 0.045, 0]), 0.05, k % 2 === 0 ? B : tint(B, 0.22), { rough: 0.25 });
    }
  }

  g.ball(add(at(1), [0, 0.05, 0]), [0.07, 0.1, 0.07], B, { rough: 0.25 });

  return add(at(1), [0, 0.15, 0]);
};

const newEnglandAster: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.8, 0], 0.05, "#5d6b4a", [0.05, 0, 0.02]);

  // Small leaves that clasp the stem, crowded right up it.
  leaves(g, at, L, { from: 0.12, to: 0.9, count: 10, length: 0.3, width: 0.09, rise: 0.04, rib: false });

  const heads: Vec3[] = [];

  [[0, 0.2, 0], [0.34, 0.05, 0.12], [-0.3, 0, -0.18], [0.06, -0.06, -0.36]].forEach((offset, index) => {
    const tip = add(at(1), offset as Vec3);

    stem(g, at(0.72 + index * 0.05), tip, 0.022, STEM, [0, 0.06, 0]);
    // Many thin rays, and a centre that starts yellow and goes rust as it ages.
    heads.push(
      rayHead(g, tip, pair(B, 0.16), {
        count: 20,
        length: 0.2,
        width: 0.045,
        rise: 0.01,
        disc: 0.075,
        dome: 0.05,
        discPaint: index % 2 === 0 ? "#f0c13a" : "#c9813a",
        profile: STRAP,
      }),
    );
  });

  return highest(...heads);
};

const purpleConeflower: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.9, 0], 0.055, "#55704a");

  leaves(g, at, L, { from: 0.1, to: 0.55, count: 4, length: 0.5, width: 0.18, rise: 0.12 });

  // The rays hang down like a shuttlecock under a tall, bristling orange cone.
  return rayHead(g, add(at(1), [0, 0.02, 0]), pair(B, 0.12), {
    count: 13,
    length: 0.36,
    width: 0.1,
    rise: -0.17,
    disc: 0.16,
    dome: 0.22,
    discPaint: flecked("#7a3f1c", "#e08a2c", 0.42),
    profile: STRAP,
  });
};

const blackEyedSusan: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.04, H * 0.92, 0], 0.05, "#5f7a48");

  leaves(g, at, L, { from: 0.1, to: 0.6, count: 4, length: 0.4, width: 0.15, rise: 0.08 });

  const side = add(at(0.55), [-0.34, H * 0.22, 0.16]);

  stem(g, at(0.5), side, 0.03, STEM, [-0.08, 0, 0]);

  const eye = "#2f1d12";
  // Gold rays, darker toward the eye, round a chocolate button.
  const ray = (centre: Vec3): Paint => (x, _y, z) =>
    Math.hypot(x - centre[0], z - centre[2]) < 0.17 ? shade(B, 0.18) : B;
  const main = add(at(1), [0, 0.02, 0]);

  rayHead(g, side, ray(side), { count: 11, length: 0.25, width: 0.09, rise: -0.02, disc: 0.085, dome: 0.1, discPaint: eye });

  return rayHead(g, main, ray(main), { count: 13, length: 0.31, width: 0.1, rise: -0.03, disc: 0.105, dome: 0.13, discPaint: eye });
};

const virginiaBluebell: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // The whole plant leans, and the flowers hang off the end of the lean.
  const at = stem(g, [0, 0, 0], [0.42, H * 0.86, 0], 0.05, "#7fa878", [-0.14, 0.28, 0]);
  const leafGreen = "#7fae84";

  leaves(g, at, mixHex(L, leafGreen), { from: 0.12, to: 0.72, count: 4, length: 0.46, width: 0.3, rise: 0.06, profile: OVAL, shrink: 0.75 });

  const tip = at(1);

  for (let i = 0; i < 7; i += 1) {
    const hang = add(polar(i * 0.95 - 0.6, 0.12 + (i % 3) * 0.1, 0, tip), [0.1, 0.02 - (i % 2) * 0.07, 0]);

    g.limb(tip, hang, 0, 0, "#a9b4d6");
    // Pink in bud, blue once open. Both on the same stem at once.
    bell(g, hang, i < 5 ? 0.32 : 0.18, i < 5 ? 0.105 : 0.055, i < 5 ? B : "#e3a3c6", i < 5 ? tint(B, 0.35) : undefined);
  }

  return add(tip, [0, 0.03, 0]);
};

const joePyeWeed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.86, 0], 0.07, "#6f4d5e");

  // Leaves in rings of four, floor after floor.
  leaves(g, at, L, { from: 0.2, to: 0.8, count: 4, length: 0.56, width: 0.16, pattern: "whorl", whorl: 4, rise: 0.02 });

  const top = add(at(1), [0, 0.1, 0]);
  const pale = tint(B, 0.3);

  // A big dusty-pink dome, made of smaller domes.
  cluster(g, top, [0.34, 0.24, 0.34], B, { florets: 16, pale });

  for (let i = 0; i < 5; i += 1) {
    const centre = polar(i * (TAU / 5), 0.34, -0.12, top);

    stem(g, at(0.9), centre, 0.02, "#6f4d5e");
    cluster(g, centre, [0.2, 0.15, 0.2], i % 2 === 0 ? B : shade(B, 0.08), { florets: 9, pale, seed: i });
  }

  return add(top, [0, 0.24, 0]);
};

const jewelweed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // A watery, see-through stem, swollen at every joint.
  const at = stem(g, [0, 0, 0], [0.1, H * 0.94, 0], 0.055, banded("#9cc07c", "#b7d394", 0.36, 0.7), [-0.06, 0, 0.05]);

  leaves(g, at, L, { from: 0.25, to: 0.95, count: 6, length: 0.34, width: 0.2, rise: 0.04, profile: OVAL });

  const flowers: Vec3[] = [];

  [0.55, 0.74, 0.9].forEach((t, index) => {
    const angle = index * 2.2 + 0.4;
    const base = at(t);
    const hang = polar(angle, 0.3, -0.08, base);

    // Each flower dangles from a thread, under a leaf.
    stem(g, base, hang, 0.012, "#8fb873", [0, 0.1, 0]);

    // The slipper: a wide spotted mouth narrowing back into a hooked spur.
    const mouth = polar(angle, 0.13, 0, hang);
    const tail = polar(angle, -0.17, 0.02, hang);

    g.limb(mouth, tail, 0.085, 0.04, flecked(B, "#b5381f", 0.2));
    g.limb(tail, polar(angle, -0.04, -0.09, tail), 0.03, 0.015, shade(B, 0.12));
    g.blade(mouth, polar(angle, 0.12, -0.05, mouth), 0.17, "#f6c14a");
    flowers.push(add(hang, [0, 0.09, 0]));
  });

  return highest(at(1), ...flowers);
};

const cardinalFlower: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.98, 0], 0.05, "#5a4a3c");

  leaves(g, at, L, { from: 0.08, to: 0.5, count: 6, length: 0.42, width: 0.13, rise: 0.08 });

  // A tower of red flowers, each with three lobes hanging like a tongue.
  spire(g, at, {
    from: 0.52,
    to: 0.97,
    count: 13,
    reach: [0.26, 0.12],
    floret: (base, angle, size) => {
      tube(g, base, angle, size, 0.032, B, { rise: size * 0.4, lip: shade(B, 0.08), lipLength: size * 0.6 });
      g.limb(polar(angle, size, size * 0.4, base), polar(angle, size * 1.15, size * 0.75, base), 0, 0, "#b9b0b0");
    },
  });

  g.ball(add(at(1), [0, 0.03, 0]), [0.035, 0.06, 0.035], shade(B, 0.2));

  return add(at(1), [0, 0.09, 0]);
};

const mayapple: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const fork: Vec3 = [0, H * 0.52, 0];

  g.limb([0, 0, 0], fork, 0.055, 0.05, "#7a9a5c");

  // Two umbrellas on one forked stalk.
  for (const side of [-1, 1]) {
    const hub: Vec3 = [side * 0.3, H * 0.92, side * 0.05];

    g.limb(fork, hub, 0.04, 0.035, "#7a9a5c");
    petals(g, hub, [L, shade(L, 0.08)], { count: 7, length: 0.44, width: 0.24, rise: -0.12, profile: SPOON, phase: side });
    g.ball(hub, [0.08, 0.04, 0.08], tint(L, 0.15));
  }

  // And the one flower, hung in the fork where nothing flying over would see it.
  const bloom: Vec3 = [0.02, H * 0.52 - 0.02, 0.2];

  g.limb(fork, add(bloom, [0, 0.07, 0]), 0, 0, "#7a9a5c");
  petals(g, bloom, pair(B, 0.04), { count: 6, length: 0.15, width: 0.11, rise: -0.05, profile: OVAL });
  g.ball(bloom, [0.05, 0.05, 0.05], "#e8c64a");

  return add(bloom, [0, 0.06, 0]);
};

const troutLily: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // Two leaves from the ground, dappled brown like the side of a brook trout.
  const dappled = (x: number, y: number, z: number, h: number) =>
    h > 0.8 || Math.sin(x * 23 + z * 17) > 0.8 ? "#8f7a52" : L;

  leaf(g, [0, 0.02, 0], 0.5, 0.62, 0.2, dappled, { rise: 0.3 });
  leaf(g, [0, 0.02, 0], 3.5, 0.56, 0.18, dappled, { rise: 0.22 });

  const at = stem(g, [0, 0, 0], [0.16, H * 0.88, 0], 0.03, "#a39566", [-0.1, 0.22, 0]);
  const face = add(at(1), [0.05, -0.05, 0]);

  // The flower nods, and its petals sweep back up over its own head.
  petals(g, face, [B, shade(B, 0.1)], { count: 6, length: 0.3, width: 0.11, rise: 0.2, inner: 0.03 });
  g.ball(face, [0.05, 0.05, 0.05], tint(B, 0.1));

  for (let i = 0; i < 3; i += 1) {
    g.limb(face, polar(i * 2.1, 0.035, -0.15, face), 0, 0, "#8b4a2c");
  }

  return add(at(1), [0, 0.14, 0]);
};

const wildGeranium: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.04, H * 0.82, 0], 0.04, "#6d8553", [0.04, 0, -0.04]);

  // Hand-shaped leaves on long stalks.
  [[0.3, 0.8, 0.52], [0.42, 3.2, 0.44], [0.62, 5.2, 0.36]].forEach(([t, angle, size]) => {
    const hub = polar(angle, size * 0.7, size * 0.3, at(t));

    g.limb(at(t), hub, 0, 0, "#6d8553");
    palmate(g, hub, angle, size, size * 0.3, L, 5, 0.52, -0.05);
  });

  const blooms: Vec3[] = [];

  [[0, 0.16, 0], [0.26, 0.06, 0.14], [-0.2, 0, -0.2]].forEach((offset, index) => {
    const centre = add(at(1), offset as Vec3);

    g.limb(at(0.86), centre, 0, 0, "#6d8553");
    // Five flat petals, veined darker, round a pale eye.
    petals(g, centre, [B, shade(B, 0.07)], { count: 5, length: 0.17, width: 0.14, rise: 0.02, profile: SPOON, phase: index });
    g.ball(centre, [0.04, 0.035, 0.04], "#f2ecd8");
    blooms.push(add(centre, [0, 0.04, 0]));
  });

  // The crane's bill: the long beak the seed is flung from.
  g.limb(at(0.9), add(at(0.9), [-0.1, 0.3, 0.16]), 0.022, 0.008, "#7d8a55");

  return highest(...blooms);
};

const whiteTrillium: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const whorl: Vec3 = [0, H * 0.6, 0];

  g.limb([0, 0, 0], whorl, 0.05, 0.045, "#6a8a56");

  // Three leaves, three sepals, three petals. Everything in threes.
  petals(g, whorl, [L, L], { count: 3, length: 0.56, width: 0.44, rise: -0.04, profile: OVAL, phase: 0.5 });

  const bloom: Vec3 = [0, H * 0.82, 0];

  g.limb(whorl, bloom, 0.028, 0.025, "#6a8a56");
  petals(g, bloom, ["#5d8c4c", "#5d8c4c"], { count: 3, length: 0.24, width: 0.09, rise: -0.02, phase: 0.5 + TAU / 6 });
  petals(g, add(bloom, [0, 0.02, 0]), [B, B], { count: 3, length: 0.36, width: 0.27, rise: 0.1, profile: OVAL, phase: 0.5 });
  g.ball(add(bloom, [0, 0.04, 0]), [0.05, 0.05, 0.05], "#e8c44a");

  return add(bloom, [0, 0.12, 0]);
};

const spicebush: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const twigs = canes(g, 5, H, 0.9, 0.05, WOOD);
  let top: Vec3 = [0, 0, 0];

  twigs.forEach((at, index) => {
    // Flowers straight off the bare twig, in little yellow knots, before the leaves.
    for (let k = 0; k < 5; k += 1) {
      const point = at(0.35 + k * 0.15);

      g.ball(add(point, [0, 0.03, 0]), [0.09, 0.07, 0.09], k % 2 === 0 ? B : tint(B, 0.2), { rough: 0.3 });
    }

    leaf(g, at(0.72), index * 1.3, 0.34, 0.18, L, { profile: OVAL });
    leaf(g, at(0.95), index * 1.3 + 2, 0.3, 0.16, shade(L, 0.08), { profile: OVAL, rise: 0.06 });

    // And the red berries the thrushes strip in autumn.
    if (index % 2 === 0) {
      g.ball(add(at(0.5), [0.06, -0.05, 0.04]), 0.055, "#c3312b");
    }

    top = highest(top, add(at(1), [0, 0.06, 0]));
  });

  return top;
};

const easternRedbud: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const bark = "#4f3d30";

  g.limb([0, 0, 0], [0.1, H * 0.34, 0], 0.2, 0.15, bark);

  let top: Vec3 = [0, 0, 0];

  for (let i = 0; i < 6; i += 1) {
    const angle = i * 1.1 + 0.3;
    const reach = H * (0.3 + (i % 3) * 0.05);
    const end = polar(angle, reach, H * (0.5 + (i % 2) * 0.14), [0.1, H * 0.3, 0]);
    // Zigzag, the way a redbud's twigs really go.
    const at = stem(g, [0.1, H * 0.3, 0], end, 0.1, bark, [0, H * 0.1 * (i % 2 === 0 ? 1 : -0.4), 0], 0.35);

    // Blossom straight off the bark, all the way along the branch.
    for (let k = 1; k <= 9; k += 1) {
      const t = k / 9;

      g.ball(add(at(t), [0, 0.06, 0]), 0.14 + (k % 3) * 0.035, k % 3 === 0 ? tint(B, 0.2) : B, { rough: 0.35 });
    }

    // Heart-shaped leaves, just breaking at the tips.
    leaf(g, at(1), angle, 0.44, 0.4, L, { profile: HEART, rise: -0.06 });
    top = highest(top, add(at(1), [0, 0.16, 0]));
  }

  // Cauliflory: a few flowers on the trunk itself, which is the point of a redbud.
  g.ball([0.24, H * 0.2, 0.08], 0.12, B, { rough: 0.3 });
  g.ball([-0.08, H * 0.27, -0.16], 0.1, tint(B, 0.15), { rough: 0.3 });

  return top;
};

const pickerelweed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // It stands in water, so it stands in a little of it here.
  g.column([0, 0, 0], 0.03, 0.42, 0.42, "#6f9db3");

  // Arrowhead leaves held up like spear blades.
  [[0.9, 0.3, 0.72], [2.9, 0.26, 0.62], [4.9, 0.28, 0.5]].forEach(([angle, lean, top]) => {
    const hub = polar(angle, lean, H * top);

    g.limb([0, 0, 0], hub, 0.04, 0.035, "#5f9463");
    g.blade(hub, polar(angle, 0.16, 0.56, hub), 0.34, L, { profile: HEART, thickness: 0.05 });
    g.blade(hub, polar(angle, -0.14, -0.12, hub), 0.24, shade(L, 0.08), { profile: TAPER });
  });

  const at = stem(g, [0, 0, 0], [-0.06, H, 0.04], 0.04, "#5f9463");

  // A packed spike of small violet flowers, each with a yellow spot.
  spire(g, at, {
    from: 0.66,
    to: 0.98,
    count: 22,
    reach: [0.11, 0.05],
    floret: (base, angle, size, index) => {
      g.ball(polar(angle, size, 0, base), size * 0.55, index % 4 === 0 ? "#f0d24a" : index % 2 === 0 ? B : tint(B, 0.16));
    },
  });

  return add(at(1), [0, 0.05, 0]);
};

const buttonbush: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const twigs = canes(g, 4, H * 0.9, 0.9, 0.06, WOOD);
  let top: Vec3 = [0, 0, 0];

  twigs.forEach((at, index) => {
    leaves(g, at, L, { from: 0.4, to: 0.86, count: 3, length: 0.44, width: 0.22, pattern: "opposite", profile: OVAL, rise: 0.04 });

    // A perfect ball, bristling with pins: one flower head, a pincushion.
    const centre = add(at(1), [0, 0.14, 0]);

    g.ball(centre, 0.17, flecked(B, "#f8f4e6", 0.4), { rough: 0.1 });

    for (let k = 0; k < 18; k += 1) {
      const tilt = Math.acos(1 - ((k + 0.5) / 18) * 2);
      const turn = k * 2.4 + index;
      const out: Vec3 = [Math.sin(tilt) * Math.cos(turn), Math.cos(tilt), Math.sin(tilt) * Math.sin(turn)];

      g.limb(centre, add(centre, [out[0] * 0.26, out[1] * 0.26, out[2] * 0.26]), 0, 0, "#fffdf2");
    }

    top = highest(top, add(centre, [0, 0.26, 0]));
  });

  return top;
};

const swampMilkweed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.72, 0], 0.05, "#5d7a4a");

  // Willow-thin leaves, nothing like its roadside cousin's.
  leaves(g, at, L, { from: 0.14, to: 0.9, count: 6, length: 0.5, width: 0.1, pattern: "opposite", rise: 0.14, rib: false });

  let top: Vec3 = [0, 0, 0];

  [[0, 0.3, 0], [0.34, 0.22, 0.1], [-0.3, 0.2, -0.16]].forEach((offset, index) => {
    const head = add(at(1), offset as Vec3);

    stem(g, at(0.84), head, 0.025, "#5d7a4a", [0, 0.05, 0]);
    // Flat-topped, two-tone: deep pink hoods over pale pink crowns.
    cluster(g, head, [0.25, 0.1, 0.25], index === 0 ? B : shade(B, 0.06), { florets: 14, pale: "#f6cfe0", floretSize: 0.055, seed: index });
    top = highest(top, add(head, [0, 0.1, 0]));
  });

  // A slim pod, upright as a candle.
  g.ball(add(at(0.66), [0.16, 0.2, -0.1]), [0.04, 0.2, 0.04], "#86a468");

  return top;
};

const boneset: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.8, 0], 0.055, "#6a8556");

  // Each pair of leaves is joined round the stem, so the stem seems to grow
  // straight through one long leaf. That is the whole plant, and its name.
  for (let i = 0; i < 4; i += 1) {
    const node = at(0.18 + i * 0.19);
    const turn = i * (Math.PI / 2) + 0.3;
    const size = 0.62 - i * 0.08;

    for (const side of [0, Math.PI]) {
      g.blade(node, polar(turn + side, size, -0.06, node), size * 0.3, i % 2 === 0 ? L : shade(L, 0.08), { profile: TAPER });
    }

    g.column(add(node, [0, -0.02, 0]), 0.04, 0.09, 0.09, shade(L, 0.12));
  }

  let top: Vec3 = [0, 0, 0];

  // A flat table of fuzzy white heads.
  for (let i = 0; i < 6; i += 1) {
    const head = i === 0 ? add(at(1), [0, 0.2, 0]) : polar(i * (TAU / 5), 0.3, 0.16, at(1));

    stem(g, at(0.88), head, 0.018, "#6a8556");
    cluster(g, head, [0.17, 0.07, 0.17], flecked(B, "#fffdf7", 0.4), { florets: 9, floretSize: 0.045, seed: i });
    top = highest(top, add(head, [0, 0.07, 0]));
  }

  return top;
};

const blueVervain: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.62, 0], 0.05, "#5f6f4c");

  leaves(g, at, L, { from: 0.2, to: 0.92, count: 4, length: 0.42, width: 0.13, pattern: "opposite", rise: 0.1 });

  let top: Vec3 = [0, 0, 0];

  // A candelabra of pencil-thin spikes. Each blooms in a ring that climbs it:
  // seed below the ring, bud above, flowers only on the band between.
  for (let i = 0; i < 7; i += 1) {
    const centre = i === 0;
    const tip = centre ? add(at(1), [0, H * 0.4, 0]) : polar(i * (TAU / 6), 0.3, H * (0.26 + (i % 2) * 0.06), at(1));
    const ring = at(1)[1] + (tip[1] - at(1)[1]) * (0.35 + (i % 3) * 0.14);

    stem(g, at(1), tip, 0.03, (_x, y) => (y < ring - 0.06 ? "#6f7a52" : y > ring + 0.07 ? "#7c86a8" : B), centre ? [0, 0, 0] : polar(i * (TAU / 6), 0.14, -0.08), 0.6);
    g.column([mixAt(at(1), tip, ring)[0], ring - 0.05, mixAt(at(1), tip, ring)[2]], 0.11, 0.07, 0.07, i % 2 === 0 ? B : tint(B, 0.18));
    top = highest(top, tip);
  }

  return top;
};

const mapleleafViburnum: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const twigs = canes(g, 4, H * 0.86, 0.8, 0.05, WOOD);
  let top: Vec3 = [0, 0, 0];

  twigs.forEach((at, index) => {
    // Maple leaves on a shrub: three pointed lobes, in opposite pairs.
    for (const t of [0.5, 0.78]) {
      for (const side of [0, Math.PI]) {
        const angle = index * 1.57 + side + t * 3;
        const hub = polar(angle, 0.12, 0.02, at(t));

        palmate(g, hub, angle, 0.4, 0.2, t > 0.6 ? L : shade(L, 0.08), 3, 0.5, -0.03);
      }
    }

    const head = add(at(1), [0, 0.12, 0]);

    // A flat lace cap of cream flowers.
    cluster(g, head, [0.26, 0.07, 0.26], B, { florets: 14, floretSize: 0.05, pale: "#fbf8ec", seed: index });
    top = highest(top, add(head, [0, 0.07, 0]));
  });

  // Last year's berries, blue-black, on one stem.
  for (let k = 0; k < 5; k += 1) {
    g.ball(polar(k * 1.3, 0.09, 0, add(twigs[1](0.62), [0.12, 0.02, 0.1])), 0.05, "#2b2f4a");
  }

  return top;
};

const whiteSnakeroot: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.04, H * 0.78, 0], 0.045, "#5f7a4c", [0.05, 0, 0.03]);

  // Heart-shaped, sharply toothed leaves, each on a stalk of its own.
  for (let i = 0; i < 3; i += 1) {
    const node = at(0.25 + i * 0.22);

    for (const side of [0, Math.PI]) {
      const angle = i * 1.57 + side + 0.4;
      const hub = polar(angle, 0.16, 0.04, node);

      g.limb(node, hub, 0, 0, "#5f7a4c");
      leaf(g, hub, angle, 0.4 - i * 0.05, 0.3 - i * 0.04, i % 2 === 0 ? L : shade(L, 0.08), { profile: HEART });
    }
  }

  let top: Vec3 = [0, 0, 0];

  // Loose sprays of the whitest white in the autumn woods.
  for (let i = 0; i < 7; i += 1) {
    const head = polar(i * 2.4, i === 0 ? 0 : 0.16 + (i % 3) * 0.09, 0.14 + (i % 2) * 0.1, at(1));

    stem(g, at(0.82), head, 0.014, "#5f7a4c", [0, 0.04, 0]);
    g.ball(head, [0.085, 0.06, 0.085], flecked(B, "#ffffff", 0.5), { rough: 0.3 });
    top = highest(top, add(head, [0, 0.06, 0]));
  }

  return top;
};

const bloodroot: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const bloom: Vec3 = [0, H * 0.9, 0];

  g.limb([0, 0, 0], bloom, 0.03, 0.028, "#b98a6a");

  // One leaf, lobed like a cupped hand, wrapped round the flower stalk as if
  // to keep it warm, which early in spring is what it is doing.
  const hub: Vec3 = [0.06, H * 0.36, 0];

  g.limb([0.05, 0, 0], hub, 0.035, 0.03, "#b98a6a");
  palmate(g, hub, 0, 0.5, 0.26, mixHex(L, "#7fa888"), 7, 1.25, 0.24);

  // A dozen narrow white petals round a gold middle.
  petals(g, bloom, pair(B, 0.03), { count: 10, length: 0.25, width: 0.085, rise: 0.04, profile: STRAP });
  g.ball(add(bloom, [0, 0.02, 0]), [0.06, 0.045, 0.06], flecked("#e7b93c", "#f6da6a", 0.3));

  return add(bloom, [0, 0.07, 0]);
};

const cutleafToothwort: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const whorl: Vec3 = [0, H * 0.55, 0];
  const at = stem(g, [0, 0, 0], [0.06, H * 0.9, 0], 0.035, "#6d8a58", [0, 0, 0.03]);

  // Three leaves in a ring, each slashed into narrow, toothed fingers.
  for (let i = 0; i < 3; i += 1) {
    const angle = i * (TAU / 3) + 0.4;
    const hub = polar(angle, 0.1, 0, whorl);

    palmate(g, hub, angle, 0.46, 0.07, i === 1 ? shade(L, 0.08) : L, 5, 0.5, -0.02);
  }

  let top: Vec3 = [0, 0, 0];

  // A loose bunch of four-petalled flowers, white going pink with age.
  for (let i = 0; i < 6; i += 1) {
    const centre = polar(i * 2.4, 0.06 + (i % 3) * 0.05, -(i % 2) * 0.07, add(at(1), [0, 0.04, 0]));

    g.limb(at(0.9), centre, 0, 0, "#6d8a58");
    petals(g, centre, i % 3 === 0 ? "#f0d5e0" : B, { count: 4, length: 0.1, width: 0.065, rise: 0.06, profile: SPOON, phase: i });
    top = highest(top, add(centre, [0, 0.06, 0]));
  }

  return top;
};

const dutchmansBreeches: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const lace = mixHex(L, "#8fb0a0");

  // A cushion of grey-green lace on the ground.
  for (let i = 0; i < 5; i += 1) {
    const angle = i * (TAU / 5) + 0.3;
    const hub = polar(angle, 0.2, H * 0.24);

    g.limb([0, 0, 0], hub, 0, 0, "#8a9a78");
    pinnate(g, hub, angle, 0.4, i % 2 === 0 ? lace : shade(lace, 0.08), 3, -0.04);
  }

  // A bare stalk arching over it, with the washing hung out along it.
  const at = stem(g, [0, 0, 0], [0.62, H * 0.9, 0], 0.025, "#b08a7a", [-0.16, 0.4, 0]);
  let top: Vec3 = [0, 0, 0];

  for (let i = 0; i < 4; i += 1) {
    const peg = at(0.42 + i * 0.14);
    const waist = add(peg, [0, -0.22, 0]);

    g.limb(peg, waist, 0, 0, "#b08a7a");

    // Pantaloons, upside down: two legs up and apart, a yellow waistband below.
    for (const side of [-1, 1]) {
      g.limb(add(waist, [0, 0.02, 0]), add(waist, [0, 0.2, side * 0.1]), 0.06, 0.036, B);
    }

    g.ball(waist, [0.055, 0.04, 0.065], "#edc84a");
    top = highest(top, peg);
  }

  return add(top, [0, 0.03, 0]);
};

const greatBlueLobelia: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.97, 0], 0.06, "#5a7a4a");

  leaves(g, at, L, { from: 0.08, to: 0.5, count: 7, length: 0.4, width: 0.14, rise: 0.08 });

  // A fat, crowded spike of blue: each flower two-lipped, with a pale striped throat.
  spire(g, at, {
    from: 0.46,
    to: 0.97,
    count: 20,
    reach: [0.2, 0.09],
    floret: (base, angle, size) => {
      g.limb(base, polar(angle, size * 0.4, size * 0.3, base), 0.03, 0.03, "#5f8a52");
      tube(g, polar(angle, size * 0.3, size * 0.25, base), angle, size * 0.8, 0.042, B, { rise: size * 0.2, lip: "#c9d4f2", lipLength: size * 0.55 });
    },
  });

  return add(at(1), [0, 0.06, 0]);
};

const ohioSpiderwort: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.05, H * 0.86, 0], 0.045, "#6c8f6a", [0.04, 0, 0]);
  const grassy = mixHex(L, "#7fa890");

  // Long, folded, grass-like leaves that arch right over.
  [[0.05, 0.4, 1.15], [0.2, 2.6, 1], [0.4, 4.4, 0.9], [0.62, 1.4, 0.75], [0.85, 5.6, 0.6]].forEach(([t, angle, length], index) => {
    const base = at(t);
    const crest = polar(angle, length * 0.5, length * 0.42, base);

    g.blade(base, crest, 0.14, index % 2 === 0 ? grassy : shade(grassy, 0.08), { profile: STRAP });
    g.blade(crest, polar(angle, length * 0.5, -length * 0.2, crest), 0.12, grassy, { profile: TAPER });
  });

  const head = add(at(1), [0, 0.05, 0]);
  let top = head;

  // Three-petalled flowers, open for one morning each, over a knot of drooping buds.
  [[0.1, 0.1, 0.04], [-0.12, 0.04, 0.1], [0, 0.02, -0.14]].forEach((offset, index) => {
    const centre = add(head, offset as Vec3);

    petals(g, centre, [B, tint(B, 0.1)], { count: 3, length: 0.2, width: 0.21, rise: 0.02, profile: OVAL, phase: index * 0.7 });

    for (let k = 0; k < 3; k += 1) {
      g.limb(centre, polar(k * 2.1 + index, 0.04, 0.07, centre), 0, 0, "#f2cf3e");
    }

    top = highest(top, add(centre, [0, 0.07, 0]));
  });

  for (let k = 0; k < 5; k += 1) {
    g.ball(polar(k * 1.3, 0.09, -0.1, head), [0.03, 0.045, 0.03], "#7d9a78");
  }

  return top;
};

const healAll: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.02, H * 0.62, 0], 0.045, "#6a7a52");

  leaves(g, at, L, { from: 0.15, to: 0.95, count: 3, length: 0.3, width: 0.15, pattern: "opposite", profile: OVAL, rise: 0.03 });

  // A blocky little tower of overlapping bracts, with hooded flowers poking out
  // of it a ring at a time.
  const base = at(1);
  const tower = H * 0.36;

  g.column(base, tower, 0.105, 0.085, banded("#6f6a4a", "#7d5a6e", tower / 5, 0.5));

  for (let ring = 0; ring < 3; ring += 1) {
    for (let k = 0; k < 4; k += 1) {
      const angle = k * (TAU / 4) + ring * 0.8;
      const from = add(base, [0, tower * (0.22 + ring * 0.28), 0]);

      // The hood above, the fringed paler lip below.
      tube(g, from, angle, 0.17, 0.036, B, { rise: 0.03, lip: tint(B, 0.35), lipLength: 0.07 });
    }
  }

  return add(base, [0, tower, 0]);
};

const virginiaWaterleaf: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // Leaves spotted pale, as if water had dripped on them and dried.
  const stained = flecked(L, "#b7d2ae", 0.2);
  const at = stem(g, [0, 0, 0], [0.04, H * 0.82, 0], 0.04, "#6a8a5a", [0.03, 0, 0.03]);

  [[0.2, 0.7, 0.56], [0.36, 3, 0.5], [0.5, 5, 0.44]].forEach(([t, angle, size]) => {
    const hub = polar(angle, size * 0.5, size * 0.2, at(t));

    g.limb(at(t), hub, 0, 0, "#6a8a5a");
    // Cut into five or seven pointed lobes.
    g.blade(hub, polar(angle, size, -0.06, hub), size * 0.36, stained);

    for (const side of [-1, 1]) {
      g.blade(hub, polar(angle + side * 1.1, size * 0.52, -0.03, hub), size * 0.26, stained);
      g.blade(polar(angle, size * 0.4, -0.02, hub), polar(angle + side * 0.8, size * 0.5, -0.05, polar(angle, size * 0.4, 0, hub)), size * 0.22, stained);
    }
  });

  // A ball of bells, whiskery with stamens that stick out twice as far.
  const head = add(at(1), [0, 0.1, 0]);

  cluster(g, head, [0.17, 0.14, 0.17], B, { florets: 12, floretSize: 0.055, pale: tint(B, 0.3) });

  for (let k = 0; k < 16; k += 1) {
    const tilt = Math.acos(1 - ((k + 0.5) / 16) * 1.4);
    const turn = k * 2.4;

    g.limb(head, add(head, [Math.sin(tilt) * Math.cos(turn) * 0.3, Math.cos(tilt) * 0.28, Math.sin(tilt) * Math.sin(turn) * 0.3]), 0, 0, "#f4f0fa");
  }

  return add(head, [0, 0.28, 0]);
};

const wildColumbine: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.08, H * 0.94, 0], 0.03, "#7a6f5a", [-0.06, 0, 0.04]);
  const soft = mixHex(L, "#8fb08a");

  // Leaves in threes of threes, scalloped and blue-green.
  [[0.14, 0.6], [0.28, 2.7], [0.42, 4.6]].forEach(([t, angle]) => {
    const hub = polar(angle, 0.26, 0.12, at(t));

    g.limb(at(t), hub, 0, 0, "#7a6f5a");

    for (let k = 0; k < 3; k += 1) {
      const leaflet = polar(angle + (k - 1) * 1.1, 0.12, 0, hub);

      palmate(g, leaflet, angle + (k - 1) * 1.1, 0.17, 0.1, k === 1 ? soft : shade(soft, 0.07), 3, 0.55);
    }
  });

  let top: Vec3 = [0, 0, 0];

  // Lanterns: five red spurs standing straight up, yellow skirts and a tassel
  // of stamens hanging below.
  [[1, 0.14, 0.02, 0.1], [0.82, -0.2, 0.06, -0.14], [0.68, 0.24, 0.04, -0.2]].forEach(([t, dx, dy, dz]) => {
    const peg = add(at(t), [dx, dy, dz]);
    const centre = add(peg, [0, -0.12, 0]);

    stem(g, at(t), peg, 0.012, "#7a6f5a", [0, 0.08, 0]);
    g.limb(peg, centre, 0, 0, "#7a6f5a");

    for (let k = 0; k < 5; k += 1) {
      const angle = k * (TAU / 5);
      const knob = polar(angle, 0.05, 0.2, centre);

      g.limb(polar(angle, 0.055, -0.04, centre), knob, 0.03, 0.018, B);
      g.ball(knob, 0.026, shade(B, 0.1));
      g.blade(polar(angle + 0.63, 0.03, -0.03, centre), polar(angle + 0.63, 0.1, -0.1, centre), 0.06, "#f1cf4a");
    }

    g.limb(centre, add(centre, [0, -0.2, 0]), 0.02, 0.012, "#efd35a");
    top = highest(top, add(peg, [0, 0.1, 0]));
  });

  return top;
};

const pawpaw: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const bark = "#6a655c";

  g.limb([0, 0, 0], [0, H * 0.5, 0], 0.17, 0.12, bark);

  let top: Vec3 = [0, 0, 0];

  for (let i = 0; i < 5; i += 1) {
    const angle = i * 1.26 + 0.2;
    const end = polar(angle, H * 0.3, H * (0.34 + (i % 2) * 0.1), [0, H * 0.5, 0]);
    const at = stem(g, [0, H * (0.36 + i * 0.03), 0], end, 0.08, bark, [0, H * 0.06, 0], 0.4);

    // Huge leaves that hang like the ears of a hound.
    for (let k = 0; k < 4; k += 1) {
      const turn = angle + (k - 1.5) * 0.8;

      g.blade(at(1), polar(turn, 0.6, -0.16, at(1)), 0.5, k % 2 === 0 ? L : shade(L, 0.09), { profile: OVAL });
      g.blade(polar(turn, 0.56, -0.16, at(1)), polar(turn, 1.25, -0.72, at(1)), 0.5, k % 2 === 0 ? L : shade(L, 0.09), { profile: (t) => OVAL(0.5 + t * 0.5) });
    }

    // Flowers the colour of old meat, nodding from last year's wood: three
    // petals outside, three smaller inside.
    const bloom = add(at(0.55), [0, -0.2, 0]);

    g.limb(at(0.55), bloom, 0, 0, bark);
    petals(g, bloom, [B, shade(B, 0.1)], { count: 3, length: 0.26, width: 0.24, rise: -0.14, profile: OVAL, phase: i });
    petals(g, add(bloom, [0, -0.03, 0]), tint(B, 0.12), { count: 3, length: 0.14, width: 0.13, rise: -0.1, profile: OVAL, phase: i + 1.05 });
    g.ball(add(bloom, [0, -0.05, 0]), 0.055, "#d8c66a");
    top = highest(top, add(at(1), [0, 0.1, 0]));
  }

  // And the fruit: lumpy, green, and the biggest any native tree here grows.
  g.ball([0.5, H * 0.52, 0.3], [0.16, 0.26, 0.16], "#8fae5e", { rough: 0.12 });
  g.ball([0.7, H * 0.5, 0.22], [0.14, 0.22, 0.14], "#9ab866", { rough: 0.12 });

  return top;
};

const wingstem: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.84, 0], 0.06, "#5d7a48");

  // Wings: thin green flanges running down the stem from every leaf.
  g.box([0, H * 0.4, 0], [0.2, H * 0.74, 0.03], shade(L, 0.14));
  g.box([0, H * 0.4, 0], [0.03, H * 0.74, 0.2], shade(L, 0.14));

  leaves(g, at, L, { from: 0.14, to: 0.86, count: 7, length: 0.6, width: 0.15, rise: 0.08 });

  let top: Vec3 = [0, 0, 0];

  [[0, 0.3, 0], [0.4, 0.14, 0.1], [-0.36, 0.1, -0.16], [0.08, 0.04, -0.42], [-0.1, 0.18, 0.38]].forEach((offset, index) => {
    const centre = add(at(1), offset as Vec3);

    stem(g, at(0.86), centre, 0.025, "#5d7a48", [0, 0.08, 0]);

    // A shaggy green-gold mop with a few yellow rays hanging off it, never the
    // same number twice and never evenly.
    const rays = 5 + (index % 3);

    for (let k = 0; k < rays; k += 1) {
      const angle = k * (TAU / rays) + index + (k % 2) * 0.25;

      g.blade(polar(angle, 0.05, 0, centre), polar(angle, 0.24 + (k % 3) * 0.05, -0.15, centre), 0.075, k % 2 === 0 ? B : tint(B, 0.14), { profile: STRAP });
    }

    g.ball(add(centre, [0, 0.03, 0]), 0.115, flecked("#c7b83a", "#e9d75a", 0.4), { rough: 0.3 });
    top = highest(top, add(centre, [0, 0.15, 0]));
  });

  return top;
};

const commonElderberry: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const twigs = canes(g, 4, H * 0.84, 1.1, 0.06, "#7a6b55");
  let top: Vec3 = [0, 0, 0];

  twigs.forEach((at, index) => {
    // Feather leaves, in opposite pairs.
    for (const side of [0, Math.PI]) {
      pinnate(g, at(0.55), index * 1.57 + side + 0.3, 0.66, index % 2 === 0 ? L : shade(L, 0.08), 3, -0.06);
    }

    if (index === 3) {
      // One head already gone over to fruit: a drooping fan of purple-black.
      const fruit = add(at(1), [0.1, -0.12, 0]);

      stem(g, at(1), fruit, 0.02, "#8a4a5a", [0, 0.1, 0]);
      cluster(g, fruit, [0.3, 0.14, 0.3], "#2f2444", { florets: 18, floretSize: 0.055, pale: "#4a3462" });

      return;
    }

    // A dinner plate of cream lace.
    const head = add(at(1), [0, 0.1, 0]);

    cluster(g, head, [0.44, 0.08, 0.44], B, { florets: 26, floretSize: 0.06, pale: "#fffcf0", seed: index });
    top = highest(top, add(head, [0, 0.08, 0]));
  });

  return top;
};

const witchHazel: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const bark = "#7a7064";
  let top: Vec3 = [0, 0, 0];

  // It flowers in November, on bare zigzag twigs, when nothing else would.
  for (let i = 0; i < 6; i += 1) {
    const angle = i * 1.05 + 0.4;
    const end = polar(angle, H * (0.24 + (i % 3) * 0.05), H * (0.86 + (i % 2) * 0.12));
    const at = stem(g, polar(angle, 0.12), end, 0.14, bark, polar(angle + 1.4, H * 0.08, 0), 0.35);

    for (let k = 0; k < 5; k += 1) {
      const centre = add(at(0.4 + k * 0.14), [0, 0.06, 0]);

      // Four crumpled yellow ribbons from a rust-red cup.
      g.ball(centre, 0.07, "#8a4a2a");

      for (let p = 0; p < 4; p += 1) {
        const turn = p * (TAU / 4) + k + i;
        const out = polar(turn, 0.3, 0.12 - (p % 2) * 0.2, centre);

        g.limb(centre, mix(centre, out, 0.55), 0.03, 0.03, B);
        g.limb(mix(centre, out, 0.55), add(out, [0, 0.07 * (p % 2 === 0 ? 1 : -1), 0]), 0.03, 0.02, tint(B, 0.14));
      }
    }

    // A last few leaves, gone gold, that never quite let go.
    if (i % 2 === 0) {
      leaf(g, at(0.66), angle + 1, 0.6, 0.4, L, { profile: OVAL, rise: -0.1 });
      leaf(g, at(0.9), angle - 1, 0.5, 0.34, "#c9a13c", { profile: OVAL, rise: -0.16 });
    }

    top = highest(top, add(at(1), [0, 0.12, 0]));
  }

  return top;
};

const skunkCabbage: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // The hood: a mottled, liver-coloured shell that melts its own way up
  // through the snow.
  const mottled = (x: number, y: number, z: number) =>
    // Streaked rather than speckled: flecks of one voxel would triple its cost.
    Math.sin(y * 11 + x * 5 + z * 3) > 0.6 ? "#c2ae52" : Math.sin(y * 5 - x * 7) > 0.55 ? B : tint(B, 0.14);
  const centre: Vec3 = [0, H * 0.3, 0];
  const radius: Vec3 = [0.3, H * 0.34, 0.3];

  g.ball(centre, radius, mottled);
  // Drawn up to a twisted point.
  g.limb([0, H * 0.56, 0], [0.12, H * 0.8, -0.1], 0.2, 0.03, mottled);
  // Open down one side, and hollow as far in as anyone can see.
  g.ball([0, H * 0.3, 0.2], [0.18, H * 0.25, 0.26], null);
  // Inside, the knobbly yellow club the flies come for.
  g.limb([0, 0.02, 0.04], [0, H * 0.16, 0.06], 0.035, 0.035, "#c9bb7a");
  g.ball([0, H * 0.24, 0.06], [0.1, 0.12, 0.1], flecked("#d6c56a", "#efe3a0", 0.4), { rough: 0.2 });

  // The leaves come after: rolled tight at first, then enormous.
  // Behind the hood, which opens to the front.
  [[3.7, 0.36, 1], [4.7, 0.3, 0.84], [5.7, 0.34, 0.7]].forEach(([angle, lean, tall], index) => {
    const base = polar(angle, 0.4);

    g.blade(base, polar(angle, lean, H * tall * 0.62, base), 0.46, index === 1 ? shade(L, 0.08) : L, { profile: OVAL });
    g.blade(polar(angle, lean, H * tall * 0.6, base), polar(angle, lean * 2.1, H * tall, base), 0.4, tint(L, 0.08), { profile: (t) => OVAL(0.5 + t * 0.5) });
  });

  return [0.12, H * 0.8, -0.1];
};

const foxgloveBeardtongue: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.96, 0], 0.045, "#7d5560");

  leaves(g, at, L, { from: 0.08, to: 0.48, count: 4, length: 0.46, width: 0.14, pattern: "opposite", rise: 0.1 });

  let top = at(1);

  // An airy, open tower of white trumpets, a pair of branches at each floor,
  // each trumpet lined with violet to show the way in.
  for (let tier = 0; tier < 4; tier += 1) {
    const node = at(0.56 + tier * 0.12);
    const reach = 0.3 - tier * 0.05;

    for (const side of [0, Math.PI]) {
      const angle = tier * 1.57 + side;
      const twig = polar(angle, reach * 0.6, reach * 0.5, node);

      g.limb(node, twig, 0, 0, "#7d5560");

      for (const fork of [-0.5, 0.5]) {
        tube(g, twig, angle + fork, 0.24, 0.05, B, { rise: 0.05, lip: "#cdb6dd", lipLength: 0.09 });
      }
    }
  }

  tube(g, top, 0.4, 0.2, 0.045, B, { rise: 0.14, lip: "#cdb6dd", lipLength: 0.08 });
  top = add(top, [0, 0.16, 0]);

  return top;
};

const whiteTurtlehead: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.94, 0], 0.05, "#5a7a4a");

  leaves(g, at, L, { from: 0.1, to: 0.7, count: 5, length: 0.46, width: 0.12, pattern: "opposite", rise: 0.08 });

  // A tight stack of flowers shaped exactly like their name: a blunt hooded
  // head with the mouth shut, flushed pink at the lips.
  for (let i = 0; i < 9; i += 1) {
    const base = at(0.72 + i * 0.03);
    const angle = i * (Math.PI / 2) + Math.floor(i / 4) * 0.8;
    const nose = polar(angle, 0.2, 0.08, base);

    g.limb(base, nose, 0.06, 0.085, B);
    g.ball(nose, [0.085, 0.07, 0.085], B);
    g.blade(polar(angle, 0.13, 0.01, base), polar(angle, 0.26, 0.0, base), 0.11, "#f1c5d6");
    g.limb(polar(angle, 0.16, 0.045, base), polar(angle, 0.29, 0.055, base), 0, 0, "#8a6f7a");
  }

  g.ball(add(at(1), [0, 0.05, 0]), [0.06, 0.08, 0.06], tint(L, 0.2));

  return add(at(1), [0, 0.13, 0]);
};

const newYorkIronweed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0, H * 0.84, 0], 0.07, "#4f4450");

  leaves(g, at, L, { from: 0.1, to: 0.86, count: 12, length: 0.72, width: 0.15, rise: 0.06 });

  let top: Vec3 = [0, 0, 0];

  // A wide, loose crown of shaving-brush tufts in the deepest purple there is.
  for (let i = 0; i < 11; i += 1) {
    const head = i === 0 ? add(at(1), [0, H * 0.14, 0]) : polar(i * 2.4, 0.3 + (i % 3) * 0.18, H * (0.07 + (i % 4) * 0.022), at(1));

    stem(g, at(0.9), head, 0.022, "#4f4450", [0, 0.1, 0]);
    g.column(add(head, [0, -0.1, 0]), 0.1, 0.045, 0.075, "#5a5a3e");
    cluster(g, add(head, [0, 0.04, 0]), [0.12, 0.09, 0.12], i % 3 === 0 ? tint(B, 0.12) : B, { florets: 8, floretSize: 0.04, seed: i });
    top = highest(top, add(head, [0, 0.13, 0]));
  }

  return top;
};

const cupPlant: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  // A square stem as thick as a broom handle.
  g.box([0, H * 0.42, 0], [0.16, H * 0.84, 0.16], "#5f8a4c");

  // Each pair of leaves is welded round the stem into a cup, and the cup holds
  // rain. Birds drink from it. That is the plant.
  for (let i = 0; i < 4; i += 1) {
    const node: Vec3 = [0, H * (0.2 + i * 0.17), 0];
    const turn = i * (Math.PI / 2) + 0.2;
    const size = 1.15 - i * 0.14;

    for (const side of [0, Math.PI]) {
      g.blade(node, polar(turn + side, size * 0.6, size * 0.32, node), size * 0.6, i % 2 === 0 ? L : shade(L, 0.08), { profile: TAPER, thickness: 0.06 });
      g.blade(polar(turn + side, size * 0.56, size * 0.32, node), polar(turn + side, size, size * 0.12, node), size * 0.36, L, { profile: TAPER });
    }

    g.ball(add(node, [0, 0.16, 0]), [0.4, 0.2, 0.4], shade(L, 0.1), { half: "lower" });
    g.column(add(node, [0, 0.06, 0]), 0.08, 0.33, 0.33, "#8fc7de");
    g.box(add(node, [0, 0.07, 0]), [0.16, 0.2, 0.16], "#5f8a4c");
  }

  let top: Vec3 = [0, 0, 0];

  // Small sunflowers, in a loose handful at the very top.
  [[0, 0.16, 0], [0.5, 0.06, 0.16], [-0.46, 0.02, -0.2], [0.1, -0.04, -0.52]].forEach((offset, index) => {
    const centre = add([0, H * 0.84, 0], [offset[0], H * 0.1 + offset[1], offset[2]] as Vec3);

    stem(g, [0, H * 0.8, 0], centre, 0.035, "#5f8a4c", [0, 0.1, 0]);
    top = highest(
      top,
      rayHead(g, centre, pair(B, 0.12), { count: 20, length: 0.36, width: 0.085, rise: -0.02, disc: 0.17, dome: 0.09, discPaint: flecked("#b9a436", "#d9c852", 0.4), profile: STRAP }),
    );
    void index;
  });

  return top;
};

const eveningPrimrose: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.03, H * 0.94, 0], 0.055, "#8a6a5a");

  // A flat rosette on the ground from its first year, and leaves all the way up.
  petals(g, [0, 0.03, 0], [L, shade(L, 0.08)], { count: 8, length: 0.46, width: 0.13, rise: 0.02 });
  leaves(g, at, L, { from: 0.14, to: 0.62, count: 8, length: 0.36, width: 0.1, rise: 0.1, rib: false });

  // Seed capsules below, like little upright bananas; buds at the very top.
  for (let i = 0; i < 6; i += 1) {
    const base = at(0.64 + i * 0.03);

    g.limb(base, polar(i * 2.4, 0.07, 0.17, base), 0.035, 0.022, "#7f9a5a");
  }

  let top = at(1);

  // The flowers open at dusk, four wide heart-shaped petals each, with a
  // cross for a stigma.
  [[0.82, 0.6], [0.88, 2.9], [0.94, 4.8]].forEach(([t, angle]) => {
    const neck = polar(angle, 0.14, 0.12, at(t));

    g.limb(at(t), neck, 0.03, 0.025, "#a8b46a");
    petals(g, neck, pair(B, 0.1), { count: 4, length: 0.19, width: 0.2, rise: 0.05, profile: SPOON, phase: angle });

    for (let k = 0; k < 4; k += 1) {
      g.limb(add(neck, [0, 0.05, 0]), polar(k * (TAU / 4) + 0.78 + angle, 0.045, 0.06, neck), 0, 0, "#cbd66a");
    }

    top = highest(top, add(neck, [0, 0.08, 0]));
  });

  g.limb(at(1), add(at(1), [0, 0.16, 0]), 0.035, 0.012, "#a8845a");

  return highest(top, add(at(1), [0, 0.16, 0]));
};

const jimsonweed: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const purple = "#5f4a5e";

  g.limb([0, 0, 0], [0, H * 0.42, 0], 0.08, 0.07, purple);

  let top: Vec3 = [0, 0, 0];

  // It forks, and forks again, with a flower or a seed pod in every fork.
  [[0.7, 0.42, 0.74], [3.8, 0.4, 0.7]].forEach(([angle, lean, tall], index) => {
    const end = polar(angle, lean, H * tall);

    g.limb([0, H * 0.42, 0], end, 0.06, 0.05, purple);

    // Big, dark, jagged leaves.
    for (const turn of [-1, 1]) {
      const hub = polar(angle + turn * 1.2, 0.1, 0, end);

      palmate(g, hub, angle + turn * 1.2, 0.56, 0.2, turn === 1 ? L : shade(L, 0.1), 5, 0.42, -0.08);
    }

    // A white trumpet as long as your hand, pleated, with a violet throat.
    const base = add(end, [0, 0.02, 0]);
    const length = H * 0.3;

    g.column(base, length * 0.42, 0.055, 0.06, "#8fa56a");
    trumpet(g, add(base, [0, length * 0.3, 0]), length * 0.7, 0.22, B, "#a98fc9");
    petals(g, add(base, [0, length - 0.03, 0]), [B, tint(B, 0.06)], { count: 5, length: 0.1, width: 0.12, rise: 0.02, inner: 0.17, phase: index });
    top = highest(top, add(base, [0, length, 0]));
  });

  // The thorn apple: a green egg covered in spikes.
  const pod: Vec3 = [0.02, H * 0.52, 0.02];

  g.ball(pod, [0.13, 0.16, 0.13], "#7f9a52");

  for (let k = 0; k < 16; k += 1) {
    const tilt = Math.acos(1 - ((k + 0.5) / 16) * 2);
    const turn = k * 2.4;

    g.limb(pod, add(pod, [Math.sin(tilt) * Math.cos(turn) * 0.2, Math.cos(tilt) * 0.23, Math.sin(tilt) * Math.sin(turn) * 0.2]), 0, 0, "#93ad62");
  }

  return top;
};

const nightFloweringCatchfly: PlantForm = (g, { bloomColor: B, height: H, leafColor: L }) => {
  const at = stem(g, [0, 0, 0], [0.03, H * 0.62, 0], 0.04, "#7d8a62", [0.03, 0, 0]);

  leaves(g, at, L, { from: 0.14, to: 0.9, count: 3, length: 0.4, width: 0.12, pattern: "opposite", rise: 0.08 });

  let top: Vec3 = [0, 0, 0];

  [[0, 0.24, 0, 0], [0.3, 0.1, 0.1, 0.5], [-0.26, 0.04, -0.16, 3.4]].forEach(([dx, dy, dz, lean]) => {
    const base = add(at(1), [dx, dy, dz]);

    stem(g, at(0.9), base, 0.02, "#7d8a62", [0, 0.06, 0]);

    // A swollen, sticky, striped bladder behind every flower.
    const bladder = add(base, [0, 0.16, 0]);

    g.ball(bladder, [0.1, 0.17, 0.1], (x, _y, z) =>
      Math.floor((Math.atan2(z - bladder[2], x - bladder[0]) + Math.PI) * (10 / TAU)) % 2 === 0 ? "#9cb07a" : "#5f7a4a",
    );

    // Five petals, each split nearly in two, so it reads as ten.
    const mouth = add(bladder, [0, 0.17, 0]);

    for (let k = 0; k < 5; k += 1) {
      for (const split of [-0.24, 0.24]) {
        const angle = k * (TAU / 5) + split + lean;

        g.blade(polar(angle, 0.03, 0, mouth), polar(angle, 0.19, 0.02, mouth), 0.065, k % 2 === 0 ? B : tint(B, 0.08), { profile: SPOON });
      }
    }

    g.ball(mouth, [0.035, 0.03, 0.035], "#e8dcc0");
    top = highest(top, add(mouth, [0, 0.04, 0]));
  });

  return top;
};

/** A stem's own point at a given height, for a ring drawn round it. */
function mixAt(from: Vec3, to: Vec3, y: number): Vec3 {
  const t = to[1] === from[1] ? 0 : (y - from[1]) / (to[1] - from[1]);

  return mix(from, to, Math.min(1, Math.max(0, t)));
}

/** Halfway between two colours. */
function mixHex(a: string, b: string) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round((((pa >> shift) & 255) + ((pb >> shift) & 255)) / 2);

  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}

export const PLANT_FORMS: Record<string, PlantForm> = {
  "common-milkweed": commonMilkweed,
  "wild-bergamot": wildBergamot,
  "canada-goldenrod": canadaGoldenrod,
  "new-england-aster": newEnglandAster,
  "purple-coneflower": purpleConeflower,
  "black-eyed-susan": blackEyedSusan,
  "virginia-bluebell": virginiaBluebell,
  "joe-pye-weed": joePyeWeed,
  jewelweed,
  "cardinal-flower": cardinalFlower,
  mayapple,
  "trout-lily": troutLily,
  "wild-geranium": wildGeranium,
  "white-trillium": whiteTrillium,
  spicebush,
  "eastern-redbud": easternRedbud,
  pickerelweed,
  buttonbush,
  "swamp-milkweed": swampMilkweed,
  boneset,
  "blue-vervain": blueVervain,
  "mapleleaf-viburnum": mapleleafViburnum,
  "white-snakeroot": whiteSnakeroot,
  bloodroot,
  "cutleaf-toothwort": cutleafToothwort,
  "dutchmans-breeches": dutchmansBreeches,
  "great-blue-lobelia": greatBlueLobelia,
  "ohio-spiderwort": ohioSpiderwort,
  "heal-all": healAll,
  "virginia-waterleaf": virginiaWaterleaf,
  "wild-columbine": wildColumbine,
  pawpaw,
  wingstem,
  "common-elderberry": commonElderberry,
  "witch-hazel": witchHazel,
  "skunk-cabbage": skunkCabbage,
  "foxglove-beardtongue": foxgloveBeardtongue,
  "white-turtlehead": whiteTurtlehead,
  "new-york-ironweed": newYorkIronweed,
  "cup-plant": cupPlant,
  "evening-primrose": eveningPrimrose,
  jimsonweed,
  "night-flowering-catchfly": nightFloweringCatchfly,
};

export type { Along };
export { LANCE };
