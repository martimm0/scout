"use client";

import styles from "./rotate-notice.module.css";

/**
 * Turn the phone.
 *
 * The park is wide, the bee flies along the horizon, and both thumbs need a
 * corner to sit in. A portrait phone gives none of that: a tall slot to fly
 * through and two thumbs meeting in the middle.
 *
 * Only phones see this. A tablet held upright is a perfectly good way to play, so
 * the query that mounts this one is size-limited as well as coarse and portrait.
 * It covers the scene rather than replacing it, so the park is still there,
 * running, the moment the phone comes round.
 */
export function RotateNotice() {
  return (
    <div className={styles.notice} role="status">
      <div className={styles.card}>
        <span aria-hidden className={styles.glyph}>
          ⟳
        </span>
        <p className={styles.title}>Turn your phone.</p>
        <p className={styles.body}>
          The park is wider than it is tall, and so are you. Scout plays in
          landscape.
        </p>
      </div>
    </div>
  );
}
