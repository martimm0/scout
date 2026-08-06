import { routePartykitRequest } from "partyserver";

import { Garden, guardRoom, guardTicket, type Env } from "./garden";

/**
 * The Worker in front of the rooms.
 *
 * PartyKit put the two gates on the server class as static methods; on
 * Cloudflare they are options to the router, which runs them before the Durable
 * Object is addressed. That distinction is the whole point of them, so it is
 * worth saying plainly: `guardRoom` decides whether a name may exist at all,
 * and it runs in the Worker, so a request for a room nobody should have does
 * not bring one into being. `guardTicket` then decides whether this particular
 * person may open a socket to it.
 *
 * `guardTicket` is a factory because it needs `AUTH_SECRET` and the router's
 * lobby does not carry `env`. Closing over it here is the only place the secret
 * is read.
 */
export { Garden };

/**
 * Ensure a response says who may read it.
 *
 * A WebSocket upgrade (101) must be returned untouched: its headers are part of
 * the handshake and it has no body for a browser to be protected from.
 */
function withCors(response: Response): Response {
  if (response.status === 101 || response.headers.has("Access-Control-Allow-Origin")) {
    return response;
  }

  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const routed = await routePartykitRequest(request, env, {
      /**
       * CORS on the ROUTER, not only on our own responses.
       *
       * The room's head-count already sets its own header, but the router
       * answers first and answers on its own for anything it cannot match: a
       * request to a path this worker does not serve comes back 400 with no
       * CORS header at all, and the browser then reports a CORS failure rather
       * than the 400. That is how a stale client asking for the old
       * `/parties/main/...` path showed up as an inscrutable CORS error in
       * production instead of "this route does not exist".
       *
       * Wide open, and safe to be: everything behind these routes is either a
       * count of bees in a public park or a socket that wants a signed ticket.
       */
      cors: true,
      onBeforeRequest: guardRoom,
      onBeforeConnect: guardTicket(env),
    });

    if (routed) {
      // `cors: true` above only decorates routes the router MATCHED. Anything
      // it refuses comes back bare, so a client asking for a path this worker
      // does not serve gets a CORS failure in the console instead of the 400
      // that would tell them what is actually wrong. Make every answer legible.
      return withCors(routed);
    }

    // Anything that is not a room. There is no site here, only parties.
    return new Response("no party at this address", {
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  },
};

export default worker;
