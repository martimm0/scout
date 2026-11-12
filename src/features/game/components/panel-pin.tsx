"use client";

import styles from "./panel-pin.module.css";

/**
 * The pin in a HUD panel's header. Pressed, the panel stays open; otherwise it
 * folds itself away a few seconds after it opens. See `useAutoFold`.
 */
export function PanelPin({
  label,
  pinned,
  onToggle,
}: {
  /** The panel's name as the player reads it: "Controls", "Field Notes". */
  label: string;
  pinned: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={pinned ? `Let ${label} fold` : `Keep ${label} open`}
      aria-pressed={pinned}
      className={styles.pin}
      data-pinned={pinned}
      onClick={onToggle}
      title={pinned ? "Pinned open" : "Pin open"}
      type="button"
    >
      <svg aria-hidden viewBox="0 0 16 16" width="14" height="14">
        <path
          d="M10.5 1.5 14.5 5.5 12 6.5 9.5 9l.5 3.5-1 1L6 10.5 2.5 14 2 13.5 5.5 10 2.5 7l1-1L7 6.5 9.5 4z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
