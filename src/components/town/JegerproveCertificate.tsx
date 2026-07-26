"use client";

import {
  JEGERPROVE_CERTIFICATE_SRC,
  JEGERPROVE_PASS_MIN_CORRECT,
  JEGERPROVE_QUESTION_COUNT,
  getJegerproveLocale,
  type JegerproveLang,
} from "@/lib/jegerprove/exam";

type JegerproveCertificateProps = {
  playerName: string;
  nickname: string;
  /** When the exam was passed (defaults to now). */
  passedAt?: Date;
  /** Exam language — date months / course line follow this. */
  lang?: JegerproveLang;
};

/**
 * Filled «Certificate of Completion» for a passed Jegerprøve.
 */
export function JegerproveCertificate({
  playerName,
  nickname,
  passedAt = new Date(),
  lang = "nb",
}: JegerproveCertificateProps) {
  const ui = getJegerproveLocale(lang).ui;
  const day = String(passedAt.getDate());
  const month = ui.months[passedAt.getMonth()] ?? "";
  const year = String(passedAt.getFullYear());
  const displayName = nickname
    ? `${playerName} «${nickname}»`
    : playerName;

  const dateLine =
    lang === "en"
      ? `${month} ${day}, ${year}`
      : lang === "ja"
        ? `${year}年${month}${day}日`
        : `${day}. ${month} ${year}`;

  return (
    <div
      className="jegerprove-certificate"
      role="img"
      aria-label={ui.certificateAria(displayName)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="jegerprove-certificate-bg"
        src={JEGERPROVE_CERTIFICATE_SRC}
        alt=""
        draggable={false}
      />
      <div className="jegerprove-certificate-fields" aria-hidden>
        <p className="jegerprove-certificate-name">{displayName}</p>
        <p className="jegerprove-certificate-course">
          {ui.certificateCourse(
            JEGERPROVE_PASS_MIN_CORRECT,
            JEGERPROVE_QUESTION_COUNT,
          )}
        </p>
        <p className="jegerprove-certificate-date">{dateLine}</p>
      </div>
    </div>
  );
}
