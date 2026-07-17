"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { playSound } from "../audio/sound";
import {
  FAILURE_MESSAGES,
  MINIGAME_FOR_ARCHETYPE,
  MINIGAME_SPEC,
  SUCCESS_MESSAGES,
  pickMessage,
  resolvePollination,
  type MinigameKind,
} from "../data/pollination";
import { PLANTS_BY_ID, type Plant } from "../data/plants";
import { useGameStore } from "../state/game-store";
import styles from "./pollination-minigame.module.css";

const ARROWS = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"] as const;
const ARROW_GLYPH: Record<string, string> = {
  ArrowUp: "↑",
  ArrowRight: "→",
  ArrowDown: "↓",
  ArrowLeft: "←",
};

type Outcome = {
  success: boolean;
  message: string;
};

/**
 * The pollination minigames.
 *
 * Three of them, chosen by the plant's shape so a species always plays the same
 * way and you can learn its rhythm:
 *
 *   hover — settle inside a ring and hold still (daisies, woodland flowers)
 *   taps  — work the florets one at a time (spikes, shrubs)
 *   cue   — follow the flower that's open (umbels, flowering trees)
 *
 * All three feed a single 0–1 performance score into one resolver, so the ~20%
 * failure rate lives in exactly one place.
 */
export function PollinationMinigame() {
  const plantId = useGameStore((state) => state.ui.minigamePlantId);
  const plant = plantId ? PLANTS_BY_ID.get(plantId) : undefined;

  if (!plant) {
    return null;
  }

  // Keyed on the plant so every attempt starts from a clean component rather
  // than a pile of reset effects.
  return <MinigameRun key={plant.id} plant={plant} />;
}

function MinigameRun({ plant }: { plant: Plant }) {
  const endMinigame = useGameStore((state) => state.endMinigame);
  const pollinatePlant = useGameStore((state) => state.pollinatePlant);
  const recordAttempt = useGameStore((state) => state.recordPollinationAttempt);
  const recordScore = useGameStore((state) => state.recordMinigameScore);

  const kind: MinigameKind = MINIGAME_FOR_ARCHETYPE[plant.archetype] ?? "hover";
  const spec = MINIGAME_SPEC[kind];

  useEffect(() => {
    trackEvent({
      name: "pollination_attempted",
      plant: plant.id,
      minigame: kind,
    });
  }, [plant.id, kind]);

  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Hover: a drifting target you keep the bee inside of.
  const [driftX, setDriftX] = useState(0);
  const [driftY, setDriftY] = useState(0);
  const [holding, setHolding] = useState(false);

  // Taps: florets worked.
  const [taps, setTaps] = useState(0);
  const TAP_TARGET = 14;

  // Cue: the arrow the open flower points to.
  const [cue, setCue] = useState<string>("ArrowUp");
  const [cueHits, setCueHits] = useState(0);
  const [cueMisses, setCueMisses] = useState(0);
  const CUE_TARGET = 6;

  const scoreRef = useRef(0);
  // Stamped in an effect, not during render — performance.now() is impure and
  // React may render this component more than once before it commits.
  const startedRef = useRef(0);

  useEffect(() => {
    startedRef.current = performance.now();
  }, []);

  /** Fold whatever the player did into one 0–1 number. */
  const performanceScore = useCallback(() => {
    if (kind === "hover") {
      return Math.min(1, scoreRef.current / (spec.duration * 0.75));
    }

    if (kind === "taps") {
      return Math.min(1, taps / TAP_TARGET);
    }

    const attempts = cueHits + cueMisses;

    return attempts === 0 ? 0 : Math.min(1, cueHits / CUE_TARGET);
  }, [kind, spec.duration, taps, cueHits, cueMisses]);

  const finish = useCallback(() => {
    if (outcome) {
      return;
    }

    const score = performanceScore();

    // Deterministic-ish per attempt, but genuinely variable — this is the one
    // place chance enters the game.
    const roll = Math.random();
    const success = resolvePollination(score, roll);

    recordAttempt(success);
    recordScore(score);
    trackEvent({
      name: "pollination_resolved",
      plant: plant.id,
      success,
      minigame: kind,
      score: Number(score.toFixed(3)),
    });

    if (success) {
      pollinatePlant(plant.id);
      playSound("pollinateSuccess");
    } else {
      playSound("pollinateFail");
    }

    setOutcome({
      success,
      message: pickMessage(
        success ? SUCCESS_MESSAGES : FAILURE_MESSAGES,
        Math.random(),
      ),
    });
  }, [plant, kind, outcome, performanceScore, recordAttempt, recordScore, pollinatePlant]);

  // The clock.
  useEffect(() => {
    if (outcome) {
      return;
    }

    let raf = 0;

    const tick = (now: number) => {
      const elapsed = (now - startedRef.current) / 1000;
      setProgress(Math.min(1, elapsed / spec.duration));

      if (kind === "hover") {
        // The flower head sways. Chasing it is the game.
        const t = elapsed;
        const x = Math.sin(t * 1.7) * 34 + Math.sin(t * 0.7) * 16;
        const y = Math.cos(t * 1.3) * 26 + Math.sin(t * 2.1) * 10;
        setDriftX(x);
        setDriftY(y);
      }

      if (elapsed >= spec.duration) {
        finish();

        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [outcome, kind, spec.duration, finish]);

  // Hover: accumulate held time while the pointer is inside the ring.
  useEffect(() => {
    if (kind !== "hover" || !holding || outcome) {
      return;
    }

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      scoreRef.current += (now - last) / 1000;
      last = now;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [kind, holding, outcome]);

  // Keyboard: Space taps, arrows answer cues, Esc/Space dismisses the result.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        endMinigame();

        return;
      }

      if (outcome) {
        if (event.code === "Space" || event.code === "Enter") {
          event.preventDefault();
          endMinigame();
        }

        return;
      }

      if (kind === "taps" && event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setTaps((count) => count + 1);
        playSound("tap");

        return;
      }

      if (kind === "cue" && ARROWS.includes(event.code as (typeof ARROWS)[number])) {
        event.preventDefault();

        if (event.code === cue) {
          setCueHits((hits) => hits + 1);
          playSound("tap");
        } else {
          setCueMisses((misses) => misses + 1);
        }

        setCue(ARROWS[Math.floor(Math.random() * ARROWS.length)]);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [kind, cue, outcome, endMinigame]);

  const hint = useMemo(() => {
    if (kind === "taps") {
      return `${Math.min(taps, TAP_TARGET)} / ${TAP_TARGET} florets`;
    }

    if (kind === "cue") {
      return `${Math.min(cueHits, CUE_TARGET)} / ${CUE_TARGET} blossoms`;
    }

    return holding ? "Holding steady…" : "Get inside the ring";
  }, [kind, taps, cueHits, holding]);

  return (
    <div className={styles.scrim} role="presentation">
      <section
        aria-label={`Pollinating ${plant.commonName}`}
        aria-modal="true"
        className={styles.panel}
        role="dialog"
      >
        <p className={styles.eyebrow}>Pollinating</p>
        <h2 className={styles.name}>{plant.commonName}</h2>

        {outcome ? (
          <div className={styles.outcome} data-success={outcome.success}>
            <p className={styles.outcomeTitle}>
              {outcome.success ? "Pollinated" : "Not this time"}
            </p>
            <p className={styles.outcomeMessage}>{outcome.message}</p>

            {outcome.success ? (
              <p className={styles.fact}>{plant.fact}</p>
            ) : (
              <p className={styles.fact}>
                About one flower visit in five comes to nothing, even for a good
                bee. It costs you nothing but a moment. Fly to the next one.
              </p>
            )}

            <button
              autoFocus
              className={styles.dismiss}
              onClick={endMinigame}
              type="button"
            >
              {outcome.success ? "Carry on" : "Try another"}
            </button>
          </div>
        ) : (
          <>
            <p className={styles.instruction}>{spec.instruction}</p>

            {/* `data-minigame` is the stable hook the e2e suite drives. It used
                to find the ring with `[class*="ring"]`, which is a CSS-module
                hash match: it also caught `.ringCore`, and would catch any
                future class with "ring" in the middle of it. */}
            <div className={styles.stage} data-minigame={kind}>
              {kind === "hover" ? (
                <div
                  className={styles.ring}
                  data-target="hover"
                  onPointerEnter={() => setHolding(true)}
                  onPointerLeave={() => setHolding(false)}
                  style={{
                    transform: `translate(${driftX}px, ${driftY}px)`,
                  }}
                  data-holding={holding}
                >
                  <span className={styles.ringCore} />
                </div>
              ) : null}

              {kind === "taps" ? (
                <div className={styles.florets}>
                  {Array.from({ length: TAP_TARGET }).map((_, index) => (
                    <span
                      className={styles.floret}
                      data-done={index < taps}
                      key={index}
                    />
                  ))}
                </div>
              ) : null}

              {kind === "cue" ? (
                <div className={styles.cue}>
                  <span className={styles.cueGlyph}>{ARROW_GLYPH[cue]}</span>
                </div>
              ) : null}
            </div>

            <p className={styles.hint}>{hint}</p>

            <div className={styles.timer}>
              <span style={{ width: `${(1 - progress) * 100}%` }} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
