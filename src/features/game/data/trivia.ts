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
  "evening-primrose": [
    {
      ask: "What can you actually watch this flower do at dusk?",
      options: [
        "Open, over about a minute",
        "Turn from white to yellow",
        "Fold its leaves up",
        "Pull itself down to the ground",
      ],
      answer: 0,
      because:
        "Almost no flower opens fast enough to see. This one swings open over roughly a minute as the light goes, and often several on the same spike do it within the same half hour.",
    },
    {
      ask: "Why is it pale yellow and scented only after dark?",
      options: [
        "It is addressed to moths",
        "It is addressed to bats",
        "Yellow lasts longer in rain",
        "The scent would attract deer by day",
      ],
      answer: 0,
      because:
        "Colour is close to useless at night, so a night flower goes pale and pays for scent instead. Spending on a smell nobody is awake to follow would be waste, so it holds it until dusk.",
    },
    {
      ask: "How long does one of its flowers last?",
      options: [
        "Less than a day",
        "About a week",
        "The whole summer",
        "Until it is pollinated, however long that takes",
      ],
      answer: 0,
      because:
        "Open at dusk, finished by the following midday. The plant makes its display new every evening rather than maintaining one.",
    },
  ],
  jimsonweed: [
    {
      ask: "What shape is a jimsonweed flower, and why?",
      options: [
        "A long trumpet, for a hawk moth's tongue",
        "A flat landing pad, for beetles",
        "A tight tube, for hummingbirds",
        "A hanging bell, for bats",
      ],
      answer: 0,
      because:
        "A trumpet the length of a hand, white or washed with violet, open at night. Almost nothing can reach the bottom of it, which is the point: a hawk moth can, and hovers at it like a hummingbird.",
    },
    {
      ask: "How poisonous is it?",
      options: [
        "Very, and unpredictably so",
        "Mildly, and only the seeds",
        "Only if eaten in quantity",
        "Not at all, despite the reputation",
      ],
      answer: 0,
      because:
        "Every part of it, and the dangerous part is the variability: the alkaloid content differs hugely between plants, seasons and even parts of one plant. That is what kills people who believed they knew the dose.",
    },
    {
      ask: "When are its flowers open?",
      options: [
        "At night",
        "Only in full midday sun",
        "All the time",
        "Only after rain",
      ],
      answer: 0,
      because:
        "They open at dusk and are done by morning, which is why almost everyone who knows the plant knows it by its spiny seed pods instead.",
    },
  ],
  "night-flowering-catchfly": [
    {
      ask: "Why is it easy to walk straight past in daylight?",
      options: [
        "Its petals roll up into thin twists",
        "It grows flat against the ground",
        "The flowers close underground",
        "It has no flowers until autumn",
      ],
      answer: 0,
      because:
        "The petals roll up lengthwise by day and the whole plant reads as a weedy nothing. After dark they open out, white or washed with pink, and start to smell.",
    },
    {
      ask: "What is the catchfly name about?",
      options: [
        "Sticky hairs on the stems",
        "A trap that closes on insects",
        "A smell like rotting meat",
        "Flowers that shut on visitors",
      ],
      answer: 0,
      because:
        "The stems are sticky enough that small insects get caught. It is not a carnivorous plant and gains no food from them: the leading explanation is that it keeps crawlers off the nectar it is saving for moths.",
    },
    {
      ask: "Pale, night-scented and tubular. What does that combination say?",
      options: [
        "A moth flower",
        "A beetle flower",
        "A wind-pollinated flower",
        "A flower that has given up on pollinators",
      ],
      answer: 0,
      because:
        "Those three together are the classic moth syndrome. Pale to be seen without colour vision, scented to be found in the dark, and tubular to be reachable only by a long tongue.",
    },
  ],
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

  // --- Schenley Park ---

  pickerelweed: [
    {
      ask: "Pickerelweed is tristylous. How many builds of the flower are there?",
      options: ["One", "Two", "Three", "Six"],
      answer: 2,
      because:
        "Three. Every plant has its style long, medium or short, with the anthers set at the two heights it is not.",
    },
    {
      ask: "What is all that arrangement actually for?",
      options: [
        "It stops the plant fertilising itself",
        "It makes the flower harder to rob",
        "It spreads the flowering over three months",
        "It attracts three different species of bee",
      ],
      answer: 0,
      because:
        "A flower can only really pollinate one of the other two builds. It is an elaborate, and very effective, way of refusing to fertilise itself.",
    },
    {
      ask: "How does a bumblebee work a pickerelweed spike?",
      options: [
        "It hovers without landing",
        "From the bottom up",
        "It chews in through the side",
        "From the top down",
      ],
      answer: 1,
      because:
        "Bottom to top, every time. Which means the pollen ends up on the bee at exactly the height the next build needs it.",
    },
  ],

  buttonbush: [
    {
      ask: "What shape is a buttonbush flower head?",
      options: [
        "A flat plate",
        "A narrow spike",
        "A perfect sphere",
        "A drooping tassel",
      ],
      answer: 2,
      because:
        "A flawless white sphere with the styles shooting out of it in every direction. It looks like a firework caught halfway.",
    },
    {
      ask: "The lake rises and floods a buttonbush for weeks. What happens to it?",
      options: [
        "Very little. It does not mind",
        "It drowns within days",
        "It drops its flowers and reflowers later",
        "It goes dormant until the water falls",
      ],
      answer: 0,
      because:
        "It grows with its feet in the water and tolerates being flooded outright. That is why it is the shrub standing at the very edge and nothing else is.",
    },
    {
      ask: "Who works a flowering buttonbush?",
      options: [
        "Only long-tongued bees",
        "Only beetles",
        "Only night-flying moths",
        "Nearly everything: bees, wasps, swallowtails, even hummingbirds",
      ],
      answer: 3,
      because:
        "It is the busiest shrub on the lake edge. Hundreds of small flowers packed into a ball, and almost anything can get a meal out of it.",
    },
  ],

  "swamp-milkweed": [
    {
      ask: "How does swamp milkweed get its pollen onto a bee?",
      options: [
        "As loose dust on her back",
        "In waxy saddlebags clipped onto her foot",
        "On the wind",
        "It does not. It self-pollinates",
      ],
      answer: 1,
      because:
        "The same trick as common milkweed: pollen in waxy packets, clipped on by a slot in the flower. Different address, same machinery.",
    },
    {
      ask: "Why does a bird only ever try to eat one monarch?",
      options: [
        "Monarchs are too quick to catch twice",
        "Monarchs sting",
        "The caterpillar eats milkweed and keeps the toxins",
        "Monarchs taste of nothing at all",
      ],
      answer: 2,
      because:
        "The sap is mildly toxic, the caterpillar eats it anyway, and the adult butterfly carries the poison for life. The orange is a warning, and it was earned by eating.",
    },
    {
      ask: "What sets swamp milkweed apart from common milkweed?",
      options: [
        "It has no milky sap",
        "Monarchs will not touch it",
        "It is pollinated by wind",
        "It is rose pink, and it stands in the mud",
      ],
      answer: 3,
      because:
        "A narrower plant with rose-pink flowers, wanting wet feet at the water's edge. The milky sap and the saddlebags are exactly the same.",
    },
  ],

  boneset: [
    {
      ask: "What is odd about the way boneset's leaves meet the stem?",
      options: [
        "The pair is fused, so the stalk seems pushed clean through one leaf",
        "They clasp the stem and can be pulled off in a ring",
        "They grow only on one side of it",
        "There are no leaves on the stem at all",
      ],
      answer: 0,
      because:
        "The leaf pair fuses around the stalk. It genuinely looks as though somebody has run the stem through a single leaf.",
    },
    {
      ask: "Where does the name boneset come from?",
      options: [
        "Its stems are as hard and hollow as bone",
        "The fused leaf suggested a plant for knitting things back together",
        "The roots are bone white",
        "It grows on old graveyards",
      ],
      answer: 1,
      because:
        "Colonial doctors read that fused leaf as a sign, and dosed people with it for a fever so vicious it was called breakbone fever. The name stuck. The medicine did not.",
    },
    {
      ask: "Which crowd does boneset feed that a deep, tubed flower shuts out?",
      options: [
        "Hummingbirds",
        "Hawkmoths",
        "Long-tongued bumblebees",
        "Small bees, flies, wasps and beetles",
      ],
      answer: 3,
      because:
        "The florets are shallow and open, so a short tongue is no handicap. A deep flower is exclusive. Boneset is not.",
    },
  ],

  "blue-vervain": [
    {
      ask: "A blue vervain spike flowers in a thin ring of violet. What is below the ring?",
      options: [
        "Buds, still waiting to open",
        "Seed. Those flowers have already finished",
        "Bare stem",
        "Leaves",
      ],
      answer: 1,
      because:
        "Below the ring is done and setting seed. Above it is still waiting. Only the band itself is open for business.",
    },
    {
      ask: "Which way does the ring travel?",
      options: [
        "Upward, over weeks",
        "Downward, over weeks",
        "In a spiral around the spike",
        "It does not move",
      ],
      answer: 0,
      because:
        "It starts at the bottom and creeps up the spike over weeks, so one plant stays worth visiting for most of the summer.",
    },
    {
      ask: "What does the ring do for a bee?",
      options: [
        "It hides the nectar from robbers",
        "Nothing. Bees cannot see violet",
        "It tells her exactly where the open flowers are",
        "It warns her off until the flowers are ready",
      ],
      answer: 2,
      because:
        "It is a moving billboard. She lands on the band and works around it, and wastes no time on the parts of the spike that have nothing left to give.",
    },
  ],

  "mapleleaf-viburnum": [
    {
      ask: "What does mapleleaf viburnum do in October that almost no other native shrub does?",
      options: [
        "It flowers a second time",
        "It holds its leaves all winter",
        "Its leaves turn rose pink",
        "It fruits before it flowers",
      ],
      answer: 2,
      because:
        "Soft rose pink, sometimes nearly lilac, glowing in the understorey after the canopy above it has gone brown.",
    },
    {
      ask: "How would you know one in summer, with no autumn colour to help?",
      options: [
        "Maple-shaped leaves, and flat plates of small white flowers",
        "Long violet spikes",
        "Red trumpet flowers",
        "Needles, and a smell of resin",
      ],
      answer: 0,
      because:
        "The leaf is the giveaway. It looks like a maple, on a shrub that is nothing of the kind, which is the whole of the name.",
    },
    {
      ask: "Who does a flat, shallow plate of flowers suit?",
      options: [
        "Hummingbirds",
        "Hawkmoths",
        "Nobody. It is wind pollinated",
        "Small bees, flies and beetles",
      ],
      answer: 3,
      because:
        "No tube to climb, nowhere to hide the nectar. The small, unglamorous insects that deeper flowers exclude can all feed here.",
    },
  ],

  "white-snakeroot": [
    {
      ask: "White snakeroot killed a great many people without any of them touching it. How?",
      options: [
        "Through the milk of cows that had eaten it",
        "Through wells it grew beside",
        "Through honey made from its nectar",
        "Through smoke, when the fields were burned",
      ],
      answer: 0,
      because:
        "Its toxin passes straight through a cow and into her milk. Whole settlements died of milk sickness before anyone worked out where it was coming from.",
    },
    {
      ask: "Whose mother died of milk sickness?",
      options: [
        "George Washington's",
        "Abraham Lincoln's",
        "Andrew Carnegie's",
        "Mary Schenley's",
      ],
      answer: 1,
      because:
        "Nancy Hanks Lincoln, in 1818, when Abraham was nine. Nobody knew what was killing them, and the plant went on flowering at the edge of the wood.",
    },
    {
      ask: "Why does white snakeroot matter to insects in September?",
      options: [
        "Its seeds feed them through the winter",
        "It is the only plant deer will not touch",
        "It is late nectar, in deep shade, where nothing else is open",
        "It shelters them from the first frosts",
      ],
      answer: 2,
      because:
        "Frothy white clusters lighting the woodland edge when the wood has otherwise shut up shop. Bees, wasps and flies work it hard.",
    },
  ],

  bloodroot: [
    {
      ask: "Break a bloodroot rhizome. What comes out?",
      options: [
        "Clear water",
        "A milky white latex",
        "Nothing at all",
        "A thick orange-red sap",
      ],
      answer: 3,
      because:
        "Orange red, and thick, and startling the first time. Both its names, bloodroot and Sanguinaria, come straight from it.",
    },
    {
      ask: "What does a bloodroot flower offer a bee?",
      options: [
        "Nectar only",
        "Pollen only",
        "Both, and generously",
        "Neither. It is wind pollinated",
      ],
      answer: 1,
      because:
        "No nectar whatsoever. The early bees turn up expecting a drink and leave with the shopping instead.",
    },
    {
      ask: "How long is a bloodroot flower open?",
      options: [
        "All spring",
        "About a month",
        "A day or two",
        "Until the first frost",
      ],
      answer: 2,
      because:
        "It comes up wrapped in its own leaf like a furled umbrella, opens for a day or two, and is gone. Miss the week and you miss the year.",
    },
  ],

  "cutleaf-toothwort": [
    {
      ask: "Cutleaf toothwort is a mustard. What gives it away?",
      options: [
        "A square stem",
        "Milky sap",
        "Four white petals in a cross, and a root that bites like horseradish",
        "Yellow flowers in a flat head",
      ],
      answer: 2,
      because:
        "Four petals in a cross is the family badge, and the knobbly toothed rhizome underneath tastes exactly of horseradish.",
    },
    {
      ask: "Which butterfly lays its eggs on toothwort?",
      options: [
        "The monarch",
        "The spicebush swallowtail",
        "The West Virginia white",
        "The cabbage white",
      ],
      answer: 2,
      because:
        "The West Virginia white, a small pale butterfly of old woodland, and its caterpillars need this plant.",
    },
    {
      ask: "Why is invasive garlic mustard a disaster for that butterfly?",
      options: [
        "It shades toothwort out, and does nothing else",
        "She lays her eggs on it by mistake, and every caterpillar dies",
        "It poisons the adult butterflies outright",
        "It flowers first and takes all the pollinators",
      ],
      answer: 1,
      because:
        "She cannot tell the impostor from the real thing. She lays, the caterpillars hatch, and they cannot survive on it. Every one of those eggs is wasted.",
    },
  ],

  "dutchmans-breeches": [
    {
      ask: "Where is the nectar in a Dutchman's breeches flower?",
      options: [
        "At the base of the stem",
        "On the outside of the petals",
        "Up in the toes of the trousers",
        "There is none",
      ],
      answer: 2,
      because:
        "Right up in the toes of the two little upside-down legs, and the flower is locked shut around it.",
    },
    {
      ask: "Who can actually get into one?",
      options: [
        "Any honeybee",
        "A queen bumblebee",
        "A hoverfly",
        "Nothing. The wind does it",
      ],
      answer: 1,
      because:
        "It takes something strong enough to force the petals apart and long enough in the tongue to reach the toes. Almost nothing else in the wood is invited.",
    },
    {
      ask: "Why would a flower bother locking itself shut at all?",
      options: [
        "To keep warm through a cold night",
        "To keep the rain off its pollen",
        "To stop its petals falling",
        "To save its nectar for a visitor that will actually carry the pollen on",
      ],
      answer: 3,
      because:
        "Nectar handed to an insect too small to reach the pollen is nectar thrown away. Locking the door is a way of choosing your customer.",
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

  "hen-of-the-woods": [
    {
      ask: "Why does a forager guard the location of a hen of the woods oak?",
      options: [
        "It comes back to the same tree year after year, sometimes for twenty",
        "It fruits once, and never again",
        "It is the only edible fungus in the park",
        "It is worth more than the tree it grows on",
      ],
      answer: 0,
      because:
        "Same tree, same week, decade after decade. Find one and you have found it for life, which is why the oaks are kept quiet and handed on like property.",
    },
    {
      ask: "Where would you look for one?",
      options: [
        "High on a dead trunk",
        "Out in open grassland",
        "At the foot of an old oak",
        "On fallen branches, well away from any tree",
      ],
      answer: 2,
      because:
        "A great grey rosette of overlapping fronds sitting at the base of the tree, big enough to fill a rucksack.",
    },
    {
      ask: "What is it doing to the oak?",
      options: [
        "Nothing. It only eats the leaf litter around it",
        "Feeding it, through the roots",
        "Strangling it",
        "Rotting the roots and the base of the trunk",
      ],
      answer: 3,
      because:
        "It is quietly rotting the tree it feeds on, from the roots up. The hen is the bill arriving, decades late.",
    },
  ],

  "artists-conk": [
    {
      ask: "Why is it called artist's conk?",
      options: [
        "Its top is banded with colour, like a painting",
        "Scratch the white underside and it bruises brown, permanently",
        "Artists once boiled it down to make ink",
        "It grows in the shape of a palette",
      ],
      answer: 1,
      because:
        "The chalk-white pore surface bruises wherever you touch it, and the mark never fades. People draw whole landscapes on them with a stick, and the picture keeps for years.",
    },
    {
      ask: "How could you work out the age of one?",
      options: [
        "Weigh it",
        "Measure how far it juts from the trunk",
        "Count its annual layers, like tree rings",
        "You cannot. It fruits once and rots away",
      ],
      answer: 2,
      because:
        "The bracket is perennial and lays down a new layer every year. It keeps its own records, and you can read them.",
    },
    {
      ask: "How many spores can one large conk shed in a single day?",
      options: [
        "A few thousand",
        "About a million",
        "None. This one is sterile",
        "Tens of billions",
      ],
      answer: 3,
      because:
        "Tens of billions a day, all summer long. They settle as a fine rust-brown dust on everything underneath the bracket, and once you know that, you start noticing it.",
    },
  ],

  "ravenels-stinkhorn": [
    {
      ask: "Why does Ravenel's stinkhorn smell so precisely of rotting meat?",
      options: [
        "To warn animals away from it",
        "To attract flies",
        "To repel the insects that would eat it",
        "No reason. It is a by-product of decay",
      ],
      answer: 1,
      because:
        "The smell is an advertisement, and the customers are flies. They come expecting carrion and find a fungus instead.",
    },
    {
      ask: "What do the flies do for it?",
      options: [
        "Eat the slime and carry the spores off in their guts",
        "Pollinate it",
        "Lay eggs whose grubs feed the fungus",
        "Nothing. They get stuck and die",
      ],
      answer: 0,
      because:
        "Every other fungus here trusts its spores to the wind. This one advertises, pays in slime, and has the flies deliver. It is the only pollinator-shaped arrangement in the wood with no plant in it.",
    },
    {
      ask: "What does a stinkhorn come up out of?",
      options: [
        "A hollow log",
        "A woody bracket",
        "A soft gelatinous egg",
        "Nothing. It grows straight off a tree root",
      ],
      answer: 2,
      because:
        "An egg, sitting in the leaf litter, and then several inches of stinkhorn in a few hours. It is one of the fastest-growing things in the park.",
    },
  ],

  "bitter-oyster": [
    {
      ask: "What is foxfire?",
      options: [
        "The autumn colour of a rotting log",
        "A beetle that glows in dead wood",
        "The green light given off by a fungus in the dark",
        "A red bracket fungus of burnt ground",
      ],
      answer: 2,
      because:
        "A steady green glow off the gills, along a fallen branch, in a wood with no other light in it. Soldiers once read letters by it.",
    },
    {
      ask: "What is strange about which bitter oysters glow?",
      options: [
        "Only the young ones glow",
        "Only the North American ones glow. The European ones are dark",
        "Only the ones growing on oak glow",
        "Only the ones fruiting in winter glow",
      ],
      answer: 1,
      because:
        "The same species, on two continents, and only one of them lights up. There is no way to guess it from looking at the mushroom.",
    },
    {
      ask: "Its second name is stipticus. What does that mean?",
      options: [
        "Bitter",
        "Glowing",
        "Stalked",
        "Styptic: it stops bleeding",
      ],
      answer: 3,
      because:
        "Styptic. It was once packed onto wounds to stop them bleeding. The bitterness is real too, and nobody eats it twice.",
    },
  ],

  // --- Highland Park ---

  "great-blue-lobelia": [
    {
      ask: "Great blue lobelia is Lobelia siphilitica. Where did that name come from?",
      options: [
        "The flower is shaped like a medical instrument",
        "A Mohawk remedy was sold to Europe as a syphilis cure, and Linnaeus believed it",
        "It was first found growing outside a hospital",
        "Its sap was used to treat the sores",
      ],
      answer: 1,
      because:
        "The remedy did not work. Linnaeus wrote the claim into the species name anyway, and botanical names do not come off. The plant has been carrying somebody else's mistake ever since.",
    },
    {
      ask: "How does a bumblebee get into a great blue lobelia?",
      options: [
        "She hovers at the mouth and reaches in with her tongue",
        "She chews through the base",
        "She forces in headfirst, and comes out with pollen on her back",
        "She cannot. It is pollinated by hummingbirds",
      ],
      answer: 2,
      because:
        "The tube is long and tight, so she has to shove. The plant loads her back on the way in, which is the point of making her work for it.",
    },
    {
      ask: "Lobelia and cardinal flower are built almost identically. So what is different?",
      options: [
        "The colour, and therefore the customer",
        "The season. One is spring, one is autumn",
        "One has nectar and the other does not",
        "One is a mint and the other is a daisy",
      ],
      answer: 0,
      because:
        "Same shape, different paint. Red is aimed at a hummingbird, blue at a bumblebee. Two sisters advertising to two entirely different species.",
    },
  ],

  "ohio-spiderwort": [
    {
      ask: "What happens to a spiderwort flower in the heat of the afternoon?",
      options: [
        "It closes up tight and opens again tomorrow",
        "It turns from violet to pink",
        "It collapses into a bead of clear jelly",
        "It drops its petals one at a time",
      ],
      answer: 2,
      because:
        "Each flower gets one morning. By the afternoon it does not wilt so much as dissolve: touch one and it goes to a bead of clear jelly on your fingers. There will be a new one tomorrow.",
    },
    {
      ask: "The blue hairs on a spiderwort's stamens turn pink. What makes them?",
      options: [
        "Ionising radiation, or sulphur dioxide",
        "The plant running short of water",
        "Being pollinated",
        "The first frost of the autumn",
      ],
      answer: 0,
      because:
        "The cells mutate and change colour, and they are one of the very few living tissues that work as a bioassay for ambient radiation. Sulphur dioxide from industry does it too, which is a pointed thing for a plant growing in Pittsburgh.",
    },
    {
      ask: "Why do the bees work a spiderwort in the morning and not later?",
      options: [
        "It is too hot for a bee to fly by then",
        "Because by the afternoon the flower is gone",
        "Other bees have taken all the nectar by noon",
        "The flower only smells of anything at dawn",
      ],
      answer: 1,
      because:
        "There is nothing to come back to. The Xerces Society rates it as being of special value to native bees and bumblebees, and they collect it while it is there, which is one morning.",
    },
  ],

  "heal-all": [
    {
      ask: "You mow a lawn full of heal-all every fortnight. What does it do?",
      options: [
        "It dies out within a season",
        "It stops flowering and spreads by root instead",
        "It flowers again at two inches instead of twelve",
        "It goes dormant until autumn",
      ],
      answer: 2,
      because:
        "It just blooms shorter, hugging the ground under the blades. It has worked out how to live on a mown lawn, which almost nothing else has.",
    },
    {
      ask: "Which family does heal-all belong to?",
      options: ["The mints", "The daisies", "The mustards", "The peas"],
      answer: 0,
      because:
        "A mint, hooded violet flowers and all. The square stem gives it away if the shape does not.",
    },
    {
      ask: "The violet flowers come out of what?",
      options: [
        "A flat plate, like an elder",
        "A squat purple cone that looks like a small pineapple",
        "A drooping tassel",
        "A single bare stalk",
      ],
      answer: 1,
      because:
        "A stubby purple cone, and the hooded flowers push out of it a few at a time. On a mown Pittsburgh lawn half the bees are working this and nothing else.",
    },
  ],

  "virginia-waterleaf": [
    {
      ask: "The young leaves look water-stained. What is actually going on?",
      options: [
        "It is a fungus growing in the leaf",
        "The plant is drought-stressed",
        "Rain really does bleach the leaf",
        "The pale blotches are the plant's own markings, and they fade",
      ],
      answer: 3,
      because:
        "Nothing is wrong with it. The blotches are simply how the young leaves come up, they fade as the season goes on, and the whole name rests on the resemblance.",
    },
    {
      ask: "What is odd about waterleaf's stamens?",
      options: [
        "They shoot well out past the petals, like a fistful of pins",
        "They are hidden deep in the tube",
        "There are only two of them",
        "They open only after dark",
      ],
      answer: 0,
      because:
        "Well clear of the flower. They dust the underside of a bumblebee that never quite has to land, which saves her the trouble of climbing in.",
    },
    {
      ask: "When would you find waterleaf flowering on the slope?",
      options: ["August to October", "May to June", "March, before anything else", "All summer"],
      answer: 1,
      because:
        "Late spring, and it is one of the better nectar plants on a wooded slope while it lasts.",
    },
  ],

  "wild-columbine": [
    {
      ask: "Wild columbine opens at a very particular moment. Which?",
      options: [
        "The first frost",
        "The night the canopy closes",
        "When the ruby-throated hummingbirds get back to Pennsylvania",
        "The peak of the monarch migration",
      ],
      answer: 2,
      because:
        "Five red horns hanging upside down with the nectar sealed in the tips, opening exactly as the birds arrive. The timing is not a coincidence.",
    },
    {
      ask: "A bumblebee cannot reach the tip of the spur. What does she do?",
      options: [
        "She gives up and works something else",
        "She waits for a hummingbird to open it",
        "She reaches in from the mouth and gets a little",
        "She chews through the side of the spur and drinks",
      ],
      answer: 3,
      because:
        "Nectar robbing. She takes the drink without going anywhere near the pollen, and the plant gets nothing at all for it.",
    },
    {
      ask: "Why does columbine grow out of cracks in bare rock?",
      options: [
        "It cannot root in soil",
        "That is where the competition is not",
        "The rock keeps its roots warm",
        "Hummingbirds will not visit anything at ground level",
      ],
      answer: 1,
      because:
        "A crack in a cliff is a bad address that nothing else wants, which makes it a very good address indeed if you can survive there.",
    },
  ],

  pawpaw: [
    {
      ask: "A pawpaw flower is maroon, hangs upside down, and smells faintly of rotting meat. Why?",
      options: [
        "To warn deer off the young fruit",
        "Because bees are not the customer. It wants carrion flies and beetles",
        "It is a by-product of the fruit ripening",
        "To keep other trees from growing near it",
      ],
      answer: 1,
      because:
        "The smell is an advertisement, and it is aimed at flies and beetles that expect to find a corpse. They find a flower instead.",
    },
    {
      ask: "What is a pawpaw, exactly?",
      options: [
        "An escaped tropical fruit tree",
        "A wild relative of the banana",
        "The largest edible fruit native to North America",
        "An imported ornamental with inedible fruit",
      ],
      answer: 2,
      because:
        "Native, and the biggest edible fruit on the continent. It tastes roughly like a mango that has been talked into being a banana, and it grows wild on the Allegheny flats.",
    },
    {
      ask: "Pawpaw growers often hand-pollinate with a paintbrush. Why bother?",
      options: [
        "It is bad at attracting its own pollinators, and fruit set is poor",
        "The flowers open for only one hour",
        "Its pollinators are extinct",
        "It cannot pollinate itself at all without help",
      ],
      answer: 0,
      because:
        "The carrion trick works, but badly. Too few flies turn up, so growers do the job themselves rather than wait on an advertisement nobody is answering.",
    },
  ],

  wingstem: [
    {
      ask: "Run a thumb up a wingstem stalk. What do you feel?",
      options: [
        "Stiff downward-pointing hairs",
        "Thin flanges of green tissue running down it",
        "A perfectly square stem",
        "Milky sap on your thumb",
      ],
      answer: 1,
      because:
        "Wings, running down the stalk. You can feel them, which is the whole of the name and one of the easier identifications on the flats.",
    },
    {
      ask: "Why does wingstem matter on the river flats in September?",
      options: [
        "Its seeds feed birds through the winter",
        "It shades out invasive plants",
        "It is enormous quantities of late nectar, when little else is open",
        "It is the only plant deer will not eat",
      ],
      answer: 2,
      because:
        "Head high and then some, flowering hard when the floodplain has otherwise finished. Late nectar is worth more than early nectar, because there is less of it.",
    },
    {
      ask: "Which butterfly lays its eggs on wingstem?",
      options: [
        "The silvery checkerspot",
        "The monarch",
        "The zebra swallowtail",
        "The West Virginia white",
      ],
      answer: 0,
      because:
        "The silvery checkerspot, on the leaves. The flowers feed the adults and the leaves feed the caterpillars, which is a plant doing two jobs at once.",
    },
  ],

  "common-elderberry": [
    {
      ask: "Elderberry has been wine and syrup and pie for centuries. What is the catch?",
      options: [
        "The fruit only ripens every second year",
        "Raw, the stems and leaves carry compounds that release cyanide",
        "The berries are safe but the flowers are not",
        "There is no catch. All of it is edible raw",
      ],
      answer: 1,
      because:
        "Cooking is not a preference here, it is the point. The same shrub is dinner or a bad mistake depending entirely on whether you heated it.",
    },
    {
      ask: "Who gets fed by a flat, wide-open plate of elder flowers?",
      options: [
        "Only long-tongued bumblebees",
        "Hummingbirds",
        "The flies, small bees and beetles that cannot manage a deep flower",
        "Night-flying moths, exclusively",
      ],
      answer: 2,
      because:
        "Nothing to climb into and nowhere to hide the nectar. A deep flower is a private club. This is a canteen.",
    },
    {
      ask: "The fruit ripens near black in September. How long does it last?",
      options: [
        "Days. The birds strip it almost at once",
        "All winter. Nothing will touch it",
        "Until the first hard frost",
        "A month or so, until it drops",
      ],
      answer: 0,
      because:
        "Days, and the birds do not leave much. If you want elderberries you are competing with everything that has wings, and you will usually lose.",
    },
  ],

  "smooth-chanterelle": [
    {
      ask: "Look under a smooth chanterelle. What do you find?",
      options: [
        "Deep crowded gills",
        "Fine pores, like a sponge",
        "A ring of spines",
        "Almost nothing: a blunt, faintly wrinkled face",
      ],
      answer: 3,
      because:
        "As though someone took sandpaper to it. That smooth face is the quickest way to tell it from the golden chanterelle growing right beside it.",
    },
    {
      ask: "Nobody has ever farmed a smooth chanterelle. Why not?",
      options: [
        "It is mycorrhizal, and cannot live without the oak",
        "It fruits too rarely to be worth it",
        "It loses its flavour in cultivation",
        "It has been farmed, just not at scale",
      ],
      answer: 0,
      because:
        "Its threads sheathe the oak's finest roots and trade minerals and water for sugar made up in the canopy. Take away the tree and there is no mushroom, so you cannot grow it in a shed.",
    },
    {
      ask: "What does it smell of?",
      options: ["Aniseed", "Apricot", "Watermelon rind", "Nothing at all"],
      answer: 1,
      because:
        "Apricot, which is also roughly its colour. Between the smell and the sanded-off underside it is one of the more honest mushrooms in the wood.",
    },
  ],

  "shaggy-mane": [
    {
      ask: "Pick a shaggy mane at breakfast. What have you got by lunch?",
      options: [
        "A dried, papery cap",
        "Black ink",
        "A cap that has doubled in size",
        "Exactly what you picked. It keeps for days",
      ],
      answer: 1,
      because:
        "It digests itself. The cap dissolves into a black liquid that drips off the edge, and people genuinely used to write with it.",
    },
    {
      ask: "Why would a mushroom destroy its own cap?",
      options: [
        "To stop insects eating the spores",
        "To recover the nutrients before it dies",
        "So the spores drip clear of the grass instead of waiting on wind that may not come",
        "It is a disease, not a strategy",
      ],
      answer: 2,
      because:
        "The self-destruction is the whole trick. A still autumn afternoon is no use to a spore, so this one arranges its own delivery.",
    },
    {
      ask: "Which way does a shaggy mane dissolve?",
      options: [
        "From the rim upward",
        "From the stalk outward",
        "From the top down",
        "All at once, evenly",
      ],
      answer: 0,
      because:
        "The rim goes first and the ruin creeps up. It comes up overnight through gravel and mown grass and is gone inside a day.",
    },
  ],

  "witches-butter": [
    {
      ask: "Witches' butter sits on a dead branch. What is it eating?",
      options: [
        "The wood, like any other rot fungus",
        "The bark only",
        "Nothing. It photosynthesises",
        "Another fungus, which is eating the wood",
      ],
      answer: 3,
      because:
        "It is a parasite on Peniophora, the flat crust fungus doing the actual rotting. It drives its threads into that fungus and takes the sugar. A fungus feeding on a fungus feeding on a tree.",
    },
    {
      ask: "The jelly dries to a hard scab. Is that the end of it?",
      options: [
        "No. It swells back from the same spot with the next rain, for years",
        "Yes. It fruits once and dies",
        "It is dead, but the spores stay in the scab",
        "It survives, but never fruits twice on one branch",
      ],
      answer: 0,
      because:
        "Rain, orange jelly. Dry, black scab. It will do this on the same branch for years on end, which is why you can go back and find it again.",
    },
    {
      ask: "Where does the name come from?",
      options: [
        "It was churned into butter in hard winters",
        "Find it on your gate and somebody had cursed the house",
        "It only grows where lightning has struck",
        "Its colour was thought to mark poisoned ground",
      ],
      answer: 1,
      because:
        "Older names blamed witches. A gate that suddenly grows orange jelly overnight is an unsettling thing if you do not know about Peniophora, and nobody did.",
    },
  ],
  /* ------------------------------------------------------------------ *
   * The garden party species.
   *
   * Same rule as everything above: the answer and the explanation both come
   * from the species' own article, and the wrong answers are things a person
   * might reasonably believe rather than jokes.
   * ------------------------------------------------------------------ */

  "witch-hazel": [
    {
      ask: "When does witch-hazel flower?",
      options: [
        "Late autumn, sometimes into December",
        "Early spring, before the leaves",
        "Midsummer, with everything else",
        "It flowers twice, spring and autumn",
      ],
      answer: 0,
      because:
        "It opens from late September into November and occasionally December, which is why moths are the ones working it. Its relative Hamamelis vernalis is the one that waits for winter.",
    },
    {
      ask: "A witch-hazel flower is pollinated in November. When is the ovary actually fertilised?",
      options: [
        "About the middle of May, five to seven months later",
        "Within a few days, like most flowers",
        "The following November, a full year later",
        "It is not, and the flower drops",
      ],
      answer: 0,
      because:
        "The pollinated ovary rests through the winter and is not fertilised until around mid-May. Almost nothing else in the park waits half a year between the two.",
    },
    {
      ask: "What does the seed capsule do when it is ripe?",
      options: [
        "Splits and fires the seeds up to ten metres",
        "Splits open and drops them straight down",
        "Rots away over the winter",
        "Is carried off whole by birds",
      ],
      answer: 0,
      because:
        "The woody capsule dries and splits explosively a year after pollination, throwing two shiny black seeds as far as ten metres from the parent.",
    },
  ],

  "skunk-cabbage": [
    {
      ask: "Skunk cabbage does something almost no other plant here can. What?",
      options: [
        "It makes its own heat and melts the ice around it",
        "It flowers underwater",
        "It moves to follow the sun",
        "It grows an entire leaf overnight",
      ],
      answer: 0,
      because:
        "It is thermogenic. The hood generates enough warmth to melt a circle in the surrounding ice, which is how it can be in flower while the ground is still frozen.",
    },
    {
      ask: "Why does the flower smell the way it does?",
      options: [
        "The smell is the point, and Linnaeus named it for it",
        "It is a sign the plant is rotting",
        "Only bruised leaves smell, never the flower",
        "It smells of honey, and the name is a joke",
      ],
      answer: 0,
      because:
        "Linnaeus gave it the species name foetidus, Latin for bad-smelling. The odour strengthens as the plant matures, and bruised leaves smell of skunk.",
    },
    {
      ask: "Its flowers are protogynous. What does that mean?",
      options: [
        "The female parts ripen before the male ones",
        "The flower opens only at night",
        "Each flower lives a single day",
        "The plant has separate male and female stalks",
      ],
      answer: 0,
      because:
        "The pistils mature before the stamens on the same flower, which is a plant going to some trouble not to pollinate itself.",
    },
  ],

  "foxglove-beardtongue": [
    {
      ask: "What is unusual about the outside of the flower tube?",
      options: [
        "It is covered in tiny white hairs",
        "It is sticky enough to trap small insects",
        "It changes colour after it is pollinated",
        "It is completely transparent",
      ],
      answer: 0,
      because:
        "The two-lipped white tubes carry fine white hairs on the outside. It is one of the details that separates it from the other penstemons.",
    },
    {
      ask: "Where would you expect to find it growing?",
      options: [
        "Open ground: meadows, field edges, along railroad tracks",
        "Deep shade under closed canopy",
        "Standing water at the edge of a pond",
        "Bare rock faces",
      ],
      answer: 0,
      because:
        "It wants moist soil and full sun, and turns up in meadows, prairies, fields, wood margins and along railroad tracks. Junction Hollow suits it exactly.",
    },
    {
      ask: "How widespread is it?",
      options: [
        "The most widespread penstemon east of the Mississippi",
        "Found only in western Pennsylvania",
        "A garden escape, not native anywhere here",
        "Rare enough to be legally protected",
      ],
      answer: 0,
      because:
        "Of all the penstemons east of the Mississippi, this is the one you are most likely to meet.",
    },
  ],

  "white-turtlehead": [
    {
      ask: "Where does the name come from?",
      options: [
        "The petals close into the shape of a tortoise's head",
        "The seeds are shaped like tiny shells",
        "It grows where turtles bask",
        "The leaves are patterned like a shell",
      ],
      answer: 0,
      because:
        "The flower really does look like a tortoise's head, and the name says so twice over: chelone is Greek for tortoise.",
    },
    {
      ask: "Chelone was a nymph in Greek myth. What happened to her?",
      options: [
        "She skipped Zeus's wedding and was turned into a turtle",
        "She was turned into a flower by Apollo",
        "She guarded a spring and was turned to stone",
        "Nothing; the name is purely descriptive",
      ],
      answer: 0,
      because:
        "She refused to attend the wedding of Zeus and was turned into a turtle for it, which is how a plant in Pittsburgh ended up named after a punishment.",
    },
    {
      ask: "Which butterfly depends on it?",
      options: [
        "The Baltimore checkerspot",
        "The monarch",
        "The eastern tiger swallowtail",
        "The mourning cloak",
      ],
      answer: 0,
      because:
        "It is the primary plant the Baltimore checkerspot lays its eggs on. No turtlehead, far fewer checkerspots.",
    },
  ],

  "new-york-ironweed": [
    {
      ask: "What is that single purple flower head actually made of?",
      options: [
        "A crowd of small florets",
        "One large flower with fused petals",
        "A flower and its own leaf bract",
        "Two flowers of different sexes",
      ],
      answer: 0,
      because:
        "Like the rest of the daisy family, what reads as one flower is a crowd of small florets packed together.",
    },
    {
      ask: "How does its seed travel?",
      options: [
        "On the wind, in a coat of bristles",
        "Inside berries eaten by birds",
        "It is flung out when the pod dries",
        "It simply drops at the base",
      ],
      answer: 0,
      because:
        "The seed is an achene covered in bristles, which is a seed built to be carried off by the wind.",
    },
    {
      ask: "What kind of ground does it want?",
      options: [
        "Wetlands and moist soil",
        "Dry sandy banks",
        "Deep shade under conifers",
        "Disturbed gravel and roadsides",
      ],
      answer: 0,
      because:
        "It blooms in August in wetlands and damp soil, which is why the riverside flats suit it and a dry hilltop does not.",
    },
  ],

  "cup-plant": [
    {
      ask: "Where does the cup in cup plant come from?",
      options: [
        "The leaf stalks fuse around the stem and hold rainwater",
        "The flower head fills with nectar",
        "The root forms a hollow bowl",
        "The seed pods are cup-shaped",
      ],
      answer: 0,
      because:
        "The leaf stalks are winged and fused right around the stem, and the join makes a cup that fills with rain.",
    },
    {
      ask: "What drinks from those cups?",
      options: ["Birds", "Deer", "Nothing; it is only rainwater", "Foxes"],
      answer: 0,
      because:
        "Birds come to the water collected in the cups along the stems, as well as for the seeds.",
    },
    {
      ask: "What shape is the stem?",
      options: [
        "Strongly square, four-angled like a mint",
        "Perfectly round",
        "Flattened like a ribbon",
        "Triangular, like a sedge",
      ],
      answer: 0,
      because:
        "It is stout and strongly four-angled. A square stem in your fingers is a useful thing to notice on a plant this tall.",
    },
  ],

  "lions-mane": [
    {
      ask: "What does lion's mane have instead of gills?",
      options: [
        "Hanging spines, a centimetre or more long",
        "Pores, like a bracket fungus",
        "Folded ridges running down the stem",
        "Nothing; the spores form inside",
      ],
      answer: 0,
      because:
        "It is a single clump of crowded, dangling white spines, and the spores are made on the spines themselves.",
    },
    {
      ask: "How long can one dead tree keep producing them?",
      options: ["About twenty years", "A single season", "Two or three years", "A century"],
      answer: 0,
      because:
        "It can fruit intermittently for twenty years on the same dead tree, which is a fungus that has settled in rather than passed through.",
    },
    {
      ask: "Is it edible?",
      options: [
        "Yes, and it is used in traditional Chinese medicine",
        "No, it is dangerously toxic",
        "Only after long boiling",
        "Nobody has ever established it",
      ],
      answer: 0,
      because:
        "It is an edible mushroom with a long history in traditional Chinese medicine. As ever, identification is the hard part, not the cooking.",
    },
  ],

  "dead-mans-fingers": [
    {
      ask: "Where does dead man's fingers grow?",
      options: [
        "From the base of rotting or injured stumps",
        "On living bark, high up",
        "In open grass, away from trees",
        "Only on fallen conifer needles",
      ],
      answer: 0,
      because:
        "It pushes out of the bases of rotting or injured stumps and decaying wood, which is why it looks like something reaching up out of the ground.",
    },
    {
      ask: "How long does it take to release its spores?",
      options: [
        "Months, a few at a time",
        "A single puff when it is knocked",
        "One night, all at once",
        "It does not release spores at all",
      ],
      answer: 0,
      because:
        "The spores are discharged over a lengthy period, sometimes several months. It is a very slow way to do it, and it works well enough for something living in a stump.",
    },
    {
      ask: "What happens to it in spring?",
      options: [
        "It grows a layer of white or bluish spores on its surface",
        "It turns bright orange",
        "It softens and collapses",
        "It flowers",
      ],
      answer: 0,
      because:
        "In spring it produces a layer of white or bluish asexual spores called conidia across its surface, which is the one time of year it is not simply black.",
    },
  ],

  "crown-tipped-coral": [
    {
      ask: "Why is it called crown-tipped?",
      options: [
        "Each branch ends in a ring of small points",
        "It grows in a circle, like a crown on the ground",
        "The colour is regal purple",
        "It was named after a person called Crown",
      ],
      answer: 0,
      because:
        "The tips of the branches finish in a crown of tiny points, which is the detail that separates it from the other coral fungi.",
    },
    {
      ask: "Where on this fungus are the spores made?",
      options: [
        "All over the surfaces of the branches",
        "In gills underneath a cap",
        "Inside a sealed sac at the base",
        "In pores at the branch tips only",
      ],
      answer: 0,
      because:
        "It has no cap and no gills. The basidia and spores form on the branch surfaces, so the whole shape is the spore-bearing surface.",
    },
    {
      ask: "How big does it get?",
      options: [
        "Four to ten centimetres tall",
        "Half a metre across",
        "A few millimetres, easily missed",
        "It varies from a centimetre to a metre",
      ],
      answer: 0,
      because:
        "The hard, coral-like fruiting bodies reach four to ten centimetres, so it is small enough to walk past and distinctive enough to be certain of.",
    },
  ],

  "bleeding-fairy-helmet": [
    {
      ask: "What happens when you break the stem?",
      options: [
        "Dark red latex wells out of the break",
        "It snaps cleanly and stays dry",
        "It releases a cloud of spores",
        "The whole mushroom collapses",
      ],
      answer: 0,
      because:
        "It bleeds a dark red latex, which is where both the common name and the scientific one come from: haematopus is Greek for blood-foot.",
    },
    {
      ask: "What else does this mushroom do?",
      options: [
        "Both the mushrooms and the mycelium glow",
        "It changes colour in daylight",
        "It grows only on the night of a full moon",
        "It closes up when touched",
      ],
      answer: 0,
      because:
        "Both the fruit bodies and the mycelium in the wood are strongly bioluminescent, which puts it in a very short list of things in this park that make their own light.",
    },
    {
      ask: "What is it growing on?",
      options: [
        "Decaying hardwood, beech especially",
        "Living tree roots",
        "Bare soil in the open",
        "Pine needles and cones",
      ],
      answer: 0,
      because:
        "It is saprotrophic, clustering on the decaying logs, trunks and stumps of deciduous trees, and it is particularly fond of beech.",
    },
  ],

  "hemlock-varnish-shelf": [
    {
      ask: "What tree should you be looking at to find one?",
      options: ["A hemlock", "An oak", "A sycamore", "A black locust"],
      answer: 0,
      because:
        "It grows on conifers and on hemlock above all, so finding one tells you something about the tree it is on.",
    },
    {
      ask: "Why is it called varnish shelf?",
      options: [
        "The surface is glossy enough to look lacquered",
        "It was once used to make varnish",
        "It smells of turpentine",
        "It is only found on varnished timber",
      ],
      answer: 0,
      because:
        "The shelf has a hard, shining surface that genuinely looks as though somebody has varnished it.",
    },
    {
      ask: "Can you eat it?",
      options: [
        "It is not poisonous, but it is far too woody to be worth it",
        "Yes, and it is a choice edible",
        "No, it is deadly",
        "Only the spores are edible",
      ],
      answer: 0,
      because:
        "It is non-poisonous but generally considered inedible because of its solid woody nature. Teas and extracts are made from it, though the medicinal claims are contested.",
    },
  ],

  "scarlet-elf-cup": [
    {
      ask: "When does the scarlet elf cup fruit?",
      options: [
        "Winter and early spring",
        "High summer",
        "Only in autumn, with the leaf fall",
        "All year, without a season",
      ],
      answer: 0,
      because:
        "It comes up in winter and early spring in damp habitats, which is most of what makes it worth the walk: there is very little else to find.",
    },
    {
      ask: "What is it growing on?",
      options: [
        "Fallen dead hardwood among moss and leaf litter",
        "Living tree bark",
        "Bare wet soil",
        "Old fungi from the year before",
      ],
      answer: 0,
      because:
        "It grows on fallen pieces of dead hardwood among mosses and leaf litter. Alder, willow, maple and locust are all recorded hosts.",
    },
    {
      ask: "Is it edible?",
      options: [
        "Generally considered inedible, though not everyone agrees",
        "A well known choice edible",
        "Deadly poisonous",
        "Edible only when cooked twice",
      ],
      answer: 0,
      because:
        "It is generally considered inedible, although the Norwegian Association for Mycology and Foraging counts it as edible. Where the sources disagree, so does this.",
    },
  ],
};

export function triviaFor(id: string): Question[] {
  return TRIVIA[id] ?? [];
}

/**
 * The same questions, with their options shuffled.
 *
 * Hand-written options come out in the order the writer thought of them, which is
 * the true one first: 90 of the 147 questions above had `answer: 0`, so tapping
 * the top option every time passed most quizzes in the game, and two right of
 * three is a pass. It is the kind of tell that makes a quiz feel rigged the moment
 * you notice, and unlosable until you do.
 *
 * Shuffling here rather than rewriting 147 records fixes every question at once
 * and cannot drift back: a new question can still be written in whatever order
 * reads best. It is only safe because no `ask` or `because` line refers to an
 * option by its position, and nothing in the game stores an answer index.
 *
 * Seeded, not random, so a species deals the same board twice in a session and
 * the options cannot reshuffle underneath a player who is mid-question.
 */
export function shuffledTriviaFor(id: string): Question[] {
  return triviaFor(id).map((question, questionIndex) => {
    const order = question.options.map((_, index) => index);

    let seed = id.length * 97 + questionIndex * 31 + 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return {
      ...question,
      options: order.map((index) => question.options[index]),
      answer: order.indexOf(question.answer),
    };
  });
}
