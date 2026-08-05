import { expect, test } from "@playwright/test";

import {
  C4_COLUMNS,
  C4_ROWS,
  connectFourFull,
  connectFourWinner,
  emptyConnectFour,
  emptyOthello,
  emptyTicTacToe,
  othelloFlips,
  othelloLegalMoves,
  othelloNextSeat,
  othelloScore,
  playConnectFour,
  playOthello,
  playTicTacToe,
  ticTacToeFull,
  ticTacToeWinner,
  type Seat,
} from "../party/games/boards";
import {
  QUIP_MAX_PLAYERS,
  QUIP_MIN_PLAYERS,
  QUIP_PROMPTS,
  closeMatchup,
  dealQuips,
  isWriter,
  matchup,
  quipLeave,
  quipTimeout,
  submitQuip,
  voteQuip,
} from "../party/games/quips";

/**
 * The party games, as arithmetic.
 *
 * No browser and no socket: these are the rules the ROOM referees, and the room
 * is the only thing that decides whether a move is legal. Testing them here
 * rather than by clicking is not a shortcut, it is the only way to reach the
 * cases that matter. A person clicking an othello board will not find the
 * position where both players must pass, and that position is how an othello
 * implementation deadlocks with squares still empty.
 */

test.describe("seed and sprout", () => {
  test("a line wins, and the win freezes the board", () => {
    let board = emptyTicTacToe();

    board = playTicTacToe(board, 0, 0)!;
    board = playTicTacToe(board, 3, 1)!;
    board = playTicTacToe(board, 1, 0)!;
    board = playTicTacToe(board, 4, 1)!;

    expect(ticTacToeWinner(board)).toBeNull();

    board = playTicTacToe(board, 2, 0)!;

    expect(ticTacToeWinner(board)).toBe(0);

    // And nothing more can be played onto a finished board.
    expect(playTicTacToe(board, 5, 1)).toBeNull();
  });

  test("an occupied cell and an off-board cell are both refused", () => {
    const board = playTicTacToe(emptyTicTacToe(), 4, 0)!;

    expect(playTicTacToe(board, 4, 1), "played on top of a taken cell").toBeNull();
    expect(playTicTacToe(board, 9, 1)).toBeNull();
    expect(playTicTacToe(board, -1, 1)).toBeNull();
    expect(playTicTacToe(board, 1.5, 1)).toBeNull();
  });

  test("a full board with no line is a draw rather than a win", () => {
    // 0 1 0
    // 0 1 1
    // 1 0 0
    const seats: Seat[] = [0, 1, 0, 0, 1, 1, 1, 0, 0];
    const board = seats.slice() as (Seat | null)[];

    expect(ticTacToeFull(board)).toBe(true);
    expect(ticTacToeWinner(board)).toBeNull();
  });
});

test.describe("trellis four", () => {
  test("seeds stack from the bottom and a column fills up", () => {
    let board = emptyConnectFour();

    for (let i = 0; i < C4_ROWS; i += 1) {
      board = playConnectFour(board, 3, (i % 2) as Seat)!;
    }

    expect(board[3]).toHaveLength(C4_ROWS);
    expect(
      playConnectFour(board, 3, 0),
      "a seventh seed went into a six-deep column",
    ).toBeNull();
  });

  test("four in a row wins in every direction", () => {
    // Vertical.
    let board = emptyConnectFour();

    for (let i = 0; i < 3; i += 1) {
      board = playConnectFour(board, 0, 0)!;
    }

    expect(connectFourWinner(board)).toBeNull();
    board = playConnectFour(board, 0, 0)!;
    expect(connectFourWinner(board)).toBe(0);

    // Horizontal.
    board = emptyConnectFour();
    for (let column = 0; column < 4; column += 1) {
      board = playConnectFour(board, column, 1)!;
    }
    expect(connectFourWinner(board)).toBe(1);

    // Diagonal, built as a staircase.
    board = emptyConnectFour();
    for (let column = 0; column < 4; column += 1) {
      for (let below = 0; below < column; below += 1) {
        board = playConnectFour(board, column, 1)!;
      }

      board = playConnectFour(board, column, 0)!;
    }

    expect(connectFourWinner(board), "no diagonal win found").toBe(0);
  });

  test("a full board with no four is a draw", () => {
    /**
     * `(row + 2 * column) mod 4` in bands of two.
     *
     * Every direction breaks: along a row the value steps by two, so colours
     * alternate singly; up a column it steps by one, giving runs of two; and
     * both diagonals step by three and one, which also cap at two. My first
     * attempt at this was hand-drawn pairs and it quietly contained a diagonal
     * of four, which the test caught and I had not.
     */
    const board = emptyConnectFour();

    for (let column = 0; column < C4_COLUMNS; column += 1) {
      for (let row = 0; row < C4_ROWS; row += 1) {
        board[column].push((((row + 2 * column) % 4) < 2 ? 0 : 1) as Seat);
      }
    }

    expect(connectFourFull(board)).toBe(true);
    expect(connectFourWinner(board)).toBeNull();
  });
});

test.describe("leaf turn", () => {
  test("the opening has four leaves and four legal moves each", () => {
    const board = emptyOthello();

    expect(othelloScore(board)).toEqual([2, 2]);
    expect(othelloLegalMoves(board, 0)).toHaveLength(4);
    expect(othelloLegalMoves(board, 1)).toHaveLength(4);
  });

  test("a move must turn something over, or it is not a move", () => {
    const board = emptyOthello();

    // A corner flips nothing at the start.
    expect(othelloFlips(board, 0, 0)).toEqual([]);
    expect(playOthello(board, 0, 0)).toBeNull();

    // And an occupied cell is refused.
    expect(playOthello(board, 27, 0)).toBeNull();
  });

  test("a legal move turns the line and the count follows it", () => {
    const board = emptyOthello();

    // 19 is above 27, closing the line 19-27-35 for seat 0.
    expect(othelloFlips(board, 19, 0)).toEqual([27]);

    const next = playOthello(board, 19, 0)!;

    expect(next[19]).toBe(0);
    expect(next[27], "the leaf between did not turn").toBe(0);
    expect(othelloScore(next)).toEqual([4, 1]);
  });

  test("a run only turns when your own leaf closes it", () => {
    /**
     * The rule that separates othello from a colouring book: a line of the
     * other player's leaves that runs off the edge, or into a gap, turns
     * nothing at all.
     */
    const board = Array<Seat | null>(64).fill(null);

    // Seat 1 along a row, with nothing of seat 0 to close it.
    board[1] = 1;
    board[2] = 1;
    board[3] = 1;

    expect(othelloFlips(board, 0, 0)).toEqual([]);

    // Now close it, and the whole run turns.
    board[4] = 0;
    expect(othelloFlips(board, 0, 0).sort()).toEqual([1, 2, 3]);
  });

  test("a player with no move passes, and the turn comes back", () => {
    /**
     * The awkward one. Seat 1 has nothing legal, so the turn returns to seat 0
     * rather than stalling on a player who cannot act.
     */
    /**
     * Seat 0 owns the board except for a single leaf of seat 1, with exactly
     * one empty cell beside it.
     *
     * Seat 1 cannot move anywhere: closing a line needs one of your OWN leaves
     * at the far end, and its only leaf is immediately adjacent, so every run
     * it could claim is empty. Seat 0 can play the gap and take that leaf.
     *
     * My first attempt left the far corner empty instead, which looked stuck
     * and was not: seat 1 could play the corner and close a diagonal running
     * the whole width of the board back to its own leaf. The test found that;
     * I would not have.
     */
    const board = Array<Seat | null>(64).fill(0) as (Seat | null)[];

    board[1] = 1;
    board[0] = null;

    expect(othelloLegalMoves(board, 1), "seat 1 should be stuck").toEqual([]);
    expect(
      othelloLegalMoves(board, 0),
      "seat 0 should still have the gap to play",
    ).toEqual([0]);
    expect(othelloNextSeat(board, 0), "the turn did not come back").toBe(0);
  });

  test("when neither player can move the game is over", () => {
    // A completely full board: nobody has anywhere to go.
    const board = Array<Seat | null>(64).fill(0);

    expect(othelloNextSeat(board, 0), "a full board did not end").toBeNull();
    expect(othelloNextSeat(board, 1)).toBeNull();
  });
});

test.describe("field notes", () => {
  const players = ["a", "b", "c", "d"];

  /** Deterministic deal, so a round plays the same way every run. */
  const deal = () => dealQuips(players, 1000, () => 0.5);

  test("everybody writes exactly twice, and never against themselves", () => {
    const state = deal();

    expect(state.assignments).toHaveLength(players.length);

    for (const player of players) {
      const mine = state.assignments.filter((assignment) =>
        assignment.writers.includes(player),
      );

      expect(mine, `${player} was not given two prompts`).toHaveLength(2);
    }

    for (const assignment of state.assignments) {
      expect(
        assignment.writers[0],
        "somebody was paired with themselves",
      ).not.toBe(assignment.writers[1]);
    }
  });

  test("the prompts are all real, and no prompt is dealt twice", () => {
    const state = deal();

    expect(new Set(state.prompts).size).toBe(state.prompts.length);

    for (const prompt of state.prompts) {
      expect(QUIP_PROMPTS[prompt]).toBeTruthy();
    }
  });

  test("only the two writers can answer, and only once each", () => {
    let state = deal();
    const [first, second] = state.assignments[0].writers;
    const stranger = players.find(
      (player) => player !== first && player !== second,
    )!;

    state = submitQuip(state, 0, stranger, "not mine to answer", 1000);
    expect(matchup(state, 0), "a non-writer got an answer in").toHaveLength(0);

    state = submitQuip(state, 0, first, "a real answer", 1000);
    expect(matchup(state, 0)).toHaveLength(1);

    state = submitQuip(state, 0, first, "second bite", 1000);
    expect(matchup(state, 0), "the same writer answered twice").toHaveLength(1);

    state = submitQuip(state, 0, second, "  ", 1000);
    expect(matchup(state, 0), "blank answer accepted").toHaveLength(1);

    expect(isWriter(state, 0, first)).toBe(true);
    expect(isWriter(state, 0, stranger)).toBe(false);
  });

  test("writers do not vote on their own matchup", () => {
    let state = deal();

    for (const assignment of [0, 1, 2, 3]) {
      for (const writer of state.assignments[assignment].writers) {
        state = submitQuip(state, assignment, writer, `${writer}-${assignment}`, 1000);
      }
    }

    expect(state.phase, "writing did not close when everybody was in").toBe(
      "voting",
    );

    const [writerA] = state.assignments[0].writers;

    state = voteQuip(state, 0, writerA, writerA, 2000);
    expect(
      state.votes[0]?.[writerA],
      "a writer voted on their own matchup",
    ).toBeUndefined();
  });

  test("a full vote scores the winner and moves on", () => {
    let state = deal();

    for (const assignment of [0, 1, 2, 3]) {
      for (const writer of state.assignments[assignment].writers) {
        state = submitQuip(state, assignment, writer, `${writer}-${assignment}`, 1000);
      }
    }

    const [winner] = state.assignments[0].writers;
    const voters = players.filter((player) => !isWriter(state, 0, player));

    for (const voter of voters) {
      state = voteQuip(state, 0, voter, winner, 2000);
    }

    expect(state.score[winner]).toBe(voters.length);
    expect(state.voting, "did not move to the next matchup").toBe(1);
  });

  test("the clock always moves the game along", () => {
    /**
     * Nobody answers, nobody votes, and it still finishes. A game that waits
     * forever for somebody who wandered off is a game one closed tab ends for
     * everybody else.
     */
    let state = deal();

    state = quipTimeout(state, 2000);
    expect(state.phase).toBe("voting");

    for (let i = 0; i < players.length; i += 1) {
      state = quipTimeout(state, 3000 + i);
    }

    expect(state.phase, "the round never ended on its own").toBe("done");
  });

  test("dropping below three players ends it", () => {
    let state = deal();

    state = quipLeave(state, "d", 5000);
    expect(state.phase).toBe("writing");

    state = quipLeave(state, "c", 5000);
    expect(state.players).toHaveLength(2);
    expect(state.phase, "a game carried on with two players").toBe("done");
  });

  test("the player bounds are what the lobby will enforce", () => {
    expect(QUIP_MIN_PLAYERS).toBe(3);
    expect(QUIP_MAX_PLAYERS).toBe(10);

    // Enough prompts that a full room never runs the deck dry.
    expect(QUIP_PROMPTS.length).toBeGreaterThanOrEqual(QUIP_MAX_PLAYERS);
  });

  test("closing the last matchup ends the game", () => {
    let state = deal();

    state = { ...state, phase: "voting", voting: state.assignments.length - 1 };
    state = closeMatchup(state, 9000);

    expect(state.phase).toBe("done");
  });
});
