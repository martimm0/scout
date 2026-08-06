"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type NavLink = { href: string; label: string };

/**
 * The rest of the nav, folded up.
 *
 * The bar had seven links, a sign-in button and a theme toggle in it, which on a
 * laptop is a wall of small words and on a phone wrapped onto three lines. The
 * two things you actually came to do stay out on the bar; everything else lives
 * behind one button.
 *
 * A DISCLOSURE, not a menubar. `role="menu"` and its arrow-key model are for
 * application menus (cut, copy, paste), and a screen reader user meeting it on a
 * list of links is told these are commands rather than places to go. A button
 * with `aria-expanded` and a plain list of links underneath is the pattern that
 * matches what this is, and it needs no key handling that browsers do not
 * already give links.
 *
 * Three things it has to do, and each one is a way these usually go wrong:
 *
 *  - **Escape closes it and gives focus back to the button.** Otherwise the
 *    keyboard is left somewhere invisible.
 *  - **A click anywhere else closes it.** A menu that only closes by its own
 *    button is one people leave open by accident and then can't see past.
 *  - **Navigating closes it.** In an app-router app the layout is not remounted
 *    between pages, so without this the menu stays hanging open over the page it
 *    just took you to.
 */
export function NavMenu({
  label,
  links,
}: {
  label: string;
  links: NavLink[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const id = useId();

  /**
   * Open, and the page it was opened on.
   *
   * DERIVED rather than closed by an effect. In an app-router app the layout is
   * not remounted between pages, so a menu left open hangs over the page it just
   * took you to; the obvious fix is an effect on `pathname` that calls setOpen,
   * and that is a synchronous setState in an effect, which cascades a render and
   * which the linter rightly refuses.
   *
   * Remembering WHERE it was opened says the same thing without a render: if the
   * path has moved on, it is shut. It also covers the back button and any other
   * navigation, which a click handler on the links would not.
   */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  // Stable, so the effect below can depend on it honestly rather than being
  // told to ignore the rule.
  const setOpen = useCallback(
    (next: boolean) => setOpenedOn(next ? pathname : null),
    [pathname],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };

    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    // Capture, so a click on a link elsewhere still closes this first.
    window.addEventListener("pointerdown", onPointer, true);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, setOpen]);

  return (
    <div className="nav-menu" ref={wrap}>
      <button
        aria-controls={id}
        aria-expanded={open}
        className="nav-menu__button"
        onClick={() => setOpen(!open)}
        ref={button}
        type="button"
      >
        {label}
        <span aria-hidden className="nav-menu__chevron" data-open={open}>
          ▾
        </span>
      </button>

      {/* Rendered only when open. A hidden list that is merely invisible is
          still in the tab order in some browsers, which is a keyboard user
          tabbing through six links that are not on screen. */}
      {open ? (
        <ul className="nav-menu__list" id={id}>
          {links.map((link) => (
            <li key={link.href}>
              <Link
                aria-current={pathname === link.href ? "page" : undefined}
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
