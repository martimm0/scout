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

  /**
   * Read the theme AFTER mounting, deliberately.
   *
   * The lint rule objects to setting state in an effect, and it is right to, in
   * general. It is wrong here, and the alternative it pushes you toward is worse:
   * a lazy `useState` initialiser runs on the SERVER too, where there is no
   * document, so the server renders no button and the client renders one, and the
   * whole tree fails to hydrate. That is not theoretical, it is what happened when
   * I tried it.
   *
   * Both renders have to agree, and the server cannot know the theme, so the
   * first client render must not either. This is the mount-once read that makes
   * them agree, and the rule cannot tell it apart from a cascade.
   */
  useEffect(() => {
    const stored = window.localStorage.getItem("scout-theme") as Theme | null;
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Labelled, not just a glyph. The first version of this was a small unlabelled
  // circle with a sun in it, sitting at the end of a row of navigation links, and
  // it read as decoration rather than as a control: it was on the page and nobody
  // could find it. An icon on its own is a puzzle, and a theme switch is not
  // supposed to be one.
  return (
    <button
      aria-label={`Switch to ${next} mode`}
      className="theme-toggle"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      type="button"
    >
      <span aria-hidden>{theme === "dark" ? "☾" : "☀"}</span>
      <span className="theme-toggle__label">
        {theme === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
}
