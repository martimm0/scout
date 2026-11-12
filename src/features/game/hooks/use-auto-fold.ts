"use client";

import { useEffect, useState, type FocusEvent, type PointerEvent } from "react";

import { useGameStore, type PanelId } from "../state/game-store";

/** How long a panel stays open, untouched, before it folds itself away. */
export const FOLD_AFTER_MS = 8000;

/**
 * A HUD panel that gets out of the way.
 *
 * The play screen used to keep Controls, Field Notes and Scout Stats open at
 * once, which is a lot of text over a meadow. Each now folds to its header a
 * few seconds after it opens, unless the player pins it. The timer waits while
 * a mouse is over the panel or keyboard focus is inside it, so a panel never
 * folds out from under somebody reading it or reaching for a button.
 *
 * A mouse and the keyboard only. A tap focuses the button it lands on and the
 * focus stays there after the thumb has gone, so counting it held a phone's
 * panels open for good.
 *
 * `defaultOpen` is followed until the player touches the panel, and it may
 * change: the panels sit folded during the first flight and open when it ends,
 * then fold again on their own.
 */
export function useAutoFold(id: PanelId, defaultOpen: boolean) {
  const pinned = useGameStore((state) => state.settings.pinnedPanels?.[id] === true);
  const updateSettings = useGameStore((state) => state.updateSettings);

  // null until the player (or the timer) decides, then their choice.
  const [choice, setChoice] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = hovered || focused;
  // Bumped on every open, so reopening restarts the countdown.
  const [openedAt, setOpenedAt] = useState(0);

  const open = pinned || (choice ?? defaultOpen);

  useEffect(() => {
    if (!open || pinned || held) {
      return;
    }

    const timer = window.setTimeout(() => setChoice(false), FOLD_AFTER_MS);

    return () => window.clearTimeout(timer);
  }, [open, pinned, held, openedAt]);

  const setPinned = (next: boolean) => {
    const current = useGameStore.getState().settings.pinnedPanels ?? {};
    updateSettings({ pinnedPanels: { ...current, [id]: next } });
  };

  return {
    open,
    pinned,
    toggle: () => {
      if (open) {
        // Folding a pinned panel is asking it to stay folded.
        if (pinned) {
          setPinned(false);
        }
        setChoice(false);
      } else {
        setChoice(true);
        setOpenedAt(Date.now());
      }
    },
    togglePin: () => {
      // Unpinning leaves it open, with the full count to read it by.
      setChoice(true);
      setOpenedAt(Date.now());
      setPinned(!pinned);
    },
    holdProps: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") {
          setHovered(true);
        }
      },
      onPointerLeave: () => setHovered(false),
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target.matches(":focus-visible")) {
          setFocused(true);
        }
      },
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      },
    },
  };
}
