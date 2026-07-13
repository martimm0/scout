"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { playSound } from "../audio/sound";
import { ACCESSORIES, SPECIES_LIST, WING_STYLES, speciesFor } from "../models/pollinators";
import { useGameStore } from "../state/game-store";
import { StarterVisual } from "./starter-selection";
import styles from "./customize.module.css";

const BODY_COLORS = [
  "#f2bb42",
  "#e89a3c",
  "#d97f4a",
  "#c9a227",
  "#8fae4a",
  "#5f9ea0",
  "#a878c8",
  "#e0e0e0",
];

const WING_COLORS = ["#dcefff", "#e8e0ff", "#d9f5e6", "#fff0d6", "#ffe0ec"];

const ACCENT_COLORS = [
  "#c0413b",
  "#2f6fa8",
  "#3f8c5a",
  "#8a4fa8",
  "#e08a2c",
  "#333333",
];

const TRAILS = [
  { id: "pollen", label: "Pollen", note: "A soft dust of gold behind you." },
  { id: "sparkle", label: "Sparkle", note: "Bright motes, briefly." },
  { id: "none", label: "None", note: "Fly clean." },
];

const WING_STYLE_NOTES: Record<string, string> = {
  round: "The honeybee's paddle.",
  long: "Long and tapered, like a hoverfly's.",
  stubby: "Short and round. Bumblebee energy.",
};

const ACCESSORY_NOTES: Record<string, string> = {
  none: "Nothing at all.",
  cap: "A little cap.",
  flower: "A blossom, tucked behind the antennae.",
  scarf: "A scarf. It's cold up there.",
};

/** Names are trimmed, capped, and must not be empty or all whitespace. */
function validateName(raw: string) {
  const name = raw.trim();

  if (name.length === 0) {
    return { valid: false, error: "Your pollinator needs a name." };
  }

  if (name.length > 20) {
    return { valid: false, error: "Twenty characters is plenty." };
  }

  if (!/^[\p{L}\p{N} '’-]+$/u.test(name)) {
    return { valid: false, error: "Letters, numbers, spaces and hyphens only." };
  }

  return { valid: true, error: null };
}

/**
 * Pollinator customization.
 *
 * The species picker offers all three again — and this time each one is a real
 * model that really flies differently. It was bee-only for a while precisely
 * because the scene rendered a bee whatever you picked, and a chooser that hands
 * you a bee whatever you choose is just lying to you.
 */
export function Customize() {
  const pollinator = useGameStore((state) => state.pollinator);
  const updatePollinator = useGameStore((state) => state.updatePollinator);

  const [name, setName] = useState(pollinator.name);
  const [saved, setSaved] = useState(false);

  const species = speciesFor(pollinator.type);

  const validation = useMemo(() => validateName(name), [name]);

  const set = (patch: Parameters<typeof updatePollinator>[0]) => {
    updatePollinator(patch);
    playSound("ui");
    setSaved(false);
  };

  const save = () => {
    if (!validation.valid) {
      return;
    }

    updatePollinator({ name: name.trim() });
    playSound("pollinateSuccess");
    trackEvent({ name: "pollinator_customized" });
    setSaved(true);
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.previewPane}>
        <div className={styles.preview}>
          <StarterVisual pollinator={pollinator} />
        </div>
        <p className={styles.previewName}>
          {validation.valid ? name.trim() : pollinator.name} the{" "}
          {species.label.toLowerCase()}
        </p>
        <p className={styles.previewNote}>
          The 2D preview shows your colours. Fly to see the model.
        </p>
      </aside>

      <div className={styles.form}>
        <section className={styles.field}>
          <p className={styles.label}>Species</p>
          <div className={styles.species}>
            {SPECIES_LIST.map((option) => (
              <button
                aria-pressed={pollinator.type === option.id}
                className={styles.speciesOption}
                key={option.id}
                onClick={() => set({ type: option.id })}
                type="button"
              >
                <span className={styles.speciesName}>{option.label}</span>
                <span className={styles.speciesNote}>{option.flightNote}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.field}>
          <label className={styles.label} htmlFor="pollinator-name">
            Name
          </label>
          <input
            aria-describedby="pollinator-name-error"
            aria-invalid={!validation.valid}
            className={styles.input}
            id="pollinator-name"
            maxLength={24}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            value={name}
          />
          <p className={styles.error} id="pollinator-name-error" role="status">
            {validation.error ?? ""}
          </p>
        </section>

        <Swatches
          colors={BODY_COLORS}
          label="Body colour"
          onPick={(bodyColor) => set({ bodyColor })}
          value={pollinator.bodyColor}
        />

        {/* A butterfly's wings carry their own pattern in the vertex colours, so
            a "wing colour" would only smear it. Hidden rather than ignored. */}
        {species.wings.tinted ? (
          <Swatches
            colors={WING_COLORS}
            label="Wing colour"
            onPick={(wingColor) => set({ wingColor })}
            value={pollinator.wingColor}
          />
        ) : null}

        {/* Wing style is the bee's alone. A butterfly's wings ARE the butterfly,
            and a hoverfly has exactly the two it needs. */}
        {species.supportsWingStyle ? (
          <Options
            label="Wing style"
            notes={WING_STYLE_NOTES}
            onPick={(wingStyle) => set({ wingStyle })}
            options={[...WING_STYLES]}
            value={pollinator.wingStyle}
          />
        ) : null}

        <Options
          label="Accessory"
          notes={ACCESSORY_NOTES}
          onPick={(accessory) => set({ accessory })}
          options={[...ACCESSORIES]}
          value={pollinator.accessory}
        />

        <Swatches
          colors={ACCENT_COLORS}
          label="Accent colour"
          onPick={(accentColor) => set({ accentColor })}
          value={pollinator.accentColor}
        />

        <section className={styles.field}>
          <p className={styles.label}>Trail</p>
          <div className={styles.options}>
            {TRAILS.map((trail) => (
              <button
                aria-pressed={pollinator.trailEffect === trail.id}
                className={styles.option}
                key={trail.id}
                onClick={() => set({ trailEffect: trail.id })}
                type="button"
              >
                <span className={styles.optionLabel}>{trail.label}</span>
                <span className={styles.optionNote}>{trail.note}</span>
              </button>
            ))}
          </div>
        </section>


        <div className={styles.actions}>
          <Button disabled={!validation.valid} onClick={save} type="button">
            {saved ? "Saved" : "Save pollinator"}
          </Button>
          <Button href="/play" variant="secondary">
            Fly
          </Button>
        </div>
      </div>
    </div>
  );
}

function Swatches({
  colors,
  label,
  onPick,
  value,
}: {
  colors: string[];
  label: string;
  onPick: (color: string) => void;
  value: string;
}) {
  return (
    <section className={styles.field}>
      <p className={styles.label}>{label}</p>
      <div className={styles.swatches}>
        {colors.map((color) => (
          <button
            aria-label={`${label}: ${color}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            className={styles.swatch}
            key={color}
            onClick={() => onPick(color)}
            style={{ background: color }}
            type="button"
          />
        ))}
      </div>
    </section>
  );
}

function Options({
  label,
  notes,
  onPick,
  options,
  value,
}: {
  label: string;
  notes: Record<string, string>;
  onPick: (option: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <section className={styles.field}>
      <p className={styles.label}>{label}</p>
      <div className={styles.options}>
        {options.map((option) => (
          <button
            aria-pressed={value === option}
            className={styles.option}
            key={option}
            onClick={() => onPick(option)}
            type="button"
          >
            <span className={styles.optionLabel}>{option}</span>
            <span className={styles.optionNote}>{notes[option]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
