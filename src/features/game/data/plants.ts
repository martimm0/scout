import type { TimeWindow } from "../world/daylight";
import type { AreaId, ParkId } from "../world/terrain";

/**
 * When a flower is open.
 *
 * This is not a game mechanic bolted on: it is what flowers do. Trout lily and
 * trillium close their petals in the afternoon and at night and open again with
 * the sun. Meadow flowers stay open through the day and shut at dusk.
 *
 * The consequence is that after dark there is nothing to pollinate anywhere in
 * the park, and the only things out are the fungi. That is exactly right, and it
 * gives the night its own reason to exist.
 */
const EPHEMERAL: TimeWindow = {
  from: 6,
  to: 14,
  note: "Opens with the sun and closes by mid-afternoon. Come in the morning.",
};

const DAYLIGHT: TimeWindow = {
  from: 7,
  to: 19,
  note: "Open through the day. Shut after dark.",
};

/**
 * The other shift.
 *
 * Wraps past midnight, which `isActive` handles and which nothing in the game
 * needed until now: these open as the light goes and are finished by the time
 * anybody sensible is awake. A park with a night flora is a different park
 * after dark rather than the same park with the lights off.
 */
const NIGHT: TimeWindow = {
  from: 19,
  to: 6,
  note: "Opens at dusk and is over by morning.",
};

/**
 * Sixteen plants that actually grow in Frick Park, sorted into the habitats
 * where you'd actually find them: spring ephemerals on the woodland floor,
 * moisture-lovers down along Nine Mile Run, sun-lovers out in the meadow, and a
 * planted native garden by the environmental center.
 *
 * The facts are the point. Each one should be the kind of thing a player repeats
 * to somebody later.
 */

export type PlantArchetype = "daisy" | "spike" | "umbel" | "low" | "shrub" | "tree";


/**
 * Where a species lives.
 *
 * A list, not a single area, because a species can genuinely grow in both parks:
 * goldenrod is goldenrod, and it is in the rough at Frick and on Flagstaff Hill
 * at Schenley. It is the SAME organism, so finding it in one park means you have
 * found it, and the journal keeps one entry for it with both homes listed.
 */
export type Home = { park: ParkId; area: AreaId };

export type Plant = {
  id: string;
  commonName: string;
  scientificName: string;
  homes: Home[];
  bloom: string;
  /** The hours of the day this flower is actually open. */
  window: TimeWindow;
  /** One short line for the card that hovers over the plant in the world. */
  hook: string;
  /** The full story. One or two sentences, no lecture. */
  fact: string;
  /** Why a pollinator cares. */
  pollinatorNote: string;
  /** Verified: every one of these returns 200. A dead "learn more" is worse
   *  than none, so these are written out rather than guessed from the name. */
  wikipedia: string;
  /**
   * A flower you cannot work until you understand it.
   *
   * These are the difficult ones, and the gate is not arbitrary: every plant with
   * this set has a real mechanism that a real pollinator has to learn. Milkweed
   * clips its pollen onto your foot and small bees get stuck and die there.
   * Dutchman's breeches is locked, and only a bumblebee queen has the strength and
   * the tongue. Pickerelweed comes in three builds and refuses two of them. A
   * naive insect fails at these flowers, which is precisely why they are the ones
   * you have to pass the quiz for.
   *
   * The string is the reason, shown to the player when the button is inert.
   */
  demanding?: string;
  /**
   * What this one looks like bare, in winter, if that can be SOURCED.
   *
   * Optional in the strict sense: most species do not have one and are not
   * supposed to. Winter identification in the game leans on evidence it already
   * holds for every plant (the silhouette it is drawn with, the height it stands
   * at, the habitat it stands in), and this field is an extra hint on top for the
   * handful where a real winter character is documented.
   *
   * It is thin on purpose. Wikipedia is an encyclopedia of the plant rather than a
   * winter key, so it carries buds and twigs for a few woody species and nothing
   * at all for most herbs; the USDA profiles that would have it render their
   * content in JavaScript and cannot be read. Rule 1 says a fact that cannot be
   * sourced does not go in however good the line would have been, so the rest of
   * these are simply absent rather than plausibly invented.
   */
  winter?: string;
  /**
   * Only findable inside a garden party.
   *
   * Kept out of every existing counter by SOLO_PLANTS / SOLO_FUNGI. That is not
   * tidiness: `plantsIn` feeds the park unlock threshold, so counting these
   * would push Schenley from eight of Frick's plants to nine for every player
   * mid-way through the game, over a feature they may never have opened. The
   * per-park badges would quietly start meaning "and two you cannot reach
   * alone", and the completionist badge would become unobtainable without
   * other people. A badge that silently changes what it means is worse than no
   * badge, and a door that moves is worse than a locked one.
   */
  partyOnly?: true;
  archetype: PlantArchetype;
  bloomColor: string;
  leafColor: string;
  /** World height in units. The bee is about 1.6 long for scale. */
  height: number;
  /** How many to scatter through its habitat. */
  count: number;
};

export const PLANTS: Plant[] = [
  {
    id: "common-milkweed",
    commonName: "Common Milkweed",
    scientificName: "Asclepias syriaca",
    homes: [{ park: "frick", area: "blue-slide" }, { park: "schenley", area: "flagstaff-hill" }],
    bloom: "June to August",
    window: DAYLIGHT,
    hook: "Hands out pollen like luggage.",
    fact: "Milkweed doesn't dust you with pollen. It hands you luggage. Its pollen comes in waxy saddlebags called pollinia, and a visiting bee's foot slips into a slot that clips a pair on. Small bees sometimes can't pull free.",
    pollinatorNote: "The only plant monarch caterpillars can eat.",
    wikipedia: "https://en.wikipedia.org/wiki/Asclepias_syriaca",
    demanding:
      "Milkweed does not dust you with pollen, it hands you luggage, and a bee that does not know how the slot works can lose a leg in it. Learn the flower before you try it.",
    archetype: "umbel",
    bloomColor: "#d9a2b4",
    leafColor: "#5f8a4e",
    height: 2.2,
    count: 5,
  },
  {
    id: "wild-bergamot",
    commonName: "Wild Bergamot",
    scientificName: "Monarda fistulosa",
    homes: [{ park: "frick", area: "blue-slide" }],
    bloom: "July to September",
    window: DAYLIGHT,
    hook: "Smells like Earl Grey. It's a mint.",
    fact: "Crush a leaf and it smells like Earl Grey tea, because it is a mint. The flower is a ragged lavender crown of long tubes.",
    pollinatorNote: "Long-tongued bees and hummingbird moths reach the nectar. Short-tongued bees give up and chew in through the side of the tube.",
    wikipedia: "https://en.wikipedia.org/wiki/Monarda_fistulosa",
    archetype: "spike",
    bloomColor: "#b39ddb",
    leafColor: "#5c8a52",
    height: 2,
    count: 5,
  },
  {
    id: "canada-goldenrod",
    commonName: "Canada Goldenrod",
    scientificName: "Solidago canadensis",
    homes: [{ park: "frick", area: "bowling-green" }, { park: "highland", area: "lake-carnegie" }],
    bloom: "August to October",
    window: DAYLIGHT,
    hook: "Blamed for hay fever it doesn't cause.",
    fact: "Goldenrod gets blamed every autumn for hay fever it does not cause. Its pollen is heavy and sticky and travels on insects, not wind. Ragweed, blooming quietly at the same time, is the real culprit.",
    pollinatorNote: "A late-season feast, and one of the last big nectar flows before frost.",
    wikipedia: "https://en.wikipedia.org/wiki/Solidago_canadensis",
    archetype: "spike",
    bloomColor: "#f2c94c",
    leafColor: "#5f8a4e",
    height: 2.3,
    count: 6,
  },
  {
    id: "new-england-aster",
    commonName: "New England Aster",
    scientificName: "Symphyotrichum novae-angliae",
    homes: [{ park: "frick", area: "bowling-green" }, { park: "schenley", area: "flagstaff-hill" }, { park: "highland", area: "lake-carnegie" }],
    bloom: "August to October",
    window: DAYLIGHT,
    hook: "The meadow's last supper before frost.",
    fact: "Deep violet rays around a gold centre, opening just as everything else in the meadow is shutting down for the year.",
    pollinatorNote: "Fuels migrating monarchs and the last bumblebee queens before they overwinter.",
    wikipedia: "https://en.wikipedia.org/wiki/Symphyotrichum_novae-angliae",
    archetype: "daisy",
    bloomColor: "#8e7cc3",
    leafColor: "#5c8a52",
    height: 1.8,
    count: 5,
  },
  {
    id: "purple-coneflower",
    commonName: "Purple Coneflower",
    scientificName: "Echinacea purpurea",
    homes: [{ park: "frick", area: "environmental-center" }],
    bloom: "June to August",
    window: DAYLIGHT,
    hook: "That cone is hundreds of tiny flowers.",
    fact: "That raised orange cone isn't one flower. It is hundreds of tiny ones, opening in a slow ring from the outside in. A bee can work the same cone for days.",
    pollinatorNote: "The drooping petals make a landing pad; the cone is the dinner table.",
    wikipedia: "https://en.wikipedia.org/wiki/Echinacea_purpurea",
    archetype: "daisy",
    bloomColor: "#c96f9b",
    leafColor: "#578049",
    height: 1.9,
    count: 4,
  },
  {
    id: "black-eyed-susan",
    commonName: "Black-eyed Susan",
    scientificName: "Rudbeckia hirta",
    homes: [{ park: "frick", area: "environmental-center" }],
    bloom: "June to September",
    window: DAYLIGHT,
    hook: "Wears a bullseye only bees can see.",
    fact: "To us it's a plain yellow daisy. To a bee it has a dark ultraviolet bullseye burned into the middle of the petals: a landing target we simply cannot see.",
    pollinatorNote: "The UV bullseye points straight at the nectar.",
    wikipedia: "https://en.wikipedia.org/wiki/Rudbeckia_hirta",
    archetype: "daisy",
    bloomColor: "#f2b705",
    leafColor: "#5f8a4e",
    height: 1.6,
    count: 5,
  },
  {
    id: "virginia-bluebell",
    commonName: "Virginia Bluebell",
    scientificName: "Mertensia virginica",
    homes: [{ park: "frick", area: "nine-mile-run" }],
    bloom: "March to May",
    window: EPHEMERAL,
    hook: "Opens pink, then turns blue.",
    fact: "The buds open pink and turn blue as they age, because the flower's own chemistry shifts underneath them. A colony along the creek in April looks like spilled sky.",
    pollinatorNote: "The tube is long, so bumblebees and early butterflies do most of the work.",
    wikipedia: "https://en.wikipedia.org/wiki/Mertensia_virginica",
    archetype: "low",
    bloomColor: "#7aa7e0",
    leafColor: "#6b9c5c",
    height: 1.3,
    count: 6,
  },
  {
    id: "joe-pye-weed",
    commonName: "Joe-Pye Weed",
    scientificName: "Eutrochium purpureum",
    homes: [{ park: "frick", area: "nine-mile-run" }],
    bloom: "July to September",
    window: DAYLIGHT,
    hook: "Head-high, and crawling with butterflies.",
    fact: "It grows head-high on damp ground and holds up great dusty-mauve domes of flower. Stand near one in August and the whole thing is moving with insects.",
    pollinatorNote: "One of the best butterfly plants in the park, full stop.",
    wikipedia: "https://en.wikipedia.org/wiki/Eutrochium_purpureum",
    archetype: "umbel",
    bloomColor: "#c58fae",
    leafColor: "#4f7d47",
    height: 2.6,
    count: 5,
  },
  {
    id: "jewelweed",
    commonName: "Jewelweed",
    scientificName: "Impatiens capensis",
    homes: [{ park: "frick", area: "nine-mile-run" }, { park: "schenley", area: "panther-hollow-lake" }, { park: "highland", area: "riverside-flats" }],
    bloom: "July to September",
    window: DAYLIGHT,
    hook: "Its seed pods explode at a touch.",
    fact: "Also called touch-me-not: brush a ripe seed pod and it snaps apart in your hand, flinging seeds a metre. It tends to grow right where poison ivy does, and its crushed stem is an old folk remedy for the rash.",
    pollinatorNote: "Orange spotted lanterns on a thread, worked by hummingbirds and long-tongued bees.",
    wikipedia: "https://en.wikipedia.org/wiki/Impatiens_capensis",
    archetype: "low",
    bloomColor: "#f0913a",
    leafColor: "#6b9c5c",
    height: 1.5,
    count: 6,
  },
  {
    id: "cardinal-flower",
    commonName: "Cardinal Flower",
    scientificName: "Lobelia cardinalis",
    homes: [{ park: "frick", area: "nine-mile-run" }],
    bloom: "July to September",
    window: DAYLIGHT,
    hook: "A red built for hummingbirds, not bees.",
    fact: "An impossible red, on a spike at the water's edge. The colour is not for you and it is not for bees, most of which cannot even see red properly.",
    pollinatorNote: "Built end to end for hummingbirds. Most bees can't reach the nectar at all.",
    wikipedia: "https://en.wikipedia.org/wiki/Lobelia_cardinalis",
    demanding:
      "This flower is not built for you. It is built for a bird, and working it as a bee takes knowing exactly what you are looking at.",
    archetype: "spike",
    bloomColor: "#d7263d",
    leafColor: "#4f7d47",
    height: 2.1,
    count: 4,
  },
  {
    id: "mayapple",
    commonName: "Mayapple",
    scientificName: "Podophyllum peltatum",
    homes: [{ park: "frick", area: "falls-ravine" }],
    bloom: "April to May",
    window: EPHEMERAL,
    hook: "Hides its flower under an umbrella.",
    fact: "A colony looks like a crowd of little green umbrellas. The single waxy white flower hides underneath, where you'll never see it unless you crouch and look up.",
    pollinatorNote: "Bumblebees have to push under the leaves to find it. The fruit is for box turtles.",
    wikipedia: "https://en.wikipedia.org/wiki/Podophyllum_peltatum",
    archetype: "low",
    bloomColor: "#f5f2e8",
    leafColor: "#5f9150",
    height: 1.2,
    count: 6,
  },
  {
    id: "trout-lily",
    commonName: "Trout Lily",
    scientificName: "Erythronium americanum",
    homes: [{ park: "frick", area: "falls-ravine" }],
    bloom: "March to May",
    window: EPHEMERAL,
    hook: "Leaves mottled like a brook trout.",
    fact: "Named for its leaves, mottled like the flank of a brook trout. A patch of them can be older than the trees above it. Some colonies are estimated at a century or more.",
    pollinatorNote: "Ants carry the seeds home for a fatty snack attached to them, then discard the seed underground. Free planting.",
    wikipedia: "https://en.wikipedia.org/wiki/Erythronium_americanum",
    archetype: "low",
    bloomColor: "#f5d76e",
    leafColor: "#6f9c58",
    height: 1.1,
    count: 6,
  },
  {
    id: "wild-geranium",
    commonName: "Wild Geranium",
    scientificName: "Geranium maculatum",
    homes: [{ park: "frick", area: "falls-ravine" }],
    bloom: "April to June",
    window: EPHEMERAL,
    hook: "Its petals are painted with runways.",
    fact: "Look closely at a petal and you'll find dark lines running inward. They're nectar guides: a runway painted on the flower, pointing at the middle.",
    pollinatorNote: "Follow the lines. The plant is telling you exactly where to go.",
    wikipedia: "https://en.wikipedia.org/wiki/Geranium_maculatum",
    archetype: "low",
    bloomColor: "#b98bc9",
    leafColor: "#5f9150",
    height: 1.4,
    count: 6,
  },
  {
    id: "white-trillium",
    commonName: "White Trillium",
    scientificName: "Trillium grandiflorum",
    homes: [{ park: "frick", area: "falls-ravine" }],
    bloom: "April to May",
    window: EPHEMERAL,
    hook: "Seven years from seed to first flower.",
    fact: "Everything about it comes in threes: three leaves, three petals, three sepals. It takes roughly seven years to get from seed to its first flower, which is why picking one is close to killing it.",
    pollinatorNote: "Ants disperse the seeds. Bees and beetles handle the pollen.",
    wikipedia: "https://en.wikipedia.org/wiki/Trillium_grandiflorum",
    archetype: "low",
    bloomColor: "#f7f5ef",
    leafColor: "#4f8545",
    height: 1.3,
    count: 5,
  },
  {
    id: "spicebush",
    commonName: "Spicebush",
    scientificName: "Lindera benzoin",
    homes: [{ park: "frick", area: "fern-hollow" }, { park: "schenley", area: "panther-hollow" }],
    bloom: "March to April",
    window: DAYLIGHT,
    hook: "Flowers before it bothers with leaves.",
    fact: "It flowers before it bothers growing leaves, throwing a haze of tiny yellow-green blooms onto bare grey twigs in early spring. Snap a twig and it smells sharp and citrusy.",
    pollinatorNote: "Host plant for the spicebush swallowtail, whose caterpillar disguises itself as a small snake, fake eyespots and all.",
    wikipedia: "https://en.wikipedia.org/wiki/Lindera_benzoin",
    // Bare grey twigs, and the smell is the giveaway: it is already in this
    // entry's own sourced fact, and it is the one winter character you find with
    // your hands rather than your eyes.
    winter:
      "Bare grey twigs, speckled all over with small round lenticels. Snap one and it smells sharp and citrusy, which nothing else out here does.",

    archetype: "shrub",
    bloomColor: "#d9e04f",
    leafColor: "#48753f",
    height: 2.8,
    count: 5,
  },
  {
    id: "eastern-redbud",
    commonName: "Eastern Redbud",
    scientificName: "Cercis canadensis",
    homes: [{ park: "frick", area: "fern-hollow" }],
    bloom: "March to May",
    window: DAYLIGHT,
    hook: "Blooms straight out of its own trunk.",
    fact: "The flowers erupt straight out of the trunk and the bare branches, not from twig tips, in a trick called cauliflory. For two weeks the whole tree is magenta, then it goes green and you forget it's there.",
    pollinatorNote: "One of the first serious nectar sources of spring, arriving exactly when queen bumblebees wake up starving.",
    wikipedia: "https://en.wikipedia.org/wiki/Cercis_canadensis",
    winter:
      "Slender, nearly black twigs that zigzag from bud to bud, spotted with pale lenticels, and flat brown pea-pods still hanging on into the early winter.",

    archetype: "tree",
    bloomColor: "#d16ba5",
    leafColor: "#4f8545",
    height: 6,
    count: 4,
  },
  /* ----------------------------------------------------------------------- *
   * Schenley Park.
   * ----------------------------------------------------------------------- */

  {
    id: "pickerelweed",
    commonName: "Pickerelweed",
    scientificName: "Pontederia cordata",
    homes: [{ park: "schenley", area: "panther-hollow-lake" }],
    bloom: "June to October",
    window: DAYLIGHT,
    hook: "Comes in three different builds.",
    fact: "It stands in the shallows in violet spikes, and it is tristylous: every plant is built in one of three configurations, with the style long, medium or short and the anthers set at the two heights it is not. A flower can only really pollinate one of the other two builds, which is an elaborate way of refusing to fertilise itself.",
    pollinatorNote: "Bumblebees work the spike from the bottom up, and carry pollen at exactly the height the next build needs it.",
    wikipedia: "https://en.wikipedia.org/wiki/Pontederia_cordata",
    archetype: "spike",
    bloomColor: "#6a76c4",
    leafColor: "#4f8a5c",
    height: 2,
    count: 6,
  },
  {
    id: "buttonbush",
    commonName: "Buttonbush",
    scientificName: "Cephalanthus occidentalis",
    homes: [{ park: "schenley", area: "panther-hollow-lake" }],
    bloom: "June to August",
    window: DAYLIGHT,
    hook: "A shrub that flowers in perfect spheres.",
    fact: "The flowers are packed into a flawless white sphere with the styles shooting out of it in every direction, so the whole thing looks like a firework caught halfway. It grows with its feet in the water and does not mind being flooded for weeks.",
    pollinatorNote: "The busiest shrub on the lake edge: bees, wasps and swallowtails all over it, and hummingbirds when nobody is looking.",
    wikipedia: "https://en.wikipedia.org/wiki/Cephalanthus_occidentalis",
    archetype: "shrub",
    bloomColor: "#eae4d0",
    leafColor: "#3f7a46",
    height: 3,
    count: 4,
  },
  {
    id: "swamp-milkweed",
    commonName: "Swamp Milkweed",
    scientificName: "Asclepias incarnata",
    homes: [{ park: "schenley", area: "panther-hollow-lake" }],
    bloom: "July to August",
    window: DAYLIGHT,
    hook: "Milkweed that likes wet feet.",
    fact: "The same trick as common milkweed, pollen in waxy saddlebags clipped onto a visiting foot, but in rose pink, on a narrower plant, standing in the mud at the water's edge. Its sap is milky and mildly toxic, which is exactly the point.",
    pollinatorNote: "Monarch caterpillars eat it and take the toxins with them, which is why a bird only ever tries to eat one monarch.",
    wikipedia: "https://en.wikipedia.org/wiki/Asclepias_incarnata",
    archetype: "umbel",
    bloomColor: "#e0709b",
    leafColor: "#58874e",
    height: 2.2,
    count: 5,
  },
  {
    id: "boneset",
    commonName: "Boneset",
    scientificName: "Eupatorium perfoliatum",
    homes: [{ park: "schenley", area: "panther-hollow-lake" }],
    bloom: "July to October",
    window: DAYLIGHT,
    hook: "The stem grows straight through the leaves.",
    fact: "The leaf pair is fused around the stem, so the stalk appears to have been pushed clean through a single leaf. That looked to colonial doctors like a plant for knitting things back together, and they dosed people with it for a fever so vicious it was called breakbone fever. The name stuck. The medicine did not.",
    pollinatorNote: "Shallow, open florets, so the short-tongued crowd gets a look in: small bees, flies, wasps and beetles that cannot reach into anything deeper.",
    wikipedia: "https://en.wikipedia.org/wiki/Eupatorium_perfoliatum",
    archetype: "umbel",
    bloomColor: "#f0ece2",
    leafColor: "#4f7d47",
    height: 2.1,
    count: 5,
  },
  {
    id: "blue-vervain",
    commonName: "Blue Vervain",
    scientificName: "Verbena hastata",
    homes: [{ park: "schenley", area: "flagstaff-hill" }],
    bloom: "July to September",
    window: DAYLIGHT,
    hook: "Blooms in a ring that climbs the spike.",
    fact: "It holds up a candelabra of narrow spikes, and each one opens in a thin ring of violet that starts at the bottom and creeps upward over weeks. Everything below the ring is already seed. Everything above it is still waiting.",
    pollinatorNote: "The ring tells a bee exactly where the open flowers are, so it lands on the band and works around it.",
    wikipedia: "https://en.wikipedia.org/wiki/Verbena_hastata",
    archetype: "spike",
    bloomColor: "#8f8fd0",
    leafColor: "#5c8a52",
    height: 2.3,
    count: 5,
  },
  {
    id: "mapleleaf-viburnum",
    commonName: "Mapleleaf Viburnum",
    scientificName: "Viburnum acerifolium",
    homes: [{ park: "schenley", area: "panther-hollow" }],
    bloom: "May to June",
    window: DAYLIGHT,
    hook: "Turns pink in autumn. Nothing else does.",
    fact: "A modest shrub with maple-shaped leaves and flat plates of small white flowers, and then in October it does something almost no other native shrub does: the leaves turn a soft rose pink, sometimes nearly lilac, and glow in the understorey after the canopy has gone brown.",
    pollinatorNote: "Flat-topped and shallow, so it feeds the small unglamorous bees, flies and beetles that deeper flowers shut out.",
    wikipedia: "https://en.wikipedia.org/wiki/Viburnum_acerifolium",
    archetype: "shrub",
    bloomColor: "#ede7d3",
    leafColor: "#4c8248",
    height: 2.6,
    count: 5,
  },
  {
    id: "white-snakeroot",
    commonName: "White Snakeroot",
    scientificName: "Ageratina altissima",
    homes: [{ park: "schenley", area: "panther-hollow" }, { park: "highland", area: "allegheny-slope" }],
    bloom: "August to October",
    window: DAYLIGHT,
    hook: "It once killed people through cows.",
    fact: "Frothy white clusters lighting up the woodland edge in autumn, and one of the most quietly lethal plants in eastern America. It carries a toxin called tremetol, which passes straight through a cow into her milk. Abraham Lincoln's mother died of it, and so did whole settlements, before anybody worked out what was happening.",
    pollinatorNote: "Late nectar in deep shade, where almost nothing else is still open. Bees, wasps and flies work it hard in September.",
    wikipedia: "https://en.wikipedia.org/wiki/Ageratina_altissima",
    archetype: "umbel",
    bloomColor: "#f2efe6",
    leafColor: "#4f8548",
    height: 1.8,
    count: 6,
  },
  {
    id: "bloodroot",
    commonName: "Bloodroot",
    scientificName: "Sanguinaria canadensis",
    homes: [{ park: "schenley", area: "phipps-run" }],
    bloom: "March to April",
    window: EPHEMERAL,
    hook: "Snap the root and it bleeds orange.",
    fact: "Break the rhizome and it bleeds a thick orange-red sap, which is where it gets both its names. The white flower comes up wrapped in its own leaf like a furled umbrella, opens for a day or two, and is gone.",
    pollinatorNote: "It offers no nectar whatsoever, only pollen, so the early bees turn up expecting a drink and leave with the shopping instead.",
    wikipedia: "https://en.wikipedia.org/wiki/Sanguinaria_canadensis",
    archetype: "low",
    bloomColor: "#f9f7f2",
    leafColor: "#5f9150",
    height: 1.2,
    count: 6,
  },
  {
    id: "cutleaf-toothwort",
    commonName: "Cutleaf Toothwort",
    scientificName: "Cardamine concatenata",
    homes: [{ park: "schenley", area: "phipps-run" }],
    bloom: "March to May",
    window: EPHEMERAL,
    hook: "A mustard. Chew the root and it bites back.",
    fact: "Four white petals in a cross, over deeply slashed leaves, and a knobbly toothed rhizome underneath that tastes of horseradish. It is a mustard, and it is what the West Virginia white butterfly lays its eggs on.",
    pollinatorNote: "That butterfly is in trouble here. It cannot tell toothwort from invasive garlic mustard, lays on the impostor, and every caterpillar dies. This is the real thing.",
    wikipedia: "https://en.wikipedia.org/wiki/Cardamine_concatenata",
    archetype: "low",
    bloomColor: "#f4f0f2",
    leafColor: "#5f9150",
    height: 1.1,
    count: 6,
  },
  {
    id: "dutchmans-breeches",
    commonName: "Dutchman's Breeches",
    scientificName: "Dicentra cucullaria",
    homes: [{ park: "schenley", area: "phipps-run" }],
    bloom: "April to May",
    window: EPHEMERAL,
    hook: "A washing line of tiny upside-down trousers.",
    fact: "A row of little white pantaloons hung upside down along an arching stem, over foliage as fine as a fern. The nectar is right up in the toes of the trousers, and the flower is locked shut.",
    pollinatorNote: "Only a queen bumblebee is strong enough to force the petals apart and long enough in the tongue to reach the nectar. Almost nothing else in the wood is invited.",
    wikipedia: "https://en.wikipedia.org/wiki/Dicentra_cucullaria",
    demanding:
      "The flower is locked shut and the nectar is up in the toes. Getting in is a technique, not an accident.",
    archetype: "low",
    bloomColor: "#f7f4ea",
    leafColor: "#6f9c58",
    height: 1.2,
    count: 6,
  },

  /* ----------------------------------------------------------------------- *
   * Highland Park.
   * ----------------------------------------------------------------------- */

  {
    id: "great-blue-lobelia",
    commonName: "Great Blue Lobelia",
    scientificName: "Lobelia siphilitica",
    homes: [{ park: "highland", area: "reservoir-rim" }],
    bloom: "July to September",
    window: DAYLIGHT,
    hook: "The cardinal flower's blue sister.",
    fact: "The same shape as the cardinal flower wearing a different colour for a different customer. Its name is a libel: a Mohawk remedy was sold to Europe as a cure for syphilis, Linnaeus wrote that into the species name, and it does not work. The name is stuck there permanently.",
    pollinatorNote: "The tube is long and tight, so a bumblebee has to force in headfirst and comes out with pollen loaded onto her back.",
    wikipedia: "https://en.wikipedia.org/wiki/Lobelia_siphilitica",
    archetype: "spike",
    bloomColor: "#4a6fd0",
    leafColor: "#52864c",
    height: 2.2,
    count: 5,
  },
  {
    id: "ohio-spiderwort",
    commonName: "Ohio Spiderwort",
    scientificName: "Tradescantia ohiensis",
    homes: [{ park: "highland", area: "reservoir-rim" }],
    bloom: "May to July",
    window: EPHEMERAL,
    hook: "Its hairs turn pink when the air is wrong.",
    fact: "Three violet petals that open in the morning and are finished by the heat of the afternoon: touch one then and it does not wilt so much as collapse into a bead of clear jelly. The blue hairs on its stamens are one of the very few living tissues that work as a radiation detector. They mutate and turn pink near ionising radiation, or near sulphur dioxide, which is the thing Pittsburgh used to be made of.",
    pollinatorNote: "The Xerces Society flags it as being of special value to native bees and to bumblebees, which work it hard in the morning because by the afternoon there is nothing left to work.",
    wikipedia: "https://en.wikipedia.org/wiki/Tradescantia_ohiensis",
    archetype: "umbel",
    bloomColor: "#5b62c4",
    leafColor: "#5c8a52",
    height: 2.2,
    count: 6,
  },
  {
    id: "heal-all",
    commonName: "Heal-All",
    scientificName: "Prunella vulgaris",
    homes: [{ park: "highland", area: "lake-carnegie" }],
    bloom: "June to September",
    window: DAYLIGHT,
    hook: "Mow it and it just blooms shorter.",
    fact: "A mint that has worked out how to live on a mown lawn. Cut it down and it does not sulk: it flowers again at two inches instead of twelve, hugging the ground under the blades. The violet hooded flowers come out of a squat purple cone that looks like a very small pineapple.",
    pollinatorNote: "On a mown Pittsburgh lawn half the bees are working this and nothing else. It is most of the argument for not mowing in May.",
    wikipedia: "https://en.wikipedia.org/wiki/Prunella_vulgaris",
    archetype: "low",
    bloomColor: "#8b7fc8",
    leafColor: "#4f8548",
    height: 1,
    count: 7,
  },
  {
    id: "virginia-waterleaf",
    commonName: "Virginia Waterleaf",
    scientificName: "Hydrophyllum virginianum",
    homes: [{ park: "highland", area: "allegheny-slope" }],
    bloom: "May to June",
    window: DAYLIGHT,
    hook: "Its leaves look water-stained. They aren't.",
    fact: "The young leaves come up looking as though someone spilled water on them and left pale blotches behind, which is exactly where the name comes from. The marks fade as the season goes on. The flowers are small white bells with the stamens shot well out past the petals, like a held-out fistful of pins.",
    pollinatorNote: "Those protruding stamens dust the underside of a bumblebee that never quite has to land. One of the better nectar plants on a wooded slope in May.",
    wikipedia: "https://en.wikipedia.org/wiki/Hydrophyllum_virginianum",
    archetype: "low",
    bloomColor: "#dcd6ea",
    leafColor: "#58904f",
    height: 1.3,
    count: 6,
  },
  {
    id: "wild-columbine",
    commonName: "Wild Columbine",
    scientificName: "Aquilegia canadensis",
    homes: [{ park: "highland", area: "allegheny-slope" }],
    bloom: "April to June",
    window: DAYLIGHT,
    hook: "Bees cannot reach the nectar. So they burgle it.",
    fact: "Five red horns hanging upside down with the nectar sealed in the tips, opening exactly when the ruby-throated hummingbirds get back to Pennsylvania. It grows out of cracks in bare rock on the slope, which is where the competition is not.",
    pollinatorNote: "A bumblebee that cannot reach the tip chews straight through the side of the spur and drinks without going near the pollen. The plant gets nothing at all. This is called nectar robbing, and it is exactly what it sounds like.",
    wikipedia: "https://en.wikipedia.org/wiki/Aquilegia_canadensis",
    demanding:
      "The nectar is sealed in the tips of five upside-down horns, out of reach of your tongue. There is a way to get at it and there is a way to wreck the flower doing it. Know which is which first.",
    archetype: "low",
    bloomColor: "#d8443c",
    leafColor: "#6f9c58",
    height: 1.5,
    count: 5,
  },
  {
    id: "pawpaw",
    commonName: "Pawpaw",
    scientificName: "Asimina triloba",
    homes: [{ park: "highland", area: "riverside-flats" }],
    bloom: "April to May",
    window: DAYLIGHT,
    hook: "Smells like carrion. It is not after bees.",
    fact: "The largest edible fruit native to North America, growing wild on the Allegheny flats and tasting like a mango that has been talked into being a banana. The flower is maroon, hangs upside down, and smells faintly of rotting meat, because bees are not the customer.",
    pollinatorNote: "It wants carrion flies and beetles, and it is bad at attracting them: fruit set is so poor that growers hand-pollinate with a paintbrush. Its other job is the zebra swallowtail, whose caterpillar eats pawpaw and nothing else on earth.",
    wikipedia: "https://en.wikipedia.org/wiki/Asimina_triloba",
    winter:
      "Two kinds of bud on the same twig: the leaf buds pointed and pressed flat against it, the flower buds round, brown and furry.",

    demanding:
      "It is not advertising to you. It smells of rotting meat because it wants flies, and working it as a bee means understanding what the flower is actually asking for.",
    archetype: "tree",
    bloomColor: "#6e2b3a",
    leafColor: "#4f8545",
    height: 6,
    count: 4,
  },
  {
    id: "wingstem",
    commonName: "Wingstem",
    scientificName: "Verbesina alternifolia",
    homes: [{ park: "highland", area: "riverside-flats" }],
    bloom: "August to September",
    window: DAYLIGHT,
    hook: "Run a thumb up the stem and feel the wings.",
    fact: "Head-high and then some on the river flats, with thin flanges of green tissue running down the stalk. You can feel them with a thumb, which is the whole name. The yellow rays hang off the disc at careless angles, like a sunflower that has given up on symmetry.",
    pollinatorNote: "Enormous quantities of late nectar exactly when the floodplain has little else open. The silvery checkerspot lays its eggs on the leaves.",
    wikipedia: "https://en.wikipedia.org/wiki/Verbesina_alternifolia",
    archetype: "daisy",
    bloomColor: "#f0c02e",
    leafColor: "#567f47",
    height: 2.6,
    count: 6,
  },
  {
    id: "common-elderberry",
    commonName: "Common Elderberry",
    scientificName: "Sambucus canadensis",
    homes: [{ park: "highland", area: "zoo-edge" }],
    bloom: "June to July",
    window: DAYLIGHT,
    hook: "Wine, syrup and pie. Or cyanide, raw.",
    fact: "Great flat plates of tiny cream flowers on a shrub that colonises any damp edge it can reach, and by September the same plates are heavy heads of near-black fruit. Cooked, it has been wine and syrup and pie for as long as anyone has lived here. Raw, the stems and leaves carry compounds that release cyanide.",
    pollinatorNote: "Shallow and flat and wide open, so the flies, small bees and beetles that cannot manage a deep flower all get fed. The birds strip the fruit within days of it ripening.",
    wikipedia: "https://en.wikipedia.org/wiki/Sambucus_canadensis",
    archetype: "shrub",
    bloomColor: "#f2eeda",
    leafColor: "#47803f",
    height: 3.2,
    count: 4,
  },

  /* ---------------------------------------------------------------- *
   * Garden party plants.
   *
   * Only findable with other people in the park. Sourced to the same bar as
   * everything above: two candidates were cut outright because their articles
   * carry no ecology at all, and a hook invented to fill the gap is exactly
   * what rule 1 exists to stop.
   * ---------------------------------------------------------------- */

  {
    id: "witch-hazel",
    commonName: "Witch-hazel",
    scientificName: "Hamamelis virginiana",
    homes: [{ park: "frick", area: "fern-hollow" }],
    bloom: "October to November",
    window: DAYLIGHT,
    partyOnly: true,
    hook: "Flowers when everything else has given up.",
    fact: "It opens ribbon-shaped yellow petals from late September into November, sometimes December, when the wood has nothing else in flower. Then it waits: the pollinated ovary rests all winter and is not fertilised until about the middle of May, five to seven months later.",
    pollinatorNote:
      "Moths work it, which is the point of flowering into the cold when almost nothing else does. It also feeds the caterpillars of sixty-two species.",
    wikipedia: "https://en.wikipedia.org/wiki/Hamamelis_virginiana",
    winter:
      "A dense cluster of stems from the base, with the empty seed capsules still attached after they have fired.",
    archetype: "shrub",
    bloomColor: "#e8c33c",
    leafColor: "#7a8a45",
    height: 9,
    count: 4,
  },
  {
    id: "skunk-cabbage",
    commonName: "Skunk Cabbage",
    scientificName: "Symplocarpus foetidus",
    homes: [{ park: "frick", area: "falls-ravine" }],
    bloom: "February to April",
    window: DAYLIGHT,
    partyOnly: true,
    hook: "Melts its own hole in the ice.",
    fact: "It is thermogenic: the hood makes enough heat to melt a circle in the ice around itself, and it blooms so early that the flower is often the only thing above the mud. Linnaeus named it foetidus, Latin for bad-smelling, and a bruised leaf earns it.",
    pollinatorNote:
      "The female parts ripen before the male ones on the same flower, which is a plant going to some trouble not to pollinate itself.",
    wikipedia: "https://en.wikipedia.org/wiki/Symplocarpus_foetidus",
    archetype: "low",
    bloomColor: "#6b3f52",
    leafColor: "#4e7a3f",
    height: 1.4,
    count: 6,
  },
  {
    id: "foxglove-beardtongue",
    commonName: "Foxglove Beardtongue",
    scientificName: "Penstemon digitalis",
    homes: [{ park: "schenley", area: "junction-hollow" }],
    bloom: "May to July",
    window: DAYLIGHT,
    partyOnly: true,
    hook: "White tubes with hairy chins.",
    fact: "Two-lipped white tubes carried on a panicle that runs almost a third of the way down the plant. The outside of each tube is covered in tiny white hairs. It is the most widespread penstemon east of the Mississippi.",
    pollinatorNote:
      "A tube is a shape that sorts its visitors: what fits, feeds. It grows in the open, along field edges, wood margins and railroad tracks.",
    wikipedia: "https://en.wikipedia.org/wiki/Penstemon_digitalis",
    archetype: "spike",
    bloomColor: "#f4f1e4",
    leafColor: "#5f8a52",
    height: 2.4,
    count: 5,
  },
  {
    id: "white-turtlehead",
    commonName: "White Turtlehead",
    scientificName: "Chelone glabra",
    homes: [{ park: "schenley", area: "phipps-run" }],
    bloom: "August to September",
    window: DAYLIGHT,
    partyOnly: true,
    hook: "A flower shaped like a tortoise's head.",
    fact: "The petals really do close into the shape of a tortoise's head, and the name says so twice: chelone is Greek for tortoise, after a nymph who would not come to Zeus's wedding and was turned into one for it.",
    pollinatorNote:
      "It is the plant the Baltimore checkerspot lays its eggs on, mostly to the exclusion of anything else.",
    wikipedia: "https://en.wikipedia.org/wiki/Chelone_glabra",
    archetype: "spike",
    bloomColor: "#f2ede0",
    leafColor: "#4f7a46",
    height: 2.2,
    count: 5,
  },
  {
    id: "new-york-ironweed",
    commonName: "New York Ironweed",
    scientificName: "Vernonia noveboracensis",
    homes: [{ park: "highland", area: "riverside-flats" }],
    bloom: "August to September",
    window: DAYLIGHT,
    partyOnly: true,
    hook: "The deepest purple in the wet meadow.",
    fact: "It blooms in August in wet ground, and what looks like one purple flower is a crowd of small florets. The seed that follows is an achene in a coat of bristles, built to leave on the wind.",
    pollinatorNote:
      "Late, tall and purple in ground that stays damp: it grows fast early in the season and holds its height, which is how it gets a share of the light.",
    wikipedia: "https://en.wikipedia.org/wiki/Vernonia_noveboracensis",
    archetype: "daisy",
    bloomColor: "#7b4a9c",
    leafColor: "#4d7a44",
    height: 4.2,
    count: 5,
  },
  {
    id: "cup-plant",
    commonName: "Cup Plant",
    scientificName: "Silphium perfoliatum",
    homes: [{ park: "highland", area: "allegheny-slope" }],
    bloom: "July to September",
    window: DAYLIGHT,
    partyOnly: true,
    hook: "Its leaves hold rainwater. Birds drink from it.",
    fact: "The leaf stalks are winged and fused right around the stem, and the join makes a cup. It fills with rain, and birds come to drink from it. The stem itself is strongly square, four-angled like a mint.",
    pollinatorNote:
      "Yellow heads like small sunflowers from midsummer into autumn, worked by bees, butterflies and skippers. The first head opens at the very tip of the main stem, and the side branches follow.",
    wikipedia: "https://en.wikipedia.org/wiki/Silphium_perfoliatum",
    archetype: "daisy",
    bloomColor: "#f0c93f",
    leafColor: "#5a8746",
    height: 5.5,
    count: 4,
  },
  /**
   * The night shift.
   *
   * Three real species that really open after dark in western Pennsylvania, and
   * they are the reason the moths exist. All three are moth flowers by the same
   * three signals: white or pale (visible by starlight when colour is useless),
   * scented at night and not by day, and built as a tube too deep for most
   * mouths but not for a hawk moth's tongue.
   *
   * Deliberately spread one per park, so no park is the daytime one.
   */
  {
    id: "evening-primrose",
    commonName: "Common Evening Primrose",
    scientificName: "Oenothera biennis",
    homes: [{ park: "frick", area: "bowling-green" }],
    bloom: "June to September",
    window: NIGHT,
    hook: "Opens in about a minute, at dusk, while you watch.",
    fact: "Most flowers open too slowly to see. This one does not: on a summer evening the buds swell, the sepals let go, and the petals swing open over roughly a minute, often several on a spike within the same half hour. By the following midday each flower is finished and going limp.",
    pollinatorNote: "Pale yellow, scented after dark, and shaped for the tongue of a hawk moth. Bees get the leftovers in the morning.",
    wikipedia: "https://en.wikipedia.org/wiki/Oenothera_biennis",
    archetype: "spike",
    bloomColor: "#f6e27a",
    leafColor: "#6d8a52",
    height: 2.4,
    count: 5,
  },
  {
    id: "jimsonweed",
    commonName: "Jimsonweed",
    scientificName: "Datura stramonium",
    homes: [{ park: "schenley", area: "flagstaff-hill" }],
    bloom: "July to October",
    window: NIGHT,
    hook: "A trumpet the length of your hand, open only at night.",
    fact: "Every part of it is poisonous, and dangerously unpredictably so: the amount of alkaloid varies enormously between plants, between seasons, and between one part of the same plant and another. That variability is exactly what makes it kill people who thought they knew the dose.",
    pollinatorNote: "A trumpet far too deep for most insects, opening at dusk and scented at night. It is built for hawk moths, which hover at it like hummingbirds.",
    wikipedia: "https://en.wikipedia.org/wiki/Datura_stramonium",
    archetype: "low",
    // White washed with violet, which is what Datura actually is and what the
    // photograph shows. It was flat white.
    bloomColor: "#ece4f2",
    leafColor: "#4f6f43",
    height: 1.8,
    count: 4,
  },
  {
    id: "night-flowering-catchfly",
    commonName: "Night-flowering Catchfly",
    scientificName: "Silene noctiflora",
    homes: [{ park: "highland", area: "lake-carnegie" }],
    bloom: "June to September",
    window: NIGHT,
    hook: "Rolls its petals shut at dawn and looks like nothing all day.",
    fact: "Walk past it in daylight and you would not look twice: the petals roll up lengthwise into thin twists and the whole plant reads as a weedy nothing. After dark they open out, white or washed with pink, and start to smell. The sticky hairs on its stems are what the catchfly name is about, and small insects do get stuck on them.",
    pollinatorNote: "Pale, night-scented and tubular, which is the moth signal in three parts. The stickiness is thought to keep crawling insects off the nectar it is saving for them.",
    wikipedia: "https://en.wikipedia.org/wiki/Silene_noctiflora",
    archetype: "low",
    // White to pale pink, as the photograph shows. It was flat white.
    bloomColor: "#f6ecef",
    leafColor: "#71875a",
    height: 1.5,
    count: 5,
  },
];

/**
 * Everything you can find on your own.
 *
 * What every counter in the game has always meant. The park unlock threshold,
 * the per-park badges and the completionist badge all read this rather than
 * PLANTS, so adding a garden party species cannot move a door somebody was
 * walking towards. See `partyOnly`.
 */
export const SOLO_PLANTS: Plant[] = PLANTS.filter((plant) => !plant.partyOnly);

/** The other half: only findable with other people in the park. */
export const PARTY_PLANTS: Plant[] = PLANTS.filter((plant) => plant.partyOnly);

export const PLANTS_BY_ID = new Map(PLANTS.map((plant) => [plant.id, plant]));

/**
 * Where a species can be found, in words.
 *
 * A species with homes in both parks says so. This is the payoff of `homes`
 * being a list: goldenrod is one plant with one journal entry and two addresses,
 * rather than two goldenrods that happen to share a name.
 */
export function describeHomes(
  homes: Home[],
  labelOf: (areaId: string) => string,
  parkLabelOf: (park: ParkId) => string,
): string {
  return homes
    .map((home) => `${labelOf(home.area)} (${parkLabelOf(home.park)})`)
    .join(", and ");
}
