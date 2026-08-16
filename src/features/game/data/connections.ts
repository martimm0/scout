/**
 * What the species have to do with each other.
 *
 * The journal records things one at a time: this plant, that mushroom, a photo
 * of each. But almost nothing in a park is interesting on its own, and the
 * actual subject of the game is the arrangements between organisms. A milkweed
 * is a flower; a milkweed and its pollinia and the leg they clip onto is a
 * story.
 *
 * A connection opens when you have found EVERY species in it, which makes it a
 * reward for looking rather than a page of text handed over at the start. It is
 * also the cheapest content in the game by a distance: no model, no photograph,
 * no minigame. Just the thing that was already true about two plants you had
 * both walked past.
 *
 * **Every one of these is sourced, and the ones that are not are not here.**
 * Rule 1 does not get a holiday because a link would be a nice line. The
 * temptation is real: it would be easy to generate these from what the records
 * already share (same area, same bloom window, same archetype) and produce
 * hundreds. "These two grow in the same field" is a coincidence, not an
 * ecological fact, and a game that dressed one up as the other would be exactly
 * the prettier lie the brief refuses.
 */

import { FUNGI_BY_ID } from "./fungi";
import { PLANTS_BY_ID } from "./plants";

export type Connection = {
  id: string;
  title: string;
  /**
   * The species this is about, by id. Plants and fungi in one list, because
   * several of the best ones cross between them.
   */
  between: string[];
  body: string;
  /** Verified: every one of these returns 200. */
  source: string;
};

export const CONNECTIONS: Connection[] = [
  {
    id: "pollinia",
    title: "Pollen in a suitcase",
    between: ["common-milkweed", "swamp-milkweed"],
    body: "Most flowers dust you with loose grains and hope. Milkweeds do not. Their pollen is packed into two waxy sacs joined by a clip, and the flower is built so that an insect's foot slips into a slot and comes out wearing the whole apparatus. It is close to a machine. It also means a milkweed is pollinated or it is not, with nothing in between, and that a bee too small to pull free simply dies in the slot. Orchids are the only other family that commits to this.",
    source: "https://en.wikipedia.org/wiki/Pollinium",
  },
  {
    id: "lobelia-split",
    title: "Two sisters, two customers",
    between: ["cardinal-flower", "great-blue-lobelia"],
    body: "These two are the same genus growing in the same wet ground, and they have divided the work. The cardinal flower is scarlet, unscented, and shaped as a long tube: that is a hummingbird's flower, and bees can barely use it. The great blue lobelia is blue, landable, and built for a bumblebee. Neither is better. They are two answers to the same question, standing next to each other, and the colours are addressed to different eyes.",
    source: "https://en.wikipedia.org/wiki/Ornithophily",
  },
  {
    id: "red-and-tubular",
    title: "Red, tubular, and no smell at all",
    between: ["cardinal-flower", "wild-columbine", "jewelweed"],
    body: "Once you have seen it you cannot stop seeing it. Red or orange, a long spur or tube, nectar right at the bottom, held nodding or sideways, and no scent worth mentioning. Birds see red well and smell almost nothing; most insects are the other way round. These three are not related to each other, and they have arrived at the same design because they are all addressed to a ruby-throated hummingbird.",
    source: "https://en.wikipedia.org/wiki/Ornithophily",
  },
  {
    id: "ant-sown",
    title: "Seeds with a bribe attached",
    between: ["bloodroot", "white-trillium", "dutchmans-breeches"],
    body: "Each of these seeds carries a pale oily lump called an elaiosome. Ants carry the seed home for it, eat the lump, and throw the seed out onto the nest midden: underground, fertilised, and away from the parent. It is a courier service paid in fat. It is also slow, which is why a trillium patch spreads by a few feet in a lifetime, and why a wood that has been cleared does not get them back quickly.",
    source: "https://en.wikipedia.org/wiki/Myrmecochory",
  },
  {
    id: "carrion-mimics",
    title: "Two kingdoms, one bad smell",
    between: ["skunk-cabbage", "ravenels-stinkhorn"],
    body: "A flowering plant and a fungus, no more related to each other than you are to either, and both have arrived at the same trick: smell like something dead and let the flies do the rest. The skunk cabbage goes further and makes its own heat, holding itself well above freezing for days and melting its way up through snow, which carries the smell further and gives an early insect somewhere warm to sit. Convergence is not a coincidence. It means the trick works.",
    source: "https://en.wikipedia.org/wiki/Thermogenic_plant",
  },
  {
    id: "slice-it-first",
    title: "The one that matters",
    between: ["eastern-destroying-angel", "giant-puffball"],
    body: "A young destroying angel is a white egg in the leaf litter, and a small puffball is a white ball in the leaf litter. One is a good meal and the other holds enough amatoxin to destroy a liver, with no antidote and no symptoms for the first half day, by which point it is often too late. The test is to cut it in half from top to bottom: a real puffball is solid white all the way through, and an Amanita button shows the outline of a mushroom folded up inside it, cap, gills and stem.",
    source: "https://en.wikipedia.org/wiki/Amanita_bisporigera",
  },
  {
    id: "false-gills",
    title: "Gills, and things that look like gills",
    between: ["jack-o-lantern", "smooth-chanterelle"],
    body: "Orange, on wood or near it, in the same weeks: this is the confusion that puts people in hospital every autumn. The difference is underneath. A chanterelle has blunt forking ridges that run down into the stem and cannot be cleanly peeled off, more like a wrinkle in the flesh than a structure. A jack-o'-lantern has true gills, thin and crowded and bladelike. The jack-o'-lantern also grows in dense clumps from one base, where chanterelles come up singly out of soil.",
    source: "https://en.wikipedia.org/wiki/Omphalotus_illudens",
  },
  {
    id: "foxfire",
    title: "The wood that glows",
    between: ["jack-o-lantern", "bitter-oyster"],
    body: "Both of these give off a faint green light in the dark, from the same chemistry every glowing fungus uses: luciferin, oxygen, and an enzyme. It is not bright. You need a properly dark night and twenty minutes for your eyes to adjust, and then a rotting log has a green edge to it. This is the foxfire that soldiers reported on damp wood and that people have been arguing about since Aristotle. Nobody is certain what it is for. The leading guess is that it brings in insects to carry spores.",
    source: "https://en.wikipedia.org/wiki/List_of_bioluminescent_fungi",
  },
  {
    id: "swallowtail-hosts",
    title: "The only thing their caterpillars will eat",
    between: ["pawpaw", "spicebush"],
    body: "An adult butterfly will take nectar from almost anything. Its caterpillars are usually far pickier, and these two shrubs are each the entire diet of a particular one. Zebra swallowtail caterpillars eat pawpaw leaves and nothing else, anywhere in the world; spicebush swallowtails want spicebush and its close relatives, and their caterpillars roll themselves into a leaf and wear two enormous false eyespots. Cut down the shrub and the butterfly goes with it, whatever else is flowering.",
    source: "https://en.wikipedia.org/wiki/Protographium_marcellus",
  },
  {
    id: "beat-the-canopy",
    title: "Everything before the leaves",
    between: ["trout-lily", "cutleaf-toothwort", "virginia-bluebell"],
    body: "For about six weeks in spring the floor of a deciduous wood is the sunniest place in it, because the trees overhead have not leafed out yet. These three do their entire year in that window: up, flowering, pollinated, seed set, and gone back underground before the canopy closes. By July there is no sign any of them were ever there. It is why a spring wood and a summer wood seem to be two different places, and why an April walk is not optional.",
    source: "https://en.wikipedia.org/wiki/Spring_ephemeral",
  },
  {
    id: "the-autumn-door",
    title: "Who keeps the door open in October",
    between: [
      "canada-goldenrod",
      "new-england-aster",
      "boneset",
      "joe-pye-weed",
    ],
    body: "A pollinator's year is a chain of overlapping bloom windows, and a gap anywhere in it is a gap in the food supply that nothing can wait out. These four hold the last link. They flower when almost nothing else does, feeding the bumblebee queens that have to reach hibernation fat enough to survive, and the monarchs crossing the state on their way to Mexico. A tidy autumn garden with nothing in flower is a beautiful place with no food in it.",
    source: "https://en.wikipedia.org/wiki/Bumblebee",
  },
  {
    id: "shivering-moths",
    title: "A flower that opens in November",
    between: ["witch-hazel"],
    body: "Witch hazel flowers after its own leaves have fallen, in October and November and sometimes into December, which looks like a mistake. It is not. There is a guild of owlet moths active in the cold that shiver their flight muscles to warm their bodies thirty degrees above the air around them, and they have this flower almost to themselves. Blooming when nothing else does means every one of those moths is carrying witch hazel pollen and nothing else.",
    source: "https://en.wikipedia.org/wiki/Hamamelis_virginiana",
  },
  {
    id: "white-rot",
    title: "The only things that can eat a tree",
    between: ["turkey-tail", "artists-conk", "dryads-saddle"],
    body: "Wood is cellulose held in lignin, and lignin is deliberately hard to digest. Almost nothing can break it: not you, not a cow, not a termite without help. These fungi can, and that is why a fallen oak eventually becomes soil instead of piling up forever. Before white rot fungi evolved, dead trees genuinely did pile up, and a great deal of the world's coal is the backlog.",
    source: "https://en.wikipedia.org/wiki/Trametes_versicolor",
  },
];

/**
 * Whether a connection needs a species you can only meet in company.
 *
 * DERIVED, never hand-set. A flag typed in beside the entry would be one more
 * thing to forget when a species changes, and it would go stale silently: the
 * journal would promise a solo player something they could never open, which is
 * the failure mode party content is otherwise carefully kept away from.
 *
 * Two of these do need a party, and that is allowed. What is not allowed is not
 * saying so.
 */
export function needsParty(connection: Connection): boolean {
  return connection.between.some(
    (id) => PLANTS_BY_ID.get(id)?.partyOnly ?? FUNGI_BY_ID.get(id)?.partyOnly,
  );
}

export const CONNECTIONS_BY_ID = new Map(
  CONNECTIONS.map((connection) => [connection.id, connection]),
);

/**
 * Whether every species in a connection has been found.
 *
 * Takes both records because several connections cross between a plant and a
 * fungus, and the save keeps those apart.
 */
export function connectionOpen(
  connection: Connection,
  found: { plants: Record<string, boolean>; fungi: Record<string, boolean> },
): boolean {
  return connection.between.every(
    (id) => found.plants[id] || found.fungi[id],
  );
}

/** How many are open, for the journal's counter. */
export function openConnections(found: {
  plants: Record<string, boolean>;
  fungi: Record<string, boolean>;
}): Connection[] {
  return CONNECTIONS.filter((connection) => connectionOpen(connection, found));
}
