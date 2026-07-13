"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { playSound } from "../audio/sound";
import { FUNGI_BY_ID } from "../data/fungi";
import { PLANTS_BY_ID } from "../data/plants";
import { triviaFor, type Question } from "../data/trivia";
import { useGameStore, type SpeciesRef } from "../state/game-store";
import styles from "./quiz.module.css";

/**
 * Three questions about the thing you are standing on.
 *
 * The explanation matters more than the score. Getting one wrong should still
 * leave you knowing the answer, so the "because" line is shown either way, and
 * the tone never scolds. Two out of three passes, because a quiz that demands
 * perfection is a quiz people stop taking.
 */
export function Quiz() {
  const ref = useGameStore((state) => state.ui.quiz);

  if (!ref) {
    return null;
  }

  // Keyed, so every attempt starts from a clean component rather than a pile of
  // reset effects.
  return <QuizRun key={ref.key} refSpecies={ref} />;
}

function QuizRun({ refSpecies }: { refSpecies: SpeciesRef }) {
  const endQuiz = useGameStore((state) => state.endQuiz);
  const recordQuiz = useGameStore((state) => state.recordQuiz);

  const questions = useMemo(() => triviaFor(refSpecies.id), [refSpecies.id]);

  const name =
    refSpecies.kind === "plant"
      ? PLANTS_BY_ID.get(refSpecies.id)?.commonName
      : FUNGI_BY_ID.get(refSpecies.id)?.commonName;

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const question: Question | undefined = questions[index];

  const answer = useCallback(
    (choice: number) => {
      if (picked !== null || !question) {
        return;
      }

      const right = choice === question.answer;

      setPicked(choice);

      if (right) {
        setCorrect((count) => count + 1);
        playSound("pollinateSuccess");
      } else {
        playSound("pollinateFail");
      }
    },
    [picked, question],
  );

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setDone(true);

      return;
    }

    setIndex((value) => value + 1);
    setPicked(null);
  }, [index, questions.length]);

  // Score it once, when the last question is answered.
  useEffect(() => {
    if (done) {
      recordQuiz(refSpecies, correct, questions.length);
    }
  }, [done, recordQuiz, refSpecies, correct, questions.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        endQuiz();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [endQuiz]);

  if (questions.length === 0) {
    return null;
  }

  const passed = correct >= 2;

  return (
    <div className={styles.scrim} role="presentation">
      <section
        aria-label={`Quiz: ${name}`}
        aria-modal="true"
        className={styles.card}
        role="dialog"
      >
        {done ? (
          <div className={styles.result} data-passed={passed}>
            <p className={styles.eyebrow}>{passed ? "Passed" : "Not quite"}</p>
            <h2 className={styles.name}>
              {correct} of {questions.length}
            </h2>
            <p className={styles.resultNote}>
              {passed
                ? "You know this one. It goes in the journal."
                : "Two out of three passes. Read the entry and come back to it; nothing is lost by trying again."}
            </p>
            <button className={styles.primary} onClick={endQuiz} type="button">
              Carry on
            </button>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>
              {name} · question {index + 1} of {questions.length}
            </p>
            <h2 className={styles.question}>{question?.ask}</h2>

            <ul className={styles.options}>
              {question?.options.map((option, choice) => {
                const state =
                  picked === null
                    ? "idle"
                    : choice === question.answer
                      ? "right"
                      : choice === picked
                        ? "wrong"
                        : "muted";

                return (
                  <li key={option}>
                    <button
                      className={styles.option}
                      data-state={state}
                      disabled={picked !== null}
                      onClick={() => answer(choice)}
                      type="button"
                    >
                      {option}
                    </button>
                  </li>
                );
              })}
            </ul>

            {picked !== null ? (
              <div className={styles.because}>
                <p>{question?.because}</p>
                <button
                  autoFocus
                  className={styles.primary}
                  onClick={next}
                  type="button"
                >
                  {index + 1 >= questions.length ? "See the score" : "Next"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
