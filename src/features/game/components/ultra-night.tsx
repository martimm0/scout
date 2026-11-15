"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import type { Object3D, PointLight } from "three";

import { air } from "../world/air";
import { plantDrop } from "../world/perch";
import { sparks } from "../world/sparks";
import { isOut, landingHeight, type SpeciesInstance } from "../world/species-scatter";

/**
 * What glows, lights. Ultra only.
 *
 * On Low and High a jack-o'-lantern mushroom is a brighter green than the
 * mushroom beside it, and a firefly is a bright dot. Neither lights anything.
 * Here the nearest of each are real lamps: the grass round a firefly is lit
 * from above as it drifts, and a glowing fungus puts a green pool on the log
 * it grows from, which is how you find one in the dark.
 *
 * Four lamps, and always four while it is dark. The count of lights is
 * compiled into every material, so a lamp added or taken away rebuilds every
 * shader in the park; the four are therefore mounted together at dusk and
 * unmounted together at dawn, and never one at a time. (They were once left
 * in the scene all day, switched off. A lamp at zero still costs what a lit
 * one does, in every pixel of every surface: four of them were 2.4 ms of a
 * 15 ms frame, at noon.) Two go to the nearest glowing fungi and two to the
 * nearest fireflies, re-chosen a few times a second and eased into place so a
 * lamp handed from one firefly to another does not jump.
 */
const FUNGUS_LAMPS = 2;
const FIREFLY_LAMPS = 2;
const REACH = 90;

export function UltraNight({
  focus,
  hour,
  instances,
  month,
}: {
  /** The bee: lamps go to what is nearest it. */
  focus: RefObject<Object3D | null>;
  hour: number;
  instances: SpeciesInstance[];
  month: number;
}) {
  const lamps = useRef<(PointLight | null)[]>([]);
  const chosen = useRef({ since: 1, fungi: [] as SpeciesInstance[] });
  /** Every fungus that makes its own light and is up at this hour. */
  const glowing = useMemo(
    () =>
      instances.filter(
        (instance) =>
          instance.species.kind === "fungus" && instance.species.fungus.glows && isOut(instance, hour, month),
      ),
    [hour, instances, month],
  );

  useFrame((_state, delta) => {
    const bee = focus.current;
    const dark = air.night.value;

    if (!bee || dark <= 0) {
      for (const lamp of lamps.current) {
        if (lamp) lamp.intensity = 0;
      }

      return;
    }

    const pick = chosen.current;

    pick.since += delta;

    // The fungi do not move, so which are nearest changes only as the bee does.
    if (pick.since > 0.4) {
      pick.since = 0;
      pick.fungi = glowing
        .map((instance) => ({
          instance,
          away: Math.hypot(instance.position[0] - bee.position.x, instance.position[2] - bee.position.z),
        }))
        .filter((entry) => entry.away < REACH)
        .sort((a, b) => a.away - b.away)
        .slice(0, FUNGUS_LAMPS)
        .map((entry) => entry.instance);
    }

    const ease = 1 - Math.exp(-delta * 6);

    for (let index = 0; index < FUNGUS_LAMPS; index += 1) {
      const lamp = lamps.current[index];
      const fungus = pick.fungi[index];

      if (!lamp) continue;

      if (fungus) {
        // Just over the cap, where the light is coming from.
        lamp.position.set(
          fungus.position[0],
          landingHeight(fungus) + plantDrop(fungus, "ultra") + 0.6,
          fungus.position[2],
        );
        lamp.intensity += (26 * dark - lamp.intensity) * ease;
      } else {
        lamp.intensity += (0 - lamp.intensity) * ease;
      }
    }

    // The two fireflies nearest the bee, found fresh each frame: they move.
    let first = -1;
    let second = -1;
    let firstAway = Infinity;
    let secondAway = Infinity;

    for (let index = 0; index < sparks.count; index += 1) {
      const away =
        (sparks.at[index * 3] - bee.position.x) ** 2 +
        (sparks.at[index * 3 + 1] - bee.position.y) ** 2 +
        (sparks.at[index * 3 + 2] - bee.position.z) ** 2;

      if (away < firstAway) {
        second = first;
        secondAway = firstAway;
        first = index;
        firstAway = away;
      } else if (away < secondAway) {
        second = index;
        secondAway = away;
      }
    }

    for (let slot = 0; slot < FIREFLY_LAMPS; slot += 1) {
      const lamp = lamps.current[FUNGUS_LAMPS + slot];
      const spark = slot === 0 ? first : second;

      if (!lamp) continue;

      if (spark >= 0 && (slot === 0 ? firstAway : secondAway) < REACH * REACH) {
        const x = sparks.at[spark * 3];
        const y = sparks.at[spark * 3 + 1];
        const z = sparks.at[spark * 3 + 2];

        // Eased, so a lamp passed to another firefly glides rather than jumps.
        if (lamp.intensity < 0.05) {
          lamp.position.set(x, y, z);
        } else {
          lamp.position.x += (x - lamp.position.x) * ease;
          lamp.position.y += (y - lamp.position.y) * ease;
          lamp.position.z += (z - lamp.position.z) * ease;
        }

        lamp.intensity += (9 * dark - lamp.intensity) * ease;
      } else {
        lamp.intensity += (0 - lamp.intensity) * ease;
      }
    }
  });

  return (
    <>
      {Array.from({ length: FUNGUS_LAMPS + FIREFLY_LAMPS }, (_, index) => (
        <pointLight
          // Green for a fungus, the yellow-green of a firefly for the rest.
          color={index < FUNGUS_LAMPS ? "#7dd88a" : "#d9f27a"}
          decay={2}
          distance={index < FUNGUS_LAMPS ? 22 : 13}
          intensity={0}
          key={index}
          ref={(lamp) => {
            lamps.current[index] = lamp;
          }}
          userData={{ nightLamp: index < FUNGUS_LAMPS ? "fungus" : "firefly" }}
        />
      ))}
    </>
  );
}
