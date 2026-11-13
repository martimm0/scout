"use client";

import { useEffect, useMemo, useState } from "react";
import type { BufferGeometry } from "three";

import type { Quality } from "../models/quality";

/**
 * The park arrives coarse and sharpens.
 *
 * Compiling a fine voxel model is real work: a few to a few hundred
 * milliseconds each, and there are a couple of hundred of them. Done all at
 * once on load it froze the page for seconds before the first frame, long
 * enough on a slower browser that the canvas was not there yet when a test
 * went looking for it.
 *
 * So everything is built at LOW first, which is quick, and the park is on
 * screen and flyable at once. Then the high versions are compiled one at a
 * time between frames and swapped in as each is ready. The player sees the
 * park come into focus over its first few seconds instead of staring at
 * nothing.
 */

const queue: (() => void)[] = [];
let pumping = false;
let outstanding = 0;

/** For the specs that count triangles: they must wait until the park is whole. */
function report() {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.scoutBuilding = String(outstanding);
  }
}

function pump() {
  const started = performance.now();

  // One model, usually. More if they are small: a frame's worth and no more.
  while (queue.length > 0 && performance.now() - started < 8) {
    try {
      (queue.shift() as () => void)();
    } catch (error) {
      // One model that will not build must not stop the rest: the pump is the
      // page's, not the model's, and a stalled queue would leave the park
      // coarse and everything that waits for it waiting for good.
      console.error("a model failed to build", error);
    }
  }

  if (queue.length > 0) {
    window.setTimeout(pump, 0);
  } else {
    pumping = false;
  }
}

function enqueue(task: () => void) {
  outstanding += 1;
  report();
  queue.push(() => {
    try {
      task();
    } finally {
      outstanding -= 1;
      report();
    }
  });

  if (!pumping) {
    pumping = true;
    window.setTimeout(pump, 0);
  }
}

/**
 * A set of geometries, keyed, at the quality asked for.
 *
 * `build` must be pure in its arguments and whatever `stamp` stands for: the
 * map is rebuilt from scratch whenever the keys, the quality or the stamp change.
 * Geometries are disposed when they are replaced and when the set goes away.
 */
export function useProgressive<K extends string>(
  keys: readonly K[],
  build: (key: K, quality: Quality) => BufferGeometry,
  quality: Quality,
  /** Everything `build` depends on besides the key and the quality, as text. */
  stamp: string,
): ReadonlyMap<K, BufferGeometry> {
  const signature = `${keys.join("|")}#${stamp}`;

  // Low, at once. On the low quality this is all there ever is.
  const coarse = useMemo(
    () => new Map(keys.map((key) => [key, build(key, "low")])),
    // The signature stands in for `keys` and `build`: both are fresh each
    // render, and the stamp is the caller's word for what `build` closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const [fine, setFine] = useState<{ of: typeof coarse; map: Map<K, BufferGeometry> } | null>(null);

  useEffect(() => {
    if (quality !== "high") {
      return;
    }

    let cancelled = false;
    const done = new Map<K, BufferGeometry>();
    let flush = 0;

    for (const key of coarse.keys()) {
      enqueue(() => {
        if (cancelled) {
          return;
        }

        done.set(key, build(key, "high"));

        // Swapped in a few at a time, not one render per model.
        if (!flush) {
          flush = window.setTimeout(() => {
            flush = 0;

            if (!cancelled) {
              setFine({ of: coarse, map: new Map(done) });
            }
          }, 90);
        }
      });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(flush);

      for (const geometry of done.values()) {
        geometry.dispose();
      }

      // And let go of them. Without this, switching to low and back handed
      // the disposed set to the scene again (the low set had not changed, so
      // it still looked current), and nothing ever disposed it a second time.
      setFine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coarse, quality]);

  useEffect(
    () => () => {
      for (const geometry of coarse.values()) {
        geometry.dispose();
      }
    },
    [coarse],
  );

  return useMemo(() => {
    if (quality !== "high" || !fine || fine.of !== coarse) {
      return coarse;
    }

    const merged = new Map(coarse);

    for (const [key, geometry] of fine.map) {
      merged.set(key, geometry);
    }

    return merged;
  }, [coarse, fine, quality]);
}
