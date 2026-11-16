import {
  Server,
  type Connection,
  type ConnectionContext,
  type Lobby,
  type WSMessage,
} from "partyserver";
import { decode } from "next-auth/jwt";

import {
  CHAT_TTL_MS,
  GAME_SEATS,
  GARDEN_PARTIES,
  PARTY_CAP,
  parkOf,
  type ClientMessage,
  type CoopView,
  type GameKind,
  type GardenPartyId,
  type PartyPlayer,
  type Pose,
  type ServerMessage,
} from "./protocol";
import {
  applyMove,
  beginQuips,
  openTable,
  sitDown,
  standUp,
  tableIsStale,
  tableTimeout,
  tableView,
  type Table,
} from "./games/tables";
import { OutingRoom } from "./games/outing-room";

/**
 * A garden party: one park, up to ten players, nothing remembered.
 *
 * The server is a relay and a referee, and deliberately not a database. It
 * holds who is here and where they are flying, referees the seat cap, the
 * tables and the rounds played out in the park, and passes chat and WebRTC
 * signaling through without reading them. It never
 * writes to storage: chat that is promised to vanish in sixty seconds must not
 * exist in a log somewhere, and a Durable Object that never touches storage
 * stays inside the free tier by construction.
 *
 * Hibernation is on. Three standing rooms that are usually empty should cost
 * nothing while they are empty.
 */

type Seat = {
  player: PartyPlayer;
  pose: Pose | null;
  /**
   * When `pose` arrived, by the room's clock. With the pose before it, this is
   * the line a bee flew and how long it took, which is what a race is judged on.
   */
  poseAt: number;
  /** Chat timestamps in the last few seconds, for the rate limit. */
  recentChat: number[];
  /** Board moves and votes, on their own limit so a game cannot silence chat. */
  recentMoves: number[];
};

/** What survives hibernation: the connection's attachment. Everything a seat
 *  needs to be rebuilt must live here, because the in-memory map does not. */
type Attachment = { sub: string; name: string; pollinator: string };

/**
 * The head-count is read by the browser, and the party server is a different
 * origin from the game, so without this the fetch fails and the lobby shows
 * "Counting who is here" forever. It failed silently the first time, because
 * the picker swallows a dead party server rather than putting a red box on a
 * page whose other job is to show you three parks.
 *
 * Wide open on purpose, and safe to be: the only thing behind it is how many
 * bees are in a public park. Everything that is not a head-count is behind the
 * socket, and the socket wants a signed ticket.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
} as const;

export type Env = {
  Garden: DurableObjectNamespace<Garden>;
  AUTH_SECRET: string;
};

export class Garden extends Server<Env> {
  static options = { hibernate: true };

  /**
   * sub -> seat. In-memory only, so hibernation wipes it; `ensureSeats` rebuilds
   * it from connection attachments, which do survive. Poses are lost across a
   * hibernation and that is fine: they re-arrive eight times a second.
   */
  seats = new Map<string, Seat>();

  /**
   * The games in progress. A list, because several at once in one party is the
   * whole point of them.
   *
   * In memory only, like the seats. A room that hibernates forgets its games,
   * which is right: an empty room has nothing worth resuming, and storing them
   * would be storing exactly the thing this server promises not to.
   */
  tables: Table[] = [];

  private nextTable = 1;

  /**
   * Flowers being worked, keyed by scatter instance.
   *
   * By instance and not by species, because two bees on two different asters are
   * not working together. In memory like everything else, and cleared the moment
   * the last bee leaves the flower.
   */
  coop = new Map<string, CoopView>();

  /** How long a finished Field Notes round stays on the board before it goes. */
  private static readonly FINISHED_FOR = 60_000;

  /**
   * Races and hide and seek. In memory like the tables, and refereed from the
   * poses this room was already relaying.
   */
  outings = new OutingRoom(Garden.FINISHED_FOR);

  /** The latest pose the room holds for anybody. What the outings judge by. */
  private poseOf = (sub: string) => this.seats.get(sub)?.pose ?? null;

  private ensureSeats() {
    const woke = this.seats.size === 0;

    for (const conn of this.getConnections<Attachment>()) {
      const state = conn.state;

      if (state?.sub && !this.seats.has(state.sub)) {
        this.seats.set(state.sub, {
          player: {
            sub: state.sub,
            name: state.name,
            pollinator: state.pollinator,
          },
          pose: null,
          poseAt: 0,
          recentChat: [],
          recentMoves: [],
        });
      }
    }

    /**
     * Seats rebuilt from nothing means the room slept with people in it, and
     * everything it was refereeing went with its memory. That only happens when
     * every tab in the party stopped sending poses at once, hidden windows for
     * the most part, and those players come back holding a round that no longer
     * exists. A racer in a countdown that will never end is held at the start
     * for ever, and a hider is frozen in a bush.
     *
     * So say what is true now, which is that there is nothing on. A fresh room
     * never gets here: its first connection has no attachment yet, and no seat
     * is rebuilt from it.
     */
    if (woke && this.seats.size > 0) {
      this.tables = [];
      this.outings.clear();
      this.tell({ t: "tables", tables: [] });
      this.publishOutings();
    }
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    this.ensureSeats();

    const sub = ctx.request.headers.get("x-scout-sub");
    const name = ctx.request.headers.get("x-scout-name") ?? "A bee";
    const pollinator = ctx.request.headers.get("x-scout-pollinator") ?? "bee";

    if (!sub) {
      this.refuse(conn, "unauthorized");
      return;
    }

    // One seat per account. A second tab for the same account replaces the
    // first rather than taking a second chair.
    const returning = this.seats.has(sub);

    if (!returning && this.seats.size >= PARTY_CAP) {
      this.refuse(conn, "full");
      return;
    }

    const player: PartyPlayer = { sub, name, pollinator };

    if (returning) {
      for (const other of this.getConnections<Attachment>()) {
        if (other.id !== conn.id && other.state?.sub === sub) {
          // TELL it, then close. A bare close leaves workerd's hibernatable
          // socket in CLOSING and the far end never hears the handshake
          // finish, so the replaced tab would sit there believing it was
          // still in the party. The message is the guarantee.
          this.refuse(other, "replaced");
        }
      }
    }

    conn.setState({ sub, name, pollinator } satisfies Attachment);
    this.seats.set(sub, {
      player,
      pose: this.seats.get(sub)?.pose ?? null,
      poseAt: this.seats.get(sub)?.poseAt ?? 0,
      recentChat: [],
      recentMoves: [],
    });

    this.send(conn, {
      t: "welcome",
      you: player,
      players: [...this.seats.values()]
        .filter((seat) => seat.player.sub !== sub)
        .map((seat) => ({
          ...seat.player,
          // A seeker who opens a second tab while counting must not be handed
          // where everybody went. The live relay withholds it; so does this.
          pose: this.outings.blindTo(seat.player.sub)?.has(sub)
            ? null
            : seat.pose,
        })),
    });

    if (!returning) {
      this.tell({ t: "join", player }, sub);
    }

    // Whatever is being played right now, so a joiner can walk up to a table
    // rather than only seeing games that start after they arrived.
    this.send(conn, { t: "tables", tables: this.tables.map(tableView) });
    this.send(conn, {
      t: "outings",
      outings: this.outings.views(),
      now: Date.now(),
    });
  }

  onMessage(conn: Connection<Attachment>, raw: WSMessage) {
    this.ensureSeats();

    const sub = conn.state?.sub;
    const seat = sub ? this.seats.get(sub) : undefined;

    if (!sub || !seat || typeof raw !== "string" || raw.length > 4096) {
      return;
    }

    let message: ClientMessage;

    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    // `null`, a number or an array all parse, and `message.t` below then threw
    // out of the handler, once per message, for anybody holding a ticket.
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    switch (message.t) {
      case "pos": {
        const p = message.pose;

        if (
          // Finite, not just numbers: `1e999` parses as Infinity, which is a
          // number, and reached every other player as null, a bee at NaN.
          !Number.isFinite(p?.x) ||
          !Number.isFinite(p.z) ||
          !Number.isFinite(p.altitude) ||
          !Number.isFinite(p.heading)
        ) {
          return;
        }

        const now = Date.now();
        const prev = seat.pose;
        const prevAt = seat.poseAt;
        const pose: Pose = {
          x: p.x,
          z: p.z,
          altitude: p.altitude,
          heading: p.heading,
          gesture: typeof p.gesture === "string" ? p.gesture : "none",
        };

        seat.pose = pose;
        seat.poseAt = now;

        /**
         * The pose stream is also the outings' clock.
         *
         * A room with anybody in it hears about six of these a second from
         * each of them, so "has a countdown run out" is asked here and not by
         * an alarm. The
         * room's one alarm belongs to the tables and is moved every time one of
         * them changes, which would move it off a five-second countdown.
         *
         * Before the pose is judged, so that the pose which arrives as a race
         * starts is a pose in a race that has started.
         */
        let changed =
          now >= this.outings.nextDeadline &&
          this.outings.tick(now, this.poseOf);

        // Read after the tick: a count that has just ended blinds nobody.
        const hidden = this.outings.blindTo(sub);
        const raw = JSON.stringify({ t: "pos", sub, pose } satisfies ServerMessage);

        for (const other of this.getConnections<Attachment>()) {
          const to = other.state?.sub;

          // Not to the sender, and not to a seeker who is still counting.
          if (to !== sub && !(to && hidden?.has(to))) {
            other.send(raw);
          }
        }

        changed =
          this.outings.onPose(sub, prev, prevAt, pose, now, this.poseOf) ||
          changed;

        if (changed) {
          this.publishOutings();
        }

        return;
      }

      case "chat": {
        const text = typeof message.text === "string" ? message.text.trim() : "";

        if (!text || text.length > 240) {
          return;
        }

        // Four messages in ten seconds is conversation; forty is a hose.
        const now = Date.now();
        seat.recentChat = seat.recentChat.filter((at) => now - at < 10_000);

        if (seat.recentChat.length >= 4) {
          return;
        }

        seat.recentChat.push(now);
        // To everyone INCLUDING the sender: one code path for drawing a
        // message, and your own line proves the room heard you.
        this.tell({ t: "chat", sub, name: seat.player.name, text });
        return;
      }

      /**
       * A waggle dance, relayed and forgotten.
       *
       * Same treatment as chat, for the same reason: it happened in a room you
       * were both in and the room stores nothing. Rate limited on the same
       * budget as chat, because a dance drops a pin on nine other screens and
       * is therefore worth more to somebody determined to be a nuisance.
       *
       * The coordinates are the dancer's claim and are NOT checked against
       * their pose. A liar can send you to an empty patch of grass, which is
       * exactly what an honest bee dancing about a flower somebody has since
       * stripped can also do. There is nothing to win here and nothing to
       * corrupt: the mark is a note on a screen, not a fact about the world.
       */
      case "mark": {
        const species = typeof message.species === "string" ? message.species : "";
        const commonName =
          typeof message.commonName === "string" ? message.commonName : "";

        if (!species || species.length > 64 || commonName.length > 64) {
          return;
        }

        if (!Number.isFinite(message.x) || !Number.isFinite(message.z)) {
          return;
        }

        const now = Date.now();
        seat.recentChat = seat.recentChat.filter((at) => now - at < 10_000);

        if (seat.recentChat.length >= 4) {
          return;
        }

        seat.recentChat.push(now);

        // To everybody EXCEPT the dancer: their own mark is already on their
        // record, put there before this was ever sent.
        this.tell(
          {
            t: "mark",
            sub,
            name: seat.player.name,
            species,
            commonName,
            x: message.x,
            z: message.z,
          },
          sub,
        );
        return;
      }

      case "open": {
        const kind = message.kind;

        if (typeof kind !== "string" || !Object.hasOwn(GAME_SEATS, kind)) {
          return;
        }

        // One table each. Somebody who keeps pressing the button would
        // otherwise paper the lobby with empty games nobody can clear. And
        // one THING each: a bee in a race is not also at a board.
        if (this.atATable(sub) || this.outings.has(sub)) {
          return;
        }

        this.tables.push(
          openTable(
            `t${this.nextTable++}`,
            kind as GameKind,
            sub,
            seat.player.name,
          ),
        );
        this.publishTables();
        return;
      }

      case "sit": {
        // One table each, as with opening one. A second chair leaves a game
        // waiting on somebody whose screen only shows the first.
        if (this.atATable(sub) || this.outings.has(sub)) {
          return;
        }

        this.updateTable(message.table, (table) =>
          sitDown(table, sub, seat.player.name),
        );
        return;
      }

      case "leaveTable": {
        this.updateTable(message.table, (table) =>
          standUp(table, sub, Date.now()),
        );
        return;
      }

      case "begin": {
        this.updateTable(message.table, (table) =>
          // Seat 0 deals, because somebody has to and they opened it.
          table.seats[0] === sub ? beginQuips(table, Date.now()) : table,
        );
        return;
      }

      case "move": {
        // Through the rate limit, like chat: a client stuck in a loop should
        // not be able to hammer the room, and a move is cheap to send.
        // Its own budget. Moves shared chat's, so a quick game of noughts and
        // crosses used up the four lines and "gg" went nowhere.
        const now = Date.now();

        seat.recentMoves = seat.recentMoves.filter((at) => now - at < 10_000);

        if (seat.recentMoves.length >= 12) {
          return;
        }

        seat.recentMoves.push(now);
        this.updateTable(message.table, (table) =>
          applyMove(table, sub, message.move, now),
        );
        return;
      }

      case "workOn": {
        const key = message.instance;

        if (typeof key !== "string" || typeof message.plant !== "string") {
          return;
        }

        const existing = this.coop.get(key);

        if (existing) {
          if (!existing.members.some((member) => member.sub === sub)) {
            existing.members.push({ sub, name: seat.player.name });
          }
        } else {
          this.coop.set(key, {
            instance: key,
            plant: message.plant,
            members: [{ sub, name: seat.player.name }],
            finds: [],
            // Drawn once, here, and used by everybody. See CoopView.roll.
            roll: Math.random(),
          });
        }

        this.publishCoop(key);
        return;
      }

      case "found": {
        const session = this.coop.get(message.instance);

        if (
          !session ||
          typeof message.token !== "string" ||
          message.token.length > 64 ||
          !session.members.some((member) => member.sub === sub) ||
          session.finds.includes(message.token)
        ) {
          return;
        }

        session.finds.push(message.token);
        this.publishCoop(message.instance);
        return;
      }

      case "stopWorking": {
        this.leaveFlower(sub, message.instance);
        return;
      }

      /**
       * A round out in the park: open one, join, begin, say you are hidden,
       * leave. Everything else about a round, who passed which gate and who
       * found whom, the room works out for itself from `pos`.
       */
      case "outing": {
        const now = Date.now();
        const asked = (message as { do?: unknown }).do;

        /**
         * On the moves budget. These are button presses, and twelve in ten
         * seconds is more than anybody presses a button.
         *
         * Except Leave, which is never refused. It is the way out of being
         * held at a start line, and a screen shows it as done the moment it is
         * pressed: dropped here, the player was out of the round on their own
         * screen and in it on everybody else's, a racer who would never finish
         * and could start nothing new, with no button left to press about it.
         * Leaving twice is leaving once, so there is nothing to protect.
         */
        if (asked !== "leave") {
          seat.recentMoves = seat.recentMoves.filter((at) => now - at < 10_000);

          if (seat.recentMoves.length >= 12) {
            return;
          }

          seat.recentMoves.push(now);
        }

        // One thing each, the other way round: no races from a chair.
        if ((asked === "open" || asked === "join") && this.atATable(sub)) {
          return;
        }

        if (
          this.outings.handle(
            parkOf(this.name as GardenPartyId),
            sub,
            seat.player.name,
            message,
            now,
            this.poseOf,
          )
        ) {
          this.publishOutings();
        }

        return;
      }

      case "rtc": {
        // Verbatim relay to one peer. The server does not read the payload;
        // the voices themselves never come through here at all.
        const target = message.to;

        for (const other of this.getConnections<Attachment>()) {
          if (other.state?.sub === target) {
            this.send(other, { t: "rtc", from: sub, payload: message.payload });
          }
        }

        return;
      }
    }
  }

  onClose(conn: Connection<Attachment>) {
    this.ensureSeats();

    const sub = conn.state?.sub;

    if (!sub) {
      return;
    }

    // Only vacate the seat if this was the account's last connection.
    for (const other of this.getConnections<Attachment>()) {
      if (other.id !== conn.id && other.state?.sub === sub) {
        return;
      }
    }

    this.seats.delete(sub);
    this.tell({ t: "leave", sub });

    for (const key of [...this.coop.keys()]) {
      this.leaveFlower(sub, key);
    }

    // And out of any game they were in the middle of.
    const now = Date.now();
    const before = this.tables;

    this.tables = this.tables.map((table) => standUp(table, sub, now));

    if (this.tables.some((table, at) => table !== before[at])) {
      this.publishTables();
    }

    // And out of any round. A dropped connection is out of the race, as it is
    // out of its chair: the room has no way to tell a tunnel from a goodbye.
    if (this.outings.leave(sub, now)) {
      this.publishOutings();
    }
  }

  /** At a table whose game is not over. */
  private atATable(sub: string) {
    return this.tables.some(
      (table) => !table.finished && table.seats.includes(sub),
    );
  }

  /** Every round, to everybody. The whole list, as the tables are. */
  private publishOutings() {
    this.tell({
      t: "outings",
      outings: this.outings.views(),
      now: Date.now(),
    });

    /**
     * And, after it, where each hider is, to whoever may now look.
     *
     * AFTER the list, because a seeker's screen ignores a hider's pose until
     * it has been told the count is over. See `OutingRoom.takeRevealed` for
     * why the room cannot just wait for the hider's next pose.
     */
    for (const [subject, recipient] of this.outings.takeRevealed()) {
      const pose = this.seats.get(subject)?.pose;

      if (!pose) {
        continue;
      }

      for (const conn of this.getConnections<Attachment>()) {
        if (conn.state?.sub === recipient) {
          this.send(conn, { t: "pos", sub: subject, pose });
        }
      }
    }
  }

  /**
   * `GET /parties/garden/:id` answers with the live head-count, for the party
   * picker. Public on purpose: a count of bees is not a secret, and the picker
   * shows it before the player has decided to join.
   */
  onRequest(request: Request) {
    this.ensureSeats();

    if (request.method !== "GET") {
      return new Response("nope", { status: 405, headers: CORS });
    }

    return Response.json(
      {
        party: this.name,
        count: this.seats.size,
        cap: PARTY_CAP,
      },
      { headers: CORS },
    );
  }

  /**
   * Run a change over one table and tell the room, if anything changed.
   *
   * Compared by identity, because every transition returns a new object when it
   * does something and the SAME object when it refuses. So "an illegal move
   * changes nothing and is silently ignored" needs no special case: it simply
   * fails this check and nothing is sent.
   */
  private updateTable(id: unknown, change: (table: Table) => Table) {
    if (typeof id !== "string") {
      return;
    }

    let changed = false;

    this.tables = this.tables.map((table) => {
      if (table.id !== id) {
        return table;
      }

      const next = change(table);

      changed = next !== table;

      return next;
    });

    if (changed) {
      this.publishTables();
    }
  }

  /**
   * Send every table to everybody, and drop the dead ones on the way out.
   *
   * Sweeping here rather than on a timer means an abandoned table is cleared by
   * the next thing that happens in the room, and a room where nothing is
   * happening does not need waking up to tidy itself.
   */
  private publishTables() {
    const now = Date.now();

    this.tables = this.tables.filter(
      (table) => !tableIsStale(table, now, Garden.FINISHED_FOR),
    );

    this.tell({ t: "tables", tables: this.tables.map(tableView) });
    this.scheduleTimeout(now);
  }

  /**
   * One alarm for the whole room, set to the earliest deadline any table has.
   *
   * One rather than one per table, because a Durable Object gets one alarm and
   * because a timer per table is a timer per table to leak. Only Field Notes
   * has deadlines; the board games sit as long as the players like, since a
   * turn clock on a friendly game of noughts and crosses invents a pressure
   * nobody asked for.
   */
  private scheduleTimeout(now: number) {
    const deadlines = this.tables
      .filter((table) => !table.finished && table.deadline > 0)
      .map((table) => table.deadline);

    if (deadlines.length === 0) {
      return;
    }

    void this.ctx.storage.setAlarm(Math.max(now + 250, Math.min(...deadlines)));
  }

  /**
   * A phase ran out.
   *
   * The one place this server touches storage, and it stores no data: an alarm
   * is a wake-up, not a record.
   *
   * **Why an in-memory game is safe here**, which is not obvious and is worth
   * writing down because it is the thing that would break it. Tables live only
   * in memory, and a hibernating Durable Object loses them. What keeps that from
   * mattering is the pose stream: every player in the park broadcasts about
   * seven times a second for as long as their tab is open, so an occupied room
   * is never idle and never evicted. A room only hibernates once it is empty,
   * and an empty room has no game worth resuming.
   *
   * That does mean the presence traffic is load-bearing for the games. If poses
   * ever stop while somebody is still connected (a paused tab, a future idle
   * mode), tables have to be persisted or a Field Notes round will quietly
   * disappear during its own writing phase. `ensureSeats` covers the one case
   * that does happen, every tab in the party hidden at once: the room wakes
   * with nothing and says so, which loses the round and strands nobody.
   *
   * The rounds out in the park do not use this alarm at all. See the `pos`
   * handler, where the pose stream is their clock.
   */
  onAlarm() {
    const now = Date.now();
    const before = this.tables;

    this.tables = this.tables.map((table) => tableTimeout(table, now));

    if (this.tables.some((table, at) => table !== before[at])) {
      this.publishTables();
    } else {
      this.scheduleTimeout(now);
    }
  }

  /**
   * Tell everybody on one flower what is on it.
   *
   * Only them. A shared board is a small private thing between the bees standing
   * on one stalk, and the rest of the party has no use for it.
   */
  private publishCoop(key: string) {
    const session = this.coop.get(key);

    if (!session) {
      return;
    }

    const raw = JSON.stringify({ t: "coop", session } satisfies ServerMessage);

    for (const conn of this.getConnections<Attachment>()) {
      if (
        conn.state?.sub &&
        session.members.some((member) => member.sub === conn.state!.sub)
      ) {
        conn.send(raw);
      }
    }
  }

  /** Off the flower. The session goes when the last bee does. */
  private leaveFlower(sub: string, key: string) {
    const session = this.coop.get(key);

    if (!session) {
      return;
    }

    const members = session.members.filter((member) => member.sub !== sub);

    if (members.length === 0) {
      this.coop.delete(key);
      return;
    }

    session.members = members;
    this.publishCoop(key);
  }

  /** Say why, then close. A silent refusal looks like a network fault and the
   *  client would retry it forever. */
  private refuse(
    conn: Connection,
    reason: "full" | "unauthorized" | "replaced",
  ) {
    this.send(conn, { t: "refused", reason });
    conn.close(4000, reason);
  }

  private send(conn: Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  /**
   * To everybody in the room, or everybody but one.
   *
   * Named `tell` rather than `broadcast` because the base class has a
   * `broadcast` of its own that takes a raw string, and overriding it with a
   * different shape is how a subclass quietly breaks its parent.
   */
  private tell(message: ServerMessage, except?: string) {
    const raw = JSON.stringify(message);

    for (const conn of this.getConnections<Attachment>()) {
      if (except === undefined || conn.state?.sub !== except) {
        conn.send(raw);
      }
    }
  }
}

/** Chat expiry lives on the CLIENT: each message dies CHAT_TTL_MS after it was
 *  seen. The server forgets a message the moment it has finished relaying it,
 *  which is what "messages do not save" means when it is true. */
export { CHAT_TTL_MS };

/**
 * The gate in front of the whole room, HTTP and WebSocket alike.
 *
 * Runs in the lobby, BEFORE the room object is addressed, which is the entire
 * point: a request for `garden-nope` must not bring a room called garden-nope
 * into existence. Without this, `GET /parties/garden/<anything>` answered 200
 * and span up a Durable Object per made-up name, so an unauthenticated
 * stranger with a for-loop could mint unbounded rooms on the account. There
 * are exactly three parties and their names are a closed set, so anything else
 * is answered here and never reaches a room.
 *
 * `onBeforeConnect` still checks the ticket. This one checks the address.
 */
export function guardRoom(request: Request, lobby: Lobby<Env>) {
  if (!(GARDEN_PARTIES as readonly string[]).includes(lobby.name)) {
    return new Response("no such party", { status: 404, headers: CORS });
  }

  return request;
}

/**
 * The door. Runs before the socket upgrades.
 *
 * The ticket is a short-lived JWT minted by the game's own server at
 * `/api/party/ticket`, signed with the same AUTH_SECRET the session uses. The
 * browser cannot read its own session cookie (httpOnly, different host), so
 * the game hands it a ticket instead. No account, no ticket, no party.
 */
export function guardTicket(env: Env) {
  return async function checkTicket(request: Request, lobby: Lobby<Env>) {
    if (!(GARDEN_PARTIES as readonly string[]).includes(lobby.name)) {
      return new Response("no such party", { status: 404 });
    }

    const ticket = new URL(request.url).searchParams.get("ticket");

    if (!ticket) {
      return new Response("a garden party needs an account", { status: 401 });
    }

    try {
      const token = await decode({
        token: ticket,
        secret: env.AUTH_SECRET,
        salt: "scout-party-ticket",
      });

      if (!token?.sub || typeof token.name !== "string") {
        return new Response("bad ticket", { status: 401 });
      }

      request.headers.set("x-scout-sub", token.sub);
      request.headers.set("x-scout-name", token.name);
      request.headers.set(
        "x-scout-pollinator",
        typeof token.pollinator === "string" ? token.pollinator : "bee",
      );

      return request;
    } catch {
      return new Response("bad ticket", { status: 401 });
    }
  };
}
