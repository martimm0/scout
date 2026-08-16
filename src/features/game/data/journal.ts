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
    body: "The flower cannot walk to another flower. You cannot make sugar. So it pays you in nectar to carry its pollen, and you both get something you could not get alone. Nobody is in charge of this arrangement. It simply out-competed every arrangement where one side cheated.",
    hint: "Unlocked the first time you pollinate something.",
  },
  {
    id: "pollination-failure",
    title: "Pollination Failure",
    body: "Most flower visits come to nothing. Wind strips the pollen, the anthers haven't opened, another insect got there first, or the bee simply didn't touch the right part. A honeybee visits thousands of flowers a day precisely because so many of them don't take. Failure isn't the exception. It is the arithmetic the whole system is built on.",
    hint: "You'll learn this one the hard way.",
  },
  {
    id: "seed-set",
    title: "Setting Seed",
    body: "This is what the visit was for. Pollen you carried from another flower of the same species fertilises the ovules, and the flower stops being a flower and starts being a fruit full of seed. The plant spends the rest of the season on it. Almost none of those seeds become plants: they are eaten, they land on stone, they rot. A meadow persists because a plant makes thousands and needs one. In the park you are flying, seed you set comes up nearby and fills out over about a week, which is faster than any of this really happens. A seed set in August germinates the following spring at the earliest, and many species will not flower for a year or more after that. The park hurries it so you can see what you did.",
    hint: "Pollinate something, and it will do the rest.",
  },
  {
    id: "waggle-dance",
    title: "The Waggle Dance",
    body: "A honeybee that finds good forage goes home and dances it. She runs a figure of eight on the vertical comb, and the straight waggling part in the middle is the message: its angle away from straight up is the angle away from the sun you should fly, and how long she waggles is how far. Bees in total darkness read this off her body with their antennae and fly out to a flower they have never seen, sometimes miles away, and arrive. Karl von Frisch worked it out over decades and people flatly did not believe him. He shared a Nobel Prize for it in 1973.",
    hint: "Dance beside something worth coming back to.",
  },
  {
    id: "native-plants",
    title: "Native Plants",
    body: "A native plant and its pollinators have been in the same room for ten thousand years, and they have worked things out. A garden of natives feeds insects that a garden of ornamentals starves, not because the ornamentals are bad, but because nothing local has evolved to eat them.",
    hint: "Discover a handful of plants.",
  },
  {
    id: "bloom-windows",
    title: "Bloom Windows",
    body: "No plant flowers all year, so a pollinator's survival depends on the calendar lining up. Spring ephemerals bloom and vanish before the trees leaf out and steal the light. Goldenrod and aster hold the door open in October. A gap anywhere in that chain is a gap in the food supply, and a bee cannot wait it out.",
    hint: "Find plants that flower at different times of year.",
  },
  {
    id: "habitat-corridors",
    title: "Habitat Corridors",
    body: "A park is not an island if it's joined to another one. Nine Mile Run runs from Frick down to the Monongahela, and everything that flies, crawls or swims can use it as a road. Cut the corridor and the park becomes a jar: big enough to look healthy, too small to stay that way.",
    hint: "Follow the creek all the way through the valley.",
  },
  {
    id: "invasive-species",
    title: "Invasive Species",
    body: "Japanese knotweed, garlic mustard, Japanese honeysuckle. They arrived without the insects and diseases that kept them in check at home, and here they simply win. Frick Park's volunteers spend thousands of hours a year pulling them out, not to be tidy, but because a hillside of knotweed feeds almost nothing.",
    hint: "Not everything green in the park belongs here.",
  },
  {
    id: "fungi",
    title: "Fungi",
    body: "A mushroom is not a plant. It has no leaves, no flowers, and it cannot make its own food, so it eats. Genetically it is closer to you than it is to a tree. The part you see is only the fruit: the actual organism is a web of threads through the wood or the soil, sometimes running for acres, and one colony in Oregon is the largest living thing on earth. Nothing pollinates a mushroom. It has no interest in you at all.",
    hint: "Find something in the wood that is not a flower.",
  },
  {
    id: "day-and-night",
    title: "Day and Night",
    body: "The park is not one place. Trout lily and trillium open with the sun and close by mid-afternoon, because holding a flower open costs energy and there is no point paying for it when the pollinators have gone. After dark the meadow is shut and nothing is flowering anywhere, and that is precisely when the fungi are out. If you only ever visit at noon you will see maybe half of what is here.",
    hint: "Come back at another hour and see what changed.",
  },
  {
    id: "seasonal-cycles",
    title: "Seasonal Cycles",
    body: "A bumblebee colony lives one summer. Only the new queens survive the winter, alone, underground, and each one starts a colony from nothing in the spring. Everything you see flying in August will be dead by November except a few queens asleep in the leaf litter, which is one very good reason not to rake the woods clean.",
    hint: "Keep exploring, and keep pollinating.",
  },
];

export const CONCEPTS_EXTRA: ConceptEntry[] = [];

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
    hint: "Become one, and you'll learn what it is.",
  },
  {
    id: "moth",
    title: "Moth",
    body: "Not a drab butterfly. They are two branches of one order and the moths are overwhelmingly the bigger branch, something like nine species to every one. The differences are structural: a butterfly's antenna ends in a club, a moth's is a comb, and on a male hawk moth it is a feathered fan that can find a female by scent from a kilometre off. The thick fur is insulation, and it is why a moth can work a flower on a night far too cold for any bee: it shivers its flight muscles until its thorax is thirty degrees above the air, then takes off.",
    hint: "Become one, and you'll learn what it is.",
  },
  {
    id: "hoverfly",
    title: "Hoverfly",
    body: "A fly wearing a bee's warning colours, and it works, because nothing wants to eat a bee. Two wings instead of four: the hind pair shrank into halteres, tiny gyroscopes that let it hang dead still in the air, which no bee can do. It cannot sting you with anything. Its larvae eat aphids by the hundred.",
    hint: "Become one, and you'll learn what it is.",
  },
  {
    id: "butterfly",
    title: "Butterfly",
    body: "Long legs, long tongue, and a habit of standing well clear of the flower, which makes it a worse pollinator than a bee and a far better sight. It drinks through a coiled straw and tastes with its feet. A monarch will cross a continent on nectar from meadows like this one.",
    hint: "Become one, and you'll learn what it is.",
  },
];
