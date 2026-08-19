"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { STARTER_POLLINATORS } from "@/features/game/data/starter-pollinators";
import {
  useGameStore,
  type Pollinator,
} from "@/features/game/state/game-store";
import styles from "./starter-selection.module.css";

export function StarterVisual({ pollinator }: { pollinator: Pollinator }) {
  const cssVars = {
    // The player's own accent, not a hardcoded one, otherwise the preview
    // silently ignores the colour they just picked.
    "--starter-accent": pollinator.accentColor,
    "--starter-body": pollinator.bodyColor,
    "--starter-wing": pollinator.wingColor,
  } as CSSProperties;

  return (
    <div className={styles.visual} style={cssVars}>
      <div className={styles.insect} data-type={pollinator.type}>
        <span className={styles.wing} />
        <span className={styles.wing} />
        <span className={styles.wingLower} />
        <span className={styles.wingLower} />
        <span className={styles.body} />
        <span className={styles.head} />
        <span className={styles.tail} />
        <span className={`${styles.stripe} ${styles.stripeOne}`} />
        <span className={`${styles.stripe} ${styles.stripeTwo}`} />
        <span className={styles.eye} />
        <span className={styles.eye} />
        <span className={styles.antenna} />
        <span className={styles.antenna} />
      </div>
    </div>
  );
}

export function StarterSelection() {
  const selectedPollinator = useGameStore((state) => state.pollinator);
  const updatePollinator = useGameStore((state) => state.updatePollinator);
  const selectedStarter =
    STARTER_POLLINATORS.find(
      (starter) => starter.type === selectedPollinator.type,
    ) ?? STARTER_POLLINATORS[0];

  return (
    <main className="page-container">
      <section className={styles.layout} aria-label="Starter pollinator selection">
        <div className={styles.header}>
          <p className="eyebrow">Milestone 5</p>
          <h1>Choose Your Starter</h1>
          <p className="lead">
            Pick the pollinator you want to take into Frick Park. The current
            starter changes the in-game model, preview, colors, wing style, and
            trail effect.
          </p>
        </div>

        <div className={styles.grid}>
          {STARTER_POLLINATORS.map((starter) => {
            const isSelected = starter.type === selectedPollinator.type;
            const pollinator = {
              bodyColor: starter.bodyColor,
              name: starter.name,
              trailEffect: starter.trailEffect,
              trailColor: starter.trailColor,
              type: starter.type,
              wingColor: starter.wingColor,
              wingStyle: starter.wingStyle,
            };

            return (
              <Card
                className={styles.starterCard}
                data-selected={isSelected}
                key={starter.type}
              >
                <StarterVisual pollinator={starter} />
                <div className={styles.meta}>
                  <div className={styles.nameRow}>
                    <h2>{starter.name}</h2>
                    <span className={styles.type}>{starter.type}</span>
                  </div>
                  <p>{starter.description}</p>
                  <ul className={styles.detailList}>
                    <li>
                      <span>Flight</span>
                      <strong>{starter.flightNote}</strong>
                    </li>
                    <li>
                      <span>Wings</span>
                      <strong>{starter.wingStyle}</strong>
                    </li>
                    <li>
                      <span>Trail</span>
                      <strong>{starter.trailEffect}</strong>
                    </li>
                    <li>
                      <span>Body</span>
                      <span
                        aria-label={`${starter.name} body color`}
                        className={styles.swatch}
                        style={{ "--swatch": starter.bodyColor } as CSSProperties}
                      />
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={() => updatePollinator(pollinator)}
                  type="button"
                  variant={isSelected ? "primary" : "secondary"}
                >
                  {isSelected ? "Selected" : `Choose ${starter.name}`}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className={styles.footer}>
          <Button href="/play">Enter Frick Park</Button>
          <Button href="/offline" variant="secondary">
            Try offline run
          </Button>
          <p className={styles.status}>
            Current starter: {selectedStarter.name} the {selectedStarter.type}
          </p>
        </div>
      </section>
    </main>
  );
}
