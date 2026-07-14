import type { TimeWindow } from "../world/daylight";
import type { AreaId, ParkId } from "../world/terrain";
import type { Home } from "./plants";

/**
 * Fungi.
 *
 * They behave like plants in every way that matters to the game: they are
 * scattered in habitats, discovered by getting close, photographed, and written
 * up in the journal. But you cannot pollinate one, because nothing pollinates a
 * mushroom. A fungus is not a plant and does not want anything from a bee.
 *
 * What it wants is to be understood, so landing on one gives you a quiz instead.
 *
 * The times are real. Mushrooms are not out all day: most are best at dawn,
 * before the sun dries them, and the jack-o'-lantern is worth finding after dark
 * for reasons that will be obvious.
 */

export type FungusArchetype =
  | "bracket"
  | "cap"
  | "puffball"
  | "morel"
  | "shelf"
  | "cluster";

export type Fungus = {
  id: string;
  commonName: string;
  scientificName: string;
  homes: Home[];
  /** When it can be found. */
  window: TimeWindow;
  season: string;
  /** One line for the card that hovers over it in the world. */
  hook: string;
  fact: string;
  /** The ecology. What it does for the wood. */
  roleNote: string;
  /** Edible, toxic, or deadly. This is a real thing people need to know. */
  edibility: "choice" | "edible" | "inedible" | "toxic" | "deadly";
  wikipedia: string;
  archetype: FungusArchetype;
  capColor: string;
  stemColor: string;
  /** World height in units, before scaling. */
  height: number;
  count: number;
  /** Fungi that glow. There is exactly one, and it is worth the trip. */
  glows?: boolean;
};

const DAWN: TimeWindow = {
  from: 5,
  to: 11,
  note: "Best at dawn, before the sun dries it out.",
};

const DAY: TimeWindow = {
  from: 7,
  to: 19,
  note: "Out through the day.",
};

const NIGHT: TimeWindow = {
  from: 20,
  to: 5,
  note: "After dark. You will know it when you see it.",
};

const DUSK: TimeWindow = {
  from: 17,
  to: 23,
  note: "Comes out toward evening.",
};

export const FUNGI: Fungus[] = [
  {
    id: "turkey-tail",
    commonName: "Turkey Tail",
    scientificName: "Trametes versicolor",
    homes: [{ park: "frick", area: "falls-ravine" }],
    window: DAY,
    season: "All year",
    hook: "Rings of colour, like a bird's fanned tail.",
    fact: "It grows in overlapping fans banded with concentric rings, and no two colonies are quite the same colour. It is one of the most studied fungi on earth: a compound from it is licensed as a cancer adjunct therapy in Japan.",
    roleNote:
      "A white-rot fungus. It eats lignin, the stuff that makes wood woody, and almost nothing else on the planet can. Without it and its relatives, dead trees would simply pile up.",
    edibility: "inedible",
    wikipedia: "https://en.wikipedia.org/wiki/Trametes_versicolor",
    archetype: "bracket",
    capColor: "#8a6a4a",
    stemColor: "#6b5236",
    height: 0.5,
    count: 6,
  },
  {
    id: "chicken-of-the-woods",
    commonName: "Chicken of the Woods",
    scientificName: "Laetiporus sulphureus",
    homes: [{ park: "frick", area: "fern-hollow" }],
    window: DAY,
    season: "Summer to autumn",
    hook: "A shelf of orange you can see from a hundred feet.",
    fact: "Vast overlapping shelves of sulphur-orange, sometimes weighing more than a person. It really does taste like chicken, which is why every forager in Pennsylvania knows exactly where their tree is and will not tell you.",
    roleNote:
      "A brown-rot fungus, hollowing the heartwood of oaks from the inside. The tree can stand for years with almost nothing left in the middle of it.",
    edibility: "choice",
    wikipedia: "https://en.wikipedia.org/wiki/Laetiporus_sulphureus",
    archetype: "shelf",
    capColor: "#e8873a",
    stemColor: "#c26a28",
    height: 0.7,
    count: 4,
  },
  {
    id: "oyster-mushroom",
    commonName: "Oyster Mushroom",
    scientificName: "Pleurotus ostreatus",
    homes: [{ park: "frick", area: "fern-hollow" }],
    window: DAWN,
    season: "Autumn to spring",
    hook: "Grows in shelves on dead wood, and eats worms.",
    fact: "Pale, fan-shaped, and stacked up the side of a dying tree. Here is the part nobody expects: it is carnivorous. Its threads paralyse nematode worms in the wood and digest them, because rotting wood has almost no nitrogen and it has to get it somewhere.",
    roleNote: "A decomposer, and a predator. Fungi are not plants.",
    edibility: "choice",
    wikipedia: "https://en.wikipedia.org/wiki/Pleurotus_ostreatus",
    archetype: "shelf",
    capColor: "#d8cfc0",
    stemColor: "#c0b8a8",
    height: 0.6,
    count: 5,
  },
  {
    id: "morel",
    commonName: "Yellow Morel",
    scientificName: "Morchella esculenta",
    homes: [{ park: "frick", area: "nine-mile-run" }],
    window: DAWN,
    season: "April to May",
    hook: "A honeycomb on a stalk. Two weeks a year.",
    fact: "It looks like nothing else: a hollow, pitted, honeycombed cone the colour of old parchment. It fruits for a fortnight in spring and then it is gone, and people take the week off work for it.",
    roleNote:
      "It often appears where a tree has just died, or where there has been fire. Nobody has quite pinned down why, which is a fair summary of how much we still do not know about fungi.",
    edibility: "choice",
    wikipedia: "https://en.wikipedia.org/wiki/Morchella_esculenta",
    archetype: "morel",
    capColor: "#b09a5e",
    stemColor: "#e0d8bc",
    height: 0.55,
    count: 4,
  },
  {
    id: "giant-puffball",
    commonName: "Giant Puffball",
    scientificName: "Calvatia gigantea",
    homes: [{ park: "frick", area: "bowling-green" }],
    window: DAY,
    season: "Late summer to autumn",
    hook: "A white boulder in the grass. Full of spores.",
    fact: "It can reach the size of a beach ball. A large one holds several trillion spores, and if every one of them grew, the resulting mass of fungus would be larger than the planet. Almost none of them do.",
    roleNote:
      "It breaks down organic matter in grassland, and then it hands the whole thing back to the wind.",
    edibility: "edible",
    wikipedia: "https://en.wikipedia.org/wiki/Calvatia_gigantea",
    archetype: "puffball",
    capColor: "#f0ece0",
    stemColor: "#ddd6c4",
    height: 0.5,
    count: 3,
  },
  {
    id: "jack-o-lantern",
    commonName: "Jack-o'-Lantern",
    scientificName: "Omphalotus illudens",
    homes: [{ park: "frick", area: "falls-ravine" }],
    window: NIGHT,
    season: "Late summer to autumn",
    hook: "It glows in the dark. Genuinely.",
    fact: "Bright orange, growing in dense clumps at the base of hardwoods. Its gills are faintly bioluminescent: take one into a dark room, let your eyes adjust for a few minutes, and it gives off a soft green light. Nobody is certain why it bothers.",
    roleNote:
      "It is confidently mistaken for a chanterelle every autumn by people who then have a very bad night. It will not kill you. You will wish it had.",
    edibility: "toxic",
    wikipedia: "https://en.wikipedia.org/wiki/Omphalotus_illudens",
    archetype: "cluster",
    capColor: "#e2802a",
    stemColor: "#d9762a",
    height: 0.6,
    count: 4,
    glows: true,
  },
  {
    id: "dryads-saddle",
    commonName: "Dryad's Saddle",
    scientificName: "Cerioporus squamosus",
    homes: [{ park: "frick", area: "environmental-center" }],
    window: DAY,
    season: "Spring to autumn",
    hook: "Smells of watermelon rind. Really.",
    fact: "A big scaly bracket, patterned like a pheasant's wing. Crush a young one and it smells startlingly of watermelon rind or cucumber, which is not a thing you expect a shelf of fungus on a dead elm to do.",
    roleNote:
      "It rots the heartwood of hardwoods, and its huge brackets are a whole ecosystem in themselves: beetles live in them, and other fungi grow on them.",
    edibility: "edible",
    wikipedia: "https://en.wikipedia.org/wiki/Cerioporus_squamosus",
    archetype: "bracket",
    capColor: "#c9a86a",
    stemColor: "#8a7048",
    height: 0.6,
    count: 4,
  },
  {
    id: "eastern-destroying-angel",
    commonName: "Eastern Destroying Angel",
    scientificName: "Amanita bisporigera",
    homes: [{ park: "frick", area: "fern-hollow" }],
    window: DUSK,
    season: "Summer to autumn",
    hook: "Pure white, and the deadliest thing in the wood.",
    fact: "Entirely white, elegant, and lethal. Half a cap holds enough amatoxin to kill an adult. Worse, you feel fine for a day or so while it quietly destroys your liver, and by the time you feel ill it is far too late.",
    roleNote:
      "It is not malicious. It is mycorrhizal: its threads wrap the roots of oaks and trade water and minerals for sugar, and the wood is healthier for it. Beautiful, useful, and it will kill you.",
    edibility: "deadly",
    wikipedia: "https://en.wikipedia.org/wiki/Amanita_bisporigera",
    archetype: "cap",
    capColor: "#f4f1e8",
    stemColor: "#eae6da",
    height: 0.65,
    count: 3,
  },
];

export const FUNGI_BY_ID = new Map(FUNGI.map((fungus) => [fungus.id, fungus]));

export const EDIBILITY_LABEL: Record<Fungus["edibility"], string> = {
  choice: "Choice edible",
  edible: "Edible",
  inedible: "Inedible",
  toxic: "Toxic",
  deadly: "Deadly",
};
