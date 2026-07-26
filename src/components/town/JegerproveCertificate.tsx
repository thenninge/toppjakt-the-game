"use client";

import {
  JEGERPROVE_CERTIFICATE_SRC,
  JEGERPROVE_PASS_MIN_CORRECT,
  JEGERPROVE_QUESTION_COUNT,
} from "@/lib/jegerprove/exam";

type JegerproveCertificateProps = {
  playerName: string;
  nickname: string;
  /** When the exam was passed (defaults to now). */
  passedAt?: Date;
};

function norwegianMonth(d: Date): string {
  const months = [
    "januar",
    "februar",
    "mars",
    "april",
    "mai",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "desember",
  ];
  return months[d.getMonth()] ?? "";
}

/**
 * Filled «Certificate of Completion» for a passed Jegerprøve.
 */
export function JegerproveCertificate({
  playerName,
  nickname,
  passedAt = new Date(),
}: JegerproveCertificateProps) {
  const day = String(passedAt.getDate());
  const month = norwegianMonth(passedAt);
  const year = String(passedAt.getFullYear());
  const displayName = nickname
    ? `${playerName} «${nickname}»`
    : playerName;

  return (
    <div
      className="jegerprove-certificate"
      role="img"
      aria-label={`Jegerprøvebevis for ${displayName}`}
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
          Cold Bore Jegerprøven ({JEGERPROVE_PASS_MIN_CORRECT}/
          {JEGERPROVE_QUESTION_COUNT})
        </p>
        <p className="jegerprove-certificate-date">
          {day}. {month} {year}
        </p>
      </div>
    </div>
  );
}
