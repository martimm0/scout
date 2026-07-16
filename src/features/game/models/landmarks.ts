import type { BufferGeometry } from "three";

import { buildBoxGeometry, type Box } from "./voxel";

/**
 * The things that make it Frick Park and not just any wood.
 *
 * All of these are real, and at insect scale they stop being park furniture and
 * become geography: the Blue Slide is a mountainside, the gatehouse is a cliff
 * with an arch through it, a park bench is a bridge you can fly under.
 */

const STONE = "#a89e8c";
const STONE_DARK = "#8a7f6d";
const SLATE = "#6f6a60";
const TIMBER = "#8a6a44";

/**
 * The Blue Slide. Generations of Pittsburgh children have come down this on
 * flattened cardboard. It is the most recognisable object in the park, and from
 * here it is a blue concrete hillside.
 */
function blueSlide(): Box[] {
  const boxes: Box[] = [];
  const lanes = 3;
  const steps = 14;

  // The slope itself, stepped down the hill in slabs.
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);

    boxes.push({
      position: [0, 34 - t * 32, -46 + t * 92],
      size: [58, 4, 8],
      // Worn paler down the middle where everyone actually slides.
      color: i % 2 === 0 ? "#4a86c8" : "#5390d2",
    });
  }

  // The raised concrete dividers between lanes.
  for (let lane = 0; lane < lanes - 1; lane += 1) {
    const x = -10 + lane * 20;

    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      boxes.push({
        position: [x, 37 - t * 32, -46 + t * 92],
        size: [2.4, 3, 8],
        color: "#3d70a8",
      });
    }
  }

  // Retaining wall and the run-out at the bottom.
  boxes.push({ position: [0, 33, -52], size: [64, 12, 8], color: STONE });
  boxes.push({ position: [0, 1.5, 50], size: [64, 3, 16], color: "#7d8a92" });

  return boxes;
}

/**
 * The stone gatehouse at the Beechwood Boulevard entrance — the twin-pillared
 * gates you walk through to get into the park.
 */
function gatehouse(): Box[] {
  const boxes: Box[] = [];

  for (const side of [-1, 1]) {
    const x = side * 26;

    boxes.push({ position: [x, 20, 0], size: [16, 40, 16], color: STONE });
    boxes.push({ position: [x, 41, 0], size: [19, 3, 19], color: STONE_DARK });
    boxes.push({ position: [x, 44.5, 0], size: [8, 5, 8], color: STONE_DARK });
  }

  // The lintel across the top, with the gap you can fly through.
  boxes.push({ position: [0, 38, 0], size: [40, 6, 12], color: STONE_DARK });
  boxes.push({ position: [0, 1, 0], size: [72, 2, 22], color: "#9c9382" });

  return boxes;
}

/**
 * The Frick Environmental Center. Rebuilt in 2016 as a Living Building — net
 * zero water and energy — which is exactly the sort of thing this game should be
 * pointing at.
 */
function environmentalCenter(): Box[] {
  return [
    { position: [0, 12, 0], size: [76, 24, 46], color: "#c8bda4" },
    // Long low roof with a deep overhang.
    { position: [0, 25.5, 0], size: [86, 3, 56], color: TIMBER },
    { position: [0, 28.5, -6], size: [70, 3, 30], color: "#7a5f3e" },
    // Glazing along the front.
    { position: [0, 12, 23.5], size: [64, 15, 1.5], color: "#8fc4d8" },
    // Chimney / stair core.
    { position: [-28, 30, -10], size: [12, 14, 12], color: "#a89e8c" },
    // Rain garden cistern — the building harvests its own water.
    { position: [44, 7, 12], size: [14, 14, 14], color: "#6f7f6a" },
  ];
}

/**
 * The lawn bowling green — the only one in Pittsburgh — with its clipped hedge
 * and the little clubhouse beside it.
 */
function bowlingGreen(): Box[] {
  const boxes: Box[] = [
    { position: [0, 0.6, 0], size: [110, 1.2, 110], color: "#6fbf4c" },
  ];

  // Hedge around all four sides.
  for (const [x, z, w, d] of [
    [0, -56, 116, 5],
    [0, 56, 116, 5],
    [-56, 0, 5, 116],
    [56, 0, 5, 116],
  ] as const) {
    boxes.push({ position: [x, 4, z], size: [w, 8, d], color: "#3f7340" });
  }

  // Clubhouse.
  boxes.push({ position: [0, 9, -74], size: [30, 18, 18], color: "#d8d2c2" });
  boxes.push({ position: [0, 19, -74], size: [34, 3, 22], color: "#7a5f3e" });

  return boxes;
}

/** The clay tennis courts. Har-Tru, and a startling orange from above. */
function tennisCourts(): Box[] {
  const boxes: Box[] = [];

  for (const z of [-30, 30]) {
    boxes.push({ position: [0, 0.5, z], size: [70, 1, 40], color: "#b5714a" });
    // Net.
    boxes.push({ position: [0, 3, z], size: [1, 5, 42], color: "#4a4a44" });
    // Line markings.
    boxes.push({ position: [0, 1.1, z - 19], size: [70, 0.4, 1], color: "#e8e2d2" });
    boxes.push({ position: [0, 1.1, z + 19], size: [70, 0.4, 1], color: "#e8e2d2" });
  }

  // Chain-link surround — a wall, from here.
  for (const [x, z, w, d] of [
    [0, -54, 78, 2],
    [0, 54, 78, 2],
    [-39, 0, 2, 110],
    [39, 0, 2, 110],
  ] as const) {
    boxes.push({ position: [x, 9, z], size: [w, 18, d], color: "#7f8a7a" });
  }

  return boxes;
}

/** A park bench. At this scale, a bridge. */
function bench(): Box[] {
  return [
    { position: [0, 6, 0], size: [34, 1.6, 9], color: TIMBER },
    { position: [0, 11, -4], size: [34, 8, 1.6], color: TIMBER },
    { position: [-14, 3, 0], size: [2.4, 6, 9], color: SLATE },
    { position: [14, 3, 0], size: [2.4, 6, 9], color: SLATE },
  ];
}

/** A trail marker post, for orienting. */
function trailPost(): Box[] {
  return [
    { position: [0, 9, 0], size: [2.2, 18, 2.2], color: TIMBER },
    { position: [3, 15, 0], size: [8, 3.5, 0.8], color: "#e0d7bf" },
  ];
}

/** Stepping stones across Nine Mile Run. */
function steppingStone(): Box[] {
  return [
    { position: [0, 1.6, 0], size: [16, 3.2, 14], color: "#9a9184" },
    { position: [1, 3.4, 0.5], size: [11, 0.8, 9], color: "#a8a094" },
  ];
}


/**
 * The Fern Hollow Bridge.
 *
 * It collapsed on the morning of 28 January 2022, hours before the President was
 * due in town to talk about infrastructure. Nobody died. It was rebuilt and
 * reopened in under a year, and it is now the single most Pittsburgh object in
 * Pittsburgh — a city of four hundred bridges that dropped one into a ravine and
 * then put it back faster than anyone believed possible.
 *
 * It carries Forbes Avenue over the top of Fern Hollow. From down here it is the
 * sky.
 */
function fernHollowBridge(): Box[] {
  const boxes: Box[] = [];
  const SPAN = 300;
  const DECK_Y = 96;

  // The deck.
  boxes.push({ position: [0, DECK_Y, 0], size: [SPAN, 5, 44], color: "#8e8a82" });
  boxes.push({ position: [0, DECK_Y + 3.5, 0], size: [SPAN, 2, 38], color: "#5a5750" });

  // Parapets down both sides.
  for (const z of [-21, 21]) {
    boxes.push({ position: [0, DECK_Y + 6, z], size: [SPAN, 8, 3], color: "#a49f95" });
  }

  // Girders under the deck.
  for (const z of [-14, 0, 14]) {
    boxes.push({ position: [0, DECK_Y - 6, z], size: [SPAN, 8, 5], color: "#6f6a60" });
  }

  // Piers, marching down into the hollow.
  for (const x of [-96, -32, 32, 96]) {
    boxes.push({ position: [x, DECK_Y / 2 - 6, 0], size: [16, DECK_Y - 4, 22], color: "#9a9488" });
    boxes.push({ position: [x, DECK_Y - 12, 0], size: [24, 6, 30], color: "#8e8a82" });
  }

  // Abutments at both ends.
  for (const x of [-SPAN / 2 + 10, SPAN / 2 - 10]) {
    boxes.push({ position: [x, DECK_Y / 2, 0], size: [28, DECK_Y, 46], color: "#7f7a70" });
  }

  return boxes;
}

/** Stone steps down into the ravine. Frick is full of them, and they are steep. */
function stoneSteps(): Box[] {
  const boxes: Box[] = [];
  const steps = 16;

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);

    boxes.push({
      position: [0, 40 - t * 40, -40 + t * 80],
      size: [26, 4, 6],
      color: i % 2 === 0 ? STONE : STONE_DARK,
    });
  }

  // A handrail, because the drop is genuinely alarming.
  for (const x of [-15, 15]) {
    boxes.push({ position: [x, 46 - 20, 0], size: [2, 6, 84], color: "#5f5a52" });
  }

  return boxes;
}

/** Swings, beside the Blue Slide. */
function swings(): Box[] {
  const boxes: Box[] = [
    // A-frame.
    { position: [0, 20, 0], size: [56, 3, 3], color: SLATE },
  ];

  for (const x of [-26, 26]) {
    for (const z of [-9, 9]) {
      boxes.push({ position: [x, 10, z], size: [2.5, 20, 2.5], color: SLATE });
    }
  }

  // Two seats, hanging.
  for (const x of [-13, 13]) {
    boxes.push({ position: [x, 11, 0], size: [1, 16, 1], color: "#3f3b36" });
    boxes.push({ position: [x, 3, 0], size: [10, 1.5, 5], color: "#2f6fa8" });
  }

  return boxes;
}

/** A trail shelter. Somewhere to sit out a downpour. */
function pavilion(): Box[] {
  const boxes: Box[] = [
    { position: [0, 1, 0], size: [64, 2, 48], color: "#9c9382" },
    // Roof.
    { position: [0, 26, 0], size: [72, 3, 56], color: "#7a5f3e" },
    { position: [0, 29, 0], size: [50, 3, 38], color: "#6b5232" },
  ];

  for (const x of [-28, 28]) {
    for (const z of [-20, 20]) {
      boxes.push({ position: [x, 13, z], size: [4, 24, 4], color: TIMBER });
    }
  }

  // Picnic table under it.
  boxes.push({ position: [0, 8, 0], size: [30, 1.5, 12], color: TIMBER });
  boxes.push({ position: [0, 4, 0], size: [3, 8, 10], color: TIMBER });

  return boxes;
}

/**
 * A storm culvert, discharging into Nine Mile Run.
 *
 * The whole restoration story lives here: this stream was a sewer and a slag
 * dump for most of the twentieth century, and the outfalls are still there.
 */
function culvert(): Box[] {
  return [
    { position: [0, 9, 0], size: [30, 18, 14], color: "#7a7268" },
    // The mouth.
    { position: [0, 7, 8], size: [18, 12, 4], color: "#3a352e" },
    // Apron of rip-rap.
    { position: [0, 1, 18], size: [34, 3, 20], color: "#8a8175" },
    { position: [-8, 3, 22], size: [8, 4, 7], color: "#9a9184" },
    { position: [9, 3, 25], size: [7, 4, 6], color: "#7b7368" },
  ];
}

/**
 * A slag outcrop.
 *
 * Nine Mile Run's valley was filled with steel-mill slag — millions of tons of
 * it, dumped for decades. The restoration moved what it could and planted over
 * the rest, but the stuff is still under everything, and it still breaks the
 * surface. Glassy, sharp, and faintly wrong-coloured.
 */
function slag(): Box[] {
  return [
    { position: [0, 4, 0], size: [22, 8, 18], color: "#4a4048" },
    { position: [4, 9, -3], size: [13, 6, 11], color: "#5c5060" },
    { position: [-6, 8, 4], size: [10, 5, 9], color: "#3e3640" },
    // A vein of rust where the iron in it is still weathering out.
    { position: [1, 12, 1], size: [7, 2, 6], color: "#7a4a32" },
  ];
}


/* ------------------------------------------------------------------------- *
 * Schenley Park.
 * ------------------------------------------------------------------------- */

const GLASS = "#9fd3e0";
const GLASS_DARK = "#7ab0c4";
const BRONZE = "#6f5a3a";
const BRONZE_LIT = "#8d7346";

/**
 * Phipps Conservatory: a Victorian glasshouse, which is to say a building made
 * almost entirely of the thing buildings are usually not made of.
 *
 * The real one is a spine with wings off it and a dome in the middle. At bee
 * scale you can fly between the wings, and you should: it is the only building
 * in either park you can get inside the shape of.
 */
function phipps(): Box[] {
  const boxes: Box[] = [
    // The stone base it all sits on.
    { position: [0, 3, 0], size: [130, 6, 60], color: STONE },
  ];

  // Three glass houses in a row, the middle one taller.
  for (const [x, w, h, d] of [
    [-34, 44, 30, 52],
    [0, 38, 42, 38],
    [34, 44, 26, 52],
  ] as const) {
    boxes.push({ position: [x, 6 + h / 2, 0], size: [w, h, d], color: GLASS });
    // A ridge along the top of each.
    boxes.push({
      position: [x, 6 + h + 2, 0],
      size: [w * 0.5, 4, d * 0.5],
      color: GLASS_DARK,
    });
  }

  // The dome over the middle house.
  boxes.push({ position: [0, 54, 0], size: [22, 10, 22], color: GLASS });
  boxes.push({ position: [0, 61, 0], size: [10, 6, 10], color: GLASS_DARK });
  // The white glazing bars, which are what makes it read as glass and not ice.
  for (const z of [-26, 26]) {
    boxes.push({ position: [0, 20, z], size: [130, 1.5, 1.5], color: "#f2f2ea" });
  }

  return boxes;
}

/**
 * The Panther Hollow Bridge: Schenley Drive, carried clean over the hollow.
 *
 * Longer and higher than the Fern Hollow Bridge, and it has to be, because the
 * hollow is deeper. Flying the length of it from underneath is the best thing in
 * this park.
 */
function pantherHollowBridge(): Box[] {
  const boxes: Box[] = [
    // The deck.
    { position: [0, 100, 0], size: [260, 6, 40], color: SLATE },
    // Parapets.
    { position: [0, 106, -19], size: [260, 8, 3], color: STONE },
    { position: [0, 106, 19], size: [260, 8, 3], color: STONE },
  ];

  // The stone abutments at each end, dropping to the floor of the hollow.
  for (const x of [-112, 112]) {
    boxes.push({ position: [x, 30, 0], size: [26, 150, 30], color: STONE_DARK });
  }

  // The arch under the middle, which is the shape everybody actually pictures.
  for (const [x, y, h] of [
    [-70, 86, 26],
    [-36, 78, 42],
    [0, 74, 50],
    [36, 78, 42],
    [70, 86, 26],
  ] as const) {
    boxes.push({ position: [x, y - h / 2, 0], size: [16, h, 22], color: STONE });
  }

  // Lamp posts along the deck.
  for (const x of [-84, -28, 28, 84]) {
    boxes.push({ position: [x, 114, -19], size: [2, 12, 2], color: "#3a3a34" });
    boxes.push({ position: [x, 121, -19], size: [4, 3, 4], color: "#f4e6b0" });
  }

  return boxes;
}

/**
 * A bronze panther, crouched on a corner of the bridge.
 *
 * There are four of them on the real thing, and at this scale each one is the
 * size of a house. Being looked at by a cat the size of a house is worth the
 * flight on its own.
 */
function panther(): Box[] {
  return [
    // Plinth.
    { position: [0, 3, 0], size: [16, 6, 26], color: STONE_DARK },
    // Body, long and low.
    { position: [0, 11, 0], size: [10, 8, 22], color: BRONZE },
    // Haunches, higher than the shoulders. It is about to go somewhere.
    { position: [0, 14, 8], size: [11, 7, 8], color: BRONZE_LIT },
    // Chest and shoulders.
    { position: [0, 12, -7], size: [10, 7, 7], color: BRONZE_LIT },
    // Head, thrust forward and down.
    { position: [0, 13, -13], size: [7, 6, 6], color: BRONZE },
    // Ears.
    { position: [-2.5, 17, -12], size: [2, 3, 2], color: BRONZE },
    { position: [2.5, 17, -12], size: [2, 3, 2], color: BRONZE },
    // Muzzle.
    { position: [0, 11, -17], size: [4, 3, 4], color: BRONZE_LIT },
    // Forelegs, straight down.
    { position: [-3.5, 8, -10], size: [3, 8, 3], color: BRONZE },
    { position: [3.5, 8, -10], size: [3, 8, 3], color: BRONZE },
    // The tail, curling out behind.
    { position: [0, 9, 12], size: [2.5, 2.5, 8], color: BRONZE },
    { position: [4, 10, 15], size: [8, 2.5, 2.5], color: BRONZE },
  ];
}

/** The boathouse at Panther Hollow Lake. */
function boathouse(): Box[] {
  return [
    { position: [0, 1, 0], size: [48, 2, 34], color: TIMBER },
    { position: [0, 10, 0], size: [40, 16, 26], color: "#c2a878" },
    { position: [0, 20, 0], size: [46, 4, 32], color: "#8a4f3a" },
    // The dock, running out over the water.
    { position: [0, 1, 24], size: [16, 1.5, 20], color: TIMBER },
  ];
}

/** Schenley Oval: a running track, and the tennis courts beside it. */
function oval(): Box[] {
  const boxes: Box[] = [
    { position: [0, 0.6, 0], size: [150, 1.2, 96], color: "#b4614a" },
    // The infield.
    { position: [0, 1, 0], size: [120, 1.4, 66], color: "#6fbf4c" },
  ];

  // A fence around the whole thing.
  for (const [x, z, w, d] of [
    [0, -48, 150, 3],
    [0, 48, 150, 3],
    [-75, 0, 3, 96],
    [75, 0, 3, 96],
  ] as const) {
    boxes.push({ position: [x, 6, z], size: [w, 12, d], color: "#5a5a52" });
  }

  return boxes;
}

/**
 * The Westinghouse Memorial: a curved bronze screen around a still pond.
 *
 * Two panels with a gap, so a bee can get into the middle of it, which is the
 * only place from which you can read what is written on it.
 */
function westinghouseMemorial(): Box[] {
  const boxes: Box[] = [
    // The pond.
    { position: [0, 0.4, 20], size: [90, 0.8, 60], color: "#4a6f86" },
  ];

  // The screen, as a shallow arc of panels with a gap in the middle.
  for (const step of [-3, -2, -1, 1, 2, 3]) {
    const angle = step * 0.26;
    boxes.push({
      position: [Math.sin(angle) * 46, 13, -Math.cos(angle) * 46 + 26],
      size: [16, 26, 4],
      color: step % 2 === 0 ? BRONZE : BRONZE_LIT,
    });
  }

  // The plinths under it.
  boxes.push({ position: [0, 1.5, -14], size: [96, 3, 16], color: STONE });

  return boxes;
}

/** The visitor centre, up on the drive. */
function visitorCenter(): Box[] {
  return [
    { position: [0, 9, 0], size: [54, 18, 38], color: "#c9b48c" },
    { position: [0, 20, 0], size: [60, 4, 44], color: "#7a5f3e" },
    { position: [0, 9, 20], size: [30, 12, 2], color: GLASS },
  ];
}

/** The flagpole on top of Flagstaff Hill, which is what the hill is named for. */
function flagpole(): Box[] {
  return [
    { position: [0, 2, 0], size: [10, 4, 10], color: STONE },
    { position: [0, 36, 0], size: [3, 68, 3], color: "#e8e4d8" },
    // The flag, stiff in the wind, because a voxel flag has no choice.
    { position: [7, 62, 0], size: [12, 8, 1], color: "#b8493c" },
  ];
}


/* ------------------------------------------------------------------------- *
 * Highland Park.
 * ------------------------------------------------------------------------- */

const WATER = "#3f6f96";
const WATER_DEEP = "#2f5c80";

/**
 * A reservoir: a ring of stone embankment with a lake inside it.
 *
 * Drawn as a ring of wall segments rather than a cylinder, because the voxel
 * park has no cylinders in it and a smooth ring would be the one round thing in
 * a world made of boxes. Twenty-four segments reads as a circle from the air and
 * as masonry from close up, which is both of the things it needs to be.
 */
function reservoirRing(radius: number): Box[] {
  const boxes: Box[] = [];
  const segments = 28;

  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    /**
     * Axis-aligned, sized by which way the wall is running.
     *
     * `Box` has no rotation, on purpose: the whole voxel pipeline is axis-aligned
     * and adding a rotation to it for one landmark would be a large change to
     * every model in the game for the sake of a ring. So each segment is a box
     * stretched along whichever axis the wall happens to be running at that point,
     * which is a stair-stepped circle. In a park built out of cubes, a
     * stair-stepped circle is the honest answer.
     */
    const along = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
    const chord = (Math.PI * 2 * radius) / segments;

    boxes.push({
      position: [x, 8, z],
      size: along ? [16, 16, chord * 1.3] : [chord * 1.3, 16, 16],
      color: i % 2 === 0 ? STONE : STONE_DARK,
    });
    // The railing along the top of the walk.
    boxes.push({
      position: [x, 18, z],
      size: along ? [3, 4, chord * 1.3] : [chord * 1.3, 4, 3],
      color: SLATE,
    });
  }

  // The water: a flat slab, a little below the top of the wall.
  boxes.push({
    position: [0, 2, 0],
    size: [radius * 1.72, 4, radius * 1.72],
    color: WATER,
  });
  boxes.push({
    position: [0, 3, 0],
    size: [radius * 1.5, 2, radius * 1.5],
    color: WATER_DEEP,
  });

  return boxes;
}

function reservoirOne(): Box[] {
  return reservoirRing(118);
}

function reservoirTwo(): Box[] {
  return reservoirRing(82);
}

/** The fountain at Lake Carnegie, throwing water it will never get back. */
function fountain(): Box[] {
  const boxes: Box[] = [
    // The basin.
    { position: [0, 1, 0], size: [90, 2, 90], color: WATER },
    // Its stone rim.
    { position: [0, 3, -46], size: [94, 6, 6], color: STONE },
    { position: [0, 3, 46], size: [94, 6, 6], color: STONE },
    { position: [-46, 3, 0], size: [6, 6, 94], color: STONE },
    { position: [46, 3, 0], size: [6, 6, 94], color: STONE },
    // The plinth.
    { position: [0, 5, 0], size: [22, 10, 22], color: STONE_DARK },
    { position: [0, 12, 0], size: [14, 6, 14], color: STONE },
  ];

  // The jet, as a column of boxes getting smaller. A voxel fountain cannot
  // spray, so it stacks.
  for (let i = 0; i < 6; i += 1) {
    boxes.push({
      position: [0, 18 + i * 5, 0],
      size: [6 - i * 0.7, 5, 6 - i * 0.7],
      color: "#cfe6f2",
    });
  }

  return boxes;
}

/**
 * The Highland Avenue gates.
 *
 * Two enormous stone piers with bronzes on them, and at bee scale the bronzes
 * are the size of a house and you can fly between the piers, which is the whole
 * reason to model them.
 */
function highlandGates(): Box[] {
  const boxes: Box[] = [];

  for (const side of [-1, 1]) {
    const x = side * 34;

    // The pier.
    boxes.push({ position: [x, 16, 0], size: [18, 32, 18], color: STONE });
    boxes.push({ position: [x, 33, 0], size: [22, 3, 22], color: STONE_DARK });

    // The bronze on top: a figure, roughly. Enough of one at this scale.
    boxes.push({ position: [x, 39, 0], size: [7, 9, 5], color: BRONZE });
    boxes.push({ position: [x, 45, 0], size: [5, 4, 4], color: BRONZE_LIT });
    boxes.push({
      position: [x - side * 4, 40, 0],
      size: [3, 7, 3],
      color: BRONZE,
    });
  }

  // The low wall running out from each pier.
  for (const side of [-1, 1]) {
    boxes.push({
      position: [side * 62, 6, 0],
      size: [40, 12, 8],
      color: STONE_DARK,
    });
  }

  return boxes;
}

/** Highland Park Pool: a rectangle of chlorine the size of a small sea. */
function pool(): Box[] {
  return [
    { position: [0, 1, 0], size: [120, 2, 70], color: "#4fa8c8" },
    { position: [0, 2, 0], size: [104, 2, 56], color: "#6ec4dc" },
    // The deck.
    { position: [0, 1.5, -40], size: [130, 3, 12], color: "#d8d2c2" },
    { position: [0, 1.5, 40], size: [130, 3, 12], color: "#d8d2c2" },
    // The bath house.
    { position: [-70, 10, 0], size: [30, 20, 46], color: "#c9b48c" },
    { position: [-70, 21, 0], size: [34, 3, 50], color: "#7a5f3e" },
  ];
}

/** The pump house: the reason any of this is here. */
function pumpHouse(): Box[] {
  return [
    { position: [0, 12, 0], size: [40, 24, 30], color: "#a8442f" },
    { position: [0, 25, 0], size: [44, 3, 34], color: SLATE },
    // The stack.
    { position: [14, 34, 0], size: [8, 22, 8], color: "#8a3a28" },
  ];
}

/** The zoo, from over the fence. Roofs, and something moving. */
function zoo(): Box[] {
  return [
    // The perimeter fence, which at this scale is a wall.
    { position: [0, 9, -60], size: [180, 18, 3], color: "#4a4a44" },
    { position: [-90, 9, 0], size: [3, 18, 120], color: "#4a4a44" },
    // The big cage.
    { position: [-30, 20, 0], size: [56, 40, 56], color: "#6a6a62" },
    { position: [-30, 41, 0], size: [60, 3, 60], color: "#4a4a44" },
    // The aquarium block.
    { position: [40, 14, 20], size: [50, 28, 40], color: "#b8c4cc" },
    { position: [40, 29, 20], size: [54, 3, 44], color: "#5a6a72" },
  ];
}

export type LandmarkKind =
  | "reservoirOne"
  | "reservoirTwo"
  | "fountain"
  | "highlandGates"
  | "pool"
  | "pumpHouse"
  | "zoo"
  | "phipps"
  | "pantherHollowBridge"
  | "panther"
  | "boathouse"
  | "oval"
  | "westinghouseMemorial"
  | "visitorCenter"
  | "flagpole"
  | "blueSlide"
  | "gatehouse"
  | "environmentalCenter"
  | "bowlingGreen"
  | "tennisCourts"
  | "bench"
  | "trailPost"
  | "steppingStone"
  | "fernHollowBridge"
  | "stoneSteps"
  | "swings"
  | "pavilion"
  | "culvert"
  | "slag";

const BUILDERS: Record<LandmarkKind, () => Box[]> = {
  reservoirOne,
  reservoirTwo,
  fountain,
  highlandGates,
  pool,
  pumpHouse,
  zoo,
  phipps,
  pantherHollowBridge,
  panther,
  boathouse,
  oval,
  westinghouseMemorial,
  visitorCenter,
  flagpole,
  blueSlide,
  gatehouse,
  environmentalCenter,
  bowlingGreen,
  tennisCourts,
  bench,
  trailPost,
  steppingStone,
  fernHollowBridge,
  stoneSteps,
  swings,
  pavilion,
  culvert,
  slag,
};

export function buildLandmarkGeometry(): Record<LandmarkKind, BufferGeometry> {
  return Object.fromEntries(
    (Object.keys(BUILDERS) as LandmarkKind[]).map((kind) => [
      kind,
      buildBoxGeometry(BUILDERS[kind]()),
    ]),
  ) as Record<LandmarkKind, BufferGeometry>;
}
