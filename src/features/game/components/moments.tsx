"use client";

import { useEffect, useState } from "react";

import { useGameStore } from "../state/game-store";
import { MOMENT_EVENT, momentsBetween, type Moment } from "../state/moments";
import styles from "./moments.module.css";

/** How long one stays up. Short: it is a nod, not a dialog. */
const LINGER_MS = 3200;

type Shown = Moment & { id: number };

/**
 * The line at the top of the screen when the game notices something: a first
 * find, a park opening, a streak. What counts as a moment is decided in
 * `state/moments.ts`; this only queues them and shows one at a time.
 */
export function Moments() {
  const [queue, setQueue] = useState<Shown[]>([]);

  useEffect(() => {
    let last = useGameStore.getState();
    let serial = 0;

    const add = (fresh: Moment[]) => {
      if (fresh.length > 0) {
        setQueue((current) => [
          ...current,
          ...fresh.map((moment) => ({ ...moment, id: (serial += 1) })),
        ]);
      }
    };
    const onAnnounce = (event: Event) => add([(event as CustomEvent<Moment>).detail]);
    const unsubscribe = useGameStore.subscribe((state) => {
      const before = last;

      last = state;
      add(momentsBetween(before, state));
    });

    window.addEventListener(MOMENT_EVENT, onAnnounce);

    return () => {
      unsubscribe();
      window.removeEventListener(MOMENT_EVENT, onAnnounce);
    };
  }, []);

  const showing = queue[0];

  useEffect(() => {
    if (!showing) {
      return;
    }

    const timer = window.setTimeout(
      () => setQueue((current) => current.filter((moment) => moment.id !== showing.id)),
      LINGER_MS,
    );

    return () => window.clearTimeout(timer);
  }, [showing]);

  if (!showing) {
    return null;
  }

  return (
    <aside aria-live="polite" className={styles.moment} data-moment={showing.label} key={showing.id}>
      <p className={styles.label}>{showing.label}</p>
      <p className={styles.title}>{showing.title}</p>
      {showing.detail ? <p className={styles.detail}>{showing.detail}</p> : null}
    </aside>
  );
}
