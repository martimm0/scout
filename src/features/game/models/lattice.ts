import type { BufferGeometry } from "three";

/**
 * Where a model's blocks are.
 *
 * A voxel model is compiled down to merged faces, and once that is done
 * nothing in the mesh says where one block ended and the next began. The Ultra
 * materials need to know (they bevel the edge of every block, in the shader),
 * so each builder records its lattice on the geometry it returns: a point at
 * `position` is at `position / size + offset` in cells, and block faces lie on
 * the whole numbers.
 */
export type Lattice = { size: [number, number, number]; offset: [number, number, number] };

const UNIT: Lattice = { size: [1, 1, 1], offset: [0, 0, 0] };

export function setLattice(geometry: BufferGeometry, lattice: Lattice) {
  geometry.userData.lattice = lattice;

  return geometry;
}

export function latticeOf(geometry: BufferGeometry | undefined): Lattice {
  return (geometry?.userData.lattice as Lattice | undefined) ?? UNIT;
}

/** The same lattice after the geometry has been scaled evenly. */
export function scaleLattice(geometry: BufferGeometry, factor: number) {
  const { size, offset } = latticeOf(geometry);

  return setLattice(geometry, {
    size: [size[0] * factor, size[1] * factor, size[2] * factor],
    offset,
  });
}
