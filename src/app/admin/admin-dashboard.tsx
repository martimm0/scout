"use client";

import { useState } from "react";

import type { Account, Analytics, WaitlistEntry } from "@/lib/accounts";

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
};

type Body =
  | { action: "setCeiling"; ceiling: number }
  | { action: "suspend"; userId: string }
  | { action: "unsuspend"; userId: string }
  | { action: "delete"; userId: string }
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
  initialWaitlist,
}: {
  adminEmail: string;
  initialAnalytics: Analytics;
  initialAccounts: Account[];
  initialWaitlist: WaitlistEntry[];
}) {
  const [data, setData] = useState<Data>({
    analytics: initialAnalytics,
    accounts: initialAccounts,
    waitlist: initialWaitlist,
  });
  const [ceiling, setCeilingInput] = useState(String(initialAnalytics.ceiling));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
      setCeilingInput(String(fresh.analytics.ceiling));
    } finally {
      setBusy(false);
    }
  };

  const { analytics, accounts, waitlist } = data;

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
    </div>
  );
}
