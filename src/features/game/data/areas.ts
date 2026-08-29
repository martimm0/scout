/**
 * What each corner of each park actually is.
 *
 * Twenty four areas across three parks, and every one of them a real place with
 * a real reason to be described: the Center that makes its own water, the slide
 * generations of children have come down on cardboard, the creek that spent the
 * twentieth century buried under slag.
 *
 * This lived inside journal.tsx as an unexported const, which was fine for as
 * long as the journal was the only thing that wanted to say where you were. It
 * is data, it is the only prose an `Area` has anywhere (the type carries an id,
 * a label and a centre point and nothing else), and a second reader wanted it:
 * ask your pollinator about Fern Hollow and this is the only thing in the
 * repository that can answer.
 */
export const AREA_BLURB: Record<string, string> = {
  "environmental-center":
    "The way in, off Beechwood Boulevard, through the old stone gates. The Center itself was rebuilt in 2016 as a Living Building: it makes its own energy and harvests its own water. There's a native garden out front, which is where most people's first flower is.",
  "blue-slide": "A long concrete slope that Pittsburgh children have been coming down on flattened cardboard for generations. From up here it's a mountainside. There's rough sunny meadow all around its edges, and the pollinators know it.",
  "bowling-green":
    "The only lawn bowling green in Pittsburgh, clipped to within an inch of its life and hedged on all four sides. Nothing much grows on it, which is rather the point, but the rough at its margins is thick with goldenrod and aster.",
  "nine-mile-run":
    "The creek at the bottom of the valley. It was buried under slag for most of the twentieth century and dug back out again in one of the largest urban stream restorations ever attempted in the United States. Everything wet and green down here is younger than it looks.",
  "falls-ravine":
    "Steep enough that the soil barely holds. Hemlocks, and the spring ephemerals that flower and vanish before the canopy closes over them.",
  "fern-hollow":
    "Deep shade, closed canopy, and ferns that from your height are small trees. Spicebush flowers here before it bothers growing leaves.",

  phipps:
    "A Victorian glasshouse on the edge of the plateau, and a hundred thousand panes of glass to fly around. It has been growing things nobody in Pittsburgh could otherwise see since 1893.",
  "flagstaff-hill":
    "Mown, treeless, and the most open ground in either park. Half of Pittsburgh sledges down it the first day it snows. From the top you can see the whole city, which is the point of a flagstaff.",
  "schenley-oval":
    "A running track on a plateau, flat because it has to be. The rough at its margins is the only thing growing here that nobody planted.",
  westinghouse:
    "A curved bronze wall around a still pond, put up by the people who worked for a man who electrified things. Fly into the middle of it: that is the only place you can read what it says.",
  "panther-hollow":
    "The ground opens. A hundred feet down, with a stream at the bottom and a bridge over the top of it carrying four bronze panthers, and it is as wild as anything in Frick. This is the reason to come to Schenley.",
  "panther-hollow-lake":
    "A lake at the bottom end of the hollow, ringed with pickerelweed and buttonbush. Everything that flowers here has its feet in the water.",
  "junction-hollow":
    "The other ravine, deep and shaded, with a railway running down the length of it. Nothing about it is scenic, and the fungi do not care.",
  "phipps-run":
    "The stream ravine below the conservatory. Damp, shaded, and full of spring ephemerals that are up, flowered and gone before the canopy closes over them.",

  "reservoir-rim":
    "A gravel loop around the top of an embankment, and the most walked ground in the East End. It goes round and round and arrives nowhere, which is the point of it. Chicory and shaggy manes come up through the gravel at the edge.",
  "reservoir-one":
    "Reservoir No. 1: a walled lake on top of a hill, holding the drinking water for a large part of Pittsburgh. Nothing grows in it. It is not that kind of water.",
  "reservoir-two":
    "The smaller of the two, and the same idea. Fly over the wall and there is simply a lake up there, where a lake has no business being.",
  "lake-carnegie":
    "The fountain at the bottom of the park, throwing water it will never get back, ringed with mown grass. Heal-all grows here by being shorter than the mower.",
  "highland-gates":
    "The Highland Avenue entrance, with two enormous stone piers and a bronze on each. At your size the bronzes are the size of houses and you can fly between them.",
  "allegheny-slope":
    "The whole north edge of the park falls away toward the river, a hundred and fifty feet down from the reservoir rim. Oak and hickory, columbine growing out of the bare rock, and the wildest ground in Highland.",
  "riverside-flats":
    "The floodplain at the bottom, where the Allegheny leaves things. Wingstem over your head, jewelweed, and pawpaw: the largest edible fruit on the continent, growing wild on a Pittsburgh riverbank.",
  "allegheny-shore":
    "The river itself. The only water in this park at the bottom of the hill rather than the top.",
  "zoo-edge":
    "The fence, and whatever is on the other side of it. Elderberry colonises the damp margin, and nobody in the zoo is looking at the elderberry.",
};
