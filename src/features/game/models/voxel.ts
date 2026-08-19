import { BufferAttribute, BufferGeometry, Color } from "three";

/**
 * Compiles layered text-art into voxel geometry.
 *
 * A part is authored as a stack of Y layers, bottom to top. Each layer is a
 * list of rows read front to back, and each row is a string of palette keys
 * read left to right. `.` and ` ` are empty.
 *
 *   layers[y][z][x]
 *
 * Z grows toward the BACK of the model, so row 0 is the front. The scene's
 * forward vector is -Z (see the flight loop in game-scene), which means a part
 * authored this way faces the direction it flies without any corrective yaw.
 *
 * Colour and ambient occlusion are baked into vertex colours, so a part with a
 * dozen palette keys still compiles down to one geometry and one draw call.
 */

export type VoxelPalette = Record<string, string>;

export type VoxelPart = {
  layers: string[][];
  palette: VoxelPalette;
  /**
   * Which voxel coordinate sits at the group's local origin. This is the pivot:
   * a wing hinges around its root, not its centre. Fractional values are fine.
   */
  origin: [number, number, number];
  /** World size of one voxel. */
  size: number;
  /** Ambient occlusion darkens inner corners. Off for thin translucent parts. */
  ao?: boolean;
};

type Axis = readonly [number, number, number];

type Face = {
  normal: Axis;
  u: Axis;
  v: Axis;
  corners: readonly Axis[];
};

// Corners wind counter-clockwise seen from outside, so front faces point out.
const FACES: readonly Face[] = [
  {
    normal: [1, 0, 0],
    u: [0, 1, 0],
    v: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    normal: [-1, 0, 0],
    u: [0, 1, 0],
    v: [0, 0, 1],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    normal: [0, 1, 0],
    u: [1, 0, 0],
    v: [0, 0, 1],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    normal: [0, -1, 0],
    u: [1, 0, 0],
    v: [0, 0, 1],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    normal: [0, 0, 1],
    u: [1, 0, 0],
    v: [0, 1, 0],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    normal: [0, 0, -1],
    u: [1, 0, 0],
    v: [0, 1, 0],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
];

// Four occlusion steps, from a fully boxed-in corner to an open one.
const AO_LEVELS = [0.58, 0.74, 0.88, 1] as const;

const EMPTY = new Set([".", " ", "_"]);

function isEmpty(key: string | undefined) {
  return key === undefined || EMPTY.has(key);
}

function dot(a: Axis, b: Axis) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * The classic voxel AO rule: a corner is darkest when both edge neighbours are
 * solid, and unoccluded when nothing touches it.
 */
function cornerShade(side1: boolean, side2: boolean, corner: boolean) {
  if (side1 && side2) {
    return AO_LEVELS[0];
  }

  const occluders = Number(side1) + Number(side2) + Number(corner);

  return AO_LEVELS[3 - occluders];
}

export function buildVoxelGeometry(part: VoxelPart): BufferGeometry {
  const { ao = true, layers, origin, palette, size } = part;

  const at = (x: number, y: number, z: number) => layers[y]?.[z]?.[x];
  const solid = (x: number, y: number, z: number) => !isEmpty(at(x, y, z));

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const scratch = new Color();
  const resolved = new Map<string, [number, number, number]>();

  const colorFor = (key: string) => {
    const cached = resolved.get(key);

    if (cached) {
      return cached;
    }

    const hex = palette[key];

    if (!hex) {
      throw new Error(`Voxel palette is missing an entry for "${key}"`);
    }

    // Vertex colours are multiplied in linear space by the renderer, so convert
    // once here rather than fighting washed-out output later.
    scratch.set(hex).convertSRGBToLinear();
    const rgb: [number, number, number] = [scratch.r, scratch.g, scratch.b];
    resolved.set(key, rgb);

    return rgb;
  };

  for (let y = 0; y < layers.length; y += 1) {
    const layer = layers[y];

    for (let z = 0; z < layer.length; z += 1) {
      const row = layer[z];

      for (let x = 0; x < row.length; x += 1) {
        const key = row[x];

        if (isEmpty(key)) {
          continue;
        }

        const [r, g, b] = colorFor(key);

        for (const face of FACES) {
          const [nx, ny, nz] = face.normal;

          // Skip faces buried against a neighbour, nobody will ever see them.
          if (solid(x + nx, y + ny, z + nz)) {
            continue;
          }

          const quad: number[][] = [];

          for (const corner of face.corners) {
            const px = (x + corner[0] - origin[0]) * size;
            const py = (y + corner[1] - origin[1]) * size;
            const pz = (z + corner[2] - origin[2]) * size;

            let shade = 1;

            if (ao) {
              // Step toward this corner along each of the face's two tangents.
              const du = dot(corner, face.u) === 1 ? 1 : -1;
              const dv = dot(corner, face.v) === 1 ? 1 : -1;

              const ux = face.u[0] * du;
              const uy = face.u[1] * du;
              const uz = face.u[2] * du;
              const vx = face.v[0] * dv;
              const vy = face.v[1] * dv;
              const vz = face.v[2] * dv;

              const side1 = solid(x + nx + ux, y + ny + uy, z + nz + uz);
              const side2 = solid(x + nx + vx, y + ny + vy, z + nz + vz);
              const diagonal = solid(
                x + nx + ux + vx,
                y + ny + uy + vy,
                z + nz + uz + vz,
              );

              shade = cornerShade(side1, side2, diagonal);
            }

            quad.push([px, py, pz, r * shade, g * shade, b * shade]);
          }

          // Split the quad along the darker diagonal, otherwise AO gradients
          // crease the wrong way and the seam reads as a hard edge.
          const flip =
            quad[0][3] + quad[0][4] + quad[0][5] + quad[2][3] + quad[2][4] + quad[2][5] <
            quad[1][3] + quad[1][4] + quad[1][5] + quad[3][3] + quad[3][4] + quad[3][5];

          const triangles = flip
            ? [quad[1], quad[2], quad[3], quad[1], quad[3], quad[0]]
            : [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]];

          for (const vertex of triangles) {
            positions.push(vertex[0], vertex[1], vertex[2]);
            normals.push(nx, ny, nz);
            colors.push(vertex[3], vertex[4], vertex[5]);
          }
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();

  return geometry;
}

export type Box = {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};

/**
 * How much each face direction is darkened. Trees and plants are built from a
 * handful of large boxes rather than a dense voxel grid, so per-corner AO has
 * nothing to bite on. Shading whole faces by their normal gives the same chunky
 * hand-shaded look for a fraction of the work.
 */
const FACE_SHADE = [0.86, 0.86, 1, 0.66, 0.94, 0.76];

/**
 * Merges a pile of coloured boxes into one geometry. This is the right tool
 * when a model is a few dozen chunky masses (a tree, a flower) rather than a
 * dense grid of unit cubes (the bee).
 */
export function buildBoxGeometry(boxes: Box[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const scratch = new Color();

  for (const box of boxes) {
    const [cx, cy, cz] = box.position;
    const [sx, sy, sz] = box.size;

    scratch.set(box.color).convertSRGBToLinear();
    const { r, g, b } = scratch;

    FACES.forEach((face, index) => {
      const [nx, ny, nz] = face.normal;
      const dim = FACE_SHADE[index];

      const quad = face.corners.map((corner) => [
        cx + (corner[0] - 0.5) * sx,
        cy + (corner[1] - 0.5) * sy,
        cz + (corner[2] - 0.5) * sz,
      ]);

      for (const vertex of [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]]) {
        positions.push(vertex[0], vertex[1], vertex[2]);
        normals.push(nx, ny, nz);
        colors.push(r * dim, g * dim, b * dim);
      }
    });
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();

  return geometry;
}

/** Mixes a colour toward white. Used to derive fuzz tints from the body colour. */
export function tint(hex: string, amount: number) {
  const color = new Color(hex);
  color.lerp(new Color("#ffffff"), amount);

  return `#${color.getHexString()}`;
}

/** Mixes a colour toward black. */
export function shade(hex: string, amount: number) {
  const color = new Color(hex);
  color.lerp(new Color("#000000"), amount);

  return `#${color.getHexString()}`;
}
