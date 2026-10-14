"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

import { useCloudSync, type CloudStatus } from "../state/cloud-sync";
import { useGameStore } from "../state/game-store";
import styles from "./cloud-sync-badge.module.css";

const LABEL: Record<CloudStatus, string> = {
  local: "Saved on this device",
  loading: "Loading your progress…",
  synced: "Progress saved",
  saving: "Saving…",
  error: "Couldn't save. Progress is safe on this device.",
};

/**
 * Runs the autosave, and tells the player the truth about where their progress
 * actually lives.
 *
 * Signed out, or cloud saves not configured, it says "saved on this device",
 * which is true, and is a great deal more useful than a silent absence. When a
 * save fails it says so, and says the progress is still safe locally, because it
 * is: localStorage has already taken it.
 */
export function CloudSyncBadge() {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<CloudStatus>("local");

  const onStatus = useCallback((next: CloudStatus) => setStatus(next), []);

  /**
   * Off for the whole of an offline run, summary screen included.
   *
   * The run plays on this same store, and this badge is mounted inside the park.
   * With sync on, a signed-in player's server copy was pulled and unioned into
   * the run, so the "fresh ten minutes" ran on their full save, and then the
   * run was pushed back over it. If that pull failed, what got pushed was the
   * wiped slate. `startedAt` spans the session where `active` does not: it
   * stays set on the summary screen, after the clock has stopped.
   */
  const inOfflineSession = useGameStore((state) => state.offlineRun.startedAt !== null);

  // The account id, not merely "signed in": sync has to know WHOSE save it is.
  const userId =
    sessionStatus === "authenticated" && session?.user?.id ? session.user.id : null;

  useCloudSync(inOfflineSession ? null : userId, onStatus);

  if (inOfflineSession) {
    // "Saved on this device" would be a lie for these ten minutes.
    return (
      <p className={styles.badge} data-status="offline" role="status">
        Not saved. This is the ten-minute run.
      </p>
    );
  }

  return (
    <p className={styles.badge} data-status={status} role="status">
      {LABEL[sessionStatus === "authenticated" ? status : "local"]}
    </p>
  );
}
