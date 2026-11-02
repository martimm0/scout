"use client";

import { useGameStore } from "../state/game-store";
import styles from "./sound-toggle.module.css";

/**
 * Sound on/off and volume. Audio is off by default; browsers require a gesture.
 * Only the settings change here: GameScene applies them, since this panel can
 * be closed.
 */
export function SoundToggle() {
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);

  return (
    <div className={styles.wrap}>
      <button
        aria-pressed={settings.soundOn}
        className={styles.button}
        onClick={() => updateSettings({ soundOn: !settings.soundOn })}
        type="button"
      >
        {settings.soundOn ? "🔊" : "🔇"}
        <span>{settings.soundOn ? "Sound on" : "Sound off"}</span>
      </button>

      <label className={styles.volume}>
        <span className={styles.srOnly}>Volume</span>
        <input
          disabled={!settings.soundOn}
          max={1}
          min={0}
          onChange={(event) =>
            updateSettings({ volume: Number(event.target.value) })
          }
          step={0.05}
          type="range"
          value={settings.volume}
        />
      </label>
    </div>
  );
}
