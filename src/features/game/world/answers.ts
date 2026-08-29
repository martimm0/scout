/**
 * Your pollinator, answering a question, out of the game's own data.
 *
 * There is no model here and there is not going to be one. Two reasons, and the
 * first is rule 1: an unsourced fact does not ship, and nothing can stop a
 * language model inventing a milkweed fact that sounds exactly like the real
 * ones sitting next to it. The second is the request this was built from, which
 * asked in capital letters that the game never tell anybody how it was made.
 * A function that can only emit sentences assembled from `plants.ts` has no
 * sentence about a framework to emit. The prohibition is structural rather than
 * a promise, which is the only kind worth making.
 *
 * The shape is `field-notes.ts`: a pure module, no React and no store, plain
 * values in and a plain answer out, so a test can pin the save and the hour and
 * read the copy back. Every clause is a named field of a real record. Where
 * there is no field there is no answer, and it says so.
 *
 * What it will not do is guess. A question it cannot place, a species you have
 * not met, or a detail the data does not carry all come back the same way:
 * "I don't understand." That is not a failure state, it is the honest one. The
 * page prints what it does know underneath the box so the scope is never a
 * mystery.
 */

import { AREA_BLURB } from "../data/areas";
import { CONNECTIONS, connectionOpen } from "../data/connections";
import {
  EDIBILITY_LABEL,
  FUNGI,
  FUNGI_BY_ID,
  type Fungus,
} from "../data/fungi";
import {
  CONCEPTS,
  POLLINATOR_ENTRIES,
  type ConceptEntry,
  type PollinatorEntry,
} from "../data/journal";
import {
  PLANTS,
  PLANTS_BY_ID,
  SOLO_PLANTS,
  describeHomes,
  type Plant,
} from "../data/plants";
import { triviaFor } from "../data/trivia";
import { isActive } from "./daylight";
import { hash01 } from "./hash01";
import { allAreas, type Park, type ParkId } from "./park";
import { describeSeasonWindow, isInSeason, seasonWindow } from "./season";
import { PARKS, PARK_LIST } from "./terrain";

type BooleanRecord = Record<string, boolean>;

export type Answer = {
  /**
   * "plant:common-milkweed", "concept:mutualism", "unknown".
   *
   * The text is what a player reads and it will be rewritten; this is what a
   * test holds on to.
   */
  id: string;
  /** What the pollinator says. Whole sentences, ready to render. */
  text: string;
  /** A real link out, when the subject has one. Never set on a refusal. */
  wikipedia?: string;
};

export type Found = { plants: BooleanRecord; fungi: BooleanRecord };

export type AskInput = {
  question: string;
  found: Found;
  quizPassed: BooleanRecord;
  unlockedParks: BooleanRecord;
  unlockedMapAreas: BooleanRecord;
  pollinator: { type: string; name: string };
  /** Fractional Pittsburgh month, for "is it in season". */
  month: number;
  /** Pittsburgh hour, for "is it open right now". */
  hour: number;
  /**
   * There is deliberately no `inParty` here.
   *
   * Every other pool in the game filters party species out by default, because
   * they gate things a solo player cannot reach. Nothing here gates anything:
   * the question is not "can you find this" but "have you met this", and a
   * species you met at a garden party is one you met. It stays askable
   * afterwards, which is the right answer to "I saw that, tell me more".
   */
};

/** The one thing it says when it cannot answer. Nothing is appended to it. */
export const REFUSAL = "I don't understand.";

function refuse(): Answer {
  return { id: "unknown", text: REFUSAL };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * Words that carry no subject and no intent.
 *
 * Intent is classified on the whole normalised string BEFORE this runs, because
 * half of what a question means lives in "when", "where" and "why", and they
 * are all in here.
 */
const STOPWORDS = new Set([
  "a", "about", "all", "am", "an", "and", "any", "anything", "are", "as", "ask",
  "at", "be", "been", "bit", "but", "by", "can", "could", "did", "do", "does",
  "for", "from", "get", "give", "go", "going", "got", "had", "has", "have",
  "hey", "hi", "how", "i", "if", "in", "into", "is", "it", "its", "just",
  "know", "like", "little", "look", "make", "me", "mean", "more", "much", "my",
  "of", "on", "one", "or", "our", "out", "over", "please", "say", "see",
  "should", "so", "some", "something", "tell", "than", "that", "the", "their",
  "them", "then", "there", "these", "they", "thing", "things", "this", "those",
  "to", "up", "us", "was", "way", "we", "were", "what", "whats", "when",
  "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

/** Lowercase, unaccented, punctuation gone, single spaces. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Apostrophes CLOSE a word rather than breaking it. Splitting on them made
    // "dutchman's" into "dutchman", which matches neither the common name nor
    // the id "dutchmans-breeches", so the species was unaskable by its own name.
    .replace(/['\u2018\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenise(text: string): string[] {
  return normalise(text)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

// ---------------------------------------------------------------------------
// What it can talk about
// ---------------------------------------------------------------------------

type Subject =
  | { kind: "plant"; id: string; label: string; plant: Plant }
  | { kind: "fungus"; id: string; label: string; fungus: Fungus }
  | { kind: "park"; id: ParkId; label: string; park: Park }
  | { kind: "area"; id: string; label: string; park: Park }
  | { kind: "concept"; id: string; label: string; entry: ConceptEntry }
  | { kind: "pollinator"; id: string; label: string; entry: PollinatorEntry };

type Entry = {
  subject: Subject;
  /** Every word that could point at this thing. */
  tokens: Set<string>;
  /** Its own name, normalised, for the whole-phrase bonus. */
  phrase: string;
};

/**
 * Built once, at module load, and never per question.
 *
 * Party species are in here. They are gated on `found` like everything else, so
 * a solo player cannot reach them, and somebody who met one at a party can ask
 * about it afterwards, which is the right answer to "I saw it, tell me more".
 */
const VOCABULARY: Entry[] = (() => {
  const entries: Entry[] = [];

  const add = (subject: Subject, names: string[]) => {
    const tokens = new Set<string>();

    for (const name of names) {
      for (const token of tokenise(name)) {
        tokens.add(token);
      }
    }

    entries.push({ subject, tokens, phrase: normalise(names[0]) });
  };

  for (const plant of PLANTS_BY_ID.values()) {
    add({ kind: "plant", id: plant.id, label: plant.commonName, plant }, [
      plant.commonName,
      plant.scientificName,
      plant.id.replace(/-/g, " "),
    ]);
  }

  for (const fungus of FUNGI_BY_ID.values()) {
    add({ kind: "fungus", id: fungus.id, label: fungus.commonName, fungus }, [
      fungus.commonName,
      fungus.scientificName,
      fungus.id.replace(/-/g, " "),
    ]);
  }

  for (const park of PARK_LIST) {
    add({ kind: "park", id: park.id, label: park.label, park }, [park.label]);

    for (const area of allAreas(park)) {
      if (!AREA_BLURB[area.id]) {
        continue;
      }

      add({ kind: "area", id: area.id, label: area.label, park }, [area.label]);
    }
  }

  for (const entry of CONCEPTS) {
    add({ kind: "concept", id: entry.id, label: entry.title, entry }, [
      entry.title,
      entry.id.replace(/-/g, " "),
    ]);
  }

  for (const entry of POLLINATOR_ENTRIES) {
    add({ kind: "pollinator", id: entry.id, label: entry.title, entry }, [
      entry.title,
    ]);
  }

  return entries;
})();

/**
 * How many different things each word could mean.
 *
 * "Common", "wild" and "eastern" are in a dozen names and must not decide
 * anything; "milkweed" is in two and should match both so the answer can ask
 * which. A word's worth is one over this.
 */
const DOCUMENT_FREQUENCY = (() => {
  const counts = new Map<string, number>();

  for (const entry of VOCABULARY) {
    for (const token of entry.tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return counts;
})();

/** A word shared by more than this many subjects points at none of them. */
const TOO_COMMON = 6;

type Match = { entry: Entry; score: number };

function candidatesFor(question: string): Match[] {
  const asked = normalise(question);
  const words = new Set(tokenise(question));
  const scored: Match[] = [];

  for (const entry of VOCABULARY) {
    let score = 0;
    let distinctive = false;

    for (const word of words) {
      if (!entry.tokens.has(word)) {
        continue;
      }

      const frequency = DOCUMENT_FREQUENCY.get(word) ?? 1;
      score += 1 / frequency;

      if (frequency <= TOO_COMMON) {
        distinctive = true;
      }
    }

    // The whole name, said in full, outranks any amount of word overlap. This
    // is what separates "common milkweed" from "swamp milkweed".
    if (entry.phrase.length > 0 && asked.includes(entry.phrase)) {
      score += 2;
      distinctive = true;
    }

    if (distinctive && score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * How many of a park's SOLO flowers this save has met.
 *
 * The one counter here that stays solo, and the only one that should. It feeds
 * the park unlock ladder, and counting a party species towards Schenley would
 * move a door somebody was already walking towards, over a feature they may
 * never have opened. Everything else in this file counts what you have met,
 * because nothing else in this file gates anything.
 */
function foundIn(park: ParkId, discovered: BooleanRecord): number {
  return SOLO_PLANTS.filter(
    (plant) =>
      plant.homes.some((home) => home.park === park) && discovered[plant.id],
  ).length;
}

/**
 * Whether a park is open, derived rather than read off the flag.
 *
 * `parkUnlocked` in the store is `flag OR count >= needed`, and its comment
 * says why: the stored flag is a record of the moment it happened and the
 * count is the truth, so a save written before the flag existed is not locked
 * out of a park it has already earned. Reading only the flag here meant Pocket
 * could tell somebody "eight flowers in Frick Park opens Schenley Park, you
 * have eight" about a park the rest of the game had already opened, and count
 * one park where the picker showed two.
 */
function parkOpen(
  park: Park,
  input: { found: Found; unlockedParks: BooleanRecord },
): boolean {
  const requires = park.requires;

  if (!requires) {
    return true;
  }

  return (
    Boolean(input.unlockedParks[park.id]) ||
    foundIn(requires.park, input.found.plants) >= requires.needed
  );
}

function isUnlocked(subject: Subject, input: AskInput): boolean {
  switch (subject.kind) {
    case "plant":
      return Boolean(input.found.plants[subject.id]);
    case "fungus":
      return Boolean(input.found.fungi[subject.id]);
    case "area":
      return Boolean(input.unlockedMapAreas[subject.id]);
    default:
      /**
       * Parks, concepts and pollinator entries are always answerable.
       *
       * Species are gated because finding them is the game. A park is not: the
       * picker already names all three and prints what each one costs, so
       * gating Schenley here would refuse "how do I unlock Schenley", which is
       * the most obvious question anybody will type, to keep a secret that is
       * on another page of the same site.
       */
      return true;
  }
}

// ---------------------------------------------------------------------------
// The one question it will not answer
// ---------------------------------------------------------------------------

/**
 * Anything about how the game was made.
 *
 * Be honest about what this is worth. The vocabulary above is closed, so "how
 * was this built" already resolves no subject and falls out as a refusal on its
 * own. This guard earns its lines on exactly one case: a question that names a
 * species AND asks a made-of question. "Did you use AI to write the milkweed
 * fact" would otherwise resolve milkweed, match no intent, and come back with
 * the milkweed fact, which reads as a smug dodge. It is a second lock on a door
 * the vocabulary has already shut, and worth having, because the cost of being
 * wrong here is the one thing the request put in capitals.
 */
const META = [
  "ai", "api", "backend", "browser", "build", "built", "chatgpt", "claude",
  "code", "coded", "coding", "compiler", "css", "database", "deploy",
  "developer", "engine", "framework", "frontend", "git", "github", "gpt",
  "html", "javascript", "js", "library", "llm", "made", "model", "next",
  "nextjs", "node", "npm", "opensource", "programmed", "programmer", "prompt",
  "python", "react", "render", "repo", "repository", "server", "software",
  "source", "stack", "threejs", "typescript", "vercel", "webgl", "written",
  "wrote",
];

const META_PHRASES = [
  "how are you made",
  "how does this work",
  "how is this made",
  "how was this made",
  "how were you made",
  "how did you get made",
  "open source",
  "three js",
  "under the hood",
  "who built",
  "who created",
  "who designed",
  "who made",
  "who wrote",
];

function asksHowItWasMade(question: string): boolean {
  const asked = normalise(question);
  const words = new Set(asked.split(" "));

  return (
    META.some((word) => words.has(word)) ||
    META_PHRASES.some((phrase) => asked.includes(phrase))
  );
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

type Intent =
  | "bloom"
  | "connection"
  | "edibility"
  | "fact"
  | "failure"
  | "homes"
  | "progress"
  | "self"
  | "unlock"
  | "visitors"
  | "window"
  | "winter";

/** Every word that helped decide an intent, so the residual check can ignore them. */
const INTENT_WORDS = new Set([
  "already", "bare", "bloom", "blooms", "blossom", "cannot", "cant", "close",
  "closed", "closes", "connect", "connected", "connection", "between", "connects", "count", "dark",
  "dawn", "dead", "difficult", "dormant", "dusk", "eat", "eaten", "edible",
  "fail", "fails", "far", "feed", "feeds", "find", "flower", "flowering",
  "flowers", "forage", "grow", "grows", "growing", "habitat", "hard", "hour",
  "link", "linked", "links", "live", "lives", "many", "month", "morning", "night",
  "nocturnal", "open", "opens", "poison", "poisonous", "progress", "reach",
  "relate", "relates", "relationship", "related", "safe", "season", "shut", "stem", "stems", "toxic", "unlock",
  "unlocked", "visit", "visits", "visitor", "visitors", "winter", "wont",
  "work", "works",
]);

function classify(question: string): Intent | null {
  const asked = normalise(question);
  const words = new Set(asked.split(" "));
  const any = (...candidates: string[]) =>
    candidates.some((candidate) =>
      candidate.includes(" ") ? asked.includes(candidate) : words.has(candidate),
    );

  if (any("what am i", "who am i", "who are you", "what are you", "my name", "your name")) {
    return "self";
  }

  if (any("how many", "how far", "progress", "count", "so far")) {
    return "progress";
  }

  if (
    any("connect", "connects", "connected", "connection", "related", "relate",
      "relates", "relationship", "link", "links", "linked", "between")
  ) {
    return "connection";
  }

  if (any("unlock", "unlocked", "reach", "get to", "open up")) {
    return "unlock";
  }

  if (any("eat", "eaten", "edible", "poison", "poisonous", "toxic", "safe", "forage")) {
    return "edibility";
  }

  // Before "bloom", because "when is it open" and "when does it bloom" are
  // different questions that share their first word.
  if (any("open", "opens", "close", "closed", "closes", "shut", "night", "nocturnal", "dark", "dawn", "dusk", "morning", "hour")) {
    return "window";
  }

  if (any("bloom", "blooms", "blossom", "flower", "flowers", "flowering", "season", "month")) {
    return "bloom";
  }

  if (any("where", "grow", "grows", "growing", "live", "lives", "habitat", "find")) {
    return "homes";
  }

  if (any("winter", "bare", "stem", "stems", "dormant", "dead")) {
    return "winter";
  }

  if (any("fail", "fails", "cant", "cannot", "wont", "hard", "difficult")) {
    return "failure";
  }

  if (any("visit", "visits", "visitor", "visitors", "feed", "feeds", "pollinates", "pollinator", "pollinators")) {
    return "visitors";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Saying it
// ---------------------------------------------------------------------------

const AREA_LABEL = new Map<string, string>();
const PARK_LABEL = new Map<string, string>();

for (const park of PARK_LIST) {
  PARK_LABEL.set(park.id, park.label);

  for (const area of allAreas(park)) {
    AREA_LABEL.set(area.id, area.label);
  }
}

function where(homes: Plant["homes"]): string {
  return describeHomes(
    homes,
    (areaId) => AREA_LABEL.get(areaId) ?? areaId.replace(/-/g, " "),
    (park) => PARK_LABEL.get(park) ?? park,
  );
}

/** Rule 3, in one sentence, for when a plant has no reason of its own. */
const ONE_IN_FIVE =
  "About one visit in five comes to nothing. Wind, timing, or somebody was there first. That is the arithmetic, not you doing it wrong.";

/**
 * What goes after an edibility, and it is deliberately not one line.
 *
 * It was, and the one line had "though" in it: "Eastern Destroying Angel is
 * deadly. I am a bee in a game, though, so do not eat anything on my say so."
 * "Though" signals contrast, so the sentence reads as walking the danger back,
 * which is the exact opposite of what it should do on the one surface in this
 * game that says anything about eating. It also gave a choice edible and a
 * deadly amanita identical treatment, flattening the most important
 * distinction the data has.
 *
 * The rest of the game shows edibility as a colour-coded label with no words
 * around it at all. Being asked directly is different from reading a card, and
 * an answer to "can I eat this" should not sound like advice.
 */
const EDIBILITY_CAVEAT: Record<Fungus["edibility"], string> = {
  choice: "I am a bee in a game, so do not eat anything on my say so.",
  edible: "I am a bee in a game, so do not eat anything on my say so.",
  inedible: "I am a bee in a game, so do not eat anything on my say so.",
  toxic: "Nothing here is a field guide, and that is not a thing to be wrong about.",
  deadly: "Nothing here is a field guide, and that is not a thing to be wrong about.",
};

const NOT_A_FIELD_GUIDE =
  "I am a bee in a game, so do not eat anything on my say so.";

function plantAnswer(
  plant: Plant,
  intent: Intent | null,
  input: AskInput,
): Answer | null {
  const id = `plant:${plant.id}`;
  const said = (text: string): Answer => ({ id, text, wikipedia: plant.wikipedia });

  switch (intent) {
    case "bloom": {
      const season = describeSeasonWindow(seasonWindow(plant.bloom), input.month);

      return said(
        `${plant.commonName} flowers ${plant.bloom}.${season ? ` ${season}` : ""}`,
      );
    }

    case "window": {
      /**
       * The season decides this before the hour gets a say.
       *
       * `isActive` only reads the clock, so asking when wild geranium is open
       * in July got "Opens with the sun. It is open now" about a flower that
       * finished in June, one question after the bloom answer had said it was
       * out of season. The game contradicting itself in two consecutive
       * sentences is the night shift bug again, in miniature.
       */
      if (!isInSeason(seasonWindow(plant.bloom), input.month)) {
        return said(
          `${plant.window.note} Not this month, though: ${plant.commonName} is out of season.`,
        );
      }

      return said(
        `${plant.window.note} ${
          isActive(plant.window, input.hour) ? "It is open now." : "It is shut at this hour."
        }`,
      );
    }

    case "homes":
      return said(`${plant.commonName} grows at ${where(plant.homes)}.`);

    case "visitors":
      return said(plant.pollinatorNote);

    case "winter":
      // No invented fact. Only four species carry a sourced winter line, and
      // the rest get a refusal rather than a guess about bare stems.
      return plant.winter ? said(plant.winter) : null;

    case "failure":
      return said(plant.demanding ?? ONE_IN_FIVE);

    case "edibility":
      return said(
        `I do not know what ${plant.commonName} tastes like. ${NOT_A_FIELD_GUIDE}`,
      );

    case "fact":
      return said(`${plant.fact} ${plant.pollinatorNote}`);

    default:
      return null;
  }
}

function fungusAnswer(
  fungus: Fungus,
  intent: Intent | null,
  input: AskInput,
): Answer | null {
  const id = `fungus:${fungus.id}`;
  const said = (text: string): Answer => ({ id, text, wikipedia: fungus.wikipedia });

  switch (intent) {
    case "bloom":
      return said(`${fungus.commonName} fruits ${fungus.season.toLowerCase()}.`);

    case "window": {
      if (!isInSeason(seasonWindow(fungus.season), input.month)) {
        return said(
          `${fungus.window.note} Not this month, though: ${fungus.commonName} is out of season.`,
        );
      }

      return said(
        `${fungus.window.note} ${
          isActive(fungus.window, input.hour) ? "It is out now." : "Not at this hour."
        }`,
      );
    }

    case "homes":
      return said(`${fungus.commonName} grows at ${where(fungus.homes)}.`);

    case "visitors":
      /**
       * Refused on purpose. `roleNote` is what the fungus DOES, not who calls
       * on it, and answering "what visits turkey tail" with a paragraph about
       * lignin is answering a different question well. Fungi do get visitors
       * and the data does not know which, so this is a gap rather than an
       * answer. Asked about generally, `fact` still carries the roleNote.
       */
      return null;

    case "edibility":
      return said(
        `${fungus.commonName} is ${EDIBILITY_LABEL[fungus.edibility].toLowerCase()}. ${EDIBILITY_CAVEAT[fungus.edibility]}`,
      );

    case "fact":
      return said(`${fungus.fact} ${fungus.roleNote}`);

    default:
      return null;
  }
}

function parkAnswer(park: Park, intent: Intent | null, input: AskInput): Answer | null {
  const id = `park:${park.id}`;

  if (intent === "unlock") {
    const requires = park.requires;

    if (!requires) {
      return { id, text: `${park.label} is where you start. It was always open.` };
    }

    if (parkOpen(park, input)) {
      return { id, text: `${park.label} is already open to you.` };
    }

    const from = PARKS[requires.park];
    const found = foundIn(requires.park, input.found.plants);

    return {
      id,
      text: `${requires.needed} flowers in ${from.label} opens ${park.label}. You have ${found}.`,
    };
  }

  if (intent === "fact" || intent === "homes") {
    return { id, text: park.blurb };
  }

  return null;
}

/**
 * The whole game, party species included, because this is a DISPLAY counter.
 *
 * The solo-only rule exists to protect counters that GATE something: the park
 * unlock ladder and the badges, where counting a party species would move a
 * door somebody was already walking towards. Nothing is gated here. DATA.md
 * states the exception out loud, and the journal already obeys it with
 * "Found 0 / 43". Answering "2 of 37" to the same question the journal answers
 * "2 / 43" would be the game disagreeing with itself in two rooms.
 */
function progressAnswer(input: AskInput): Answer {
  const plants = PLANTS.filter((plant) => input.found.plants[plant.id]).length;
  const fungi = FUNGI.filter((fungus) => input.found.fungi[fungus.id]).length;

  return {
    id: "progress",
    text: `${plants} of ${PLANTS.length} flowers, and ${fungi} of ${FUNGI.length} fungi.`,
  };
}

function selfAnswer(input: AskInput): Answer {
  const entry = POLLINATOR_ENTRIES.find((one) => one.id === input.pollinator.type);

  return {
    id: `pollinator:${input.pollinator.type}`,
    text: entry
      ? `I am ${input.pollinator.name}. ${entry.body}`
      : `I am ${input.pollinator.name}.`,
  };
}

function connectionAnswer(input: AskInput, matches: Match[]): Answer | null {
  const named = new Set(
    matches
      .filter(({ entry }) => entry.subject.kind === "plant" || entry.subject.kind === "fungus")
      .map(({ entry }) => entry.subject.id),
  );

  for (const connection of CONNECTIONS) {
    if (!connection.between.every((id) => named.has(id))) {
      continue;
    }

    // Same gate the journal uses: a connection you have not opened is not
    // something to hand over in a different room.
    if (!connectionOpen(connection, input.found)) {
      continue;
    }

    return { id: `connection:${connection.id}`, text: connection.body };
  }

  return null;
}

// ---------------------------------------------------------------------------
// The question
// ---------------------------------------------------------------------------

export function answerFor(input: AskInput): Answer {
  if (normalise(input.question).length === 0) {
    return refuse();
  }

  if (asksHowItWasMade(input.question)) {
    return refuse();
  }

  const intent = classify(input.question);

  if (intent === "self") {
    return selfAnswer(input);
  }

  if (intent === "progress") {
    return progressAnswer(input);
  }

  const matches = candidatesFor(input.question).filter(({ entry }) =>
    isUnlocked(entry.subject, input),
  );

  if (intent === "connection") {
    return connectionAnswer(input, matches) ?? refuse();
  }

  if (matches.length === 0) {
    return refuse();
  }

  /**
   * A tie is a real question, not a coin toss.
   *
   * "Milkweed" is two species and "aster" is more. Picking one and sounding
   * certain is the prettier lie in miniature, so it asks. Only things you have
   * found are in `matches`, so the list never mentions a species you have not
   * met.
   */
  const best = matches[0].score;
  const tied = matches.filter(({ score }) => best - score < 0.001);

  if (tied.length > 1) {
    const labels = tied.map(({ entry }) => entry.subject.label);
    const last = labels.pop();

    return {
      id: "ambiguous",
      text: `${labels.join(", ")} or ${last}?`,
    };
  }

  const subject = matches[0].entry.subject;

  /**
   * Nothing matched a rule, so: did they ask about the thing, or about a
   * detail of it?
   *
   * Strip the stopwords, the words that decide an intent, and the subject's own
   * name. "Tell me about milkweed" leaves nothing, so they want the thing, and
   * the thing is its fact. "What colour are milkweed leaves" leaves "colour"
   * and "leaves", which is a question the data cannot answer, and inventing one
   * or handing back the generic fact would both be pretending otherwise.
   */
  const resolved: Intent | null =
    intent ??
    (tokenise(input.question).some(
      (word) => !INTENT_WORDS.has(word) && !matches[0].entry.tokens.has(word),
    )
      ? null
      : "fact");

  if (!resolved) {
    return refuse();
  }

  switch (subject.kind) {
    case "plant":
      return plantAnswer(subject.plant, resolved, input) ?? refuse();
    case "fungus":
      return fungusAnswer(subject.fungus, resolved, input) ?? refuse();
    case "park":
      return parkAnswer(subject.park, resolved, input) ?? refuse();
    case "area":
      return resolved === "fact" || resolved === "homes"
        ? { id: `area:${subject.id}`, text: AREA_BLURB[subject.id] }
        : refuse();
    case "concept":
      return resolved === "fact"
        ? { id: `concept:${subject.id}`, text: subject.entry.body }
        : refuse();
    case "pollinator":
      return resolved === "fact" || resolved === "visitors"
        ? { id: `pollinator:${subject.id}`, text: subject.entry.body }
        : refuse();
  }
}

// ---------------------------------------------------------------------------
// What it knows
// ---------------------------------------------------------------------------

export function vocabulary(input: {
  found: Found;
  unlockedParks: BooleanRecord;
}): { plants: number; fungi: number; parks: number } {
  // Everything found, party species included: this counts what it can actually
  // talk about, and it can talk about anything you have met. Saying "3 flowers"
  // while answering questions about a fourth is a false line in player copy.
  return {
    plants: PLANTS.filter((plant) => input.found.plants[plant.id]).length,
    fungi: FUNGI.filter((fungus) => input.found.fungi[fungus.id]).length,
    parks: PARK_LIST.filter((park) => parkOpen(park, input)).length,
  };
}

// ---------------------------------------------------------------------------
// One thing a day
// ---------------------------------------------------------------------------

export type FactInput = {
  /** `pittsburghDate()`. Passed in so a test can pin a Tuesday. */
  date: string;
  found: Found;
  quizPassed: BooleanRecord;
  unlockedParks: BooleanRecord;
  unlockedMapAreas: BooleanRecord;
};

/**
 * A true thing about something you have actually found, the same all day.
 *
 * Derived from the date and the pool, with nothing stored. The alternative was
 * freezing the choice in the save, which means a new field through `partialize`,
 * the progress payload and the cross-device merge, to buy a guarantee nobody
 * asked for. The visible consequence is that finding a new flower can change
 * today's fact, and that reads as a reward rather than a bug.
 *
 * Trivia answers are the best prose in the repository and mostly go unread, so
 * they are the first choice, with one gate: only from a species whose quiz you
 * have already passed. Otherwise the fact of the day would quietly hand you the
 * answer to a question you have not been asked yet.
 */
export function factOfTheDay(input: FactInput): Answer {
  const pool: Answer[] = [];

  for (const plant of PLANTS) {
    if (!input.found.plants[plant.id]) {
      continue;
    }

    const trivia = input.quizPassed[plant.id] ? triviaFor(plant.id) : [];
    const pick = trivia.length
      ? trivia[Math.floor(hash01(`${input.date}:${plant.id}`, 3) * trivia.length)]
      : null;

    pool.push({
      id: `plant:${plant.id}`,
      text: pick ? pick.because : `${plant.fact} ${plant.pollinatorNote}`,
      wikipedia: plant.wikipedia,
    });
  }

  for (const fungus of FUNGI) {
    if (!input.found.fungi[fungus.id]) {
      continue;
    }

    const trivia = input.quizPassed[fungus.id] ? triviaFor(fungus.id) : [];
    const pick = trivia.length
      ? trivia[Math.floor(hash01(`${input.date}:${fungus.id}`, 3) * trivia.length)]
      : null;

    pool.push({
      id: `fungus:${fungus.id}`,
      text: pick ? pick.because : `${fungus.fact} ${fungus.roleNote}`,
      wikipedia: fungus.wikipedia,
    });
  }

  for (const park of PARK_LIST) {
    // Derived, not the flag. Same reason as `parkOpen`: a save that earned a
    // park before the flag existed should hear about it.
    if (!parkOpen(park, input)) {
      continue;
    }

    pool.push({ id: `park:${park.id}`, text: park.blurb });

    for (const area of allAreas(park)) {
      if (!AREA_BLURB[area.id] || !input.unlockedMapAreas[area.id]) {
        continue;
      }

      pool.push({ id: `area:${area.id}`, text: AREA_BLURB[area.id] });
    }
  }

  /**
   * Unreachable while any park is ungated, and kept anyway.
   *
   * Frick has no `requires`, so the pool is never actually empty for a real
   * save and a brand new player is told about the park they are standing in.
   * This is the guard against indexing an empty array, not a state anybody
   * reaches; e2e/pocket.spec.ts asserts the first day out loud.
   */
  if (pool.length === 0) {
    return {
      id: "nothing-yet",
      text: "Go and find something, and I will have something to tell you about it.",
    };
  }

  // Sorted, so the order does not depend on the order the loops happen to run
  // in. The index then depends on the date and the size of the pool and nothing
  // else.
  pool.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return pool[Math.floor(hash01(input.date, 4) * pool.length)];
}
