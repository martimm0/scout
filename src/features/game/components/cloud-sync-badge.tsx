"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

import { useCloudSync, type CloudStatus } from "../state/cloud-sync";
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
  const { status: sessionStatus } = useSession();
  const [status, setStatus] = useState<CloudStatus>("local");

  const onStatus = useCallback((next: CloudStatus) => setStatus(next), []);

  useCloudSync(sessionStatus === "authenticated", onStatus);

  return (
    <p className={styles.badge} data-status={status} role="status">
      {LABEL[sessionStatus === "authenticated" ? status : "local"]}
    </p>
  );
}
