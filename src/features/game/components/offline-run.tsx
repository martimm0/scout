"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PLANTS } from "../data/plants";
import { countUnlocked, useGameStore } from "../state/game-store";
import { GameScene } from "./game-scene";
import styles from "./offline-run.module.css";

function formatClock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);

  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The ten-minute run.
 *
 * No account, no saved progress, and a clock that doesn't stop. It should not
 * feel like a demo with the good parts taken out — it's the honest version of
 * being an insect. Your time is genuinely short, and what you do with it is the
 * whole point.
 */
export function OfflineRun() {
  const offlineRun = useGameStore((state) => state.offlineRun);
  const startOfflineRun = useGameStore((state) => state.startOfflineRun);
  const tickOfflineRun = useGameStore((state) => state.tickOfflineRun);
  const resetOfflineRun = useGameStore((state) => state.resetOfflineRun);

  const discovered = useGameStore((state) => countUnlocked(state.discoveredPlants));
  const pollinated = useGameStore((state) => countUnlocked(state.pollinatedPlants));
  const areas = useGameStore((state) => countUnlocked(state.unlockedMapAreas));
  const entries = useGameStore((state) =>
    countUnlocked(state.unlockedJournalEntries),
  );

  const [started, setStarted] = useState(false);

  const remaining = offlineRun.durationSeconds - offlineRun.elapsedSeconds;
  const finished = started && !offlineRun.active && offlineRun.startedAt !== null;

  // The clock. Driven off the wall clock rather than a frame counter, so a
  // stutter or a background tab can't buy you extra time.
  useEffect(() => {
    if (!started || !offlineRun.active || offlineRun.startedAt === null) {
      return;
    }

    const startedAt = offlineRun.startedAt;
    const timer = window.setInterval(() => {
      tickOfflineRun((Date.now() - startedAt) / 1000);
    }, 250);

    return () => window.clearInterval(timer);
  }, [started, offlineRun.active, offlineRun.startedAt, tickOfflineRun]);

  if (!started) {
    return (
      <section className={styles.gate}>
        <p className={styles.eyebrow}>Offline run</p>
        <h2 className={styles.title}>You are a pollinator.</h2>
        <p className={styles.pitch}>
          Your time is short. Ten minutes, no account, nothing saved. Explore
          Frick Park, pollinate what you can, and learn as much as you&apos;re
          able before the light goes.
        </p>
        <p className={styles.note}>
          This is not a trial version. It&apos;s a whole season, compressed.
        </p>
        <Button
          onClick={() => {
            resetOfflineRun();
            startOfflineRun();
            setStarted(true);
          }}
          type="button"
        >
          Begin
        </Button>
      </section>
    );
  }

  if (finished) {
    return (
      <section className={styles.gate}>
        <p className={styles.eyebrow}>Time</p>
        <h2 className={styles.title}>Your ten minutes are up.</h2>

        <dl className={styles.summary}>
          <div>
            <dt>Plants found</dt>
            <dd>
              {discovered} <span>/ {PLANTS.length}</span>
            </dd>
          </div>
          <div>
            <dt>Pollinated</dt>
            <dd>{pollinated}</dd>
          </div>
          <div>
            <dt>Areas seen</dt>
            <dd>{areas}</dd>
          </div>
          <div>
            <dt>Things learned</dt>
            <dd>{entries}</dd>
          </div>
        </dl>

        <p className={styles.pitch}>
          {pollinated === 0
            ? "Not a single flower took. That happens — most visits come to nothing, and a bee just flies to the next one."
            : pollinated === 1
              ? "One flower will set seed because of you. That is not nothing. That is the entire mechanism."
              : `${pollinated} flowers will set seed because of you. A meadow is built out of exactly that, one visit at a time.`}
        </p>

        <p className={styles.note}>
          Nothing here was saved. Sign in — when sign-in exists — and the park
          will remember you.
        </p>

        <div className={styles.actions}>
          <Button
            onClick={() => {
              resetOfflineRun();
              startOfflineRun();
            }}
            type="button"
          >
            Fly again
          </Button>
          <Button href="/journal" variant="secondary">
            See what you learned
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.run}>
      <aside className={styles.clock} data-low={remaining < 60}>
        <span className={styles.clockLabel}>Time left</span>
        <span className={styles.clockValue}>{formatClock(remaining)}</span>
      </aside>
      <GameScene />
    </div>
  );
}
