import type { Accessory } from "../models/species";
import { BADGES_BY_ID } from "./badges";

/**
 * What you can wear, and what you had to do to get it.
 *
 * Four accessories are free, because a new player has to be able to make their
 * bee theirs on the first screen and before they have earned anything. The rest
 * are hung off badges, and every one of them is tied to the badge it belongs to
 * rather than handed out in an arbitrary order: you get the foxfire lantern for
 * finding the thing that glows, the goggles for flying in every kind of weather,
 * the crown for having seen all three parks.
 *
 * Locked ones are SHOWN on the customize page, greyed, with the badge named. A
 * reward you cannot see is not a reward, and a player who does not know the
 * lantern exists has no reason to go looking for the bitter oyster.
 */
export type AccessoryInfo = {
  id: Accessory;
  label: string;
  /** One line, in the game's voice. */
  note: string;
  /** The badge that earns it. Undefined means anybody can wear it. */
  badge?: string;
};

export const ACCESSORY_INFO: AccessoryInfo[] = [
  { id: "none", label: "None", note: "Just the bee." },
  { id: "cap", label: "Cap", note: "A small hat for a small insect." },
  {
    id: "flower",
    label: "Flower",
    note: "Worn behind the antennae. Slightly on the nose.",
  },
  { id: "scarf", label: "Scarf", note: "For the wind at altitude." },

  {
    id: "antennaeBow",
    label: "Antennae Bow",
    note: "No practical purpose whatsoever.",
    badge: "first-bloom",
  },
  {
    id: "backpack",
    label: "Field Satchel",
    note: "Waxed canvas. For a bee who takes notes.",
    badge: "well-read",
  },
  {
    id: "goggles",
    label: "Flying Goggles",
    note: "You have been out in every hour there is. These are for the dark ones.",
    badge: "all-hours",
  },
  {
    id: "raincoat",
    label: "Sou'wester",
    note: "Pittsburgh weather is real weather. You kept flying anyway.",
    badge: "persistent",
  },
  {
    id: "lantern",
    label: "Foxfire Lantern",
    note: "A piece of the glowing wood, in a jar. Nobody who has not seen it has one.",
    badge: "foxfire",
  },
  {
    id: "crown",
    label: "Bronze Crown",
    note: "The same bronze as the panthers on the bridge. You have seen the whole city.",
    badge: "both-parks",
  },
];

export const ACCESSORY_BY_ID = new Map(
  ACCESSORY_INFO.map((entry) => [entry.id, entry]),
);

/** Can this player wear this? Anything without a badge is always wearable. */
export function accessoryUnlocked(
  unlockedBadges: Record<string, boolean>,
  accessory: Accessory,
): boolean {
  const info = ACCESSORY_BY_ID.get(accessory);

  if (!info?.badge) {
    return true;
  }

  return Boolean(unlockedBadges[info.badge]);
}

/** "Earned with Foxfire". What the lock says on the customize page. */
export function accessoryRequirement(accessory: Accessory): string | null {
  const info = ACCESSORY_BY_ID.get(accessory);

  if (!info?.badge) {
    return null;
  }

  return BADGES_BY_ID.get(info.badge)?.name ?? null;
}
