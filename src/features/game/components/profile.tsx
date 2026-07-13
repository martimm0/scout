"use client";

import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { BADGES } from "../data/badges";
import { PLANTS } from "../data/plants";
import { countUnlocked, useGameStore } from "../state/game-store";
import { AREAS } from "../world/terrain";
import { CloudSyncBadge } from "./cloud-sync-badge";
import { StarterVisual } from "./starter-selection";
import styles from "./profile.module.css";

const AREA_COUNT = AREAS.length + 1;

export function Profile({ authConfigured }: { authConfigured: boolean }) {
  const { data: session, status } = useSession();

  const pollinator = useGameStore((state) => state.pollinator);
  const discovered = useGameStore((state) => countUnlocked(state.discoveredPlants));
  const pollinated = useGameStore((state) => countUnlocked(state.pollinatedPlants));
  const areas = useGameStore((state) => countUnlocked(state.unlockedMapAreas));
  const badges = useGameStore((state) => state.unlockedBadges);
  const entries = useGameStore((state) =>
    countUnlocked(state.unlockedJournalEntries),
  );
  const stats = useGameStore((state) => state.stats);

  const earned = BADGES.filter((badge) => badges[badge.id]);
  const successRate =
    stats.pollinationAttempts === 0
      ? null
      : Math.round(
          (stats.pollinationSuccesses / stats.pollinationAttempts) * 100,
        );

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.visual}>
          <StarterVisual pollinator={pollinator} />
        </div>
        <div>
          <p className={styles.eyebrow}>Your pollinator</p>
          <h2 className={styles.name}>{pollinator.name}</h2>
          <p className={styles.species}>A bee, of Frick Park.</p>

          {status === "authenticated" && session?.user ? (
            <p className={styles.signedIn}>
              Signed in as {session.user.email ?? session.user.name}
            </p>
          ) : authConfigured ? (
            <p className={styles.signedOut}>
              Sign in to keep this pollinator across devices.
            </p>
          ) : (
            <p className={styles.signedOut}>
              Google sign-in isn&apos;t configured on this build, so everything
              lives on this device.
            </p>
          )}

          <CloudSyncBadge />

          <div className={styles.actions}>
            <Button href="/customize" variant="secondary">
              Customize
            </Button>
            <Button href="/play">Fly</Button>
          </div>
        </div>
      </section>

      <section>
        <h2>Progress</h2>
        <dl className={styles.summary}>
          <div>
            <dt>Plants found</dt>
            <dd>
              {discovered} <span>/ {PLANTS.length}</span>
            </dd>
          </div>
          <div>
            <dt>Pollinated</dt>
            <dd>
              {pollinated} <span>/ {PLANTS.length}</span>
            </dd>
          </div>
          <div>
            <dt>Areas explored</dt>
            <dd>
              {areas} <span>/ {AREA_COUNT}</span>
            </dd>
          </div>
          <div>
            <dt>Journal entries</dt>
            <dd>{entries}</dd>
          </div>
          <div>
            <dt>Visits that took</dt>
            <dd>{successRate === null ? "Not yet" : `${successRate}%`}</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd>{stats.bestStreak}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2>
          Badges <span className={styles.count}>{earned.length} of {BADGES.length}</span>
        </h2>

        {earned.length === 0 ? (
          <p className={styles.empty}>
            None yet. Go and leave the lawn. That&apos;s the first one.
          </p>
        ) : (
          <ul className={styles.badges}>
            {earned.map((badge) => (
              <li className={styles.badge} key={badge.id}>
                <span className={styles.badgeIcon} aria-hidden>
                  ✦
                </span>
                <div>
                  <p className={styles.badgeName}>{badge.name}</p>
                  <p className={styles.badgeText}>{badge.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
