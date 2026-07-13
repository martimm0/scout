/**
 * Three questions per species.
 *
 * Hand written, not generated. A question assembled automatically from the data
 * ("which area is this found in?") tests whether you read a label. These test
 * whether you read the fact, and the wrong answers are chosen to be plausible,
 * because an obviously silly wrong answer teaches nothing either.
 *
 * The explanation shown afterwards matters as much as the question. Getting one
 * wrong should still leave you knowing the thing.
 */

export type Question = {
  ask: string;
  options: string[];
  /** Index into options. */
  answer: number;
  /** Shown after answering, right or wrong. */
  because: string;
};

export const TRIVIA: Record<string, Question[]> = {
  "common-milkweed": [
    {
      ask: "Milkweed does not dust a bee with loose pollen. What does it do instead?",
      options: [
        "Clips waxy saddlebags onto the bee's foot",
        "Sprays pollen when the flower is touched",
        "Coats the bee in sticky nectar first",
        "Releases pollen only at night",
      ],
      answer: 0,
      because:
        "The pollen comes in waxy packets called pollinia. A slot in the flower clips a pair onto a visiting bee's leg, and a small bee sometimes cannot pull free.",
    },
    {
      ask: "Which caterpillar can eat nothing but milkweed?",
      options: ["The monarch", "The swallowtail", "The luna moth", "The cabbage white"],
      answer: 0,
      because:
        "Monarch caterpillars eat milkweed and only milkweed. No milkweed, no monarchs, which is why people plant it.",
    },
    {
      ask: "What can happen to a small bee visiting a milkweed flower?",
      options: [
        "It can get stuck and be unable to pull free",
        "It is poisoned by the sap",
        "It is trapped overnight inside the flower",
        "Nothing unusual happens",
      ],
      answer: 0,
      because:
        "The pollinia clip on hard. It is a real hazard for a small insect, and you do sometimes find one that did not get away.",
    },
  ],

  "canada-goldenrod": [
    {
      ask: "Goldenrod is blamed every autumn for hay fever. Is that fair?",
      options: [
        "No. Its pollen is too heavy to blow around",
        "Yes. It sheds huge amounts of pollen",
        "Only in years when it flowers early",
        "Only for people already allergic to bees",
      ],
      answer: 0,
      because:
        "Goldenrod pollen is heavy and sticky and travels on insects, not wind. Ragweed flowers at the same time and is the real culprit, but it is drab and nobody notices it.",
    },
    {
      ask: "So how does goldenrod actually move its pollen?",
      options: ["On insects", "On the wind", "By dropping it into water", "It self-pollinates"],
      answer: 0,
      because:
        "Insect-carried, which is exactly why the pollen is heavy and sticky in the first place. Wind-pollinated plants make light, dry pollen by the ton.",
    },
    {
      ask: "Why does goldenrod matter so much in October?",
      options: [
        "It is one of the last big nectar flows before frost",
        "It is the first flower of the season",
        "It is the only plant bees can see in autumn light",
        "Its seeds feed overwintering birds",
      ],
      answer: 0,
      because:
        "It holds the door open at the end of the year, when almost nothing else is flowering and the last bees need to build reserves.",
    },
  ],

  "black-eyed-susan": [
    {
      ask: "What does a bee see on a black-eyed Susan that you cannot?",
      options: [
        "An ultraviolet bullseye at the centre",
        "A pattern of infrared warmth",
        "Polarised light on the petals",
        "A blue rim around each petal",
      ],
      answer: 0,
      because:
        "Bees see ultraviolet. To them the middle of the flower carries a dark bullseye, pointing straight at the nectar. To us it is a plain yellow daisy.",
    },
    {
      ask: "What is the bullseye for?",
      options: [
        "A landing target aimed at the nectar",
        "A warning to other insects",
        "Camouflage against birds",
        "Nothing. It is a side effect of the pigment",
      ],
      answer: 0,
      because:
        "It is a runway. The flower is advertising, and it is advertising in a channel we cannot read.",
    },
    {
      ask: "Which part of the colour spectrum can bees see that humans cannot?",
      options: ["Ultraviolet", "Infrared", "Deep red", "X-ray"],
      answer: 0,
      because:
        "Bees see into the ultraviolet and are nearly blind to red, which is roughly the opposite of us. A red flower is usually courting a bird.",
    },
  ],

  "purple-coneflower": [
    {
      ask: "That raised orange cone in the middle. What is it?",
      options: [
        "Hundreds of tiny individual flowers",
        "A seed head that has already been pollinated",
        "A nectar reservoir",
        "A landing pad made of fused petals",
      ],
      answer: 0,
      because:
        "The cone is hundreds of florets, opening in a slow ring from the outside in. A bee can work the same cone for days as new ones open.",
    },
    {
      ask: "What are the drooping petals for?",
      options: [
        "A landing pad",
        "Shedding rain away from the pollen",
        "Warning colour",
        "Shading the seeds",
      ],
      answer: 0,
      because:
        "Petals to land on, cone to feed from. The whole flower is arranged around getting an insect to stand in the right place.",
    },
    {
      ask: "Why can one coneflower be visited for days on end?",
      options: [
        "Its florets open a few at a time",
        "It refills its nectar every hour",
        "It flowers for a fortnight then dies",
        "Bees mark it and return to it",
      ],
      answer: 0,
      because:
        "Opening in sequence rather than all at once is a good strategy: it keeps the flower worth revisiting instead of being stripped in a morning.",
    },
  ],

  "white-trillium": [
    {
      ask: "How long does a trillium take to get from seed to its first flower?",
      options: ["About seven years", "One season", "About two years", "Twenty years or more"],
      answer: 0,
      because:
        "Roughly seven years. Which is why picking one is close to killing it: you have removed something that took most of a decade to build.",
    },
    {
      ask: "How do trillium seeds get around?",
      options: [
        "Ants carry them off",
        "Wind blows them",
        "Birds eat and drop them",
        "They roll downhill",
      ],
      answer: 0,
      because:
        "Ants. The seed carries a fatty parcel the ants want, so they haul it home, eat the snack, and discard the seed underground. Free planting and free burial.",
    },
    {
      ask: "Everything about a trillium comes in threes. Which of these is NOT one of them?",
      options: ["Three roots", "Three leaves", "Three petals", "Three sepals"],
      answer: 0,
      because:
        "Leaves, petals and sepals, all in threes. The name is not subtle.",
    },
  ],

  "trout-lily": [
    {
      ask: "Where does the trout lily get its name?",
      options: [
        "Its leaves are mottled like a brook trout",
        "It grows only beside streams",
        "Its flowers smell of fish",
        "Trout spawn when it blooms",
      ],
      answer: 0,
      because:
        "The mottled leaves look like the flank of a brook trout. It is one of the better common names in the wood.",
    },
    {
      ask: "How old can a colony of trout lilies be?",
      options: [
        "A century or more",
        "Around ten years",
        "One or two seasons",
        "About thirty years",
      ],
      answer: 0,
      because:
        "Some patches are estimated at a century or more, which can make them older than the trees standing over them.",
    },
    {
      ask: "Trout lily is a spring ephemeral. What does that mean?",
      options: [
        "It flowers and vanishes before the trees leaf out",
        "It flowers only after a warm winter",
        "It lives for a single year",
        "It flowers at night",
      ],
      answer: 0,
      because:
        "It gets its whole year done in the few weeks of sunlight before the canopy closes over it. Then it disappears entirely until next spring.",
    },
  ],

  jewelweed: [
    {
      ask: "Why is jewelweed also called touch-me-not?",
      options: [
        "Its ripe seed pods explode when brushed",
        "Its sap burns the skin",
        "Its leaves fold shut when touched",
        "It is covered in fine spines",
      ],
      answer: 0,
      because:
        "Brush a ripe pod and it snaps apart in your hand, flinging seeds a metre. It is the single most satisfying thing in the ravine in September.",
    },
    {
      ask: "Jewelweed tends to grow right next to which other plant?",
      options: ["Poison ivy", "Japanese knotweed", "Skunk cabbage", "Garlic mustard"],
      answer: 0,
      because:
        "It very often grows where poison ivy does, and its crushed stem is an old folk remedy for the rash. Whether it works is argued about; that it is right there is not.",
    },
    {
      ask: "Who does jewelweed's orange, spurred flower suit?",
      options: [
        "Hummingbirds and long-tongued bees",
        "Beetles",
        "Wind",
        "Ants",
      ],
      answer: 0,
      because:
        "The nectar is at the end of a long curled spur. You need a long tongue or a long beak, and short-tongued insects simply cannot reach it.",
    },
  ],

  "cardinal-flower": [
    {
      ask: "Cardinal flower is an impossible red. Who is that colour for?",
      options: [
        "Hummingbirds",
        "Bees",
        "Butterflies",
        "It is a warning to grazing animals",
      ],
      answer: 0,
      because:
        "Birds see red beautifully. Bees barely see it at all. A red tubular flower is almost always advertising to a hummingbird.",
    },
    {
      ask: "Why do most bees do badly at a cardinal flower?",
      options: [
        "They cannot reach the nectar and can barely see the colour",
        "The nectar is toxic to them",
        "It only opens at night",
        "The petals are too slippery to land on",
      ],
      answer: 0,
      because:
        "It is built end to end for a hummingbird: a long tube, and a colour bees are nearly blind to. It is not interested in you.",
    },
    {
      ask: "Where in the park would you look for one?",
      options: [
        "At the water's edge along Nine Mile Run",
        "On the dry sunny slope by the playground",
        "In deep shade under the canopy",
        "On the mown bowling green",
      ],
      answer: 0,
      because:
        "Wet feet. It wants the creek bank, and it is worth the walk down for it.",
    },
  ],

  "wild-bergamot": [
    {
      ask: "Crush a wild bergamot leaf. What does it smell of?",
      options: ["Earl Grey tea", "Lemon", "Aniseed", "Nothing at all"],
      answer: 0,
      because:
        "Startlingly of Earl Grey. It is a mint, and the bergamot in Earl Grey is a different plant entirely, but the smell is uncannily close.",
    },
    {
      ask: "How does a short-tongued bee get at nectar it cannot reach?",
      options: [
        "It chews a hole in the side of the tube",
        "It waits for rain to dilute it",
        "It cannot, and goes elsewhere",
        "It steals it from a longer-tongued bee",
      ],
      answer: 0,
      because:
        "Nectar robbing. It bites straight through the side of the flower, takes the nectar, and pollinates nothing. The flower gets robbed and gains nothing at all.",
    },
    {
      ask: "Which family does wild bergamot belong to?",
      options: ["The mints", "The daisies", "The lilies", "The peas"],
      answer: 0,
      because:
        "A mint, which you can tell from the square stem and the smell, if not from the ragged lavender crown of a flower.",
    },
  ],

  "new-england-aster": [
    {
      ask: "Why does a late-flowering aster matter so much?",
      options: [
        "It fuels migrating monarchs and the last bumblebee queens",
        "It is the only flower deer will not eat",
        "Its seeds feed birds through winter",
        "It shelters insects from the first frosts",
      ],
      answer: 0,
      because:
        "It opens as everything else shuts down. Migrating monarchs and the queens who must survive the winter are both running on it.",
    },
    {
      ask: "Which bumblebees survive a Pennsylvania winter?",
      options: [
        "Only the new queens",
        "The whole colony, underground",
        "The workers, in the leaf litter",
        "None. They are re-colonised each spring from the south",
      ],
      answer: 0,
      because:
        "Only the new queens, each alone underground. Everything else you see flying in August is dead by November.",
    },
    {
      ask: "When does New England aster flower?",
      options: ["August to October", "March to May", "June to July", "All year"],
      answer: 0,
      because:
        "Late. That is its whole strategy: arrive when the competition has gone home.",
    },
  ],

  "virginia-bluebell": [
    {
      ask: "Virginia bluebell buds open pink and then turn blue. Why?",
      options: [
        "The flower's own chemistry shifts as it ages",
        "The blue ones are older flowers of a different plant",
        "Pollination changes the colour",
        "Sunlight bleaches the pink out",
      ],
      answer: 0,
      because:
        "The pigment changes with the acidity inside the petal. A colony in April is pink and blue at once, which is why it looks like spilled sky.",
    },
    {
      ask: "Who does most of the work pollinating a bluebell?",
      options: [
        "Bumblebees and early butterflies",
        "Beetles",
        "Wind",
        "Hummingbirds",
      ],
      answer: 0,
      because:
        "The tube is long, so it takes something with reach. Early bumblebee queens, out hungry in April, are the main visitors.",
    },
    {
      ask: "When would you go looking for bluebells?",
      options: [
        "Morning, in spring",
        "Afternoon, in high summer",
        "After dark, in autumn",
        "Any time. They are out all year",
      ],
      answer: 0,
      because:
        "A spring ephemeral, and like the others it opens with the sun and closes by mid-afternoon.",
    },
  ],

  mayapple: [
    {
      ask: "Where is a mayapple's flower?",
      options: [
        "Hidden underneath the leaves",
        "Held above the leaves on a stalk",
        "At the base of the stem, at ground level",
        "It has no flower",
      ],
      answer: 0,
      because:
        "Underneath the umbrella. You will never see it unless you crouch down and look up, and a bumblebee has to push in under the leaves to find it.",
    },
    {
      ask: "Who eats the mayapple's fruit?",
      options: ["Box turtles", "Deer", "Crows", "Nothing. It is toxic to everything"],
      answer: 0,
      because:
        "Box turtles, mainly, and they carry the seeds off. Most of the plant is genuinely poisonous, but the ripe fruit is not.",
    },
    {
      ask: "What does a colony of mayapple look like from above?",
      options: [
        "A crowd of little green umbrellas",
        "A carpet of white flowers",
        "A mat of red-veined leaves",
        "A stand of tall green spikes",
      ],
      answer: 0,
      because:
        "Umbrellas, all the way across the woodland floor. It is one of the most recognisable things in the wood in May.",
    },
  ],

  "wild-geranium": [
    {
      ask: "What are the dark lines running into the centre of a geranium petal?",
      options: [
        "Nectar guides, pointing at the nectar",
        "Veins carrying water",
        "Damage from insects",
        "The plant's way of shedding rain",
      ],
      answer: 0,
      because:
        "A runway, painted on the flower. The plant is telling a bee exactly where to go, because a bee that wanders is a bee that does not pollinate.",
    },
    {
      ask: "Nectar guides are a form of what?",
      options: [
        "Advertising",
        "Camouflage",
        "Defence",
        "Waste, with no function",
      ],
      answer: 0,
      because:
        "Advertising. The flower is spending real energy to be findable, because the alternative is not being visited at all.",
    },
    {
      ask: "When is wild geranium open?",
      options: [
        "Morning, closing by mid-afternoon",
        "Only after dark",
        "Around the clock",
        "Only when it rains",
      ],
      answer: 0,
      because:
        "A woodland spring flower. It gets its business done in the morning light and shuts.",
    },
  ],

  "joe-pye-weed": [
    {
      ask: "How tall does Joe-Pye weed grow?",
      options: ["Head high or more", "Ankle high", "Knee high", "It is a low creeper"],
      answer: 0,
      because:
        "Head high on damp ground, holding up great dusty domes of flower. In August the whole thing is moving with insects.",
    },
    {
      ask: "What is Joe-Pye weed best known for attracting?",
      options: ["Butterflies", "Hummingbirds", "Beetles", "Moths"],
      answer: 0,
      because:
        "It is one of the best butterfly plants in the park, full stop. Stand near one in late summer and you will not need convincing.",
    },
    {
      ask: "What kind of ground does it want?",
      options: ["Damp", "Bone dry", "Deep shade", "Bare rock"],
      answer: 0,
      because:
        "Wet feet. Which is why it is down in the valley by the creek rather than up on the ridge.",
    },
  ],

  spicebush: [
    {
      ask: "When does spicebush flower?",
      options: [
        "Before it grows any leaves",
        "In midsummer, once fully leafed",
        "In autumn, as the leaves fall",
        "It flowers under the snow",
      ],
      answer: 0,
      because:
        "A haze of tiny yellow-green flowers on bare grey twigs in early spring. It does not wait for leaves.",
    },
    {
      ask: "The spicebush swallowtail caterpillar disguises itself as what?",
      options: ["A small snake", "A bird dropping", "A dead leaf", "A wasp"],
      answer: 0,
      because:
        "A snake, complete with fake eyespots. It is one of the best pieces of mimicry in the eastern woods and it is living on this shrub.",
    },
    {
      ask: "Snap a spicebush twig. What happens?",
      options: [
        "It smells sharp and citrusy",
        "It bleeds a milky sap",
        "It smells of almonds",
        "Nothing at all",
      ],
      answer: 0,
      because:
        "Sharply, cleanly citrus. The name is honest.",
    },
  ],

  "eastern-redbud": [
    {
      ask: "Where do a redbud's flowers grow from?",
      options: [
        "Straight out of the trunk and bare branches",
        "From the tips of new twigs",
        "From the base of the leaves",
        "Underground, at the roots",
      ],
      answer: 0,
      because:
        "Cauliflory: flowers erupting directly from old wood. For two weeks the whole trunk is magenta, and then it goes green and you forget it is there.",
    },
    {
      ask: "Why does a redbud matter to a bumblebee queen?",
      options: [
        "It is one of the first serious nectar sources of spring",
        "It is the only tree she will nest in",
        "Its leaves feed her larvae",
        "It flowers late, after everything else",
      ],
      answer: 0,
      because:
        "It arrives exactly when queens wake up starving, having burned through everything they had over the winter. Timing is the whole gift.",
    },
    {
      ask: "What is the botanical name for flowers growing from a trunk?",
      options: ["Cauliflory", "Cleistogamy", "Corymb", "Chlorosis"],
      answer: 0,
      because:
        "Cauliflory. Most famously it is how cocoa pods grow, which is a strange thing to have in common with a Pittsburgh street tree.",
    },
  ],

  // --- Fungi ---

  "turkey-tail": [
    {
      ask: "Turkey tail is a white-rot fungus. What does that mean it can eat?",
      options: [
        "Lignin, the compound that makes wood woody",
        "Only the sugars in sap",
        "Insects trapped in the bark",
        "The tree's leaves",
      ],
      answer: 0,
      because:
        "Lignin, which almost nothing else on the planet can digest. Without white-rot fungi, dead trees would simply pile up and never go away.",
    },
    {
      ask: "Why are no two turkey tail colonies quite the same colour?",
      options: [
        "The banding varies from colony to colony",
        "They change colour with the season",
        "The colour depends on the tree species",
        "Only the young ones have colour",
      ],
      answer: 0,
      because:
        "The concentric bands vary enormously. The scientific name, versicolor, means exactly that.",
    },
    {
      ask: "Turkey tail is unusual among fungi in medicine. Why?",
      options: [
        "A compound from it is a licensed cancer therapy in Japan",
        "It is the source of penicillin",
        "It is used to treat wounds directly",
        "It has no medical use at all",
      ],
      answer: 0,
      because:
        "It is among the most studied fungi in the world, and a compound derived from it is licensed as an adjunct cancer therapy in Japan.",
    },
  ],

  "chicken-of-the-woods": [
    {
      ask: "Chicken of the woods is a brown-rot fungus. What does it do to a tree?",
      options: [
        "Hollows out the heartwood from the inside",
        "Kills the leaves first",
        "Strangles the roots",
        "Feeds on the bark only",
      ],
      answer: 0,
      because:
        "It eats the heartwood, and the tree can stand for years with almost nothing left in the middle of it. Then a storm comes.",
    },
    {
      ask: "Why is it called chicken of the woods?",
      options: [
        "It genuinely tastes like chicken",
        "Chickens eat it",
        "Its shelves look like folded wings",
        "It grows where chickens are kept",
      ],
      answer: 0,
      because:
        "It really does. Which is why every forager in Pennsylvania knows exactly where their tree is and will tell you nothing.",
    },
    {
      ask: "How big can it get?",
      options: [
        "Heavier than a person",
        "About the size of a fist",
        "Never more than a few grams",
        "About the size of a dinner plate",
      ],
      answer: 0,
      because:
        "Vast overlapping shelves of sulphur orange, sometimes weighing more than the person carrying them out of the wood.",
    },
  ],

  "oyster-mushroom": [
    {
      ask: "The oyster mushroom does something almost no other fungus does. What?",
      options: [
        "It hunts and eats nematode worms",
        "It photosynthesises",
        "It flowers",
        "It moves through the soil",
      ],
      answer: 0,
      because:
        "It is carnivorous. Its threads paralyse nematodes in the wood and digest them, which is not a thing most people expect of a mushroom on a log.",
    },
    {
      ask: "Why would a wood-eating fungus need to eat animals?",
      options: [
        "Rotting wood has almost no nitrogen",
        "It needs the salt",
        "It is competing with the worms for space",
        "It does not need to. It is opportunistic",
      ],
      answer: 0,
      because:
        "Wood is carbon and very little else. Nitrogen has to come from somewhere, and worms are made of it.",
    },
    {
      ask: "What is the honest lesson of the carnivorous oyster mushroom?",
      options: [
        "Fungi are not plants",
        "Fungi are animals",
        "All mushrooms are predators",
        "Wood is more nutritious than it looks",
      ],
      answer: 0,
      because:
        "Fungi are a kingdom of their own, and genetically they are closer to you than they are to a tree.",
    },
  ],

  morel: [
    {
      ask: "How long is morel season?",
      options: [
        "About a fortnight",
        "All summer",
        "Three months in autumn",
        "All year round",
      ],
      answer: 0,
      because:
        "A couple of weeks in spring and then it is gone. People genuinely take the week off work.",
    },
    {
      ask: "Where do morels often appear?",
      options: [
        "Where a tree has just died, or where there has been fire",
        "In deep permanent shade",
        "Only on living oaks",
        "In standing water",
      ],
      answer: 0,
      because:
        "Death and fire, and nobody has quite pinned down why. Which is a fair summary of how much we still do not know about fungi.",
    },
    {
      ask: "What does a morel look like?",
      options: [
        "A hollow, pitted honeycomb on a stalk",
        "A smooth white ball",
        "A flat orange shelf",
        "A red cap with white spots",
      ],
      answer: 0,
      because:
        "It looks like nothing else in the wood, which is exactly why people trust it.",
    },
  ],

  "giant-puffball": [
    {
      ask: "How many spores does a large giant puffball hold?",
      options: [
        "Several trillion",
        "About a thousand",
        "Around a million",
        "A few hundred",
      ],
      answer: 0,
      because:
        "Several trillion. If every one grew, the resulting mass of fungus would be bigger than the planet. Almost none of them do.",
    },
    {
      ask: "How big can a giant puffball get?",
      options: [
        "The size of a beach ball",
        "The size of a golf ball",
        "The size of a car",
        "The size of a grape",
      ],
      answer: 0,
      because:
        "A beach ball, sitting improbably in the grass like something somebody left behind.",
    },
    {
      ask: "What does the arithmetic of trillions of spores actually tell you?",
      options: [
        "That the odds against any one spore are astronomical",
        "That puffballs are extremely common",
        "That most spores land on other puffballs",
        "That the fungus is wasteful and badly adapted",
      ],
      answer: 0,
      because:
        "Producing trillions is not extravagance. It is what it takes when the chance of any single spore finding what it needs is that close to zero.",
    },
  ],

  "jack-o-lantern": [
    {
      ask: "What does the jack-o'-lantern do that no other fungus in the park does?",
      options: [
        "Its gills glow in the dark",
        "It moves toward light",
        "It grows in winter only",
        "It flowers",
      ],
      answer: 0,
      because:
        "Bioluminescence. Take one into a dark room, let your eyes adjust for a few minutes, and it gives off a soft green light. Nobody is certain why it bothers.",
    },
    {
      ask: "The jack-o'-lantern is regularly mistaken for which edible mushroom?",
      options: ["The chanterelle", "The morel", "The oyster", "The puffball"],
      answer: 0,
      because:
        "Every autumn, by people who then have a very bad night. It will not kill you. You will wish it had.",
    },
    {
      ask: "What colour is the glow?",
      options: ["Soft green", "Orange", "Blue", "Red"],
      answer: 0,
      because:
        "Green, and faint. You have to be properly dark-adapted, which means standing in a black wood for five minutes doing nothing, which is its own reward.",
    },
  ],

  "dryads-saddle": [
    {
      ask: "Crush a young dryad's saddle. What does it smell of?",
      options: ["Watermelon rind", "Almonds", "Rotting fish", "Aniseed"],
      answer: 0,
      because:
        "Watermelon rind, or cucumber. Which is not what you expect from a shelf of fungus on a dead elm.",
    },
    {
      ask: "Its cap is patterned like what?",
      options: [
        "A pheasant's wing",
        "A snake's skin",
        "A honeycomb",
        "Nothing. It is plain white",
      ],
      answer: 0,
      because:
        "Big brown scales in a pattern that genuinely looks like feathering. Its other common name is pheasant back.",
    },
    {
      ask: "What lives in a big dryad's saddle bracket?",
      options: [
        "Beetles, and other fungi",
        "Nothing. It is toxic",
        "Ants, exclusively",
        "Nesting birds",
      ],
      answer: 0,
      because:
        "A bracket is a whole small ecosystem: beetles inside it, other fungi growing on it. It is habitat, not just a mushroom.",
    },
  ],

  "eastern-destroying-angel": [
    {
      ask: "How much destroying angel is enough to kill an adult?",
      options: [
        "Around half a cap",
        "Several whole mushrooms",
        "A kilogram or more",
        "It is not actually lethal",
      ],
      answer: 0,
      because:
        "Half a cap holds enough amatoxin. It is one of the deadliest organisms in North America and it is quietly standing in the leaf litter.",
    },
    {
      ask: "What makes it so much more dangerous than it looks?",
      options: [
        "You feel fine for a day while it destroys your liver",
        "It is easily confused with a puffball",
        "It releases toxic spores into the air",
        "The toxin passes through the skin",
      ],
      answer: 0,
      because:
        "The delay is the killer. By the time you feel ill, the damage is done and it is far too late for the thing that would have saved you.",
    },
    {
      ask: "What does the destroying angel do FOR the wood?",
      options: [
        "It feeds the oaks through their roots",
        "Nothing. It is purely parasitic",
        "It kills competing trees",
        "It poisons grazing deer",
      ],
      answer: 0,
      because:
        "It is mycorrhizal. Its threads wrap the roots of oaks and trade water and minerals for sugar, and the wood is healthier for it. Beautiful, useful, and it will kill you.",
    },
  ],
};

export function triviaFor(id: string): Question[] {
  return TRIVIA[id] ?? [];
}
