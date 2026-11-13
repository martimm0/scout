import { Color, type BufferGeometry } from "three";

import type { Quality } from "./quality";
import { shade, tint } from "./voxel";
import { HEART, mottle, SPOON, VoxelGrid, type PaintFn, type Vec3 } from "./voxel-grid";

/**
 * The park's furniture, sized for an insect.
 *
 * A bee here is under a unit long. So a hemlock is seventy units, a tower you
 * fly *around*, not over. A fallen log is a tunnel. An acorn is a boulder. A
 * blade of grass comes up past your head.
 *
 * That ratio is the entire trick. Nothing about a park is interesting at human
 * scale; everything about it is interesting at this one. Each model is built
 * around its base, so y=0 is where it meets the ground.
 */

const BARK = "#6b4f36";
const BARK_DARK = "#54402c";
const BARK_GREY = "#8a7a66";
const HEARTWOOD = "#c2a878";
const MOSS = "#5f8f4a";

/** A stable 0..1 number for a variant, so three oaks are three different oaks. */
function vary(variant: number, channel: number) {
  const x = Math.sin((variant + 1) * 127.1 + channel * 311.7) * 43758.5453;

  return x - Math.floor(x);
}

/**
 * Lit from above: dark underneath, pale on top, in a few flat steps.
 *
 * Steps rather than a smooth ramp, because this is a voxel park and a gradient
 * would be the one smooth thing in it. The steps also keep whole bands of a
 * canopy one colour, which is what lets their faces merge.
 */
function lit(hex: string, y0: number, y1: number, amount = 0.16): PaintFn {
  const steps = [
    shade(hex, amount),
    shade(hex, amount * 0.45),
    hex,
    sunlit(hex, amount * 1.1),
    sunlit(hex, amount * 2),
  ];

  return (_x, y, _z, h) => {
    const t = (y - y0) / (y1 - y0) + (h - 0.5) * 0.3;

    return steps[Math.min(4, Math.max(0, Math.floor(t * 5)))];
  };
}

/**
 * A leaf in the sun goes yellow-green, not grey. Lightening toward white is
 * right for fur and wrong for a canopy: it made the top of every oak look
 * frosted.
 */
function sunlit(hex: string, amount: number) {
  const color = new Color(hex);

  color.lerp(SUN_ON_LEAF, amount);

  return `#${color.getHexString()}`;
}

const SUN_ON_LEAF = new Color("#d9ec7a");

/** Bark: vertical streaks, darker in the furrows. */
function bark(hex: string, grain = 1.6): PaintFn {
  const dark = shade(hex, 0.16);
  const light = tint(hex, 0.08);

  return (x, _y, z, h) => {
    const streak = Math.sin((x * 1.7 + z * 2.3) / grain);

    return streak > 0.55 ? dark : streak < -0.7 || h > 0.9 ? light : hex;
  };
}

type Build = (grid: VoxelGrid, variant: number, fine: boolean) => void;

/** Eastern hemlock. Falls Ravine is full of them, and they are enormous. */
const hemlock: Build = (g, v) => {
  const lean = (vary(v, 1) - 0.5) * 3;

  // A flare at the root, then a long taper right up through the crown.
  g.column([0, 0, 0], 6, 4.4, 2.9, bark(BARK_DARK));
  g.limb([0, 5, 0], [lean, 82, 0], 2.8, 0.9, bark(BARK_DARK));

  const tiers = 8;

  for (let i = 0; i < tiers; i += 1) {
    const t = i / (tiers - 1);
    const width = (42 - t * 35) * (0.92 + vary(v, 10 + i) * 0.16);
    const y = 25 + i * 7.6;
    const green = i < 2 ? "#3f6d42" : i < 5 ? "#4a7d4d" : "#578b56";
    const tips = sunlit(green, 0.3);
    const half = width / 2;

    // Each tier is a drooping skirt: wide and thin at the hem, thick at the trunk.
    g.ball([lean * t, y, 0], [half, 4.6, half], (x, yy, z, h) => {
      const reach = Math.hypot(x - lean * t, z) / half;

      // New growth at the tips is paler, which is how you tell a hemlock is well.
      return reach > 0.8 && h > 0.6 ? tips : yy < y - 1 ? shade(green, 0.14) : h > 0.86 ? sunlit(green, 0.12) : green;
    }, { rough: 0.22 });
    g.ball([lean * t, y + 3.4, 0], [half * 0.62, 3.4, half * 0.62], lit(green, y + 1, y + 7), { rough: 0.2 });
  }

  // The leader, which on a hemlock nods over to one side.
  g.limb([lean, 84, 0], [lean + 2.5, 90, 1], 1.4, 0.5, "#62975f");
};

/** Red oak. Broad, heavy, and the ceiling of the woods. */
const oak: Build = (g, v) => {
  const greens = ["#59964d", "#64a457", "#4f8c46", "#6cae5c"];

  g.column([0, 0, 0], 7, 6, 3.6, bark(BARK));
  g.column([0, 6, 0], 30, 3.6, 2.9, bark(BARK));

  // Roots that show, because an old oak stands on its toes.
  for (let i = 0; i < 4; i += 1) {
    const angle = i * 1.57 + vary(v, i) * 0.8;

    g.limb([0, 3.4, 0], [Math.cos(angle) * 7.5, 0.4, Math.sin(angle) * 7.5], 2, 1, bark(BARK));
  }

  const lobes: [number, number, number, number, number, number][] = [
    [0, 45, 0, 23, 13, 22],
    [-15, 52, 8, 13, 10, 12],
    [16, 49, -9, 12, 9.5, 11.5],
    [2, 59, 1, 14, 8, 13],
    [-8, 43, -15, 10, 8, 9],
    [11, 42, 14, 10, 7.5, 10],
  ];

  lobes.forEach(([x, y, z, rx, ry, rz], index) => {
    const dx = (vary(v, 20 + index) - 0.5) * 7;
    const dz = (vary(v, 30 + index) - 0.5) * 7;
    const swell = 0.9 + vary(v, 40 + index) * 0.2;
    const centre: Vec3 = [x + dx, y, z + dz];

    // A limb reaching into every mass, so the crown is held up by something.
    if (index > 0) {
      g.limb([0, 33, 0], [centre[0] * 0.8, y - ry * 0.4, centre[2] * 0.8], 1.9, 1, bark(BARK));
    }

    g.ball(centre, [rx * swell, ry * swell, rz * swell], lit(greens[index % greens.length], y - ry, y + ry), {
      rough: 0.2,
    });
  });
};

/** Understorey shrub: spicebush and viburnum height. */
const shrub: Build = (g, v) => {
  const stems: [number, number][] = [[0, 0], [2.5, -1.5], [-2.5, 2]];

  for (const [x, z] of stems) {
    g.limb([x * 0.4, 0, z * 0.4], [x * 1.6, 8, z * 1.6], 0.7, 0.4, "#5a4630");
  }

  const masses: [number, number, number, number, number, string][] = [
    [0, 5.5, 0, 7.5, 5, "#3f7340"],
    [3.5, 10.5, -2, 5.5, 4, "#4a8449"],
    [-4, 9.5, 3, 4.6, 3.6, "#376a3a"],
  ];

  masses.forEach(([x, y, z, r, ry, color], index) => {
    const wobble = 0.88 + vary(v, index) * 0.24;

    g.ball([x, y, z], [r * wobble, ry, r * wobble], lit(color, y - ry, y + ry), { rough: 0.24 });
  });
};

/**
 * A fallen log. At this scale it isn't scenery, it's terrain, a wall you go
 * around or a tunnel you thread.
 */
const log: Build = (g) => {
  const wood = bark(BARK, 2.4);

  g.limb([-23, 4.2, 0], [23, 4.2, 0], 4.1, 3.8, (x, y, z, h) => {
    // The sawn ends: pale heartwood with a dark ring or two.
    if (Math.abs(x) > 22) {
      const ring = Math.hypot(y - 4.2, z);

      return ring < 1 ? "#9a8052" : Math.floor(ring) % 2 === 0 ? HEARTWOOD : "#ad9263";
    }

    // Moss on the weather side, which is how you tell a real one.
    if (y > 6.6 && h > 0.3) {
      return h > 0.8 ? tint(MOSS, 0.14) : MOSS;
    }

    return wood(x, y, z, h);
  });
  // The stub of a limb it had when it was standing.
  g.limb([8, 6, 0], [11, 12, 3], 1.5, 1, bark(BARK_DARK));
};

/** A cut stump, rings and all. */
const stump: Build = (g, v) => {
  for (let i = 0; i < 5; i += 1) {
    const angle = i * 1.256 + vary(v, i);

    g.limb([0, 3, 0], [Math.cos(angle) * 8, 0.3, Math.sin(angle) * 8], 2.2, 1, bark(BARK));
  }

  g.column([0, 0, 0], 8.4, 5.8, 5, (x, y, z, h) => {
    if (y > 7.6) {
      const ring = Math.hypot(x, z);

      return ring > 4.4 ? BARK : Math.floor(ring * 1.1) % 2 === 0 ? HEARTWOOD : "#a8905f";
    }

    return bark(BARK)(x, y, z, h);
  });
};

/** An acorn. A boulder, from here. */
const acorn: Build = (g) => {
  g.ball([0, 2.7, 0], [2.3, 2.9, 2.3], lit("#c98f4a", 0, 5.4, 0.2));
  // The cup, scaled like a pine cone.
  g.ball([0, 5, 0], [2.75, 1.6, 2.75], (x, y, z) =>
    (Math.floor(x * 1.6) + Math.floor(z * 1.6) + Math.floor(y * 2)) % 2 === 0 ? "#6b4f2a" : "#7c5d34",
  );
  g.box([0, 3.2, 0], [5.6, 2.8, 5.6], null);
  g.ball([0, 2.7, 0], [2.3, 2.9, 2.3], lit("#c98f4a", 0, 5.4, 0.2));
  g.ball([0, 5.1, 0], [2.75, 1.5, 2.75], (x, y, z) =>
    (Math.floor(x * 1.6) + Math.floor(z * 1.6) + Math.floor(y * 2)) % 2 === 0 ? "#6b4f2a" : "#7c5d34",
  );
  g.limb([0, 6.2, 0], [0.5, 7.6, 0.2], 0.5, 0.35, "#54402c");
};

/** Creek-bed stone. */
const rock: Build = (g, v) => {
  const stone = (hex: string): PaintFn => {
    const base = mottle(hex, 0.07);

    return (x, y, z, h) => {
      // Moss settles on top; lichen freckles the sides.
      if (y > 5.2 && h > 0.45) {
        return h > 0.82 ? tint(MOSS, 0.1) : MOSS;
      }

      return h > 0.965 ? "#c9c7a8" : base(x, y, z, h);
    };
  };

  const squat = 0.9 + vary(v, 1) * 0.3;

  g.ball([0, 2.4, 0], [6.8, 3.4 * squat, 6.2], stone("#8a8175"), { rough: 0.1 });
  g.ball([2.2, 5.4, 1.5], [4.2, 2.8 * squat, 3.7], stone("#9a9184"), { rough: 0.1 });
  g.ball([-3, 4.4, -2.2], [3.4, 2.4, 3.2], stone("#7b7368"), { rough: 0.1 });
  // Nothing floats: whatever dipped below the ground is cut away.
  g.box([0, -4, 0], [20, 8, 20], null);
};

/** A standing dead trunk. Cheap, and it does a lot for a woodland's character. */
const snag: Build = (g, v) => {
  const wood = bark(BARK_GREY);

  g.column([0, 0, 0], 5, 3.6, 2.6, wood);
  g.limb([0, 4, 0], [0.8, 40, 0], 2.6, 1.7, (x, y, z, h) =>
    // Woodpecker work, low and often.
    h > 0.985 && y > 12 ? "#3d3226" : wood(x, y, z, h),
  );
  // Snapped off, not sawn: the top is a splinter.
  g.limb([0.8, 40, 0], [2, 45 + vary(v, 1) * 3, 0.6], 1.2, 0.3, wood);
  g.limb([1, 31, 0], [12, 34, 0], 1.3, 0.6, wood);
  g.limb([0, 24, 0], [-9, 28, 1.5], 1.1, 0.5, wood);
  g.limb([0.5, 17, 0], [3, 20, -6], 0.9, 0.4, wood);
};

/** Fern. Fern Hollow is named for these, and here they're small trees. */
const fern: Build = (g, v) => {
  const fronds = 7;

  for (let i = 0; i < fronds; i += 1) {
    const angle = (i / fronds) * Math.PI * 2 + vary(v, 1);
    const cx = Math.cos(angle);
    const cz = Math.sin(angle);
    const reach = 8 + vary(v, 2 + i) * 2.5;
    const green = i % 2 === 0 ? "#4f8a3f" : "#5c9a4a";
    // Pinnae: a frond is a comb, not a paddle.
    const comb = (t: number) => (Math.floor(t * 9) % 2 === 0 ? 1 : 0.55) * (1 - t * 0.75);

    // Up and out, then over: the arch is the whole character of a fern.
    g.blade([cx * 0.6, 1.5, cz * 0.6], [cx * reach * 0.55, 8.5, cz * reach * 0.55], 3.4, green, { profile: comb });
    g.blade(
      [cx * reach * 0.5, 8.5, cz * reach * 0.5],
      [cx * reach, 5.6, cz * reach],
      2.6,
      tint(green, 0.12),
      { profile: (t) => comb(0.4 + t * 0.6) * 1.4 },
    );
  }

  // A fiddlehead still coming up through the middle.
  g.limb([0, 0, 0], [0.4, 6, 0.3], 0.7, 0.5, "#3f6b32");
  g.ball([0.7, 6.6, 0.3], 0.9, "#6aa552");
};

/**
 * Grass. The single most important model here, a lawn you could mow is, from
 * a bee's height, a forest of blades taller than you are. Nothing else sells the
 * scale as cheaply.
 *
 * And it has to stay cheap: there are thousands. A blade is a straight column
 * and at most one bent tip, because every sideways step in a voxel line is
 * another handful of faces, multiplied by the whole lawn.
 */
const grass: Build = (g, v, fine) => {
  // Placed in whole cells, two apart, so no blade shades its neighbour: a
  // shaded face cannot merge with a clear one, and that is a third more
  // triangles on the one model there are thousands of.
  const blades: [number, number, number, number, number, string][] = [
    [0, 0, 5.4, 1, 0, "#6aa84f"],
    [3, 1, 4.3, 0, 1, "#77b859"],
    [-2, -2, 3.8, -1, 0, "#5f9a45"],
    [1, 3, 3.1, 0, 0, "#7fc05e"],
    [-2, 2, 4.7, 0, -1, "#70ae54"],
  ];
  const width = g.size;

  blades.slice(0, fine ? 5 : 4).forEach(([cx, cz, h, lx, lz, color], index) => {
    const tall = h * (0.9 + vary(v, index) * 0.2);
    const x = cx * width;
    const z = cz * width;

    // On low the whole blade is one colour, so it is one column and five faces.
    g.box([x, tall * 0.4, z], [width, tall * 0.8, width], color);

    if (fine && (lx !== 0 || lz !== 0)) {
      // The tip leans over, one step, in a paler green.
      g.box([x + lx * width, tall * 0.9, z + lz * width], [width, tall * 0.2, width], tint(color, 0.14));
    } else {
      g.box([x, tall * 0.9, z], [width, tall * 0.2, width], fine ? tint(color, 0.14) : color);
    }
  });
};

/**
 * A mushroom. Frick's woodland floor is thick with them after rain, and at this
 * scale one is a parasol you could shelter under.
 */
const mushroom: Build = (g) => {
  g.column([0, 0, 0], 6, 1, 0.75, mottle("#e6dcc4", 0.05));
  // A skirt on the stem, left behind when the cap opened.
  g.column([0, 4.2, 0], 0.5, 1.5, 1.1, "#d8cdb2");
  // Gills underneath.
  g.column([0, 5.6, 0], 0.5, 3.1, 3.4, (x, _y, z) =>
    Math.floor(Math.atan2(z, x) * 5) % 2 === 0 ? "#d8c8a8" : "#c4b290",
  );
  g.ball([0, 6, 0], [3.7, 2.7, 3.7], (x, y, z, h) =>
    // The warts every storybook toadstool has, sparingly.
    h > 0.93 && y > 6.6 ? "#f0e6d2" : y > 7.8 ? "#b06a48" : "#9c5a3c",
  );
  g.box([0, 2.95, 0], [8, 5.9, 8], null);
  g.column([0, 0, 0], 6, 1, 0.75, mottle("#e6dcc4", 0.05));
  g.column([0, 4.2, 0], 0.5, 1.5, 1.1, "#d8cdb2");
  g.column([0, 5.6, 0], 0.5, 3.1, 3.4, (x, _y, z) =>
    Math.floor(Math.atan2(z, x) * 5) % 2 === 0 ? "#d8c8a8" : "#c4b290",
  );
};

/** Cattails, at the creek margin. The restoration planted these by the thousand. */
const cattail: Build = (g, v) => {
  const stalks: [number, number, number][] = [
    [0, 0, 22],
    [2.5, 1.5, 17],
    [-2, 2, 19],
  ];

  stalks.forEach(([x, z, h], index) => {
    const sway = (vary(v, index) - 0.5) * 2;

    g.limb([x, 0, z], [x + sway, h + 8, z], 0.38, 0.22, "#5f8a4a");
    // The brown sausage, and the spike it leaves above itself.
    g.limb([x + sway * 0.72, h, z], [x + sway * 0.93, h + 6, z], 1, 1, mottle("#6b4a2a", 0.1));
    // Strap leaves, taller than the stalk and bending away from it.
    for (const side of [-1, 1]) {
      g.limb([x, 0, z], [x + side * 1.6, h * 0.7, z + side * 0.6], 0.42, 0.3, "#6f9a55");
      g.limb(
        [x + side * 1.6, h * 0.7, z + side * 0.6],
        [x + side * 4.4, h * 0.95, z + side * 1.6],
        0.3,
        0.16,
        "#7aa65e",
      );
    }
  });
};

/** A fallen branch. Terrain, at this size. */
const branch: Build = (g) => {
  const wood = bark("#7a5f42", 1);

  g.limb([-13, 1.4, 0], [13, 1.8, 0.5], 1.4, 0.9, wood);
  g.limb([4, 1.8, 0], [12, 3.4, 5], 0.8, 0.4, wood);
  g.limb([-5, 1.6, 0], [-11, 3, -5], 0.7, 0.35, wood);
  g.limb([9, 2.6, 3], [12, 5.5, 2], 0.4, 0.25, "#6b5237");
  // One leaf that never let go.
  g.blade([12, 5.5, 2], [14.5, 5, 3.5], 1.8, "#a87a3c");
};

/**
 * Leaf litter. A drift of fallen leaves.
 *
 * This is where the queen bumblebees sleep through the winter, which is one very
 * good reason not to rake the woods clean, and it's in the journal.
 */
const leafLitter: Build = (g, v) => {
  const colors = ["#a87a3c", "#8a5f2c", "#c49a52", "#7a5024", "#b5673a"];

  for (let i = 0; i < 11; i += 1) {
    const angle = (i / 11) * Math.PI * 2 + vary(v, i) * 1.5;
    const radius = 1 + (i % 4) * 1.8;
    const turn = angle + 1 + vary(v, 20 + i) * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0.2 + (i % 3) * 0.4;

    g.blade(
      [x, y, z],
      [x + Math.cos(turn) * 3.2, y + (i % 2) * 0.4, z + Math.sin(turn) * 3.2],
      2.4,
      colors[i % colors.length],
    );
  }
};

/** Clover, in the mown grass. A bee's favourite thing on a lawn. */
const clover: Build = (g) => {
  g.limb([0, 0, 0], [0, 2.5, 0], 0.2, 0.2, "#5f9a45");
  g.limb([0.8, 0, 0.3], [0.5, 3.2, 0.2], 0.2, 0.2, "#5f9a45");

  // Three leaflets, each with the pale chevron clover is known by.
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + 0.5;

    g.blade([0, 2.5, 0], [Math.cos(angle) * 1.7, 2.5, Math.sin(angle) * 1.7], 1.5, (x, _y, z) => {
      const along = Math.hypot(x, z);

      return along > 0.7 && along < 1 ? "#9cc98a" : i === 1 ? "#5f9a45" : "#67a552";
    }, { profile: SPOON });
  }

  // The flower head: a ball of tiny tubes, white going pink at the base.
  g.ball([0.5, 3.9, 0.2], [0.85, 0.8, 0.85], (_x, y, _z, h) =>
    y < 3.6 ? "#e6c4cf" : h > 0.6 ? "#fbf4f5" : "#f0e6e8",
  { rough: 0.18 });
};

/**
 * Japanese knotweed. The invasive that is eating the ravine.
 *
 * It grows in dense stands nothing else can get through, it feeds almost nobody,
 * and Frick's volunteers spend thousands of hours a year pulling it. It is here
 * because a park is not only the things you want in it, and because you cannot
 * pollinate it, which is the lesson.
 */
const knotweed: Build = (g, v) => {
  const canes: [number, number, number][] = [
    [0, 0, 30],
    [4, 3, 26],
    [-4, 2, 28],
    [2, -4, 24],
    [-3, -3, 22],
  ];

  canes.forEach(([x, z, h], index) => {
    const lean = (vary(v, index) - 0.5) * 5;

    // Hollow bamboo-like cane, jointed, with a red-flecked node at every joint.
    g.limb([x, 0, z], [x + lean, h, z + lean * 0.5], 0.85, 0.5, (_x, y) =>
      y % 5 < 0.7 ? "#a8564a" : "#9aa86a",
    );

    // The big heart-shaped leaves that shade everything else out, zigzagging up.
    for (let leaf = 0; leaf < 4; leaf += 1) {
      const t = 0.45 + leaf * 0.15;
      const side = leaf % 2 === 0 ? 1 : -1;
      const bx = x + lean * t;
      const bz = z + lean * 0.5 * t;
      const angle = index * 1.3 + leaf * 0.9;

      g.blade(
        [bx, h * t, bz],
        [bx + Math.cos(angle) * 5.5 * side, h * t - 0.8, bz + Math.sin(angle) * 5.5 * side],
        4.4,
        leaf % 2 === 0 ? "#4f7a3c" : "#588a44",
        { profile: HEART },
      );
    }

    // Its sprays of cream flowers, late in the year, which bees do visit.
    g.ball([x + lean, h + 0.6, z + lean * 0.5], [1.4, 1, 1.4], "#e8e4c8", { rough: 0.3 });
  });
};


export type FoliageKind =
  | "hemlock"
  | "oak"
  | "shrub"
  | "log"
  | "stump"
  | "acorn"
  | "rock"
  | "snag"
  | "fern"
  | "grass"
  | "mushroom"
  | "cattail"
  | "branch"
  | "leafLitter"
  | "clover"
  | "knotweed";

const BUILDERS: Record<FoliageKind, Build> = {
  hemlock,
  oak,
  shrub,
  log,
  stump,
  acorn,
  rock,
  snag,
  fern,
  grass,
  mushroom,
  cattail,
  branch,
  leafLitter,
  clover,
  knotweed,
};

/**
 * The voxel size each kind is authored at, in world units: high, then low.
 *
 * Picked per kind because the kinds differ by a factor of forty in size: a
 * voxel that gives an oak a lumpy crown would make a clover leaf one block. Low
 * is not simply double. It is whatever keeps the whole park at or under what it
 * cost when every one of these was a handful of boxes.
 */
const VOXEL: Record<FoliageKind, [number, number]> = {
  hemlock: [2, 12],
  oak: [2, 12],
  shrub: [1, 6],
  log: [1, 5],
  stump: [0.8, 3.4],
  acorn: [0.45, 2],
  rock: [0.9, 4],
  snag: [0.9, 4.6],
  fern: [0.5, 3.6],
  grass: [0.4, 0.5],
  mushroom: [0.45, 1.9],
  cattail: [0.4, 2.6],
  branch: [0.5, 3.2],
  leafLitter: [0.4, 1.7],
  clover: [0.2, 1.2],
  knotweed: [0.55, 3.8],
};

/**
 * What sways, how tall it is, and how far its top travels in a breeze as a
 * fraction of that height. Rocks, logs and stumps hold still in any wind.
 */
export const SWAY: Partial<Record<FoliageKind, [height: number, amount: number]>> = {
  hemlock: [90, 0.011],
  oak: [67, 0.011],
  shrub: [14, 0.03],
  fern: [9, 0.07],
  grass: [5.5, 0.17],
  cattail: [30, 0.05],
  clover: [4, 0.11],
  knotweed: [30, 0.04],
};

/** How many different oaks there are. One on low, to keep the draw calls down. */
export function foliageVariants(quality: Quality) {
  return quality === "high" ? 3 : 1;
}

export function buildFoliageKind(kind: FoliageKind, quality: Quality, variant = 0): BufferGeometry {
  const fine = quality === "high";
  const grid = new VoxelGrid(VOXEL[kind][fine ? 0 : 1], variant + 1, !fine);

  BUILDERS[kind](grid, variant, fine);

  // Everything here stands on the ground, so nothing needs an underside.
  return grid.build({ grounded: true });
}

/** Every kind, in every variant the quality allows. */
export function buildFoliageGeometry(quality: Quality): Record<FoliageKind, BufferGeometry[]> {
  const variants = foliageVariants(quality);

  return Object.fromEntries(
    (Object.keys(BUILDERS) as FoliageKind[]).map((kind) => [
      kind,
      // Grass is one model however fine: its variety is in how it is scattered.
      Array.from({ length: kind === "grass" ? 1 : variants }, (_, variant) =>
        buildFoliageKind(kind, quality, variant),
      ),
    ]),
  ) as Record<FoliageKind, BufferGeometry[]>;
}
