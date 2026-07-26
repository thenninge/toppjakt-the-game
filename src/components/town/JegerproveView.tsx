"use client";

import { useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { JegerproveCertificate } from "@/components/town/JegerproveCertificate";
import {
  buildJegerproveSession,
  formatChoiceLabel,
  JEGERPROVE_PASS_MIN_CORRECT,
  JEGERPROVE_QUESTION_COUNT,
  scoreJegerprove,
  type JegerproveQuestion,
  type JegerproveSession,
} from "@/lib/jegerprove/exam";

type JegerproveViewProps = {
  playerName: string;
  nickname: string;
  alreadyPassed: boolean;
  /**
   * Forced gate — cannot leave for town until passed
   * (new hunters / jegerprovePassed === false).
   */
  locked?: boolean;
  onPassed: () => void;
  onLeave: () => void;
};

type Phase = "intro" | "exam" | "result" | "certificate";

export function JegerproveView({
  playerName,
  nickname,
  alreadyPassed,
  locked = false,
  onPassed,
  onLeave,
}: JegerproveViewProps) {
  const [phase, setPhase] = useState<Phase>(
    locked && !alreadyPassed ? "intro" : "intro",
  );
  const [session, setSession] = useState<JegerproveSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof scoreJegerprove> | null>(
    null,
  );
  const [passedAt, setPassedAt] = useState<Date>(() => new Date());

  const question: JegerproveQuestion | null = session?.questions[index] ?? null;
  const progressLabel = useMemo(() => {
    if (!session) return "";
    return `${index + 1} / ${session.questions.length}`;
  }, [session, index]);

  const imageSrc =
    question && "imageSrc" in question ? question.imageSrc : undefined;
  const imageAlt =
    question && "imageAlt" in question ? question.imageAlt : undefined;
  const imageNote =
    question?.kind === "knowledge" ? question.imageNote : undefined;

  function startExam() {
    const next = buildJegerproveSession();
    setSession(next);
    setIndex(0);
    setAnswers({});
    setSelected(null);
    setResult(null);
    setPhase("exam");
  }

  function confirmAnswer() {
    if (!session || !question || !selected) return;
    const nextAnswers = { ...answers, [question.id]: selected };
    setAnswers(nextAnswers);
    setSelected(null);
    if (index + 1 >= session.questions.length) {
      const scored = scoreJegerprove(session, nextAnswers);
      setResult(scored);
      if (scored.passed) {
        const when = new Date();
        setPassedAt(when);
        onPassed();
        setPhase("certificate");
      } else {
        setPhase("result");
      }
      return;
    }
    setIndex((i) => i + 1);
  }

  function continueAfterCertificate() {
    onLeave();
  }

  return (
    <div className="jegerprove">
      {locked && !alreadyPassed && phase !== "certificate" ? (
        <p className="jegerprove-lock-banner" role="status">
          Obligatorisk — bestå jegerprøven ({JEGERPROVE_PASS_MIN_CORRECT}/
          {JEGERPROVE_QUESTION_COUNT}) før byen åpnes.
        </p>
      ) : (
        <LocationNav
          onBackToTown={onLeave}
          hint={
            locked
              ? "Bestått — byen er åpen."
              : "Obligatorisk før jakt — som i virkeligheten."
          }
        />
      )}

      <header className="shop-header">
        <p className="intro-line intro-gift">Jegerprøven</p>
        <p className="shop-row-note">
          Alle jegere i Norge må gjennom jegerprøven. Her er Cold Bore-varianten:
          art, patroner, kamuflasje og litt sunn skepsis. Bestått krever{" "}
          {JEGERPROVE_PASS_MIN_CORRECT} av {JEGERPROVE_QUESTION_COUNT} riktige.
        </p>
      </header>

      {phase === "intro" ? (
        <div className="jegerprove-panel">
          {alreadyPassed && !locked ? (
            <>
              <p className="intro-line">Du har allerede bestått.</p>
              <p className="shop-row-note">
                Du kan ta prøven på nytt for moro skyld — resultatet endrer ikke
                status.
              </p>
            </>
          ) : (
            <>
              <p className="intro-line">
                {locked
                  ? "Velkommen, fersk jeger — først prøven"
                  : "Artskunnskap, patroner og kamuflasje"}
              </p>
              <p className="shop-row-note">
                {JEGERPROVE_QUESTION_COUNT} spørsmål med A/B/C tilfeldig blandet.
                Du må ha minst {JEGERPROVE_PASS_MIN_CORRECT} riktige for å få
                bevis og låse opp byen.
              </p>
            </>
          )}
          <div className="jegerprove-actions">
            <button type="button" className="intro-button" onClick={startExam}>
              {alreadyPassed && !locked ? "Øv på nytt" : "Start prøven"}
            </button>
            {!locked ? (
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={onLeave}
              >
                Tilbake
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "exam" && question ? (
        <div className="jegerprove-panel">
          <p className="jegerprove-progress" aria-live="polite">
            Spørsmål {progressLabel}
          </p>
          <p className="intro-line">{question.prompt}</p>
          {imageSrc ? (
            <div className="jegerprove-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="jegerprove-image"
                src={imageSrc}
                alt={imageAlt ?? ""}
                draggable={false}
              />
              {imageNote ? (
                <p className="jegerprove-image-note">{imageNote}</p>
              ) : null}
            </div>
          ) : null}
          <div className="jegerprove-choices" role="radiogroup" aria-label="Svar">
            {question.choices.map((c) => {
              const active = selected === c.value;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    active
                      ? "intro-button jegerprove-choice is-active"
                      : "intro-button sheriff-secondary jegerprove-choice"
                  }
                  onClick={() => setSelected(c.value)}
                >
                  <span className="jegerprove-choice-key">{c.key}</span>
                  <span className="jegerprove-choice-label">{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="jegerprove-actions">
            <button
              type="button"
              className="intro-button"
              disabled={!selected}
              onClick={confirmAnswer}
            >
              {index + 1 >= (session?.questions.length ?? 0)
                ? "Lever besvarelse"
                : "Neste"}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "certificate" ? (
        <div className="jegerprove-panel jegerprove-panel--certificate">
          <p className="intro-line">Bestått — her er beviset ditt.</p>
          {result ? (
            <p className="shop-row-note">
              {result.correct} av {result.total} riktige.
            </p>
          ) : null}
          <JegerproveCertificate
            playerName={playerName}
            nickname={nickname}
            passedAt={passedAt}
          />
          <div className="jegerprove-actions">
            <button
              type="button"
              className="intro-button"
              onClick={continueAfterCertificate}
            >
              Fortsett til byen
            </button>
          </div>
        </div>
      ) : null}

      {phase === "result" && result ? (
        <div className="jegerprove-panel">
          <p className="intro-line">Ikke bestått — mer øving i skogen.</p>
          <p className="shop-row-note">
            {result.correct} av {result.total} riktige (trenger{" "}
            {session?.passMinCorrect ?? JEGERPROVE_PASS_MIN_CORRECT}). Se
            gjennom feilene og prøv igjen.
          </p>
          {result.wrongIds.length > 0 && session ? (
            <ul className="jegerprove-wrong-list">
              {result.wrongIds.map((id) => {
                const q = session.questions.find((x) => x.id === id);
                if (!q) return null;
                const yours = answers[id];
                return (
                  <li key={id}>
                    <span className="jegerprove-wrong-prompt">{q.prompt}</span>
                    <br />
                    Riktig: {formatChoiceLabel(q, q.correctValue)}
                    {yours
                      ? ` · ditt svar: ${formatChoiceLabel(q, yours)}`
                      : ""}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="jegerprove-actions">
            <button type="button" className="intro-button" onClick={startExam}>
              Prøv igjen
            </button>
            {!locked ? (
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={onLeave}
              >
                Tilbake til byen
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
