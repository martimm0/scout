"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Light or dark, for the pages around the game.
 *
 * The park itself is untouched. It is a sunlit meadow, and a meadow rendered in
 * charcoal is not a dark theme, it is a broken one. The park already has a night,
 * and it arrives when it is night in Pittsburgh.
 *
 * The choice is remembered, and it is applied by `data-theme` on the root element
 * so that an explicit choice beats the system preference in BOTH directions: a
 * player whose laptop is dark everywhere can still ask for light here.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("scout-theme") as Theme | null;
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    setTheme(stored ?? system);
  }, []);

  useEffect(() => {
    if (!theme) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("scout-theme", theme);
  }, [theme]);

  // Render nothing until we know: a button that says "Dark" on a dark page for
  // one frame is worse than a button that arrives a frame late.
  if (!theme) {
    return null;
  }

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`Switch to ${next} mode`}
      className="theme-toggle"
      onClick={() => setTheme(next)}
      type="button"
    >
      <span aria-hidden>{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
