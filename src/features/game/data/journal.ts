/**
 * The journal: the player's pollinator record.
 *
 * Tone is casual-adult and slightly Pokédex-like. Locked entries are written to
 * be intriguing without giving the thing away — a locked entry that just says
 * "???" teaches nothing and tempts nobody.
 *
 * Entry ids are namespaced, and the store already emits them:
 *   plant:<id>      on discovery
 *   area:<id>       on entering an area
 *   concept:<id>    on the event that teaches it
 *   pollinator:<id> on flying one
 */

export type ConceptEntry = {
  id: string;
  title: string;
  body: string;
  /** Shown while locked. */
  hint: string;
};

export const CONCEPTS: ConceptEntry[] = [
  {
    id: "mutualism",
    title: "Mutualism",
    body: "The flower cannot walk to another flower. You cannot make sugar. So it pays you in nectar to carry its pollen, and you both get something you could not get alone. Nobody is in charge of this arrangement — it simply out-competed every arrangement where one side cheated.",
    hint: "Unlocked the first time you pollinate something.",
  },
  {
    id: "pollination-failure",
    title: "Pollination Failure",
    body: "Most flower visits come to nothing. Wind strips the pollen, the anthers haven't opened, another insect got there first, or the bee simply didn't touch the right part. A honeybee visits thousands of flowers a day precisely because so many of them don't take. Failure isn't the exception — it's the arithmetic the whole system is built on.",
    hint: "You'll learn this one the hard way.",
  },
  {
    id: "native-plants",
    title: "Native Plants",
    body: "A native plant and its pollinators have been in the same room for ten thousand years, and they have worked things out. A garden of natives feeds insects that a garden of ornamentals starves — not because the ornamentals are bad, but because nothing local has evolved to eat them.",
    hint: "Discover a handful of plants.",
  },
  {
    id: "bloom-windows",
    title: "Bloom Windows",
    body: "No plant flowers all year, so a pollinator's survival depends on the calendar lining up. Spring ephemerals bloom and vanish before the trees leaf out and steal the light. Goldenrod and aster hold the door open in October. A gap anywhere in that chain is a gap in the food supply — and a bee cannot wait it out.",
    hint: "Find plants that flower at different times of year.",
  },
  {
    id: "habitat-corridors",
    title: "Habitat Corridors",
    body: "A park is not an island if it's joined to another one. Nine Mile Run runs from Frick down to the Monongahela, and everything that flies, crawls or swims can use it as a road. Cut the corridor and the park becomes a jar — big enough to look healthy, too small to stay that way.",
    hint: "Follow the creek all the way through the valley.",
  },
  {
    id: "invasive-species",
    title: "Invasive Species",
    body: "Japanese knotweed, garlic mustard, Japanese honeysuckle. They arrived without the insects and diseases that kept them in check at home, and here they simply win. Frick Park's volunteers spend thousands of hours a year pulling them out — not to be tidy, but because a hillside of knotweed feeds almost nothing.",
    hint: "Not everything green in the park belongs here.",
  },
  {
    id: "seasonal-cycles",
    title: "Seasonal Cycles",
    body: "A bumblebee colony lives one summer. Only the new queens survive the winter, alone, underground, and each one starts a colony from nothing in the spring. Everything you see flying in August will be dead by November except a few queens asleep in the leaf litter — which is one very good reason not to rake the woods clean.",
    hint: "Keep exploring, and keep pollinating.",
  },
];

export const CONCEPTS_BY_ID = new Map(
  CONCEPTS.map((concept) => [concept.id, concept]),
);

export type PollinatorEntry = {
  id: string;
  title: string;
  body: string;
  hint: string;
};

export const POLLINATOR_ENTRIES: PollinatorEntry[] = [
  {
    id: "bee",
    title: "Bee",
    body: "Fuzzy, deliberate, and built for the job: branched hairs that pollen sticks to, baskets on the hind legs to carry it home, and enough colour vision to see ultraviolet patterns on petals that are invisible to us. Most of the four thousand bee species in North America are solitary and sting almost nobody.",
    hint: "You are one.",
  },
  {
    id: "hoverfly",
    title: "Hoverfly",
    body: "A fly wearing a bee's warning colours, and a very good pollinator in its own right. It can hang dead still in the air, which no bee can do. Its larvae eat aphids by the hundred.",
    hint: "Not yet. Coming to the park soon.",
  },
  {
    id: "butterfly",
    title: "Butterfly",
    body: "Long legs, long tongue, and a habit of standing well clear of the flower — which makes it a less thorough pollinator than a bee but a far prettier one. Monarchs will cross a continent on the nectar in this park.",
    hint: "Not yet. Coming to the park soon.",
  },
];
