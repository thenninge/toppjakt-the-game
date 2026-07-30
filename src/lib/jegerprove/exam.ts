/**
 * Jegerprøve — multiple-choice exam before first hunt.
 * Birds first, then ammo/weapon knowledge. Copy is localized (nb / en / ja).
 */

import {
  BIRD_SPRITES,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import type { BirdSpecies } from "@/lib/hunt/birds";
import {
  getJegerproveLocale,
  type JegerproveLang,
  type JegerproveSpeciesChoice,
} from "@/lib/jegerprove/locales";

export type { JegerproveLang, JegerproveSpeciesChoice };
export {
  JEGERPROVE_LANGS,
  JEGERPROVE_LANG_LABEL,
  getJegerproveLocale,
} from "@/lib/jegerprove/locales";

/**
 * When false, the exam is optional in town (not forced after intro) and does
 * not block hunting. Flip to true to require a pass before hunt ready.
 * Town access is never gated by the exam.
 */
export const JEGERPROVE_REQUIRED = false;

/** True when the player clears the optional hunt-ready exam gate. */
export function isJegerproveCleared(passed: boolean): boolean {
  return !JEGERPROVE_REQUIRED || passed;
}

export type JegerproveChoice = {
  key: "A" | "B" | "C";
  label: string;
  value: string;
};

/** Species ID from a topp sprite. */
export type JegerproveSpeciesQuestion = {
  kind: "species-id";
  id: string;
  prompt: string;
  imageSrc: string;
  imageAlt: string;
  choices: JegerproveChoice[];
  correctValue: JegerproveSpeciesChoice;
};

/**
 * General knowledge (ammo, weapon parts, hunting practice).
 * Optional image; A/B/C labels are shuffled at session build.
 */
export type JegerproveKnowledgeQuestion = {
  kind: "knowledge";
  id: string;
  prompt: string;
  imageSrc?: string;
  imageAlt?: string;
  /** Note under the image (fasit context, not a spoiler). */
  imageNote?: string;
  choices: JegerproveChoice[];
  correctValue: string;
};

/**
 * Future: cartridge / rifle with A–C callouts on parts.
 */
export type JegerprovePartsQuestion = {
  kind: "labeled-parts";
  id: string;
  prompt: string;
  imageSrc: string;
  imageAlt: string;
  choices: JegerproveChoice[];
  correctValue: string;
  markers: { key: "A" | "B" | "C"; xPct: number; yPct: number }[];
};

export type JegerproveQuestion =
  | JegerproveSpeciesQuestion
  | JegerproveKnowledgeQuestion
  | JegerprovePartsQuestion;

export type JegerproveSession = {
  lang: JegerproveLang;
  questions: JegerproveQuestion[];
  /** Absolute correct answers required to pass (e.g. 18 of 20). */
  passMinCorrect: number;
};

/** Official exam length / pass bar. */
export const JEGERPROVE_QUESTION_COUNT = 20;
export const JEGERPROVE_PASS_MIN_CORRECT = 18;

export const JEGERPROVE_CERTIFICATE_SRC = "/images/jegerprove/bevis.png";

type KnowledgeDraftBase = {
  id: string;
  imageSrc?: string;
  correctValue: string;
  wrongValues: string[];
};

const SPECIES_CHOICES: JegerproveSpeciesChoice[] = ["tiur", "orre", "ugle"];

const PATRON_IMAGE = "/images/jegerprove/patron-blyspiss.png";
const CAMO_IMAGE = "/images/jegerprove/camo-rod-beret.png";
const RINGO_IMAGE = "/images/jegerprove/ringo-lekehagle.png";
const BOLTRIFLE_IMAGE = "/images/jegerprove/boltrifle-sb.png";

/** Cartridge / toppjakt ammo bank (language-agnostic values). */
const PATRON_KNOWLEDGE_DRAFTS: KnowledgeDraftBase[] = [
  {
    id: "patron-kuletype",
    imageSrc: PATRON_IMAGE,
    correctValue: "blyspiss",
    wrongValues: ["helmantel", "hulspiss"],
  },
  {
    id: "patron-blyspiss-toppjakt",
    imageSrc: PATRON_IMAGE,
    correctValue: "nei-presisjon",
    wrongValues: ["ja-blas", "nja-onkel"],
  },
  {
    id: "patron-toppjakt-kuler",
    imageSrc: PATRON_IMAGE,
    correctValue: "fmj-otm",
    wrongValues: ["pil-to-fiender", "sporlys-bygd"],
  },
];

/** Camo / bird vision bank. */
const CAMO_KNOWLEDGE_DRAFTS: KnowledgeDraftBase[] = [
  {
    id: "camo-rod-detaljer",
    imageSrc: CAMO_IMAGE,
    correctValue: "ja-unntatt-rod",
    wrongValues: ["fugler-ser-ikke-farger", "separatist-russisk"],
  },
];

/** Toy / gear recognition bank. */
const GEAR_KNOWLEDGE_DRAFTS: KnowledgeDraftBase[] = [
  {
    id: "gear-ringo-hagle",
    imageSrc: RINGO_IMAGE,
    correctValue: "ringo-plast",
    wrongValues: ["over-under", "sniper-krigen"],
  },
  {
    id: "gear-boltrifle-lovlig",
    imageSrc: BOLTRIFLE_IMAGE,
    correctValue: "tja-lovlig-sb",
    wrongValues: ["ja-alle-ser", "ammo-umulig"],
  },
];

function speciesToChoice(species: BirdSpecies): JegerproveSpeciesChoice {
  if (species === "orrhane") return "orre";
  if (species === "ugle") return "ugle";
  return "tiur";
}

function shuffleInPlace<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

function choicesFromPool(
  options: Array<{ value: string; label: string }>,
  random: () => number,
): JegerproveChoice[] {
  const order = shuffleInPlace([...options], random);
  const keys: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  return order.map((opt, i) => ({
    key: keys[i]!,
    label: opt.label,
    value: opt.value,
  }));
}

function randomizedAbcChoices(
  correct: JegerproveSpeciesChoice,
  lang: JegerproveLang,
  random: () => number,
): JegerproveChoice[] {
  const labels = getJegerproveLocale(lang).ui.species;
  const order = shuffleInPlace([...SPECIES_CHOICES], random);
  const keys: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  return order.map((value, i) => ({
    key: keys[i]!,
    label: labels[value],
    value,
  }));
}

function buildKnowledgeQuestion(
  draft: KnowledgeDraftBase,
  lang: JegerproveLang,
  random: () => number,
): JegerproveKnowledgeQuestion {
  const loc = getJegerproveLocale(lang).knowledge[draft.id];
  if (!loc) {
    throw new Error(`Missing jegerprove locale for knowledge id ${draft.id}`);
  }
  const options = [draft.correctValue, ...draft.wrongValues].map((value) => ({
    value,
    label: loc.labels[value] ?? value,
  }));
  return {
    kind: "knowledge",
    id: draft.id,
    prompt: loc.prompt,
    imageSrc: draft.imageSrc,
    imageAlt: loc.imageAlt,
    imageNote: loc.imageNote,
    choices: choicesFromPool(options, random),
    correctValue: draft.correctValue,
  };
}

/** All in-game topp sprites (not target-guide analysis PNGs). */
export function allExamBirdSpriteIds(): BirdSpriteId[] {
  return Object.keys(BIRD_SPRITES) as BirdSpriteId[];
}

export function buildSpeciesIdQuestion(
  spriteId: BirdSpriteId,
  lang: JegerproveLang = "nb",
  random: () => number = Math.random,
): JegerproveSpeciesQuestion {
  const sprite = BIRD_SPRITES[spriteId];
  const correct = speciesToChoice(sprite.species);
  const ui = getJegerproveLocale(lang).ui;
  return {
    kind: "species-id",
    id: `bird-${spriteId}`,
    prompt: ui.speciesPrompt,
    imageSrc: sprite.toppSrc,
    imageAlt: ui.speciesImageAlt,
    choices: randomizedAbcChoices(correct, lang, random),
    correctValue: correct,
  };
}

/**
 * Exactly 20 questions: all bird sprites + knowledge bank (trimmed/padded).
 * Pass requires {@link JEGERPROVE_PASS_MIN_CORRECT} correct.
 */
export function buildJegerproveSession(
  lang: JegerproveLang = "nb",
  random: () => number = Math.random,
): JegerproveSession {
  const birdIds = shuffleInPlace(allExamBirdSpriteIds(), random);
  const birdQs = birdIds.map((id) => buildSpeciesIdQuestion(id, lang, random));
  const knowledgeQs = shuffleInPlace(
    [
      ...PATRON_KNOWLEDGE_DRAFTS,
      ...CAMO_KNOWLEDGE_DRAFTS,
      ...GEAR_KNOWLEDGE_DRAFTS,
    ].map((d) => buildKnowledgeQuestion(d, lang, random)),
    random,
  );
  let questions = [...birdQs, ...knowledgeQs];
  if (questions.length > JEGERPROVE_QUESTION_COUNT) {
    questions = questions.slice(0, JEGERPROVE_QUESTION_COUNT);
  } else if (questions.length < JEGERPROVE_QUESTION_COUNT) {
    const extra = shuffleInPlace(allExamBirdSpriteIds(), random);
    for (const id of extra) {
      if (questions.length >= JEGERPROVE_QUESTION_COUNT) break;
      const q = buildSpeciesIdQuestion(id, lang, random);
      if (questions.some((x) => x.id === q.id)) continue;
      questions.push(q);
    }
  }
  return {
    lang,
    questions,
    passMinCorrect: JEGERPROVE_PASS_MIN_CORRECT,
  };
}

export function scoreJegerprove(
  session: JegerproveSession,
  answers: Record<string, string>,
): {
  correct: number;
  total: number;
  ratio: number;
  passed: boolean;
  wrongIds: string[];
} {
  const wrongIds: string[] = [];
  let correct = 0;
  for (const q of session.questions) {
    if (answers[q.id] === q.correctValue) correct += 1;
    else wrongIds.push(q.id);
  }
  const total = session.questions.length;
  const ratio = total > 0 ? correct / total : 0;
  return {
    correct,
    total,
    ratio,
    passed: correct >= session.passMinCorrect,
    wrongIds,
  };
}

export function formatChoiceLabel(
  question: JegerproveQuestion,
  value: string,
  lang: JegerproveLang = "nb",
): string {
  const hit = question.choices.find((c) => c.value === value);
  if (hit) return hit.label;
  if (value === "tiur" || value === "orre" || value === "ugle") {
    return getJegerproveLocale(lang).ui.species[value];
  }
  return value;
}

/** @deprecated Prefer formatChoiceLabel with the question. */
export function formatSpeciesChoiceNb(value: string): string {
  if (value === "tiur" || value === "orre" || value === "ugle") {
    return getJegerproveLocale("nb").ui.species[value];
  }
  return value;
}
