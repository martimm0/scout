import {
  GAME_SEATS,
  type GameKind,
  type TableView,
} from "../protocol";
import {
  connectFourFull,
  connectFourWinner,
  emptyConnectFour,
  emptyOthello,
  emptyTicTacToe,
  othelloLegalMoves,
  othelloNextSeat,
  playConnectFour,
  playOthello,
  playTicTacToe,
  ticTacToeFull,
  ticTacToeWinner,
  type Seat,
} from "./boards";
import {
  dealQuips,
  quipLeave,
  quipTimeout,
  submitQuip,
  voteQuip,
  type QuipState,
} from "./quips";

/**
 * Hosting the party games.
 *
 * The room holds a LIST of tables rather than "the current game", because
 * several games at once in one party is the point: two people can be playing
 * othello in the corner while five others write field notes.
 *
 * Everything here is a pure transition over a table, for the same reason the
 * rules are: the room calls these, and so can a test, without a socket.
 *
 * Tables are never written to storage. A hibernating room forgets its games,
 * which is correct: an empty room has nothing in progress worth resuming, and
 * it keeps the Durable Object free of stored state.
 */

export type Table = {
  id: string;
  kind: GameKind;
  seats: string[];
  names: string[];
  turn: number;
  state: unknown;
  finished: boolean;
  ended?: "left";
  /** When the current phase runs out, epoch ms. Quips only; 0 means no clock. */
  deadline: number;
};

export function openTable(
  id: string,
  kind: GameKind,
  who: string,
  name: string,
): Table {
  return {
    id,
    kind,
    seats: [who],
    names: [name],
    turn: 0,
    // A board game's board exists from the moment the table does, so a player
    // waiting for an opponent can see what they are waiting to play. Quips has
    // nothing to show until it is dealt.
    state: freshState(kind),
    finished: false,
    deadline: 0,
  };
}

function freshState(kind: GameKind): unknown {
  switch (kind) {
    case "tictactoe":
      return emptyTicTacToe();
    case "connect4":
      return emptyConnectFour();
    case "othello":
      return emptyOthello();
    case "quips":
      return null;
  }
}

export function tableIsOpen(table: Table): boolean {
  return (
    !table.finished && table.seats.length < GAME_SEATS[table.kind].max
  );
}

export function sitDown(table: Table, who: string, name: string): Table {
  if (!tableIsOpen(table) || table.seats.includes(who)) {
    return table;
  }

  return {
    ...table,
    seats: [...table.seats, who],
    names: [...table.names, name],
  };
}

/**
 * Whether a two-player game can be played at all.
 *
 * Board games start the moment the second player sits: there is nothing to
 * agree on and waiting for somebody to press Ready is a step that only ever
 * loses people. Quips waits, because a round has to be dealt and the dealer
 * needs to know how many are in.
 */
export function tableReady(table: Table): boolean {
  return table.seats.length >= GAME_SEATS[table.kind].min;
}

export function beginQuips(table: Table, now: number, pick?: () => number): Table {
  if (
    table.kind !== "quips" ||
    table.state !== null ||
    !tableReady(table)
  ) {
    return table;
  }

  const state = dealQuips(table.seats, now, pick);

  return { ...table, state, deadline: state.deadline };
}

/**
 * Apply a move, or return the table untouched.
 *
 * The single most important property here: an illegal move is impossible rather
 * than merely discouraged. Every rules function returns null for anything it
 * will not allow, so this is "apply it, and if nothing comes back, nothing
 * happened". A malformed move from a broken client and a cheat from a clever
 * one take exactly the same path.
 */
export function applyMove(
  table: Table,
  who: string,
  move: unknown,
  now: number,
): Table {
  if (table.finished) {
    return table;
  }

  if (table.kind === "quips") {
    return applyQuipMove(table, who, move, now);
  }

  const seat = table.seats.indexOf(who);

  // Not at this table, or not your turn.
  if (seat < 0 || seat !== table.turn || !tableReady(table)) {
    return table;
  }

  const cell = typeof move === "number" ? move : Number.NaN;

  switch (table.kind) {
    case "tictactoe": {
      const next = playTicTacToe(
        table.state as (Seat | null)[],
        cell,
        seat as Seat,
      );

      if (!next) {
        return table;
      }

      const done =
        ticTacToeWinner(next) !== null || ticTacToeFull(next);

      return {
        ...table,
        state: next,
        turn: seat === 0 ? 1 : 0,
        finished: done,
      };
    }

    case "connect4": {
      const next = playConnectFour(
        table.state as Seat[][],
        cell,
        seat as Seat,
      );

      if (!next) {
        return table;
      }

      const done =
        connectFourWinner(next) !== null || connectFourFull(next);

      return {
        ...table,
        state: next,
        turn: seat === 0 ? 1 : 0,
        finished: done,
      };
    }

    case "othello": {
      const next = playOthello(
        table.state as (Seat | null)[],
        cell,
        seat as Seat,
      );

      if (!next) {
        return table;
      }

      /**
       * The pass. `othelloNextSeat` may hand the turn straight back, because a
       * player with no legal move sits out, and returns null when neither side
       * can move, which ends the game with squares still empty.
       */
      const following = othelloNextSeat(next, seat as Seat);

      return {
        ...table,
        state: next,
        turn: following ?? table.turn,
        finished: following === null,
      };
    }
  }
}

type QuipMove =
  | { do: "answer"; assignment: number; text: string }
  | { do: "vote"; assignment: number; forWhom: string };

function applyQuipMove(
  table: Table,
  who: string,
  move: unknown,
  now: number,
): Table {
  const state = table.state as QuipState | null;

  if (!state || !move || typeof move !== "object") {
    return table;
  }

  const request = move as QuipMove;
  let next = state;

  if (
    request.do === "answer" &&
    typeof request.assignment === "number" &&
    typeof request.text === "string"
  ) {
    next = submitQuip(state, request.assignment, who, request.text, now);
  } else if (
    request.do === "vote" &&
    typeof request.assignment === "number" &&
    typeof request.forWhom === "string"
  ) {
    next = voteQuip(state, request.assignment, who, request.forWhom, now);
  }

  if (next === state) {
    return table;
  }

  return {
    ...table,
    state: next,
    finished: next.phase === "done",
    deadline: next.deadline,
  };
}

/**
 * The clock ran out on a phase.
 *
 * Only Field Notes has one. The board games sit untouched for as long as the
 * players like, because a turn timer on a friendly game of noughts and crosses
 * would be inventing pressure the game does not want.
 */
export function tableTimeout(table: Table, now: number): Table {
  if (table.kind !== "quips" || !table.state || table.finished) {
    return table;
  }

  const next = quipTimeout(table.state as QuipState, now);

  return {
    ...table,
    state: next,
    finished: next.phase === "done",
    deadline: next.deadline,
  };
}

/**
 * Somebody left the room, or stood up.
 *
 * A two-player game ends and SAYS somebody left, rather than declaring the
 * other player the winner. Winning because your opponent's train went into a
 * tunnel is not winning, and there is no leaderboard for it to count towards.
 *
 * Field Notes carries on as long as three remain.
 */
export function standUp(table: Table, who: string, now: number): Table {
  if (!table.seats.includes(who)) {
    return table;
  }

  const index = table.seats.indexOf(who);
  const seats = table.seats.filter((seat) => seat !== who);
  const names = table.names.filter((_, at) => at !== index);

  if (table.kind === "quips") {
    const state = table.state as QuipState | null;
    const next = state ? quipLeave(state, who, now) : null;

    return {
      ...table,
      seats,
      names,
      state: next,
      finished: next ? next.phase === "done" : seats.length === 0,
      deadline: next?.deadline ?? 0,
    };
  }

  // Nobody had started yet, so the table simply loses a chair.
  if (!tableReady(table)) {
    return { ...table, seats, names, finished: seats.length === 0 };
  }

  return { ...table, seats, names, finished: true, ended: "left" };
}

/** Tables nobody is at, or that finished a while ago, stop being listed. */
export function tableIsStale(table: Table, now: number, finishedFor: number) {
  if (table.seats.length === 0) {
    return true;
  }

  return table.finished && table.deadline > 0 && now - table.deadline > finishedFor;
}

export function tableView(table: Table): TableView {
  return {
    id: table.id,
    kind: table.kind,
    seats: table.seats,
    names: table.names,
    turn: table.turn,
    state: table.state,
    finished: table.finished,
    ended: table.ended,
  };
}

/**
 * The moves a seat may legally make right now.
 *
 * Exported so the BOARD can grey out what would be refused, using the same
 * function the server refuses with. Two implementations of "is this legal"
 * would eventually disagree, and the one the player sees would be the wrong one.
 */
export function legalMovesFor(table: Table, who: string): number[] {
  const seat = table.seats.indexOf(who);

  if (table.finished || seat < 0 || seat !== table.turn || !tableReady(table)) {
    return [];
  }

  switch (table.kind) {
    case "tictactoe": {
      const board = table.state as (Seat | null)[];

      return board.flatMap((cell, at) => (cell === null ? [at] : []));
    }

    case "connect4": {
      const board = table.state as Seat[][];

      return board.flatMap((stack, column) =>
        stack.length < 6 ? [column] : [],
      );
    }

    case "othello":
      return othelloLegalMoves(table.state as (Seat | null)[], seat as Seat);

    case "quips":
      return [];
  }
}
