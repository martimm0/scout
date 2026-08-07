"use client";

/**
 * Tell the app a garden party thing happened.
 *
 * Fire and forget, and deliberately unawaited by every caller: a counter is
 * never worth making a player wait, and never worth failing their action over.
 * A dropped count is a slightly wrong number on an admin page, which is a much
 * smaller problem than a join that hung because a database was slow.
 *
 * Counts totals, not events. See the route for why that distinction is the
 * whole point.
 *
 * And only things that happen once a SESSION. There was a chat counter here,
 * and it was wrong in a way worth remembering: it fired a serverless request
 * for every line anybody typed, on the one feature whose whole design is that
 * the room stores nothing and costs nothing. "Is anybody chatting" is already
 * answered by joins, and a counter that scales with typing rather than with
 * people is not worth what it costs.
 */
export function countParty(
  name: "joins" | "coop_pollinations" | "games_played",
) {
  void fetch("/api/party/counter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => {
    // Nothing to do and nothing worth saying. See above.
  });
}
