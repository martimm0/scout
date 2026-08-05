/**
 * Field Notes: the party's writing game, for three to ten.
 *
 * Everybody gets the same kind of prompt a naturalist's notebook would have, two
 * people answer each one, and the rest of the room votes on which answer they
 * like better. Its own game with its own name: the shape is a common one, but
 * nothing here is anybody's trademark and the prompts are all written for this
 * park.
 *
 * The state machine is the whole game, and it is here as pure functions so the
 * room can referee it and the tests can play a whole round in milliseconds
 * without a browser.
 *
 *   gathering -> writing -> voting -> done
 *
 * Three rules it inherits from the rest of the game:
 *
 * **Nothing is stored.** Answers live in the room and die with the round, like
 * the chat. Nobody's joke follows them around.
 *
 * **Nothing is ranked across rounds.** There is a score inside one game because
 * a voting game needs one, and it is gone when the game is. No leaderboard, per
 * the standing rule.
 *
 * **Nobody is eliminated.** Everybody writes in every round and everybody votes
 * on everything they are not in. Losing a matchup costs you points, not turns.
 */

export const QUIP_MIN_PLAYERS = 3;
export const QUIP_MAX_PLAYERS = 10;

/** How long to write, and how long to vote. Generous: this is not a reflex game. */
export const QUIP_WRITE_SECONDS = 75;
export const QUIP_VOTE_SECONDS = 25;

export const QUIP_ANSWER_MAX = 100;

/**
 * The prompts.
 *
 * Written for this park and this game rather than borrowed: they lean on the
 * things a player has actually been looking at, which is what makes them worth
 * answering here rather than anywhere else.
 */
export const QUIP_PROMPTS: string[] = [
  "A name for a flower that only opens for ninety minutes at dawn",
  "What the skunk cabbage is thinking as it melts its way out of the ice",
  "The worst possible thing to find growing in the reservoir",
  "A bee's one-star review of a flower that gave it nothing",
  "What the Blue Slide would say if it could talk",
  "The title of a nature documentary about a single dandelion",
  "A slogan for a mushroom that is definitely not safe to eat",
  "What the oak has been meaning to tell the ivy for forty years",
  "The real reason the fireflies come out at dusk and not earlier",
  "A polite way to tell a wasp it was not invited",
  "What Panther Hollow looks like to something one centimetre long",
  "The name of a perfume made from creek mud and wild garlic",
  "Advice from an old goldenrod to a young one",
  "What the groundhog under the bowling green does all winter",
  "A warning label for a plant that is far too pleased with itself",
  "The last thing a pollen grain sees",
  "What the park does at three in the morning when nobody is looking",
  "A rejected name for the Allegheny River",
  "How a moth would explain porch lights to its children",
  "The one thing every squirrel in Frick Park agrees on",
];

export type QuipPhase = "gathering" | "writing" | "voting" | "done";

export type QuipAssignment = {
  /** Index into the round's prompt list. */
  prompt: number;
  /** The two accounts writing for it, in no particular order. */
  writers: [string, string];
};

export type QuipAnswer = {
  prompt: number;
  who: string;
  text: string;
};

export type QuipState = {
  phase: QuipPhase;
  /** Accounts in the game, in join order. */
  players: string[];
  /** The prompts drawn for this round, as indexes into QUIP_PROMPTS. */
  prompts: number[];
  assignments: QuipAssignment[];
  answers: QuipAnswer[];
  /** Which assignment is being voted on. */
  voting: number;
  /** assignment index -> voter -> the account they voted for. */
  votes: Record<number, Record<string, string>>;
  /** account -> points this game. Reset with the game, never persisted. */
  score: Record<string, number>;
  /** When the current phase runs out, epoch ms. Server clock. */
  deadline: number;
};

/**
 * Deal the round.
 *
 * Every player writes exactly twice, and no prompt goes to the same person
 * twice: pair player i with player i+1 around a circle, which gives exactly N
 * prompts for N players and two apiece with no bookkeeping. With an odd count
 * it still works, because a circle does not care.
 *
 * `pick` supplies randomness so a test can play a deterministic round; the room
 * passes `Math.random`.
 */
export function dealQuips(
  players: string[],
  now: number,
  pick: () => number = Math.random,
): QuipState {
  const count = players.length;

  // Shuffle the prompt deck, then take one per player.
  const deck = QUIP_PROMPTS.map((_, index) => index);

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(pick() * (i + 1));

    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const prompts = deck.slice(0, count);

  const assignments: QuipAssignment[] = prompts.map((prompt, index) => ({
    prompt,
    writers: [players[index], players[(index + 1) % count]],
  }));

  return {
    phase: "writing",
    players: [...players],
    prompts,
    assignments,
    answers: [],
    voting: 0,
    votes: {},
    score: Object.fromEntries(players.map((player) => [player, 0])),
    deadline: now + QUIP_WRITE_SECONDS * 1000,
  };
}

/** Whether this account was asked to write for this assignment. */
export function isWriter(
  state: QuipState,
  assignment: number,
  who: string,
): boolean {
  return state.assignments[assignment]?.writers.includes(who) ?? false;
}

export function submitQuip(
  state: QuipState,
  assignment: number,
  who: string,
  text: string,
  now: number,
): QuipState {
  const clean = text.trim().slice(0, QUIP_ANSWER_MAX);

  if (
    state.phase !== "writing" ||
    !clean ||
    !isWriter(state, assignment, who) ||
    state.answers.some(
      (answer) => answer.prompt === assignment && answer.who === who,
    )
  ) {
    return state;
  }

  const answers = [
    ...state.answers,
    { prompt: assignment, who, text: clean },
  ];

  // Everybody in, so stop waiting on the clock.
  const expected = state.assignments.length * 2;

  return answers.length >= expected
    ? startVoting({ ...state, answers }, now)
    : { ...state, answers };
}

export function startVoting(state: QuipState, now: number): QuipState {
  return {
    ...state,
    phase: "voting",
    voting: 0,
    deadline: now + QUIP_VOTE_SECONDS * 1000,
  };
}

/** The answers for one matchup, in a stable order. */
export function matchup(state: QuipState, assignment: number): QuipAnswer[] {
  return state.answers.filter((answer) => answer.prompt === assignment);
}

/**
 * Vote, unless you wrote one of them.
 *
 * Writers do not vote on their own matchup, which is the one rule that keeps it
 * honest. With three players that means exactly one voter per matchup, and that
 * is fine: somebody wins it.
 */
export function voteQuip(
  state: QuipState,
  assignment: number,
  voter: string,
  forWhom: string,
  now: number,
): QuipState {
  if (
    state.phase !== "voting" ||
    assignment !== state.voting ||
    isWriter(state, assignment, voter) ||
    !state.players.includes(voter) ||
    !matchup(state, assignment).some((answer) => answer.who === forWhom)
  ) {
    return state;
  }

  const forThis = { ...(state.votes[assignment] ?? {}), [voter]: forWhom };
  const next = { ...state, votes: { ...state.votes, [assignment]: forThis } };

  const voters = state.players.filter(
    (player) => !isWriter(state, assignment, player),
  );

  return Object.keys(forThis).length >= voters.length
    ? closeMatchup(next, now)
    : next;
}

/** Score the current matchup and move to the next, or end the game. */
export function closeMatchup(state: QuipState, now: number): QuipState {
  const assignment = state.voting;
  const cast = state.votes[assignment] ?? {};
  const score = { ...state.score };

  for (const who of Object.values(cast)) {
    score[who] = (score[who] ?? 0) + 1;
  }

  const next = assignment + 1;

  if (next >= state.assignments.length) {
    return { ...state, score, phase: "done", deadline: now };
  }

  return {
    ...state,
    score,
    voting: next,
    deadline: now + QUIP_VOTE_SECONDS * 1000,
  };
}

/**
 * The clock ran out. Move on regardless.
 *
 * A game that waits forever for somebody who has wandered off is a game that
 * ends when one person closes a tab, so every phase can always be pushed along.
 * Missing answers are simply missing: the matchup runs with one answer, or none,
 * and nobody is scolded for not writing one.
 */
export function quipTimeout(state: QuipState, now: number): QuipState {
  if (state.phase === "writing") {
    return startVoting(state, now);
  }

  if (state.phase === "voting") {
    return closeMatchup(state, now);
  }

  return state;
}

/**
 * Somebody left.
 *
 * They stop being a player and stop being expected to answer or vote, but their
 * answers stay in the round: a matchup with one writer gone is still a matchup
 * the room can vote on, and deleting their words mid-vote would be stranger than
 * leaving them.
 */
export function quipLeave(state: QuipState, who: string, now: number): QuipState {
  const players = state.players.filter((player) => player !== who);

  if (players.length < QUIP_MIN_PLAYERS) {
    return { ...state, players, phase: "done", deadline: now };
  }

  return { ...state, players };
}
