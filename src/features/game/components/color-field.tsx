"use client";

import { useState } from "react";

import styles from "./color-field.module.css";

/**
 * A colour: pick a preset, drag the wheel, or type the hex.
 *
 * The swatches stay because they are good colours and most people want a good
 * colour rather than a specific one. But they were the ONLY way to choose, which
 * meant eight body colours existed and no others, and a player who wanted their
 * bee a particular shade of their own could not have it. The wheel and the hex
 * box are the answer to that, and the hex box specifically is the answer to
 * "I have a colour and I know its number".
 */

/** Six digits, with or without the hash, upper or lower case. */
function normalise(raw: string): string | null {
  const value = raw.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    // Expand the shorthand, because `#f0c` is a colour a person might type.
    const [r, g, b] = value;

    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return `#${value}`.toLowerCase();
  }

  return null;
}

export function ColorField({
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
  /**
   * What is in the box, when it differs from the committed colour.
   *
   * Null means "show the real value". Typing puts a draft here; committing or a
   * change from outside (a preset, the wheel) clears it, and the box goes back to
   * following the colour.
   *
   * This is deliberately not a useEffect that copies `value` into state. That
   * version worked, but it set state during an effect on every outside change,
   * which is a re-render for nothing and the thing React is warning about. A
   * draft that clears itself needs no synchronising.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);

  const text = draft ?? value;

  const commit = (raw: string) => {
    const hex = normalise(raw);

    if (!hex) {
      setBad(true);

      return;
    }

    setBad(false);
    setDraft(null);
    onPick(hex);
  };

  const pick = (color: string) => {
    setDraft(null);
    setBad(false);
    onPick(color.toLowerCase());
  };

  return (
    <section className={styles.field}>
      <p className={styles.label}>{label}</p>

      <div className={styles.swatches}>
        {colors.map((color) => (
          <button
            aria-label={color}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            className={styles.swatch}
            key={color}
            onClick={() => pick(color)}
            style={{ background: color }}
            type="button"
          />
        ))}
      </div>

      <div className={styles.custom}>
        <label className={styles.wheelLabel}>
          {/* The platform's own colour picker: a full wheel, an eyedropper on
              most desktops, and it is keyboard accessible and localised without
              us writing a single line of it. */}
          <input
            aria-label={`${label}, colour picker`}
            className={styles.wheel}
            onChange={(event) => pick(event.target.value)}
            type="color"
            value={value}
          />
          <span>Wheel</span>
        </label>

        <label className={styles.hexLabel}>
          <span className={styles.hexHash} aria-hidden>
            #
          </span>
          <input
            aria-invalid={bad}
            aria-label={`${label}, hex code`}
            className={styles.hex}
            maxLength={7}
            onBlur={(event) => commit(event.target.value)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit((event.target as HTMLInputElement).value);
              }
            }}
            spellCheck={false}
            value={text.replace(/^#/, "")}
          />
        </label>

        {bad ? (
          <p className={styles.bad} role="status">
            Six hex digits, like f2bb42.
          </p>
        ) : null}
      </div>
    </section>
  );
}
