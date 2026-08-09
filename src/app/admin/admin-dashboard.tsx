"use client";

import { useState } from "react";

import type { Account, Analytics, WaitlistEntry } from "@/lib/accounts";
import type { Insights } from "@/lib/insights";

import styles from "./admin-dashboard.module.css";

/**
 * The admin tool's front end.
 *
 * Server-rendered with a first copy of the data, then mutated in place: every
 * action posts to the admin route, which does the work and hands back the fresh
 * numbers, so the screen never drifts from the database. Deleting asks first,
 * because a delete takes the save file and the album with it.
 */

type Data = {
  analytics: Analytics;
  accounts: Account[];
  waitlist: WaitlistEntry[];
  insights: Insights;
};

type Body =
  | { action: "setCeiling"; ceiling: number }
  | { action: "suspend"; userId: string }
  | { action: "unsuspend"; userId: string }
  | { action: "delete"; userId: string }
  | { action: "setUsername"; userId: string; username: string }
  | { action: "resetProgress"; userId: string }
  | { action: "removeWaitlist"; email: string };

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminDashboard({
  adminEmail,
  initialAnalytics,
  initialAccounts,
  initialInsights,
  initialWaitlist,
}: {
  adminEmail: string;
  initialAnalytics: Analytics;
  initialAccounts: Account[];
  initialInsights: Insights;
  initialWaitlist: WaitlistEntry[];
}) {
  const [data, setData] = useState<Data>({
    analytics: initialAnalytics,
    accounts: initialAccounts,
    waitlist: initialWaitlist,
    insights: initialInsights,
  });
  const [ceiling, setCeilingInput] = useState(String(initialAnalytics.ceiling));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Bumped after every action, and used to remount the username inputs.
   *
   * They are uncontrolled, so `defaultValue` is read once and ignored on every
   * render after. That is fine while the server agrees with the box, and wrong
   * the moment it does not: a name refused as already taken stayed in the cell
   * looking saved, so the table showed one thing and the database held another.
   * Remounting puts every cell back to what is actually stored, which after a
   * refusal is the old name and after a success is the new one.
   */
  const [settled, setSettled] = useState(0);

  const act = async (body: Body) => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const problem = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(problem.error ?? `Request failed (${response.status}).`);
        return;
      }

      const fresh = (await response.json()) as Data;
      setData({
        analytics: fresh.analytics,
        accounts: fresh.accounts,
        waitlist: fresh.waitlist,
        insights: fresh.insights,
      });
      setCeilingInput(String(fresh.analytics.ceiling));
    } finally {
      setBusy(false);
      setSettled((n) => n + 1);
    }
  };

  const { analytics, accounts, waitlist, insights } = data;

  const stats: [string, string | number][] = [
    ["Accounts", `${analytics.accounts} / ${analytics.ceiling}`],
    ["Seats left", analytics.seatsLeft],
    ["Active", analytics.active],
    ["Suspended", analytics.suspended],
    ["Waitlist", analytics.waitlist],
    ["With a save", analytics.withSave],
    ["Pollinations", analytics.totalPollinations],
    ["Plants discovered", analytics.totalDiscoveries],
  ];

  return (
    <div className={styles.admin}>
      <header>
        <p className="eyebrow">Scout</p>
        <h1>Admin</h1>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.stats} aria-label="Analytics">
        {stats.map(([label, value]) => (
          <div className={styles.stat} key={label}>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </section>

      <section className={styles.panel}>
        <h2>Account ceiling</h2>
        <p className={styles.note}>
          The total number of accounts allowed. Once it is reached, new sign-ins
          are turned away and their email goes on the waitlist.
        </p>
        <form
          className={styles.ceilingForm}
          onSubmit={(event) => {
            event.preventDefault();
            const next = Number(ceiling);
            if (Number.isFinite(next)) act({ action: "setCeiling", ceiling: next });
          }}
        >
          <input
            aria-label="Account ceiling"
            className={styles.input}
            min={0}
            onChange={(event) => setCeilingInput(event.target.value)}
            type="number"
            value={ceiling}
          />
          <button className={styles.primary} disabled={busy} type="submit">
            Set ceiling
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Accounts ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <p className={styles.note}>
            No accounts yet. They appear here the first time someone signs in.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last seen</th>
                  <th>Found</th>
                  <th>Pollinated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const isSelf =
                    (account.email ?? "").toLowerCase() === adminEmail;

                  return (
                    <tr key={account.userId} data-suspended={account.status === "suspended"}>
                      <td>{account.email ?? "—"}</td>
                      <td>{account.name ?? "—"}</td>
                      <td>
                        {/* Editable in place. Blank clears it, which hands the
                            name back and puts them in front of the prompt
                            again; that is the only way to free a name somebody
                            should not have taken. */}
                        <input
                          aria-label={`Username for ${account.email ?? account.userId}`}
                          className={styles.usernameInput}
                          defaultValue={account.username ?? ""}
                          disabled={busy}
                          key={`${account.userId}:${settled}`}
                          onBlur={(event) => {
                            const next = event.target.value.trim();

                            if (next !== (account.username ?? "")) {
                              void act({
                                action: "setUsername",
                                userId: account.userId,
                                username: next,
                              });
                            }
                          }}
                          placeholder="not chosen"
                          type="text"
                        />
                      </td>
                      <td>
                        <span
                          className={styles.badge}
                          data-status={account.status}
                        >
                          {account.status}
                        </span>
                      </td>
                      <td>{when(account.createdAt)}</td>
                      <td>{when(account.lastSeen)}</td>
                      <td>{account.discovered}</td>
                      <td>{account.pollinated}</td>
                      <td className={styles.rowActions}>
                        {/* Wiping a save is offered on every row, the admin's
                            own included: it is a thing a player asks for, and
                            unlike suspend or delete it cannot lock anybody out
                            of anything. */}
                        <button
                          className={styles.secondary}
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Wipe the save for ${account.email ?? "this account"}? They keep their account and their name, and start the park again.`,
                              )
                            ) {
                              void act({
                                action: "resetProgress",
                                userId: account.userId,
                              });
                            }
                          }}
                          type="button"
                        >
                          Reset save
                        </button>
                        {isSelf ? (
                          <span className={styles.you}>you</span>
                        ) : (
                          <>
                            {account.status === "suspended" ? (
                              <button
                                className={styles.secondary}
                                disabled={busy}
                                onClick={() =>
                                  act({ action: "unsuspend", userId: account.userId })
                                }
                                type="button"
                              >
                                Unsuspend
                              </button>
                            ) : (
                              <button
                                className={styles.secondary}
                                disabled={busy}
                                onClick={() =>
                                  act({ action: "suspend", userId: account.userId })
                                }
                                type="button"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              className={styles.danger}
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${account.email ?? "this account"}? This removes their save and photos for good.`,
                                  )
                                ) {
                                  act({ action: "delete", userId: account.userId });
                                }
                              }}
                              type="button"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Waitlist ({waitlist.length})</h2>
        {waitlist.length === 0 ? (
          <p className={styles.note}>
            Empty. Emails land here when someone signs in past the ceiling.
          </p>
        ) : (
          <ul className={styles.waitlist}>
            {waitlist.map((entry) => (
              <li className={styles.waitRow} key={entry.email}>
                <span>{entry.email}</span>
                <span className={styles.waitWhen}>{when(entry.createdAt)}</span>
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() =>
                    act({ action: "removeWaitlist", email: entry.email })
                  }
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ *
       * Insights.
       *
       * All read-only, all derived from saves that already exist. Nothing here
       * ranks one player against another: the game has no leaderboard and a
       * "top players" table would be that leaderboard entered through the back
       * door. These answer "is somebody stuck" and "is this plant findable".
       * ------------------------------------------------------------------ */}

      <section className={styles.panel}>
        <h2>Activity</h2>
        <div className={styles.stats}>
          {(
            [
              ["Active this week", insights.activeLastWeek],
              ["Active this month", insights.activeLastMonth],
              ["Signed in, never played", insights.neverPlayed],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div className={styles.stat} key={label}>
              <span className={styles.statLabel}>{label}</span>
              <span className={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>

        {insights.signupsByWeek.length > 0 ? (
          <ol className={styles.spark}>
            {insights.signupsByWeek.map((week) => (
              <li key={week.week}>
                <span className={styles.sparkWeek}>{week.week}</span>
                <span
                  aria-hidden
                  className={styles.sparkBar}
                  style={{ "--n": week.accounts } as React.CSSProperties}
                />
                <span className={styles.sparkCount}>{week.accounts}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2>How far people get</h2>
        <p className={styles.panelNote}>
          Medians, not averages: one completionist would drag a mean far away
          from anybody&apos;s actual afternoon.
        </p>
        <div className={styles.stats}>
          {(
            [
              ["Species found", insights.medianSpeciesFound],
              ["Pollinated", insights.medianPollinated],
              ["Badges", insights.medianBadges],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div className={styles.stat} key={label}>
              <span className={styles.statLabel}>{label}</span>
              <span className={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Which species people actually find</h2>
        <p className={styles.panelNote}>
          Rarest first. A species nobody has found is either very well hidden or
          genuinely unreachable, and the second has happened twice.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Species</th>
                <th>Found by</th>
                <th>Pollinated by</th>
                <th>Quiz passed by</th>
              </tr>
            </thead>
            <tbody>
              {insights.species.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.found}</td>
                  <td>{row.pollinated}</td>
                  <td>{row.quizPassed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Garden parties</h2>
        <p className={styles.panelNote}>
          Totals, never events. The room stores nothing at all, and a row per
          join would be a record of who was with whom and when, which is the
          thing it refuses to keep.
        </p>
        <div className={styles.stats}>
          {(
            [
              ["Joins", insights.party.joins ?? 0],
              ["Worked a flower together", insights.party.coop_pollinations ?? 0],
              ["Games opened", insights.party.games_played ?? 0],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div className={styles.stat} key={label}>
              <span className={styles.statLabel}>{label}</span>
              <span className={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
