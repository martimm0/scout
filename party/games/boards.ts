/**
 * The rules of the party games, as pure functions.
 *
 * These live under `party/` rather than `src/` because BOTH sides need them and
 * the server is the one that matters: the room referees every move, so the rules
 * have to be importable by a Cloudflare worker as well as a browser. Sharing one
 * copy is also the only way the client's idea of a legal move cannot drift from
 * the server's.
 *
 * No React, no sockets, no randomness that is not passed in. Every function here
 * takes a state and returns a new one, which is what makes them testable without
 * a browser: the othello flip logic in particular has more edge cases than any
 * amount of clicking would find.
 */

/** Two-player games share a seat model: seat 0 moves first. */
export type Seat = 0 | 1;

/* ------------------------------------------------------------------ *
 * Seed and Sprout (tic-tac-toe)
 * ------------------------------------------------------------------ */

/** Nine cells, null for empty. Row-major. */
export type TicTacToe = (Seat | null)[];

export function emptyTicTacToe(): TicTacToe {
  return Array<Seat | null>(9).fill(null);
}

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function ticTacToeWinner(board: TicTacToe): Seat | null {
  for (const [a, b, c] of TTT_LINES) {
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }

  return null;
}

export function ticTacToeFull(board: TicTacToe): boolean {
  return board.every((cell) => cell !== null);
}

/** Returns the new board, or null if the move was not legal. */
export function playTicTacToe(
  board: TicTacToe,
  cell: number,
  seat: Seat,
): TicTacToe | null {
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell > 8 ||
    board[cell] !== null ||
    ticTacToeWinner(board) !== null
  ) {
    return null;
  }

  const next = [...board];

  next[cell] = seat;

  return next;
}

/* ------------------------------------------------------------------ *
 * Trellis Four (connect four)
 * ------------------------------------------------------------------ */

export const C4_COLUMNS = 7;
export const C4_ROWS = 6;

/** Column-major: `board[column]` is a stack, bottom first. */
export type ConnectFour = Seat[][];

export function emptyConnectFour(): ConnectFour {
  return Array.from({ length: C4_COLUMNS }, () => []);
}

export function playConnectFour(
  board: ConnectFour,
  column: number,
  seat: Seat,
): ConnectFour | null {
  if (
    !Number.isInteger(column) ||
    column < 0 ||
    column >= C4_COLUMNS ||
    board[column].length >= C4_ROWS ||
    connectFourWinner(board) !== null
  ) {
    return null;
  }

  return board.map((stack, index) =>
    index === column ? [...stack, seat] : stack,
  );
}

function seatAt(board: ConnectFour, column: number, row: number): Seat | null {
  return board[column]?.[row] ?? null;
}

export function connectFourWinner(board: ConnectFour): Seat | null {
  // Four directions is enough: the opposite of each is covered by starting from
  // every cell.
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (let column = 0; column < C4_COLUMNS; column += 1) {
    for (let row = 0; row < C4_ROWS; row += 1) {
      const seat = seatAt(board, column, row);

      if (seat === null) {
        continue;
      }

      for (const [dc, dr] of directions) {
        let run = 1;

        while (
          run < 4 &&
          seatAt(board, column + dc * run, row + dr * run) === seat
        ) {
          run += 1;
        }

        if (run === 4) {
          return seat;
        }
      }
    }
  }

  return null;
}

export function connectFourFull(board: ConnectFour): boolean {
  return board.every((stack) => stack.length >= C4_ROWS);
}

/* ------------------------------------------------------------------ *
 * Leaf Turn (othello / reversi)
 * ------------------------------------------------------------------ */

export const OTHELLO_SIZE = 8;

/** Row-major, 64 cells. */
export type Othello = (Seat | null)[];

export function emptyOthello(): Othello {
  const board = Array<Seat | null>(OTHELLO_SIZE * OTHELLO_SIZE).fill(null);

  // The standard opening four in the middle.
  board[27] = 1;
  board[28] = 0;
  board[35] = 0;
  board[36] = 1;

  return board;
}

const OTHELLO_DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * Every cell this move would turn over, or an empty array if it turns none.
 *
 * A move that flips nothing is not legal in othello, so this doubles as the
 * legality check and there is no second function that could disagree with it.
 */
export function othelloFlips(
  board: Othello,
  cell: number,
  seat: Seat,
): number[] {
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= board.length ||
    board[cell] !== null
  ) {
    return [];
  }

  const row = Math.floor(cell / OTHELLO_SIZE);
  const column = cell % OTHELLO_SIZE;
  const flips: number[] = [];

  for (const [dr, dc] of OTHELLO_DIRECTIONS) {
    const run: number[] = [];

    let r = row + dr;
    let c = column + dc;

    // Walk over the opponent's leaves...
    while (r >= 0 && r < OTHELLO_SIZE && c >= 0 && c < OTHELLO_SIZE) {
      const here = board[r * OTHELLO_SIZE + c];

      if (here === null) {
        break;
      }

      if (here === seat) {
        // ...and only count them if one of yours closes the line.
        flips.push(...run);
        break;
      }

      run.push(r * OTHELLO_SIZE + c);
      r += dr;
      c += dc;
    }
  }

  return flips;
}

export function othelloLegalMoves(board: Othello, seat: Seat): number[] {
  const moves: number[] = [];

  for (let cell = 0; cell < board.length; cell += 1) {
    if (othelloFlips(board, cell, seat).length > 0) {
      moves.push(cell);
    }
  }

  return moves;
}

export function playOthello(
  board: Othello,
  cell: number,
  seat: Seat,
): Othello | null {
  const flips = othelloFlips(board, cell, seat);

  if (flips.length === 0) {
    return null;
  }

  const next = [...board];

  next[cell] = seat;

  for (const flipped of flips) {
    next[flipped] = seat;
  }

  return next;
}

export function othelloScore(board: Othello): [number, number] {
  let dark = 0;
  let light = 0;

  for (const cell of board) {
    if (cell === 0) {
      dark += 1;
    } else if (cell === 1) {
      light += 1;
    }
  }

  return [dark, light];
}

/**
 * Whose turn it is after a move, allowing for a pass.
 *
 * Othello's one genuinely awkward rule: a player with no legal move **passes**,
 * and if neither player has one the game is over. Getting this wrong is how an
 * othello implementation deadlocks with squares still empty, so it lives here
 * rather than being re-derived by whoever renders the board.
 *
 * Returns null when neither side can move, which is the end of the game.
 */
export function othelloNextSeat(board: Othello, justMoved: Seat): Seat | null {
  const other = (justMoved === 0 ? 1 : 0) as Seat;

  if (othelloLegalMoves(board, other).length > 0) {
    return other;
  }

  if (othelloLegalMoves(board, justMoved).length > 0) {
    return justMoved;
  }

  return null;
}
