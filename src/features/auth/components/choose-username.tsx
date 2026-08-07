"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import {
  USERNAME_MAX,
  usernameProblem,
  usernameProblemSays,
} from "@/lib/username";
import styles from "./choose-username.module.css";

/**
 * Pick what the park calls you.
 *
 * Shown once, to anybody signed in who has not chosen. That covers both cases
 * the brief asks for without a second mechanism: a new account has no username
 * because it has never had one, and an account from before usernames existed
 * has no username for the same reason. One null, one prompt.
 *
 * It is NOT a gate, and it is not even a modal, which took two goes to get
 * right. It began as a full-screen scrim, and a scrim eats every click on the
 * page beneath it: signed-in players with no name yet could not press Join on
 * the party lobby, take a photograph, or change their bee. It broke ten tests
 * across four pages and would have broken the same four pages for real people.
 *
 * So it sits in a corner and blocks nothing. You can ignore it entirely and it
 * will ask again next time, which is what "prompt" means. The only thing that
 * actually needs a username is the chat in a garden party, and that is a place
 * you may never go.
 *
 * The real name Google gave us is never shown to other players. That is the
 * point of asking: signing in with a Google account should not put your legal
 * name in a chat window next to strangers.
 */
export function ChooseUsername() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [current, setCurrent] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [says, setSays] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const signedIn = status === "authenticated" && Boolean(session?.user?.id);

  // Ask the server what this account is called. `undefined` means we have not
  // heard yet, which is different from `null`, which means "has not chosen".
  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let alive = true;

    void fetch("/api/username")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { username?: string | null } | null) => {
        if (alive) {
          setCurrent(body?.username ?? null);
        }
      })
      .catch(() => {
        // No answer is not the same as no username. Staying quiet is better
        // than prompting somebody who has already chosen.
        if (alive) {
          setCurrent(undefined);
        }
      });

    return () => {
      alive = false;
    };
  }, [signedIn]);

  /**
   * Never over the park.
   *
   * It no longer blocks anything anywhere, but the game routes are still the
   * wrong place for it: the HUD already owns all four corners, and a card
   * parked on top of the field notes or the chat would be in the way even
   * without swallowing clicks. Asking once you are back on an ordinary page is
   * soon enough for a name.
   */
  const overTheGame = pathname === "/play" || pathname === "/offline";

  if (!signedIn || dismissed || overTheGame || current !== null) {
    return null;
  }

  const problem = usernameProblem(draft.trim());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (problem || saving) {
      return;
    }

    setSaving(true);
    setSays(null);

    try {
      const response = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: draft.trim() }),
      });

      const body = (await response.json()) as {
        username?: string;
        says?: string;
      };

      if (response.ok && body.username) {
        setCurrent(body.username);

        return;
      }

      setSays(body.says ?? "That did not save. Try again in a moment.");
    } catch {
      setSays("That did not save. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // No scrim, and deliberately no `aria-modal`: nothing behind this is
    // inert, so saying otherwise would be a lie told to a screen reader.
    <div className={styles.anchor}>
      <section
        aria-labelledby="choose-username-title"
        className={styles.card}
        role="dialog"
      >
        <p className={styles.eyebrow}>One thing first</p>
        <h2 className={styles.title} id="choose-username-title">
          What should the park call you?
        </h2>
        <p className={styles.note}>
          This is the name other players see in a garden party. Your real name
          is not shown to anybody.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label} htmlFor="choose-username-input">
            Username
          </label>
          <input
            autoComplete="off"
            className={styles.input}
            id="choose-username-input"
            maxLength={USERNAME_MAX}
            onChange={(event) => {
              setDraft(event.target.value);
              setSays(null);
            }}
            placeholder="beequiet"
            spellCheck={false}
            type="text"
            value={draft}
          />

          {/* Says which rule, and only once something has been typed: telling
              somebody their empty box is empty is noise. */}
          <p className={styles.hint} role={says ? "alert" : undefined}>
            {says ??
              (draft.length > 0 && problem
                ? usernameProblemSays(problem)
                : `Up to ${USERNAME_MAX} characters, no spaces.`)}
          </p>

          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={Boolean(problem) || saving}
              type="submit"
            >
              {saving ? "Saving" : "That is me"}
            </button>
            <button
              className={styles.later}
              onClick={() => setDismissed(true)}
              type="button"
            >
              Later
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
