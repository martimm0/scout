import { BufferAttribute, BufferGeometry, Color } from "three";

import { setLattice } from "./lattice";
import { AO_LEVELS, FACES, shade, tint, type Box } from "./voxel";

/**
 * A voxel canvas: stamp shapes in, get one shaded mesh out.
 *
 * The park was built two ways. The bee was a real voxel grid, authored as text
 * art and shaded corner by corner, and everything else (flowers, trees, rocks,
 * landmarks) was a pile of a few large boxes with one flat shade per face. The
 * boxes were cheap and they looked it: a daisy was eleven slabs.
 *
 * This is the missing middle. A model is described in world units by stamping
 * shapes (a ball, a limb, a blade) into a grid, and the voxel size is a
 * parameter of the grid rather than of the model. So one description compiles
 * at two resolutions, which is what the quality setting is: the same flower,
 * coarse on a phone and fine on a desktop.
 *
 * Cells are centred on the origin in X and Z and sit ON the ground in Y, so a
 * one-voxel stem at x=0 is centred and a model's base is y=0, which is the
 * convention every box model here already had.
 */

export type Vec3 = [number, number, number];

/**
 * A colour, or a rule for one. The rule gets the voxel centre in world units
 * and a stable 0..1 hash for that cell, which is enough for stripes, gradients
 * and speckle without the grid knowing about any of them.
 */
export type PaintFn = (x: number, y: number, z: number, h: number) => string;
export type Paint = string | PaintFn;

export type BuildOptions = {
  /** Corner shading. Off for thin translucent parts, where it reads as dirt. */
  ao?: boolean;
  /**
   * Leave out the faces looking straight down from the lowest layer. For
   * anything that stands on the ground, where those faces are buried and a
   * lawn of five thousand tufts would be paying for all of them.
   */
  grounded?: boolean;
};

/** Cells live in -512..511 on each axis, which is plenty and packs into a number. */
const OFFSET = 512;
const SPAN = 1024;

function hash3(x: number, y: number, z: number, seed: number) {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 1440662683) ^
    Math.imul(seed, 1274126177);

  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class VoxelGrid {
  private readonly cells = new Map<number, number>();
  /** Linear RGB triples. A cell stores an index into this, plus one. */
  private readonly colors: number[] = [];
  private readonly lookup = new Map<string, number>();
  private readonly scratch = new Color();

  constructor(
    /** World size of one voxel. */
    readonly size: number,
    /** Varies the hash handed to paint rules, so two variants differ. */
    private readonly seed = 1,
    /**
     * Plain drops the texture: no roughened surfaces and no speckle, so every
     * paint rule sees the same middling hash. Shapes, stripes and gradients
     * survive. It is what the low quality asks for, because broken-up faces
     * are exactly the ones that cannot merge, and merging is where the saving is.
     */
    private readonly plain = false,
  ) {}

  /** Whether fine detail is wanted: veins, speckle, roughness. False on low. */
  get detailed() {
    return !this.plain;
  }

  /** How many cells are filled. */
  get count() {
    return this.cells.size;
  }

  private colorIndex(hex: string) {
    const known = this.lookup.get(hex);

    if (known !== undefined) {
      return known;
    }

    // Vertex colours are multiplied in linear space by the renderer.
    this.scratch.set(hex);
    this.colors.push(this.scratch.r, this.scratch.g, this.scratch.b);

    const index = this.colors.length / 3;

    this.lookup.set(hex, index);

    return index;
  }

  /** Paint one cell, or clear it with `null`. Out of range is ignored. */
  put(ix: number, iy: number, iz: number, paint: Paint | null) {
    if (
      ix < -OFFSET + 1 || ix > OFFSET - 2 ||
      iy < -OFFSET + 1 || iy > OFFSET - 2 ||
      iz < -OFFSET + 1 || iz > OFFSET - 2
    ) {
      return;
    }

    const key = ((ix + OFFSET) * SPAN + (iy + OFFSET)) * SPAN + (iz + OFFSET);

    if (paint === null) {
      this.cells.delete(key);
      return;
    }

    const { size } = this;
    const hex =
      typeof paint === "string"
        ? paint
        : paint(
            ix * size,
            (iy + 0.5) * size,
            iz * size,
            this.plain ? 0.5 : hash3(ix, iy, iz, this.seed),
          );

    this.cells.set(key, this.colorIndex(hex));
  }

  /** The cell holding a world point. */
  private cellAt(x: number, y: number, z: number): Vec3 {
    const { size } = this;

    return [Math.round(x / size), Math.floor(y / size), Math.round(z / size)];
  }

  /** Cell range along X or Z whose centres fall inside lo..hi; never empty. */
  private span(lo: number, hi: number): [number, number] {
    const { size } = this;
    const from = Math.ceil(lo / size - 1e-6);
    const to = Math.ceil(hi / size - 1e-6) - 1;

    if (to < from) {
      const only = Math.round((lo + hi) / 2 / size);

      return [only, only];
    }

    return [from, to];
  }

  /** The same, along Y, where a cell sits on its base rather than its centre. */
  private rise(lo: number, hi: number): [number, number] {
    const { size } = this;
    const from = Math.ceil(lo / size - 0.5 - 1e-6);
    const to = Math.ceil(hi / size - 0.5 - 1e-6) - 1;

    if (to < from) {
      const only = Math.floor((lo + hi) / 2 / size);

      return [only, only];
    }

    return [from, to];
  }

  /** An axis-aligned block, at least one voxel thick however thin it is drawn. */
  box(center: Vec3, dims: Vec3, paint: Paint | null) {
    const [x0, x1] = this.span(center[0] - dims[0] / 2, center[0] + dims[0] / 2);
    const [y0, y1] = this.rise(center[1] - dims[1] / 2, center[1] + dims[1] / 2);
    const [z0, z1] = this.span(center[2] - dims[2] / 2, center[2] + dims[2] / 2);

    for (let ix = x0; ix <= x1; ix += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let iz = z0; iz <= z1; iz += 1) {
          this.put(ix, iy, iz, paint);
        }
      }
    }

    return this;
  }

  /**
   * A ball or an ellipsoid. `rough` roughens the surface by that fraction of
   * the radius, cell by cell, which is the difference between a canopy and a
   * green balloon. `half` keeps only the top (a dome) or the bottom (a bowl).
   */
  ball(
    center: Vec3,
    radius: number | Vec3,
    paint: Paint | null,
    options: { rough?: number; half?: "upper" | "lower" } = {},
  ) {
    const { size } = this;
    const half = size / 2;
    const [rx, ry, rz] = (typeof radius === "number" ? [radius, radius, radius] : radius).map(
      (value) => Math.max(value, half),
    );
    const rough = this.plain ? 0 : (options.rough ?? 0);
    const reach = 1 + rough;
    const [x0, x1] = this.span(center[0] - rx * reach, center[0] + rx * reach);
    const [y0, y1] = this.rise(center[1] - ry * reach, center[1] + ry * reach);
    const [z0, z1] = this.span(center[2] - rz * reach, center[2] + rz * reach);

    for (let ix = x0; ix <= x1; ix += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let iz = z0; iz <= z1; iz += 1) {
          const dx = (ix * size - center[0]) / rx;
          const dy = ((iy + 0.5) * size - center[1]) / ry;
          const dz = (iz * size - center[2]) / rz;

          // A dome, or a bowl: only the half asked for.
          if ((options.half === "upper" && dy < 0) || (options.half === "lower" && dy > 0)) {
            continue;
          }

          const limit =
            rough === 0 ? 1 : 1 + rough * (hash3(ix, iy, iz, this.seed + 7) * 2 - 1);

          if (dx * dx + dy * dy + dz * dz <= limit * limit) {
            this.put(ix, iy, iz, paint);
          }
        }
      }
    }

    // However small, it exists.
    if (paint !== null) {
      const [cx, cy, cz] = this.cellAt(center[0], center[1], center[2]);

      this.put(cx, cy, cz, paint);
    }

    return this;
  }

  /**
   * A tapered round limb from one point to another: stems, branches, legs. A
   * limb thinner than a voxel still leaves an unbroken one-voxel line.
   */
  limb(from: Vec3, to: Vec3, r0: number, r1: number, paint: Paint | null) {
    const { size } = this;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const lengthSq = dx * dx + dy * dy + dz * dz || 1e-9;
    const reach = Math.max(r0, r1, size / 2);
    const [x0, x1] = this.span(Math.min(from[0], to[0]) - reach, Math.max(from[0], to[0]) + reach);
    const [y0, y1] = this.rise(Math.min(from[1], to[1]) - reach, Math.max(from[1], to[1]) + reach);
    const [z0, z1] = this.span(Math.min(from[2], to[2]) - reach, Math.max(from[2], to[2]) + reach);

    for (let ix = x0; ix <= x1; ix += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let iz = z0; iz <= z1; iz += 1) {
          const px = ix * size - from[0];
          const py = (iy + 0.5) * size - from[1];
          const pz = iz * size - from[2];
          const t = Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / lengthSq));
          const ox = px - dx * t;
          const oy = py - dy * t;
          const oz = pz - dz * t;
          const r = r0 + (r1 - r0) * t;

          if (ox * ox + oy * oy + oz * oz <= r * r) {
            this.put(ix, iy, iz, paint);
          }
        }
      }
    }

    if (paint !== null) {
      const steps = Math.ceil(Math.sqrt(lengthSq) / (size * 0.5)) || 1;

      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const [cx, cy, cz] = this.cellAt(from[0] + dx * t, from[1] + dy * t, from[2] + dz * t);

        this.put(cx, cy, cz, paint);
      }
    }

    return this;
  }

  /**
   * An upright round column with flat ends, tapering from `r0` at the base to
   * `r1` at the top: trunks, caps, cones (r1 of zero), discs (a short one).
   */
  column(base: Vec3, height: number, r0: number, r1: number, paint: Paint | null) {
    const { size } = this;
    const [y0, y1] = this.rise(base[1], base[1] + height);
    const reach = Math.max(r0, r1, size / 2);
    const [x0, x1] = this.span(base[0] - reach, base[0] + reach);
    const [z0, z1] = this.span(base[2] - reach, base[2] + reach);
    const [cx, , cz] = this.cellAt(base[0], base[1], base[2]);

    for (let iy = y0; iy <= y1; iy += 1) {
      const t = height > 0 ? Math.min(1, Math.max(0, ((iy + 0.5) * size - base[1]) / height)) : 0;
      const r = r0 + (r1 - r0) * t;

      for (let ix = x0; ix <= x1; ix += 1) {
        for (let iz = z0; iz <= z1; iz += 1) {
          const dx = ix * size - base[0];
          const dz = iz * size - base[2];

          if (dx * dx + dz * dz <= r * r) {
            this.put(ix, iy, iz, paint);
          }
        }
      }

      if (paint !== null) {
        this.put(cx, iy, cz, paint);
      }
    }

    return this;
  }

  /**
   * A flat blade from its base to its tip: a petal or a leaf.
   *
   * `profile` is how wide it is along its length, 0 at the base to 1 at the tip,
   * as a fraction of `width`. The default swells in the middle and comes to a
   * point, which is most leaves. The blade lies flat across its own direction
   * and may climb or droop, since `from` and `to` need not share a height.
   */
  blade(
    from: Vec3,
    to: Vec3,
    width: number,
    paint: Paint | null,
    options: { thickness?: number; profile?: (t: number) => number } = {},
  ) {
    const { size } = this;
    const profile = options.profile ?? LANCE;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dy, dz) || 1e-9;
    const flat = Math.hypot(dx, dz);
    // Along the blade; across it, kept level; and through it. A blade lying
    // down is wide on the ground and thin upward, and one standing up (a
    // cattail leaf, a skunk cabbage) is wide sideways and thin front to back.
    const ax = dx / length;
    const ay = dy / length;
    const az = dz / length;
    const cx = flat > 1e-6 ? dz / flat : 1;
    const cz = flat > 1e-6 ? -dx / flat : 0;
    const nx = ay * cz;
    const ny = az * cx - ax * cz;
    const nz = -ay * cx;
    // A sloping sheet one voxel thick leaves holes; a little more closes them.
    const halfThick = (Math.max(options.thickness ?? 0, size) / 2) * (1 + 0.45 * Math.min(1, Math.abs(ay) * 2) * (1 - Math.abs(ay)) * 2);
    const reach = width / 2 + size;
    const [x0, x1] = this.span(Math.min(from[0], to[0]) - reach, Math.max(from[0], to[0]) + reach);
    const [y0, y1] = this.rise(
      Math.min(from[1], to[1]) - reach * Math.min(1, flat / length + 0.2),
      Math.max(from[1], to[1]) + reach * Math.min(1, flat / length + 0.2),
    );
    const [z0, z1] = this.span(Math.min(from[2], to[2]) - reach, Math.max(from[2], to[2]) + reach);

    for (let ix = x0; ix <= x1; ix += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let iz = z0; iz <= z1; iz += 1) {
          const px = ix * size - from[0];
          const py = (iy + 0.5) * size - from[1];
          const pz = iz * size - from[2];
          const t = (px * ax + py * ay + pz * az) / length;

          if (t < -0.02 || t > 1.02) {
            continue;
          }

          if (Math.abs(px * nx + py * ny + pz * nz) > halfThick) {
            continue;
          }

          const half = Math.max((width * profile(Math.min(1, Math.max(0, t)))) / 2, size * 0.5);

          if (Math.abs(px * cx + pz * cz) <= half) {
            this.put(ix, iy, iz, paint);
          }
        }
      }
    }

    return this;
  }

  /** Every axis-aligned box of an older model, dropped onto the grid. */
  boxes(boxes: Box[], recolor?: (color: string, box: Box) => Paint) {
    for (const box of boxes) {
      this.box(box.position, box.size, recolor ? recolor(box.color, box) : box.color);
    }

    return this;
  }

  /**
   * Compile to one mesh.
   *
   * Hidden faces are dropped, every visible corner is shaded by what crowds it
   * (the same rule the bee has always used), and flat runs of one colour and
   * one shade are merged into single quads. The merge is what makes fine voxels
   * affordable: a tree trunk is a few dozen quads, not a few thousand.
   */
  build(options: BuildOptions = {}): BufferGeometry {
    const ao = options.ao ?? true;
    const grounded = options.grounded ?? false;
    const { size } = this;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    if (this.cells.size > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;

      for (const key of this.cells.keys()) {
        const iz = (key % SPAN) - OFFSET;
        const iy = (Math.floor(key / SPAN) % SPAN) - OFFSET;
        const ix = Math.floor(key / (SPAN * SPAN)) - OFFSET;

        if (ix < minX) minX = ix;
        if (ix > maxX) maxX = ix;
        if (iy < minY) minY = iy;
        if (iy > maxY) maxY = iy;
        if (iz < minZ) minZ = iz;
        if (iz > maxZ) maxZ = iz;
      }

      // One empty cell of padding all round, so no neighbour test needs a bound.
      const min = [minX - 1, minY - 1, minZ - 1];
      const dims = [maxX - minX + 3, maxY - minY + 3, maxZ - minZ + 3];
      const dense = new Uint16Array(dims[0] * dims[1] * dims[2]);
      const at = (x: number, y: number, z: number) =>
        dense[(x * dims[1] + y) * dims[2] + z];

      for (const [key, color] of this.cells) {
        const iz = (key % SPAN) - OFFSET;
        const iy = (Math.floor(key / SPAN) % SPAN) - OFFSET;
        const ix = Math.floor(key / (SPAN * SPAN)) - OFFSET;

        dense[((ix - min[0]) * dims[1] + (iy - min[1])) * dims[2] + (iz - min[2])] = color;
      }

      /** A lattice corner in world units. X and Z cells are centred, Y cells sit. */
      const world = (axis: number, lattice: number) =>
        axis === 1 ? (lattice + min[1]) * size : (lattice + min[axis] - 0.5) * size;

      const cell = [0, 0, 0];
      const point = [0, 0, 0];
      const shades = [1, 1, 1, 1];
      const levels = [3, 3, 3, 3];

      const emit = (
        faceIndex: number,
        n: number,
        u0: number,
        u1: number,
        v0: number,
        v1: number,
        color: number,
      ) => {
        const face = FACES[faceIndex];
        const nAxis = face.normal[0] !== 0 ? 0 : face.normal[1] !== 0 ? 1 : 2;
        const uAxis = face.u[0] !== 0 ? 0 : face.u[1] !== 0 ? 1 : 2;
        const vAxis = 3 - nAxis - uAxis;
        const r = this.colors[(color - 1) * 3];
        const g = this.colors[(color - 1) * 3 + 1];
        const b = this.colors[(color - 1) * 3 + 2];
        const quad: number[][] = [];

        face.corners.forEach((corner, index) => {
          point[nAxis] = world(nAxis, n + corner[nAxis]);
          point[uAxis] = world(uAxis, corner[uAxis] === 1 ? u1 : u0);
          point[vAxis] = world(vAxis, corner[vAxis] === 1 ? v1 : v0);

          const s = shades[index];

          quad.push([point[0], point[1], point[2], r * s, g * s, b * s]);
        });

        // Split along the darker diagonal, or a shaded corner creases the wrong way.
        const flip = shades[0] + shades[2] < shades[1] + shades[3];
        const order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];

        for (const index of order) {
          const vertex = quad[index];

          positions.push(vertex[0], vertex[1], vertex[2]);
          normals.push(face.normal[0], face.normal[1], face.normal[2]);
          colors.push(vertex[3], vertex[4], vertex[5]);
        }
      };

      FACES.forEach((face, faceIndex) => {
        const nAxis = face.normal[0] !== 0 ? 0 : face.normal[1] !== 0 ? 1 : 2;
        const uAxis = face.u[0] !== 0 ? 0 : face.u[1] !== 0 ? 1 : 2;
        const vAxis = 3 - nAxis - uAxis;
        const step = face.normal[nAxis];
        const uCount = dims[uAxis];
        const vCount = dims[vAxis];
        // Colour and shade of each mergeable face in this slice; 0 is nothing.
        const mask = new Int32Array(uCount * vCount);

        for (let n = 1; n < dims[nAxis] - 1; n += 1) {
          mask.fill(0);

          let any = false;

          for (let u = 1; u < uCount - 1; u += 1) {
            for (let v = 1; v < vCount - 1; v += 1) {
              cell[nAxis] = n;
              cell[uAxis] = u;
              cell[vAxis] = v;

              const color = at(cell[0], cell[1], cell[2]);

              if (color === 0) {
                continue;
              }

              cell[nAxis] = n + step;

              // Buried against a neighbour: nobody will ever see it.
              if (at(cell[0], cell[1], cell[2]) !== 0) {
                continue;
              }

              // Or buried in the ground.
              if (grounded && nAxis === 1 && step === -1 && n === 1) {
                continue;
              }

              let uniform = true;

              if (ao) {
                face.corners.forEach((corner, index) => {
                  const du = corner[uAxis] === 1 ? 1 : -1;
                  const dv = corner[vAxis] === 1 ? 1 : -1;

                  cell[uAxis] = u + du;
                  cell[vAxis] = v;
                  const side1 = at(cell[0], cell[1], cell[2]) !== 0;

                  cell[uAxis] = u;
                  cell[vAxis] = v + dv;
                  const side2 = at(cell[0], cell[1], cell[2]) !== 0;

                  cell[uAxis] = u + du;
                  const diagonal = at(cell[0], cell[1], cell[2]) !== 0;

                  cell[uAxis] = u;
                  cell[vAxis] = v;

                  levels[index] =
                    side1 && side2 ? 0 : 3 - (Number(side1) + Number(side2) + Number(diagonal));
                  shades[index] = AO_LEVELS[levels[index]];
                });

                uniform =
                  levels[0] === levels[1] && levels[1] === levels[2] && levels[2] === levels[3];
              } else {
                levels[0] = 3;
                shades[0] = shades[1] = shades[2] = shades[3] = 1;
              }

              if (uniform) {
                // Colour and one shade level, packed. Merged below.
                mask[u * vCount + v] = color * 4 + levels[0];
                any = true;
              } else {
                emit(faceIndex, n, u, u + 1, v, v + 1, color);
              }
            }
          }

          if (!any) {
            continue;
          }

          for (let u = 1; u < uCount - 1; u += 1) {
            for (let v = 1; v < vCount - 1; v += 1) {
              const code = mask[u * vCount + v];

              if (code === 0) {
                continue;
              }

              let vEnd = v + 1;

              while (vEnd < vCount - 1 && mask[u * vCount + vEnd] === code) {
                vEnd += 1;
              }

              let uEnd = u + 1;

              grow: while (uEnd < uCount - 1) {
                for (let k = v; k < vEnd; k += 1) {
                  if (mask[uEnd * vCount + k] !== code) {
                    break grow;
                  }
                }

                uEnd += 1;
              }

              for (let i = u; i < uEnd; i += 1) {
                for (let k = v; k < vEnd; k += 1) {
                  mask[i * vCount + k] = 0;
                }
              }

              shades[0] = shades[1] = shades[2] = shades[3] = AO_LEVELS[code % 4];
              emit(faceIndex, n, u, uEnd, v, vEnd, Math.floor(code / 4));
            }
          }
        }
      });
    }

    const geometry = new BufferGeometry();

    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.computeBoundingSphere();

    // X and Z cells are centred on the origin and Y cells sit on it: see `world` above.
    return setLattice(geometry, { size: [size, size, size], offset: [0.5, 0, 0.5] });
  }
}

/** Swells in the middle, comes to a point: most leaves, most petals. */
export const LANCE = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.7;
/** Widest near the tip and blunt: a spoon, a daisy ray, a mayapple lobe. */
export const SPOON = (t: number) => Math.min(1, 0.25 + t * 1.6) * (t > 0.86 ? (1 - t) / 0.14 : 1) ** 0.5;
/** Widest at the base, tapering: a grass blade, a sepal. */
export const TAPER = (t: number) => 1 - t * 0.85;
/** Two lobes at the base and a point: a heart-shaped leaf. */
export const HEART = (t: number) => (t < 0.3 ? 0.55 + (t / 0.3) * 0.45 : (1 - t) / 0.7) ** 0.8;

const mottleCache = new Map<string, [string, string, string]>();

/**
 * One colour, broken up. Each cell lands a touch darker, true, or a touch
 * lighter, which is what stops a large flat face reading as plastic. Three
 * steps and no more, so neighbouring faces still merge often enough to matter.
 */
export function mottle(hex: string, amount = 0.07): PaintFn {
  const key = `${hex}:${amount}`;
  let steps = mottleCache.get(key);

  if (!steps) {
    steps = [shade(hex, amount), hex, tint(hex, amount)];
    mottleCache.set(key, steps);
  }

  const [dark, mid, light] = steps;

  return (_x, _y, _z, h) => (h < 0.22 ? dark : h > 0.8 ? light : mid);
}

/**
 * One colour, broken into blocks: each `span`-sized cube of space is a touch
 * darker, true, or a touch lighter, all the way through. On a wall it reads as
 * courses of stone or boards of timber, and because a whole block is one
 * colour its faces still merge, which per-voxel speckle on a hundred-unit
 * bridge would not allow.
 */
export function patches(hex: string, amount: number, span: number): PaintFn {
  const [dark, mid, light] = [shade(hex, amount), hex, tint(hex, amount)];

  return (x, y, z) => {
    // Offset alternate courses by half a block, the way a wall is laid.
    const row = Math.floor(y / span);
    const h = hash3(Math.floor((x + (row % 2) * span * 0.5) / (span * 2)), row, Math.floor(z / (span * 2)), 11);

    return h < 0.28 ? dark : h > 0.74 ? light : mid;
  };
}

/** How many triangles a compiled model has. */
export function triangleCount(geometry: BufferGeometry) {
  return (geometry.getAttribute("position")?.count ?? 0) / 3;
}
