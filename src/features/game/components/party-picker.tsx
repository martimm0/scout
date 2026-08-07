"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { GARDEN_PARTIES, parkOf, PARTY_CAP } from "@party/protocol";
import type { GardenPartyId } from "@party/protocol";
import { joinParty } from "../state/party-client";
import { usePartyStore } from "../state/party-store";
import { PARKS } from "../world/terrain";
import styles from "./party-picker.module.css";

/**
 * The three garden parties.
 *
 * You do not make one. There are three, one per park, always there, and the
 * game names them rather than asking you to organise anything: a party you have
 * to arrange is a party that never happens, and a lobby full of empty rooms
 * somebody made and left is worse than no lobby.
 *
 * The head-count is live and the cap is honest. Ten is the ceiling because the
 * voices are a full mesh, and a mesh is the right shape at ten and the wrong
 * shape at fifty.
 *
 * **A party does not require the park to be unlocked.** Highland is a reward for
 * learning Frick alone, but being invited somewhere is not the same as earning
 * it, and a friend saying "come to Highland" should not be met with a locked
 * door. What you find there counts toward your own save, which is what makes
 * the invitation worth accepting.
 */

type Head = { count: number; cap: number };

export function PartyPicker() {
  const router = useRouter();
  const search = useSearchParams();
  const status = usePartyStore((state) => state.status);
  const [heads, setHeads] = useState<Record<string, Head>>({});
  const [tried, setTried] = useState<GardenPartyId | null>(null);

  // Poll the head-counts. Slowly: this is a number on a card, not a game
  // mechanic, and three requests every ten seconds is three requests every ten
  // seconds whether anybody is looking or not.
  useEffect(() => {
    let alive = true;

    const read = async () => {
      const host =
        process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
      const scheme = host.startsWith("127.") || host.startsWith("localhost")
        ? "http"
        : "https";

      const next: Record<string, Head> = {};

      await Promise.all(
        GARDEN_PARTIES.map(async (party) => {
          try {
            const response = await fetch(
              `${scheme}://${host}/parties/garden/${party}`,
            );

            if (response.ok) {
              next[party] = (await response.json()) as Head;
            }
          } catch {
            // The party server being down is not an error worth a red banner on
            // a page whose other job is to show you three parks.
          }
        }),
      );

      if (alive) {
        setHeads(next);
      }
    };

    void read();

    const timer = setInterval(read, 10_000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  /**
   * In, and flying. The park comes from the party, not from your save.
   *
   * Anything already on the URL is carried through, so `/parties?debug=1&hour=12`
   * lands you in the party with the clock pinned and the readout up. The hooks
   * are documented to grant no progress and this changes nothing about that; it
   * only means walking through the lobby does not silently drop them, which
   * otherwise makes a party the one place in the game they cannot be used.
   */
  useEffect(() => {
    if (status !== "in") {
      return;
    }

    const carried = new URLSearchParams(search.toString());

    carried.set("party", "1");
    router.push(`/play?${carried.toString()}`);
  }, [router, search, status]);

  const join = async (party: GardenPartyId) => {
    setTried(party);
    await joinParty(party);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Garden parties</h1>
        <p className={styles.lede}>
          Three parks, up to {PARTY_CAP} pollinators in each. Everyone flies the
          same park at the same time, and what you find there goes into your own
          field notes. Some things only grow where there are other people to see
          them.
        </p>
      </header>

      <ul className={styles.parties} aria-label="Garden parties">
        {GARDEN_PARTIES.map((party) => {
          const park = PARKS[parkOf(party)];
          const head = heads[party];
          const full = head ? head.count >= head.cap : false;
          const joining = tried === party && status === "connecting";

          return (
            <li className={styles.party} data-full={full} key={party}>
              <p className={styles.name}>{park.label}</p>
              <p className={styles.blurb}>{park.blurb}</p>

              <p className={styles.count}>
                {head ? (
                  <>
                    <strong>{head.count}</strong> of {head.cap} here
                  </>
                ) : (
                  "Counting who is here"
                )}
              </p>

              <button
                className={styles.enter}
                disabled={full || joining}
                onClick={() => void join(party)}
                type="button"
              >
                {full
                  ? "Full just now"
                  : joining
                    ? "Going in"
                    : `Join the ${park.label} party`}
              </button>
            </li>
          );
        })}
      </ul>

      {status === "unauthorized" ? (
        <p className={styles.trouble} role="alert">
          A garden party needs an account, so the game knows whose field notes to
          write in. Sign in and the door opens.
        </p>
      ) : null}

      {status === "full" ? (
        <p className={styles.trouble} role="alert">
          That one filled up between you looking and you knocking. The count
          above is live; try another, or try again in a minute.
        </p>
      ) : null}

      {status === "rejected" ? (
        <p className={styles.trouble} role="alert">
          The party server would not let us in, and it is not something you did.
          The pass the game hands out is signed with one key and checked with
          another, which means the two halves are configured with different
          secrets. Nothing is broken in your account and nothing is lost.
        </p>
      ) : null}

      {status === "lost" ? (
        <p className={styles.trouble} role="alert">
          The connection dropped. Nothing you found is lost, it is already in
          your notes.
        </p>
      ) : null}
    </main>
  );
}
