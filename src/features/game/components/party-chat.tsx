"use client";

import { useEffect, useRef, useState } from "react";

import { sendChat } from "../state/party-client";
import { startVoice, stopVoice } from "../state/party-voice";
import { usePartyStore } from "../state/party-store";
import styles from "./party-chat.module.css";

/**
 * The party's chat, which forgets.
 *
 * Every line vanishes sixty seconds after it arrives. That is not a storage
 * saving, it is the design: a garden party is a place you were, not a thread you
 * catch up on, and a chat with no history is one nobody has to moderate a
 * backlog of. The server holds nothing at all; the expiry here is the second
 * half of a promise the protocol already keeps.
 *
 * It sits above the controls panel, and the controls default to collapsed in a
 * party so the chat is readable and typable without a click.
 *
 * **Typing must not fly the bee.** The scene listens on window and calls
 * preventDefault on W, A, S, D, E, Q, Space and more, which between them are
 * most of the alphabet you need to write a sentence. The input stops the events
 * from reaching it, and the store's `chatFocused` flag makes the frame loop treat
 * a focused chat box the way it treats an open popover.
 */
export function PartyChat() {
  const chat = usePartyStore((state) => state.chat);
  const status = usePartyStore((state) => state.status);
  const setChatFocused = usePartyStore((state) => state.setChatFocused);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLUListElement>(null);

  // Newest at the bottom, kept in view. Only scrolls its own box.
  useEffect(() => {
    const node = log.current;

    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [chat.length]);

  if (status !== "in") {
    return null;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const text = draft.trim();

    if (!text) {
      return;
    }

    sendChat(text);
    setDraft("");
  };

  return (
    <section aria-label="Party chat" className={styles.chat}>
      <VoiceToggle />

      <ul className={styles.log} ref={log}>
        {chat.length === 0 ? (
          <li className={styles.quiet}>
            Nobody has said anything. Messages fade after a minute.
          </li>
        ) : (
          chat.map((line) => (
            <li className={styles.line} key={line.key}>
              <span className={styles.who}>{line.name}</span>
              <span className={styles.said}>{line.text}</span>
            </li>
          ))
        )}
      </ul>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.srOnly} htmlFor="party-chat-input">
          Say something to the party
        </label>
        <input
          autoComplete="off"
          className={styles.input}
          id="party-chat-input"
          maxLength={240}
          onBlur={() => setChatFocused(false)}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setChatFocused(true)}
          // The scene's window listener would otherwise steer the bee with the
          // letters being typed, and swallow them before the input sees them.
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
          placeholder="Say something"
          type="text"
          value={draft}
        />
        <button className={styles.send} type="submit">
          Send
        </button>
      </form>
    </section>
  );
}

/**
 * The microphone, off until asked for.
 *
 * Never opened on joining, never opened on a setting remembered from last time.
 * A game that can hear the room has to be a game you switched on, every session,
 * and the browser's own permission prompt is the second gate behind this one.
 *
 * Refusal is not an error. No microphone, or a "no" to the prompt, leaves the
 * button where it was with a line saying so, because plenty of people play with
 * no intention of talking to anybody.
 */
function VoiceToggle() {
  const [live, setLive] = useState(false);
  const [refused, setRefused] = useState(false);

  const toggle = async () => {
    if (live) {
      stopVoice();
      setLive(false);

      return;
    }

    const started = await startVoice();

    setLive(started);
    setRefused(!started);
  };

  // The mic must not outlive the party. Leaving the page with it open would
  // hold the recording indicator on with nobody left to hear.
  useEffect(() => () => stopVoice(), []);

  return (
    <div className={styles.voice}>
      <button
        aria-pressed={live}
        className={styles.mic}
        data-live={live}
        onClick={() => void toggle()}
        type="button"
      >
        {live ? "Microphone on" : "Talk to the park"}
      </button>
      <span className={styles.voiceNote}>
        {refused
          ? "No microphone, so nobody can hear you. The chat still works."
          : live
            ? "Bees near you can hear you. Fly away and you fade out."
            : "Nearby players only."}
      </span>
    </div>
  );
}
