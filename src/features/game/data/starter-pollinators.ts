import type { Pollinator } from "@/features/game/state/game-store";

export type StarterPollinator = Pollinator & {
  description: string;
  flightNote: string;
  accentColor: string;
};

export const STARTER_POLLINATORS: StarterPollinator[] = [
  {
    type: "bee",
    name: "Scout",
    bodyColor: "#f2bb42",
    wingColor: "#dcefff",
    wingStyle: "round",
    trailEffect: "pollen",
    trailColor: "#f6d15a",
    accentColor: "#332616",
    accessory: "none",
    raincoatColor: "#f7e07a",
    description: "A steady native bee with strong hover control and a warm pollen trail.",
    flightNote: "Balanced flight, clear stripes, quick wingbeat.",
  },
  {
    type: "hoverfly",
    name: "Zip",
    bodyColor: "#f5c84f",
    wingColor: "#eef9ff",
    wingStyle: "swept",
    trailEffect: "sparkle",
    trailColor: "#dbe6ef",
    accentColor: "#151916",
    accessory: "none",
    raincoatColor: "#f7e07a",
    description: "A nimble hoverfly built for tight turns around flowers and creek edges.",
    flightNote: "Fast hover, slim body, glassy swept wings.",
  },
  {
    type: "butterfly",
    name: "Marigold",
    bodyColor: "#3a2a20",
    wingColor: "#e9783e",
    wingStyle: "broad",
    trailEffect: "sparkle",
    trailColor: "#f2a9c4",
    accentColor: "#f4c34f",
    accessory: "none",
    raincoatColor: "#f7e07a",
    description: "A bright butterfly with broad wings and a graceful meadow glide.",
    flightNote: "Gentle glide, large wings, visible color from far away.",
  },
  {
    type: "moth",
    name: "Vesper",
    // Dusty pale browns. A moth advertising to a bird that cannot see it would
    // be paying for nothing, so it is camouflage rather than warning colours.
    bodyColor: "#c8b183",
    wingColor: "#b7ac97",
    wingStyle: "broad",
    trailEffect: "sparkle",
    trailColor: "#e8dcc0",
    accentColor: "#4a4038",
    accessory: "none",
    raincoatColor: "#f7e07a",
    description:
      "A furred hawk moth for the night shift, when the primrose and the jimsonweed are open and nothing else is.",
    flightNote: "The fastest thing here, and the only one awake after dark.",
  },
];

