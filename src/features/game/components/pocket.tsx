"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { SignInButton } from "@/features/auth/components/sign-in-button";

import { DEFAULT_POLLINATOR, useGameStore } from "../state/game-store";
import { answerFor, factOfTheDay, vocabulary, type Answer } from "../world/answers";
import { pittsburghDate, pittsburghHour } from "../world/daylight";
import { pittsburghMonth } from "../world/season";
import { ArCamera } from "./ar-camera";
import { PollinatorPreview } from "./pollinator-preview";
import styles from "./pocket.module.css";

/**
 * The bee you carry around when you are not flying.
 *
 * Scout is a game you have to commit to: twenty minutes, a loading screen, and
 * everything it knows about the flowers you found is behind them. This is the
 * part that fits in a pocket. One true thing a day about something you actually
 * found, a box you can ask questions into, and a camera that will stand your
 * pollinator on the kitchen table.
 *
 * Nothing here decays. There is no hunger bar, nothing to feed, and no way to
 * do badly at it by having a job. Rule 3 says failure is the subject rather
 * than the punishment, and a companion that gets sad while you are at work is
 * a punishment for going to work.
 *
 * Signed out it is the camera and nothing else, with the default bee wearing
 * the badge. That is not a crippled teaser: the precedent is `/offline`, which
 * is the whole game and only shorter, and which asks nothing of you because it
 * saves nothing.
 */

type Said = { id: number; question: string; answer: Answer };

export function Pocket({
  authConfigured,
  signedIn,
}: {
  authConfigured: boolean;
  signedIn: boolean;
}) {
  const pollinator = useGameStore((state) => state.pollinator);
  const discoveredPlants = useGameStore((state) => state.discoveredPlants);
  const discoveredFungi = useGameStore((state) => state.discoveredFungi);
  const quizPassed = useGameStore((state) => state.quizPassed);
  const unlockedParks = useGameStore((state) => state.unlockedParks);
  const unlockedMapAreas = useGameStore((state) => state.unlockedMapAreas);

  const [asked, setAsked] = useState<Said[]>([]);
  const [question, setQuestion] = useState("");
  /**
   * The date is a client fact, and this is the API for client facts.
   *
   * The server's idea of today and the browser's can differ by a day either
   * side of midnight, so rendering the fact on the server would hand React two
   * different paragraphs to reconcile over a bug nobody could reproduce on
   * purpose. `getServerSnapshot` returns null, the card is absent from the HTML,
   * and it appears on hydration. Nothing subscribes because the date does not
   * change under us: `pittsburghDate` returns a plain string, so React's
   * identity check settles on the first read.
   */
  const today = useSyncExternalStore(
    () => () => {},
    () => pittsburghDate(),
    () => null,
  );
  const nextId = useRef(0);

  const found = useMemo(
    () => ({ plants: discoveredPlants, fungi: discoveredFungi }),
    [discoveredPlants, discoveredFungi],
  );

  const knows = useMemo(
    () => vocabulary({ found, unlockedParks }),
    [found, unlockedParks],
  );

  const fact = useMemo(
    () =>
      today
        ? factOfTheDay({ date: today, found, quizPassed, unlockedParks, unlockedMapAreas })
        : null,
    [today, found, quizPassed, unlockedParks, unlockedMapAreas],
  );

  if (!signedIn) {
    return (
      <div className={styles.pocket}>
        <ArCamera badge pollinator={DEFAULT_POLLINATOR} />
        <p className={styles.note}>
          {authConfigured
            ? "This is the bee the game comes with. Sign in and it will be yours, and it will answer questions about everything you have found."
            : "This build keeps everything on this device, so the bee in the frame is the one the game comes with."}
        </p>
        {authConfigured ? <SignInButton /> : null}
      </div>
    );
  }

  const ask = (event: React.FormEvent) => {
    event.preventDefault();

    const text = question.trim();

    if (!text) {
      return;
    }

    nextId.current += 1;

    setAsked((was) => [
      {
        id: nextId.current,
        question: text,
        answer: answerFor({
          question: text,
          found,
          quizPassed,
          unlockedParks,
          unlockedMapAreas,
          pollinator,
          month: pittsburghMonth(),
          hour: pittsburghHour(),
        }),
      },
      ...was,
    ]);
    setQuestion("");
  };

  return (
    <div className={styles.pocket}>
      <section className={styles.bee}>
        <div className={styles.preview}>
          <PollinatorPreview pollinator={pollinator} />
        </div>
        <p className={styles.name}>{pollinator.name}</p>
        <Link className={styles.change} href="/customize">
          Change how it looks
        </Link>
      </section>

      {fact ? (
        <section className={styles.fact}>
          <h2>Today</h2>
          <p data-fact={fact.id}>{fact.text}</p>
          {fact.wikipedia ? (
            <a href={fact.wikipedia} rel="noreferrer" target="_blank">
              Read more
            </a>
          ) : null}
        </section>
      ) : null}

      <section className={styles.asking}>
        <h2>Ask it something</h2>
        <form className={styles.form} onSubmit={ask}>
          <label className={styles.label} htmlFor="pocket-question">
            Your question
          </label>
          <input
            autoComplete="off"
            className={styles.input}
            id="pocket-question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="When does milkweed bloom?"
            value={question}
          />
          <Button type="submit">Ask</Button>
        </form>

        {/*
          The scope, said out loud.

          It refuses questions about anything you have not found, and refuses
          them in the same words as a question it could not parse, because
          naming a species you have not met gives away that it is out there.
          That trade only works if the boundary is visible, so here it is.
        */}
        <p className={styles.knows}>
          It knows {knows.plants} {knows.plants === 1 ? "flower" : "flowers"},{" "}
          {knows.fungi} {knows.fungi === 1 ? "fungus" : "fungi"} and {knows.parks}{" "}
          {knows.parks === 1 ? "park" : "parks"} so far.
        </p>

        <ol aria-label="What you asked" className={styles.log} role="log">
          {asked.map((said) => (
            <li key={said.id}>
              <p className={styles.question}>{said.question}</p>
              <p className={styles.answer} data-answer={said.answer.id}>
                {said.answer.text}
              </p>
              {said.answer.wikipedia ? (
                <a href={said.answer.wikipedia} rel="noreferrer" target="_blank">
                  Read more
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.camera}>
        <h2>Take it outside</h2>
        <p className={styles.lead}>
          Point the camera at something and your pollinator will stand in the
          frame. Drag to turn it, pinch to change its size. The photo stays on
          this device.
        </p>
        <ArCamera badge={false} pollinator={pollinator} />
      </section>
    </div>
  );
}
