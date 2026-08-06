"use client";

import { useState } from "react";

import {
  C4_COLUMNS,
  C4_ROWS,
  connectFourWinner,
  othelloFlips,
  othelloScore,
  ticTacToeWinner,
  type Seat,
} from "@party/games/boards";
import {
  QUIP_PROMPTS,
  matchup,
  type QuipState,
} from "@party/games/quips";
import {
  GAME_NAMES,
  GAME_SEATS,
  type GameKind,
  type TableView,
} from "@party/protocol";
import {
  beginTable,
  leaveTable,
  openTable,
  sendMove,
  sitAtTable,
} from "../state/party-client";
import { usePartyStore } from "../state/party-store";
import styles from "./party-games.module.css";

/**
 * The games you can play with the people in the park.
 *
 * Four of them, several at once, and none of them worth anything to your field
 * notes: a garden party is a place to be with other people, and these are what
 * you do while you are there. Nothing here is ranked, saved, or counted towards
 * a badge, which is the standing rule about competition kept rather than bent.
 *
 * The room referees every move. This file asks and draws; it never decides. The
 * one place it uses the rules directly is to grey out moves that would be
 * refused, and it uses the SAME functions the server refuses with, because two
 * implementations of "is this legal" would eventually disagree and the one the
 * player can see would be the wrong one.
 */

const KINDS: GameKind[] = ["tictactoe", "connect4", "othello", "quips"];

const BLURBS: Record<GameKind, string> = {
  tictactoe: "Three in a row. Two players.",
  connect4: "Drop seeds down the trellis. Four in a line, two players.",
  othello: "Turn the leaves to your side. Two players.",
  quips: "Answer a field note, then vote on the best. Three to ten.",
};

export function PartyGames() {
  const status = usePartyStore((state) => state.status);
  const tables = usePartyStore((state) => state.tables);
  const you = usePartyStore((state) => state.you?.sub ?? "");
  const [open, setOpen] = useState(false);

  if (status !== "in") {
    return null;
  }

  /**
   * The table you are sitting at, finished or not.
   *
   * The `finished` check does not belong here, and having it here was a real
   * bug: the moment somebody won, the board stopped matching and the panel
   * snapped back to the lobby, so the one thing you were waiting to see went by
   * in a single frame. You leave a table by standing up, not by winning.
   */
  const mine = tables.find((table) => table.seats.includes(you));

  // At a table, the board IS the panel. Everything else is out of the way.
  if (mine) {
    return <Board table={mine} you={you} />;
  }

  return (
    <section aria-label="Party games" className={styles.lobby}>
      <button
        aria-expanded={open}
        className={styles.toggle}
        onClick={() => setOpen((was) => !was)}
        type="button"
      >
        <span className={styles.toggleLabel}>Games</span>
        <span className={styles.toggleCue}>
          {tables.length > 0 ? `${tables.length} on` : open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div className={styles.body}>
          {tables.length > 0 ? (
            <ul className={styles.tables}>
              {tables.map((table) => (
                <li className={styles.table} key={table.id}>
                  <span className={styles.tableName}>
                    {GAME_NAMES[table.kind]}
                  </span>
                  <span className={styles.tableWho}>
                    {table.names.join(", ")}
                    {table.finished ? " · finished" : ""}
                  </span>
                  {!table.finished &&
                  table.seats.length < GAME_SEATS[table.kind].max ? (
                    <button
                      className={styles.sit}
                      onClick={() => sitAtTable(table.id)}
                      type="button"
                    >
                      Sit down
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <ul className={styles.kinds}>
            {KINDS.map((kind) => (
              <li key={kind}>
                <button
                  className={styles.start}
                  onClick={() => openTable(kind)}
                  type="button"
                >
                  <span className={styles.startName}>{GAME_NAMES[kind]}</span>
                  <span className={styles.startNote}>{BLURBS[kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Board({ table, you }: { table: TableView; you: string }) {
  const seat = table.seats.indexOf(you) as Seat;
  const waiting = table.seats.length < GAME_SEATS[table.kind].min;
  const yours = !waiting && table.turn === seat && !table.finished;

  return (
    <section aria-label={GAME_NAMES[table.kind]} className={styles.board}>
      <header className={styles.boardHead}>
        <span className={styles.boardName}>{GAME_NAMES[table.kind]}</span>
        <button
          className={styles.stand}
          onClick={() => leaveTable(table.id)}
          type="button"
        >
          {table.finished ? "Done" : "Stand up"}
        </button>
      </header>

      <p className={styles.status}>
        <Status table={table} you={you} seat={seat} />
      </p>

      {table.kind === "tictactoe" ? (
        <TicTacToeBoard table={table} yours={yours} />
      ) : table.kind === "connect4" ? (
        <ConnectFourBoard table={table} yours={yours} />
      ) : table.kind === "othello" ? (
        <OthelloBoard table={table} seat={seat} yours={yours} />
      ) : (
        <Quips table={table} you={you} />
      )}
    </section>
  );
}

function Status({
  table,
  you,
  seat,
}: {
  table: TableView;
  you: string;
  seat: Seat;
}) {
  if (table.ended === "left") {
    // Not "you win". Winning because somebody's train went into a tunnel is not
    // winning, and there is no leaderboard for it to count towards anyway.
    return <>They stood up, so that is that.</>;
  }

  if (table.seats.length < GAME_SEATS[table.kind].min) {
    return table.kind === "quips" ? (
      <>
        Waiting for players. {table.seats.length} of{" "}
        {GAME_SEATS.quips.min} needed to start.
      </>
    ) : (
      <>Waiting for somebody to sit down.</>
    );
  }

  if (table.kind === "quips") {
    return <QuipStatus table={table} you={you} />;
  }

  if (table.finished) {
    const won =
      table.kind === "tictactoe"
        ? ticTacToeWinner(table.state as (Seat | null)[])
        : table.kind === "connect4"
          ? connectFourWinner(table.state as Seat[][])
          : othelloWinnerOf(table);

    if (won === null) {
      return <>A draw, which is the commonest ending there is.</>;
    }

    return won === seat ? (
      <>You won that one.</>
    ) : (
      <>{table.names[won]} took it.</>
    );
  }

  return table.turn === seat ? (
    <>Your turn.</>
  ) : (
    <>{table.names[table.turn]}&apos;s turn.</>
  );
}

function othelloWinnerOf(table: TableView): Seat | null {
  const [dark, light] = othelloScore(table.state as (Seat | null)[]);

  if (dark === light) {
    return null;
  }

  return dark > light ? 0 : 1;
}

function TicTacToeBoard({
  table,
  yours,
}: {
  table: TableView;
  yours: boolean;
}) {
  const board = table.state as (Seat | null)[];

  return (
    <div className={styles.grid} data-game="tictactoe" role="grid">
      {board.map((cell, at) => (
        <button
          aria-label={`Cell ${at + 1}`}
          className={styles.cell}
          data-seat={cell === null ? undefined : cell}
          disabled={!yours || cell !== null}
          key={at}
          onClick={() => sendMove(table.id, at)}
          type="button"
        >
          {cell === 0 ? "🌱" : cell === 1 ? "🌾" : ""}
        </button>
      ))}
    </div>
  );
}

function ConnectFourBoard({
  table,
  yours,
}: {
  table: TableView;
  yours: boolean;
}) {
  const board = table.state as Seat[][];

  return (
    <div className={styles.trellis}>
      {Array.from({ length: C4_COLUMNS }, (_, column) => (
        <button
          aria-label={`Column ${column + 1}`}
          className={styles.column}
          disabled={!yours || board[column].length >= C4_ROWS}
          key={column}
          onClick={() => sendMove(table.id, column)}
          type="button"
        >
          {/* Drawn top down, so the newest seed is where it landed. */}
          {Array.from({ length: C4_ROWS }, (_, fromTop) => {
            const row = C4_ROWS - 1 - fromTop;
            const seat = board[column][row];

            return (
              <span
                className={styles.slot}
                data-seat={seat === undefined ? undefined : seat}
                key={row}
              />
            );
          })}
        </button>
      ))}
    </div>
  );
}

function OthelloBoard({
  table,
  seat,
  yours,
}: {
  table: TableView;
  seat: Seat;
  yours: boolean;
}) {
  const board = table.state as (Seat | null)[];
  const [dark, light] = othelloScore(board);

  return (
    <>
      <p className={styles.score}>
        <span data-seat="0">{dark}</span> to <span data-seat="1">{light}</span>
      </p>
      <div className={styles.grid} data-game="othello" role="grid">
        {board.map((cell, at) => {
          // The same function the server refuses with, so what looks playable
          // is playable.
          const legal = yours && othelloFlips(board, at, seat).length > 0;

          return (
            <button
              aria-label={`Cell ${at + 1}`}
              className={styles.cell}
              data-legal={legal}
              data-seat={cell === null ? undefined : cell}
              disabled={!legal}
              key={at}
              onClick={() => sendMove(table.id, at)}
              type="button"
            >
              {cell === 0 ? "🌿" : cell === 1 ? "🍂" : ""}
            </button>
          );
        })}
      </div>
    </>
  );
}

function QuipStatus({ table, you }: { table: TableView; you: string }) {
  const state = table.state as QuipState | null;

  if (!state) {
    return <>Everybody in? Seat one starts it.</>;
  }

  if (state.phase === "writing") {
    return <>Writing. Two prompts each.</>;
  }

  if (state.phase === "voting") {
    return <>Vote for the one you like best.</>;
  }

  const best = Object.entries(state.score).sort((a, b) => b[1] - a[1])[0];
  const name = table.names[table.seats.indexOf(best?.[0] ?? "")] ?? "Nobody";

  return best?.[0] === you ? (
    <>That is you out in front. Well written.</>
  ) : (
    <>{name} came out in front.</>
  );
}

function Quips({ table, you }: { table: TableView; you: string }) {
  const state = table.state as QuipState | null;
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const setChatFocused = usePartyStore((s) => s.setChatFocused);

  if (!state) {
    return table.seats[0] === you ? (
      <button
        className={styles.begin}
        onClick={() => beginTable(table.id)}
        type="button"
      >
        Deal the prompts
      </button>
    ) : (
      <p className={styles.quiet}>Waiting for the round to be dealt.</p>
    );
  }

  if (state.phase === "writing") {
    const mine = state.assignments
      .map((assignment, at) => ({ assignment, at }))
      .filter(({ assignment }) => assignment.writers.includes(you));

    return (
      <div className={styles.quips}>
        {mine.map(({ assignment, at }) => {
          const done = state.answers.some(
            (answer) => answer.prompt === at && answer.who === you,
          );

          return (
            <div className={styles.quip} key={at}>
              <p className={styles.prompt}>{QUIP_PROMPTS[assignment.prompt]}</p>
              {done ? (
                <p className={styles.quiet}>Sent.</p>
              ) : (
                <form
                  className={styles.quipForm}
                  onSubmit={(event) => {
                    event.preventDefault();

                    const text = (drafts[at] ?? "").trim();

                    if (text) {
                      sendMove(table.id, { do: "answer", assignment: at, text });
                    }
                  }}
                >
                  <input
                    className={styles.quipInput}
                    maxLength={100}
                    onBlur={() => setChatFocused(false)}
                    onChange={(event) =>
                      setDrafts((was) => ({ ...was, [at]: event.target.value }))
                    }
                    onFocus={() => setChatFocused(true)}
                    // Same reason as the chat box: these letters would
                    // otherwise fly the bee across the park.
                    onKeyDown={(event) => event.stopPropagation()}
                    onKeyUp={(event) => event.stopPropagation()}
                    placeholder="Your answer"
                    type="text"
                    value={drafts[at] ?? ""}
                  />
                  <button className={styles.sit} type="submit">
                    Send
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (state.phase === "voting") {
    const at = state.voting;
    const pair = matchup(state, at);
    const wrote = state.assignments[at]?.writers.includes(you);
    const voted = Boolean(state.votes[at]?.[you]);

    return (
      <div className={styles.quips}>
        <p className={styles.prompt}>
          {QUIP_PROMPTS[state.assignments[at]?.prompt ?? 0]}
        </p>

        {pair.length === 0 ? (
          <p className={styles.quiet}>Nobody answered this one.</p>
        ) : (
          <ul className={styles.votes}>
            {pair.map((answer) => (
              <li key={answer.who}>
                <button
                  className={styles.vote}
                  disabled={wrote || voted}
                  onClick={() =>
                    sendMove(table.id, {
                      do: "vote",
                      assignment: at,
                      forWhom: answer.who,
                    })
                  }
                  type="button"
                >
                  {answer.text}
                </button>
              </li>
            ))}
          </ul>
        )}

        {wrote ? (
          <p className={styles.quiet}>One of these is yours, so you sit out.</p>
        ) : voted ? (
          <p className={styles.quiet}>Voted.</p>
        ) : null}
      </div>
    );
  }

  return (
    <ul className={styles.scores}>
      {table.seats.map((sub, at) => (
        <li key={sub}>
          <span>{table.names[at]}</span>
          <strong>{state.score[sub] ?? 0}</strong>
        </li>
      ))}
    </ul>
  );
}
