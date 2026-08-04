import type { Plant } from "../data/plants";
import { PLANTS } from "../data/plants";
import { seasonFor, seasonWindow } from "./season";

/**
 * Winter identification: naming a plant with nothing left to look at.
 *
 * In summer the game hands you the answer. Get close to anything and a card
 * appears with its name on it, which is the right way round for learning a
 * meadow: you cannot look a flower up if you do not know it is called anything.
 *
 * Winter is where that stops being enough, and it is also where a real botanist
 * gets interesting. The flowers are gone, the leaves are gone, and what is left
 * is a shape standing in a particular place at a particular height. Naming it
 * from that is a genuine skill and the park already holds everything you need to
 * do it: how the plant is built, how tall it stands, and the habitat it stands
 * in. All three are sourced, all three are already drawn.
 *
 * **The evidence is structural on purpose.** The obvious version of this feature
 * identifies by twig and bud, and it is not buildable honestly: Wikipedia is an
 * encyclopedia of the plant rather than a winter key, and it carries a real
 * winter character for three of these species and nothing at all for the rest.
 * Inventing the other twenty is exactly what rule 1 forbids. So the question is
 * asked from what the game genuinely knows, and `Plant.winter` adds a sourced
 * detail on top for the handful that have one.
 */

/** December, January, February: the months the game draws bare and snow-lying. */
export function isWinterMonth(month: number): boolean {
  return seasonFor(month) === "winter";
}

/**
 * Whether this plant is still standing, as a thing you could point at, in winter.
 *
 * Two ways to qualify, and both are about structure rather than a per-species
 * claim nobody sourced.
 *
 * **Woody.** A tree or a shrub is above ground all winter by definition. That is
 * what woody means, and the game already draws them as standing structures.
 *
 * **A tall stalk that was still flowering into the autumn.** A head-high plant
 * carrying flowers in September is a dead stalk in December, and dead stalks of
 * that size stand: it is why a winter meadow is full of goldenrod skeletons.
 *
 * What this deliberately excludes is the spring ephemerals. Trout lily, bloodroot
 * and Dutchman's breeches are not merely dormant in January, they are GONE:
 * everything above ground died back by midsummer. Asking somebody to identify one
 * from its winter silhouette would be asking about a plant that is not there, and
 * the game would be teaching a lie to make a puzzle.
 */
export function standsInWinter(plant: Plant): boolean {
  if (plant.archetype === "tree" || plant.archetype === "shrub") {
    return true;
  }

  // A sourced winter character IS the evidence that it has a winter. Nothing
  // gets one of those unless somebody found a description of what it looks like
  // bare, which is not a thing that exists for a plant that is not there.
  if (plant.winter) {
    return true;
  }

  const bloom = seasonWindow(plant.bloom);

  // All-year is not a real bloom for anything in this data, and a window with no
  // end month cannot say whether it ran into the autumn.
  if (bloom.allYear) {
    return false;
  }

  /**
   * The bee is about 1.6 units long, so this is "taller than the animal looking
   * at it": a stalk with enough of it to read a shape from.
   *
   * Deliberately conservative, and it has known false negatives. Common milkweed
   * finishes flowering in August and is excluded, yet its split pods on a dead
   * stalk are about the most recognisable thing in a winter meadow; purple
   * coneflower is the same story with its cones. Both are LEFT OUT rather than
   * special-cased, because the alternative is a per-species claim about
   * persistence that nothing here sources.
   *
   * Excluding something that really does stand costs a question. Including
   * something that has rotted away by December would have the game asking you to
   * identify a plant that is not there, which is the mistake that actually
   * matters. Give either of them a sourced `winter` line and they qualify above.
   */
  return plant.height >= 1.6 && bloom.to >= 9;
}

/**
 * Whether this plant is asking to be named, right now.
 *
 * ONE definition, because it decides two things in two different files and they
 * have to agree exactly: the card in the world withholds the name when this is
 * true, and the landing menu offers the question. Written out separately in each,
 * they would eventually drift, and the failure is silent and confusing rather than
 * loud: a card that hides the name and then no way to answer it, or a question
 * offered about a plant the tag has already named. The frame loop kept its own
 * copy of "is a popover open" for exactly this reason and it drifted within
 * weeks.
 *
 * Four conditions, and each one is doing a job:
 *
 * - **a month it is standing in**, or there is nothing out there to look at;
 * - **a plant that stands through winter**, or the question is about a plant that
 *   is not there;
 * - **already met in leaf**, so this is a second pass and never a wall for
 *   somebody who arrived in January;
 * - **not already named**, or it would keep asking forever.
 */
export function askingWinterName(
  plant: Plant,
  month: number,
  /** Whether this player has met it in leaf, and whether they have already named it. */
  known: { met: boolean; named: boolean },
): boolean {
  return (
    isWinterMonth(month) &&
    standsInWinter(plant) &&
    known.met &&
    !known.named
  );
}

/** Everything that stands through winter in a given park. */
export function winterStanding(park: string): Plant[] {
  return PLANTS.filter(
    (plant) =>
      plant.homes.some((home) => home.park === park) && standsInWinter(plant),
  );
}

/**
 * The options for one winter question: the answer, and three others.
 *
 * The wrong answers come from the SAME park and are all plants that also stand
 * through winter, because an option you could rule out by knowing it is not here,
 * or by knowing it has no winter form at all, is not a wrong answer, it is
 * padding. They are picked deterministically from the plant's own id so a species
 * asks the same question every time rather than rerolling until it is easy.
 */
export function winterOptions(
  answer: Plant,
  park: string,
  count = 4,
): Plant[] {
  const others = winterStanding(park).filter((plant) => plant.id !== answer.id);

  // Seeded from the answer's id: same board every time, different per species.
  let seed = answer.id.length * 131 + answer.height * 17 + 11;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const pool = [...others];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const board = [answer, ...pool.slice(0, Math.max(0, count - 1))];

  for (let i = board.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }

  return board;
}

/**
 * What you have to go on: how it is built, how tall, and where it is standing.
 *
 * Written from the data the game already holds rather than from prose somebody
 * had to author per species, which is what keeps this honest for all twenty-odd
 * of them instead of the three with a sourced twig.
 */
const SHAPE: Record<Plant["archetype"], string> = {
  tree: "A bare tree, well over your head",
  shrub: "A woody shrub, many stems from the base",
  spike: "A single tall stalk, dead and standing",
  umbel: "A stout stalk branching into flat heads, all of it dry",
  daisy: "A dry stalk with the old flower heads still on it",
  low: "Low, and mostly gone",
};

export function winterEvidence(plant: Plant, park: string): string[] {
  const home = plant.homes.find((entry) => entry.park === park);
  const lines = [SHAPE[plant.archetype]];

  lines.push(
    plant.height >= 4
      ? "Far taller than anything else standing here"
      : plant.height >= 2.2
        ? "Head-high on a bee, and then some"
        : "About twice your own length, standing",
  );

  if (home) {
    lines.push(`Standing in the ${home.area.replace(/-/g, " ")}`);
  }

  // The sourced winter character, for the few that have one documented.
  if (plant.winter) {
    lines.push(plant.winter);
  }

  return lines;
}
