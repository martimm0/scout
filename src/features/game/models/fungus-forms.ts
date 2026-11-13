import type { Fungus } from "../data/fungi";
import { add, flecked, polar, TAU } from "./plant-kit";
import { shade, tint } from "./voxel";
import { SPOON, type Paint, type PaintFn, type Vec3, type VoxelGrid } from "./voxel-grid";

/**
 * Every fungus, as itself.
 *
 * A mushroom is not a small plant. It has no stem in the plant sense, no leaves
 * and no flower: what you see is the fruiting body, the fungus's apple, and the
 * organism is a web of threads through the wood or the soil. So most of these
 * come with the thing they are eating, a stub or a stick or a log, because a
 * bracket with nothing to be a bracket ON is a plate.
 *
 * Same bargain as the plants: one feature each, pushed until it reads from the
 * air. The honeycomb of a morel, the icicles of a lion's mane, the ink dripping
 * off a shaggy mane.
 */
export type FungusForm = (g: VoxelGrid, fungus: Fungus) => Vec3;

const BARK = "#6b5236";
const ROT = "#8a7458";

/** A rotting stub, broken off at the top, for brackets to grow on. */
function stub(g: VoxelGrid, height: number, radius: number, paint: Paint = BARK) {
  const wood: PaintFn = (x, y, z, h) =>
    typeof paint === "string"
      ? Math.sin((x * 2.1 + z * 2.7) / (radius * 0.5)) > 0.5
        ? shade(paint, 0.16)
        : h > 0.9
          ? tint(paint, 0.1)
          : paint
      : paint(x, y, z, h);

  g.column([0, 0, 0], height, radius * 1.15, radius, wood);
  // Snapped, not sawn.
  g.limb([radius * 0.3, height, 0], [radius * 0.5, height * 1.14, -radius * 0.3], radius * 0.5, radius * 0.1, wood);
  g.column([0, height - g.size, 0], g.size, radius * 0.7, radius * 0.7, ROT);
}

/** A stick lying on the ground, for the small things that grow along one. */
function stick(g: VoxelGrid, length: number, radius: number, paint: Paint = BARK) {
  g.limb([-length / 2, radius, 0], [length / 2, radius * 1.3, 0.04], radius, radius * 0.8, paint);
}

/** Colour by distance from a point on the ground plane: the zones of a bracket. */
function zoned(root: Vec3, zones: [number, string][], fallback: string): PaintFn {
  return (x, _y, z) => {
    const reach = Math.hypot(x - root[0], z - root[2]);

    for (const [limit, color] of zones) {
      if (reach < limit) {
        return color;
      }
    }

    return fallback;
  };
}

/** A fan growing out of wood at `root`, facing `angle`. */
function fan(
  g: VoxelGrid,
  root: Vec3,
  angle: number,
  length: number,
  width: number,
  paint: Paint,
  options: { rise?: number; thickness?: number; under?: Paint } = {},
) {
  const tip = polar(angle, length, options.rise ?? 0, root);

  if (options.under) {
    g.blade(add(root, [0, -g.size, 0]), add(tip, [0, -g.size, 0]), width * 0.92, options.under, {
      profile: SPOON,
      thickness: options.thickness,
    });
  }

  g.blade(root, tip, width, paint, { profile: SPOON, thickness: options.thickness });
}

const turkeyTail: FungusForm = (g, { capColor: C, height: H }) => {
  stub(g, H * 0.9, 0.15);

  // Thin overlapping fans in rings of colour, like the tail it is named for.
  const fans: [number, number, number][] = [
    [0.18, 1.2, 0.3], [0.3, 2.1, 0.26], [0.42, 0.7, 0.3], [0.54, 1.7, 0.27],
    [0.66, 2.6, 0.22], [0.78, 1.1, 0.24], [0.5, 3.4, 0.2], [0.26, 0.1, 0.22],
  ];

  for (const [t, angle, size] of fans) {
    const root = polar(angle, 0.13, H * t);

    fan(g, root, angle, size, size * 1.5, zoned(root, [
      [size * 0.3, shade(C, 0.25)],
      [size * 0.46, C],
      [size * 0.6, "#5f6f7a"],
      [size * 0.74, "#b98a5a"],
      [size * 0.88, shade(C, 0.1)],
    ], "#efe6d0"), { under: "#e8e0cc" });
  }

  return [0.05, H * 1.03, 0];
};

const chickenOfTheWoods: FungusForm = (g, { capColor: C, height: H }) => {
  stub(g, H * 0.86, 0.2);

  // Great thick shelves, orange to the middle and sulphur yellow at the rim.
  const shelves: [number, number, number][] = [
    [0.2, 1.3, 0.44], [0.4, 2.2, 0.4], [0.58, 0.8, 0.42], [0.74, 1.8, 0.34], [0.9, 1.2, 0.26],
  ];

  for (const [t, angle, size] of shelves) {
    const root = polar(angle, 0.16, H * t);

    fan(g, root, angle, size, size * 1.5, zoned(root, [[size * 0.55, C], [size * 0.78, tint(C, 0.2)]], "#f4d24a"), {
      thickness: 0.07,
      rise: 0.04,
      under: "#f0cf52",
    });
  }

  return [0.1, H * 0.98, 0.2];
};

const oysterMushroom: FungusForm = (g, { capColor: C, height: H }) => {
  // On the side of a fallen log, in a cascade.
  g.limb([-0.5, 0.2, -0.05], [0.5, 0.2, -0.05], 0.2, 0.19, BARK);
  g.column([-0.5, 0, -0.05], 0.4, 0.02, 0.02, ROT);

  const caps: [number, number, number][] = [
    [-0.28, 0.2, 0.34], [-0.06, 0.34, 0.4], [0.2, 0.24, 0.36], [0.06, 0.5, 0.3], [0.34, 0.44, 0.26], [-0.2, 0.52, 0.24],
  ];

  for (const [x, y, size] of caps) {
    const root: Vec3 = [x, y * H * 1.7, 0.1];

    // Gills running down the underside, right onto the stubby off-centre stem.
    g.blade(add(root, [0, -g.size * 1.5, 0]), add(root, [0, 0.02, size * 0.86]), size * 0.9, (px) =>
      Math.floor(px / (g.size * 2)) % 2 === 0 ? "#f0e8d8" : "#ddd2bc",
    { profile: SPOON });
    fan(g, root, Math.PI / 2, size, size * 1.15, (px, _py, pz) =>
      Math.hypot(px - root[0], pz - root[2]) > size * 0.8 ? tint(C, 0.2) : C,
    { rise: 0.06, thickness: 0.05 });
  }

  return [0.06, H * 1.7 * 0.5 + 0.1, 0.25];
};

const morel: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  const s = g.size;

  g.column([0, 0, 0], H * 0.46, 0.085, 0.07, flecked(S, shade(S, 0.08), 0.2));

  // The honeycomb: pale ridges round dark pits, the whole cap hollow inside.
  g.ball([0, H * 0.72, 0], [0.13, H * 0.36, 0.13], (x, y, z) => {
    const ridge =
      Math.round(x / s + y / s) % 3 === 0 || Math.round(z / s - y / s) % 3 === 0;

    return ridge ? tint(C, 0.18) : shade(C, 0.42);
  });

  return [0, H * 1.08, 0];
};

const giantPuffball: FungusForm = (g, { capColor: C, height: H }) => {
  // A football left on the lawn. Smooth, white, and just starting to crack.
  g.ball([0, H * 0.48, 0], [H * 0.62, H * 0.5, H * 0.58], (x, y, z, h) =>
    Math.abs(Math.sin(x * 9 + z * 7) * Math.cos(z * 11 - x * 3)) < 0.06 && y > H * 0.5
      ? "#cbbf9f"
      : h > 0.9
        ? shade(C, 0.05)
        : C,
  );
  g.column([0, 0, 0], H * 0.1, H * 0.2, H * 0.34, "#ddd6c4");

  return [0, H * 0.98, 0];
};

/** A funnel-shaped cap on a stalk leaning out from a shared base. */
function funnel(g: VoxelGrid, base: Vec3, top: Vec3, radius: number, cap: string, stalk: string) {
  g.limb(base, top, radius * 0.24, radius * 0.3, stalk);
  // Gills that run down onto the stalk.
  g.column([top[0], top[1] - radius * 0.5, top[2]], radius * 0.5, radius * 0.28, radius * 0.92, (x, _y, z) =>
    Math.floor((Math.atan2(z - top[2], x - top[0]) + Math.PI) * (16 / TAU)) % 2 === 0 ? tint(cap, 0.22) : tint(cap, 0.1),
  );
  g.column(top, radius * 0.2, radius, radius * 0.86, cap);
  // Dished in the middle.
  g.ball(add(top, [0, radius * 0.24, 0]), [radius * 0.5, radius * 0.16, radius * 0.5], shade(cap, 0.1));
}

const jackOLantern: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // A dense orange clump, every stalk from the one buried root.
  const caps: [number, number, number, number][] = [
    [0, 0, 1, 0.3], [0.9, 0.34, 0.86, 0.26], [2.6, 0.36, 0.8, 0.26],
    [4.2, 0.38, 0.72, 0.24], [5.4, 0.3, 0.9, 0.22], [1.8, 0.5, 0.56, 0.2], [3.5, 0.52, 0.5, 0.2],
  ];

  for (const [angle, lean, tall, radius] of caps) {
    funnel(g, polar(angle, lean * 0.2), polar(angle, lean, H * tall), radius, C, S);
  }

  return [0, H + 0.08, 0];
};

const dryadsSaddle: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  stub(g, H * 0.9, 0.2);

  // A saddle you could actually sit in, tan and feathered with dark scales.
  const shelves: [number, number, number][] = [[0.34, 1.4, 0.62], [0.72, 2.2, 0.46]];

  for (const [t, angle, size] of shelves) {
    const root = polar(angle, 0.16, H * t);

    g.limb(root, polar(angle, 0.12, -0.08, root), 0.07, 0.06, shade(S, 0.3));
    fan(g, root, angle, size, size * 1.35, (x, _y, z, h) => {
      const reach = Math.hypot(x - root[0], z - root[2]);

      return Math.floor(reach / (size * 0.13)) % 2 === 0 && h > 0.45 ? "#6b4a2c" : C;
    }, { thickness: 0.07, rise: 0.05, under: "#efe6c8" });
  }

  return [0.2, H * 0.72 + 0.1, 0.34];
};

const destroyingAngel: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // The cup at the foot: the one feature that says do not eat this.
  g.ball([0, 0.07, 0], [0.12, 0.09, 0.12], "#e3ddcf");
  g.ball([0, 0.13, 0], [0.085, 0.06, 0.085], null);
  g.column([0, 0.04, 0], H * 0.82, 0.045, 0.036, S);
  // The skirt, hanging from the stem like a petticoat.
  g.column([0, H * 0.56, 0], 0.07, 0.11, 0.045, tint(S, 0.1));
  // Gills, then a smooth cap, white as paper.
  g.column([0, H * 0.82, 0], 0.03, 0.2, 0.2, (x, _y, z) =>
    Math.floor((Math.atan2(z, x) + Math.PI) * (20 / TAU)) % 2 === 0 ? "#f1ece0" : "#e0d9c8",
  );
  g.ball([0, H * 0.86, 0], [0.24, 0.14, 0.24], C, { half: "upper" });

  return [0, H * 0.86 + 0.14, 0];
};

const henOfTheWoods: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // At the foot of an oak: a ruffled grey-brown rosette, a hen fluffing up.
  g.ball([0, H * 0.25, 0], [0.26, H * 0.3, 0.26], S, { rough: 0.15 });

  for (let tier = 0; tier < 3; tier += 1) {
    const count = 9 - tier * 2;

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + tier * 0.5;
      const root = polar(angle, 0.16 - tier * 0.04, H * (0.26 + tier * 0.26));
      const size = 0.3 - tier * 0.05;

      fan(g, root, angle, size, size * 0.95, (x, _y, z) =>
        Math.hypot(x - root[0], z - root[2]) > size * 0.72 ? tint(C, 0.3) : i % 2 === 0 ? C : shade(C, 0.12),
      { rise: 0.1 });
    }
  }

  return [0, H * 1.0, 0];
};

const artistsConk: FungusForm = (g, { capColor: C, height: H }) => {
  stub(g, H * 1.4, 0.2);

  // One woody hoof, ridged a year at a time.
  const root: Vec3 = [0, H * 0.72, 0.14];

  g.ball(root, [0.42, H * 0.36, 0.4], (x, _y, z) => {
    const reach = Math.hypot(x - root[0], z - root[2]);

    return reach > 0.36 ? "#e8dfc9" : Math.floor(reach / 0.07) % 2 === 0 ? C : shade(C, 0.2);
  }, { half: "upper" });
  // The underside is white, and bruises brown where you scratch it. People draw on them.
  g.column([root[0], root[1] - g.size, root[2]], g.size, 0.4, 0.4, (x, _y, z) =>
    Math.abs(z - 0.34 - Math.sin(x * 14) * 0.03) < g.size * 0.6 && Math.abs(x) < 0.22 ? "#8a6a4a" : "#f2ecdc",
  );
  // Cut it back flush with the stub behind.
  g.box([0, H * 0.8, -0.34], [1, H * 0.9, 0.5], null);
  stub(g, H * 1.4, 0.2);

  return [0, H * 0.72 + H * 0.36, 0.2];
};

const ravenelsStinkhorn: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // It hatches from an egg, and the egg stays behind at the foot.
  g.ball([0, 0.07, 0], [0.11, 0.09, 0.11], "#e9dccf");
  g.column([0, 0.05, 0], H * 0.72, 0.055, 0.045, flecked(S, shade(S, 0.1), 0.3));
  // A slimy olive thimble with a white ring at the very tip.
  g.ball([0, H * 0.86, 0], [0.085, H * 0.2, 0.085], flecked(C, shade(C, 0.2), 0.3));
  g.column([0, H * 1.03, 0], g.size * 1.5, 0.04, 0.04, "#f3eedd");

  // It smells of carrion on purpose, and the flies it is calling have come.
  g.put(Math.round(0.1 / g.size), Math.round((H * 0.9) / g.size), Math.round(0.02 / g.size), "#1c1a18");
  g.put(Math.round(-0.08 / g.size), Math.round((H * 0.78) / g.size), Math.round(0.06 / g.size), "#1c1a18");

  return [0, H * 1.06, 0];
};

const bitterOyster: FungusForm = (g, { capColor: C, height: H }) => {
  stick(g, 0.9, 0.09);

  // Small tan kidneys in overlapping rows along a dead branch. They glow.
  for (let i = 0; i < 9; i += 1) {
    const x = -0.36 + i * 0.09;
    const up = i % 2 === 0;
    const root: Vec3 = [x, 0.13 + (up ? H * 0.5 : 0), up ? 0 : 0.08];
    const size = 0.17 + (i % 3) * 0.02;

    fan(g, root, Math.PI / 2 + (i % 3 - 1) * 0.3, size, size * 1.15, i % 2 === 0 ? C : tint(C, 0.14), {
      rise: up ? 0.04 : -0.02,
      under: "#e0c9a0",
    });
  }

  return [0, 0.13 + H * 0.5 + 0.06, 0.1];
};

const smoothChanterelle: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // A vase: stem and cap are one piece, flaring to a wavy rim.
  g.column([0, 0, 0], H * 0.9, 0.06, 0.24, (_x, y) => (y < H * 0.4 ? S : y < H * 0.62 ? tint(C, 0.15) : C));

  // The rim ruffles, like the hem of a skirt.
  for (let i = 0; i < 7; i += 1) {
    g.ball(polar(i * (TAU / 7), 0.25, H * 0.9), [0.1, 0.035, 0.1], C);
  }

  g.ball([0, H * 0.96, 0], [0.13, 0.07, 0.13], null);
  g.column([0, H * 0.84, 0], g.size, 0.12, 0.12, shade(C, 0.12));

  return [0.16, H * 0.98, 0];
};

const shaggyMane: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  const s = g.size;

  g.column([0, 0, 0], H * 0.5, 0.04, 0.04, S);
  // A tall closed parasol, shingled all over with curling scales.
  g.column([0, H * 0.3, 0], H * 0.62, 0.115, 0.095, (x, y, z) => {
    const row = Math.floor(y / (s * 3));
    const turn = Math.floor((Math.atan2(z, x) + Math.PI) * (9 / TAU) + (row % 2) * 0.5);

    return y > H * 0.82 ? "#b98f5c" : (turn + row) % 2 === 0 ? C : "#cdb98f";
  });
  g.ball([0, H * 0.92, 0], [0.095, 0.08, 0.095], "#b98f5c", { half: "upper" });
  // And then it dissolves itself into ink, from the hem upward.
  g.column([0, H * 0.3 - s, 0], s * 2, 0.125, 0.125, "#2a2424");

  for (let i = 0; i < 4; i += 1) {
    const drip = polar(i * 1.7 + 0.3, 0.11, H * 0.3);

    g.limb(drip, add(drip, [0, -0.06 - (i % 2) * 0.05, 0]), 0, 0, "#2a2424");
  }

  return [0, H * 1.0, 0];
};

const witchesButter: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  stick(g, 0.9, 0.1);

  // Jelly, in brain-folds, squeezed out of the bark after rain.
  const lobes: [number, number, number][] = [
    [-0.16, 0.02, 0.15], [0.02, 0.05, 0.18], [0.2, 0.0, 0.14], [-0.04, -0.08, 0.12], [0.12, 0.1, 0.11], [-0.22, -0.06, 0.1],
  ];

  lobes.forEach(([x, z, r], index) => {
    g.ball([x, 0.16 + r * 0.7, z], [r, r * 0.8, r], (_x, y) =>
      y > 0.16 + r * 1.1 ? tint(C, 0.2) : index % 2 === 0 ? C : S,
    { rough: 0.18 });
  });

  return [0.02, 0.16 + H * 0.9, 0.05];
};

const lionsMane: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  stub(g, H * 1.25, 0.2);

  // A white pom-pom on a wound in the trunk, hung all over with icicles.
  const centre: Vec3 = [0, H * 0.74, 0.3];

  g.ball(centre, [0.26, H * 0.24, 0.24], C, { rough: 0.12 });

  for (let i = 0; i < 34; i += 1) {
    const tilt = 0.2 + ((i * 0.618) % 1) * 1.3;
    const turn = i * 2.4;
    const from: Vec3 = [
      centre[0] + Math.sin(tilt) * Math.cos(turn) * 0.24,
      centre[1] - Math.cos(tilt) * H * 0.1,
      centre[2] + Math.sin(tilt) * Math.sin(turn) * 0.22,
    ];

    // Blocked by the trunk behind.
    if (from[2] < 0.12) {
      continue;
    }

    g.limb(from, add(from, [0, -H * (0.3 + (i % 4) * 0.07), 0]), 0.016, 0, i % 3 === 0 ? S : C);
  }

  return [0, H * 0.98, 0.3];
};

const deadMansFingers: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // Black, swollen, and reaching up out of the ground from a buried root.
  const fingers: [number, number, number, number][] = [
    [0, 0, 1, 0.3], [1.2, 0.16, 0.86, -0.3], [2.6, 0.2, 0.78, 0.2], [4, 0.17, 0.92, -0.2], [5.2, 0.24, 0.6, 0.4],
  ];

  for (const [angle, out, tall, crook] of fingers) {
    const base = polar(angle, out * 0.4);
    const knuckle = polar(angle, out, H * tall * 0.55);
    const tip = polar(angle + crook, out * 1.2, H * tall);

    g.limb(base, knuckle, 0.05, 0.062, flecked(C, S, 0.25));
    g.limb(knuckle, tip, 0.062, 0.045, flecked(C, S, 0.25));
    // Pale at the fingertip, where it is still growing.
    g.ball(tip, 0.04, "#c9c4b8");
  }

  return [0, H * 1.04, 0];
};

const crownTippedCoral: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  stick(g, 0.7, 0.09);

  // A candelabra: each branch ends in a little cup, and each cup's rim throws
  // up a crown of more branches.
  const branch = (from: Vec3, angle: number, length: number, depth: number) => {
    const to = polar(angle, length * 0.42, length, from);

    g.limb(from, to, 0.028 + depth * 0.012, 0.022 + depth * 0.008, depth > 0 ? S : C);

    if (depth === 0) {
      // The crown.
      for (let k = 0; k < 4; k += 1) {
        g.limb(to, polar(k * (TAU / 4) + angle, 0.035, 0.05, to), 0, 0, tint(C, 0.15));
      }

      return;
    }

    for (let k = 0; k < 3; k += 1) {
      branch(to, angle + (k - 1) * 2.1 + depth, length * 0.72, depth - 1);
    }
  };

  for (let i = 0; i < 4; i += 1) {
    branch([(i - 1.5) * 0.07, 0.14, 0], i * 1.7, H * 0.4, 2);
  }

  return [0, 0.14 + H * 0.9, 0];
};

const bleedingFairyHelmet: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  stick(g, 0.8, 0.1, "#5f4a34");

  // A troop of tiny bells on thread-thin stalks.
  const troop: [number, number, number][] = [
    [-0.22, 0.02, 0.8], [-0.08, 0.06, 1], [0.06, -0.02, 0.7], [0.18, 0.05, 0.92], [0.28, -0.03, 0.6], [-0.3, -0.04, 0.55],
  ];

  for (const [x, z, tall] of troop) {
    const top: Vec3 = [x, 0.16 + H * tall, z];

    g.limb([x * 0.9, 0.16, z], top, 0, 0, S);
    // Scalloped and paler at the hem.
    g.column([top[0], top[1] - 0.02, top[2]], 0.1, 0.075, 0.02, (_x, y) => (y < top[1] + 0.01 ? tint(C, 0.3) : C));
  }

  // Break a stalk and it bleeds dark red, which is the whole of its name.
  g.put(Math.round(-0.08 / g.size), Math.round(0.22 / g.size), Math.round(0.07 / g.size), "#8a1c2a");
  g.ball([-0.07, 0.17, 0.09], [0.03, 0.015, 0.03], "#8a1c2a");

  return [-0.08, 0.16 + H + 0.08, 0.06];
};

const hemlockVarnishShelf: FungusForm = (g, { capColor: C, height: H }) => {
  stub(g, H * 1.3, 0.19, "#4f3d30");

  // Lacquered, as if somebody had varnished it: mahogany at the wood, through
  // orange and yellow to a white growing edge.
  const root: Vec3 = [0, H * 0.66, 0.12];

  g.limb(root, add(root, [0.1, -0.04, 0.12]), 0.07, 0.06, shade(C, 0.3));
  g.ball(add(root, [0.06, 0, 0.18]), [0.38, H * 0.2, 0.3], (x, _y, z, h) => {
    const reach = Math.hypot(x - root[0], z - root[2]);

    return reach > 0.42
      ? "#f6f0dc"
      : reach > 0.36
        ? "#e9b84a"
        : reach > 0.29
          ? "#c9662c"
          : h > 0.94
            ? tint(C, 0.35)
            : C;
  }, { half: "upper" });
  g.column([root[0] + 0.06, root[1] - g.size, root[2] + 0.18], g.size, 0.32, 0.32, "#efe6cf");
  g.box([0, H * 0.7, -0.3], [1, H * 0.8, 0.44], null);
  stub(g, H * 1.3, 0.19, "#4f3d30");

  return [0.06, H * 0.86, 0.3];
};

const scarletElfCup: FungusForm = (g, { capColor: C, height: H, stemColor: S }) => {
  // A mossy stick on the wet ground, and three cups left out on it.
  stick(g, 0.9, 0.09, flecked("#5f4a34", "#5f8f4a", 0.35));

  const cups: [number, number, number][] = [[-0.2, 0.02, 0.2], [0.1, -0.03, 0.15], [0.3, 0.05, 0.11]];

  for (const [x, z, r] of cups) {
    const centre: Vec3 = [x, 0.16 + r * 0.72, z];

    // Whitish outside, the red all on the inside.
    g.ball(centre, [r, r * 0.74, r], S, { half: "lower" });
    g.ball(centre, [r * 0.8, r * 0.6, r * 0.8], C, { half: "lower" });
    g.ball(add(centre, [0, 0, 0]), [r * 0.62, r * 0.42, r * 0.62], null);
    g.column([centre[0], centre[1] - r * 0.5, centre[2]], g.size, r * 0.5, r * 0.5, shade(C, 0.12));
  }

  return [-0.2, 0.16 + H * 0.5, 0.02];
};

export const FUNGUS_FORMS: Record<string, FungusForm> = {
  "turkey-tail": turkeyTail,
  "chicken-of-the-woods": chickenOfTheWoods,
  "oyster-mushroom": oysterMushroom,
  morel,
  "giant-puffball": giantPuffball,
  "jack-o-lantern": jackOLantern,
  "dryads-saddle": dryadsSaddle,
  "eastern-destroying-angel": destroyingAngel,
  "hen-of-the-woods": henOfTheWoods,
  "artists-conk": artistsConk,
  "ravenels-stinkhorn": ravenelsStinkhorn,
  "bitter-oyster": bitterOyster,
  "smooth-chanterelle": smoothChanterelle,
  "shaggy-mane": shaggyMane,
  "witches-butter": witchesButter,
  "lions-mane": lionsMane,
  "dead-mans-fingers": deadMansFingers,
  "crown-tipped-coral": crownTippedCoral,
  "bleeding-fairy-helmet": bleedingFairyHelmet,
  "hemlock-varnish-shelf": hemlockVarnishShelf,
  "scarlet-elf-cup": scarletElfCup,
};
