"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { JegerproveCertificate } from "@/components/town/JegerproveCertificate";
import {
  buildJegerproveSession,
  formatChoiceLabel,
  getJegerproveLocale,
  JEGERPROVE_LANG_LABEL,
  JEGERPROVE_LANGS,
  JEGERPROVE_PASS_MIN_CORRECT,
  JEGERPROVE_QUESTION_COUNT,
  scoreJegerprove,
  type JegerproveLang,
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
  /** Player preferred language (persisted). */
  lang: JegerproveLang;
  onLangChange: (lang: JegerproveLang) => void;
  onPassed: () => void;
  onLeave: () => void;
};

type Phase = "intro" | "exam" | "result" | "certificate";

export function JegerproveView({
  playerName,
  nickname,
  alreadyPassed,
  locked = false,
  lang,
  onLangChange,
  onPassed,
  onLeave,
}: JegerproveViewProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<JegerproveSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof scoreJegerprove> | null>(
    null,
  );
  const [passedAt, setPassedAt] = useState<Date>(() => new Date());

  // Chrome + questions follow the exam language once started; intro follows player lang.
  const displayLang: JegerproveLang = session?.lang ?? lang;
  const ui = getJegerproveLocale(displayLang).ui;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang =
        displayLang === "nb" ? "nb" : displayLang === "ja" ? "ja" : "en";
    }
  }, [displayLang]);

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
    const next = buildJegerproveSession(lang);
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

  function changeLang(code: JegerproveLang) {
    if (phase !== "intro") return;
    onLangChange(code);
  }

  return (
    <div className="jegerprove" lang={displayLang === "nb" ? "nb" : displayLang}>
      {locked && !alreadyPassed && phase !== "certificate" ? (
        <p className="jegerprove-lock-banner" role="status">
          {ui.lockBanner(JEGERPROVE_PASS_MIN_CORRECT, JEGERPROVE_QUESTION_COUNT)}
        </p>
      ) : (
        <LocationNav
          onBackToTown={onLeave}
          backLabel={ui.backNav}
          hint={locked ? ui.navHintLocked : ui.navHintOpen}
        />
      )}

      <header className="shop-header">
        <p className="intro-line intro-gift">{ui.title}</p>
        <p className="shop-row-note">
          {ui.subtitle(JEGERPROVE_PASS_MIN_CORRECT, JEGERPROVE_QUESTION_COUNT)}
        </p>
      </header>

      {phase === "intro" ? (
        <div className="jegerprove-panel">
          <div className="jegerprove-lang-block">
            <p className="range-setup-label" id="jegerprove-lang-label">
              {ui.langLabel}
            </p>
            <div
              className="range-segment jegerprove-lang-segment"
              role="group"
              aria-labelledby="jegerprove-lang-label"
            >
              {JEGERPROVE_LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={
                    lang === code
                      ? "range-seg-btn is-active"
                      : "range-seg-btn"
                  }
                  aria-pressed={lang === code}
                  onClick={() => changeLang(code)}
                >
                  <span className="range-seg-value">
                    {JEGERPROVE_LANG_LABEL[code]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {alreadyPassed && !locked ? (
            <>
              <p className="intro-line">{ui.alreadyPassedTitle}</p>
              <p className="shop-row-note">{ui.alreadyPassedBody}</p>
            </>
          ) : (
            <>
              <p className="intro-line">
                {locked ? ui.welcomeLocked : ui.welcomeOpen}
              </p>
              <p className="shop-row-note">
                {ui.introBody(
                  JEGERPROVE_PASS_MIN_CORRECT,
                  JEGERPROVE_QUESTION_COUNT,
                )}
              </p>
            </>
          )}
          <div className="jegerprove-actions">
            <button type="button" className="intro-button" onClick={startExam}>
              {alreadyPassed && !locked ? ui.practiceAgain : ui.start}
            </button>
            {!locked ? (
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={onLeave}
              >
                {ui.back}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "exam" && question ? (
        <div className="jegerprove-panel">
          <p className="jegerprove-progress" aria-live="polite">
            {ui.questionProgress(progressLabel)}
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
          <div
            className="jegerprove-choices"
            role="radiogroup"
            aria-label={ui.answersAria}
          >
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
                ? ui.submit
                : ui.next}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "certificate" ? (
        <div className="jegerprove-panel jegerprove-panel--certificate">
          <p className="intro-line">{ui.passedTitle}</p>
          {result ? (
            <p className="shop-row-note">
              {ui.scoreLine(result.correct, result.total)}
            </p>
          ) : null}
          <JegerproveCertificate
            playerName={playerName}
            nickname={nickname}
            passedAt={passedAt}
            lang={displayLang}
          />
          <div className="jegerprove-actions">
            <button
              type="button"
              className="intro-button"
              onClick={continueAfterCertificate}
            >
              {ui.continueTown}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "result" && result ? (
        <div className="jegerprove-panel">
          <p className="intro-line">{ui.failedTitle}</p>
          <p className="shop-row-note">
            {ui.failedBody(
              result.correct,
              result.total,
              session?.passMinCorrect ?? JEGERPROVE_PASS_MIN_CORRECT,
            )}
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
                    {ui.correctPrefix}:{" "}
                    {formatChoiceLabel(q, q.correctValue, displayLang)}
                    {yours
                      ? ` · ${ui.yourAnswerPrefix}: ${formatChoiceLabel(q, yours, displayLang)}`
                      : ""}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="jegerprove-actions">
            <button type="button" className="intro-button" onClick={startExam}>
              {ui.tryAgain}
            </button>
            {!locked ? (
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={onLeave}
              >
                {ui.backTown}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
