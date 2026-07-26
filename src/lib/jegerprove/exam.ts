/**
 * Jegerprøve — multiple-choice exam before first hunt.
 * Birds first, then ammo/weapon knowledge. More banks plug into the same shape.
 */

import {
  BIRD_SPRITES,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import type { BirdSpecies } from "@/lib/hunt/birds";

export type JegerproveSpeciesChoice = "tiur" | "orre" | "ugle";

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
  questions: JegerproveQuestion[];
  /** Absolute correct answers required to pass (e.g. 18 of 20). */
  passMinCorrect: number;
};

/** Official exam length / pass bar. */
export const JEGERPROVE_QUESTION_COUNT = 20;
export const JEGERPROVE_PASS_MIN_CORRECT = 18;

export const JEGERPROVE_CERTIFICATE_SRC = "/images/jegerprove/bevis.png";

type KnowledgeDraft = {
  id: string;
  prompt: string;
  imageSrc?: string;
  imageAlt?: string;
  imageNote?: string;
  correct: { value: string; label: string };
  wrong: Array<{ value: string; label: string }>;
};

const SPECIES_LABEL: Record<JegerproveSpeciesChoice, string> = {
  tiur: "Tiur",
  orre: "Orre",
  ugle: "Ugle",
};

const SPECIES_CHOICES: JegerproveSpeciesChoice[] = ["tiur", "orre", "ugle"];

const PATRON_IMAGE = "/images/jegerprove/patron-blyspiss.png";
const CAMO_IMAGE = "/images/jegerprove/camo-rod-beret.png";

/** Cartridge / toppjakt ammo bank (image + follow-ups). */
const PATRON_KNOWLEDGE_DRAFTS: KnowledgeDraft[] = [
  {
    id: "patron-kuletype",
    prompt:
      "Har denne patronen en kule som er helmantel, blyspiss eller hulspiss?",
    imageSrc: PATRON_IMAGE,
    imageAlt: "Patron med kule, hylse og tennhette",
    imageNote: "Patron: kule, hylse og tennhette (bunn).",
    correct: { value: "blyspiss", label: "Blyspiss" },
    wrong: [
      { value: "helmantel", label: "Helmantel" },
      { value: "hulspiss", label: "Hulspiss" },
    ],
  },
  {
    id: "patron-blyspiss-toppjakt",
    prompt: "Er blyspiss normalt brukt på toppjakt?",
    imageSrc: PATRON_IMAGE,
    imageAlt: "Patron med blyspisskule",
    correct: {
      value: "nei-presisjon",
      label:
        "Nei — det gir vanligvis ikke den beste presisjonen og gir mye kjøttødeleggelse.",
    },
    wrong: [
      {
        value: "ja-blas",
        label: "Ja! De blæster fuglen i tusen knas.",
      },
      {
        value: "nja-onkel",
        label:
          "Nja, både og. Man tager hva man haver. Mauseren til onkelen min lager hull i det meste med både blyspiss og helmantel og svartspiss panserbrytende. Sporlys har vi sluttet å bruke etter lensmannen lagde bråk.",
      },
    ],
  },
  {
    id: "patron-toppjakt-kuler",
    prompt: "Hva slags kuler bruker man gjerne på toppjakt?",
    imageSrc: PATRON_IMAGE,
    imageAlt: "Patron — til sammenligning",
    correct: {
      value: "fmj-otm",
      label:
        "Både helmantel og hulspiss matchkuler er mye brukt. Hulspiss konkurransekuler kalles gjerne OTM — open tip match. Hulspissen er ikke for ekspansjon, men er et resultat av en produksjonsmetode som gir gode ballistiske egenskaper og god presisjon.",
    },
    wrong: [
      {
        value: "pil-to-fiender",
        label:
          "Man bruker en kule som går igjennom som en pil — da kan den gå langt og ta ut to fiender eller fugl på ett skudd.",
      },
      {
        value: "sporlys-bygd",
        label:
          "Med sporlys ser du best hvor du bommer — eller om skuddet går helt inn til bygda som ligger bak der du skyter.",
      },
    ],
  },
];

/** Camo / bird vision bank. */
const CAMO_KNOWLEDGE_DRAFTS: KnowledgeDraft[] = [
  {
    id: "camo-rod-detaljer",
    prompt: "Kamuflasjen han har på seg fungerer bra på toppjakt:",
    imageSrc: CAMO_IMAGE,
    imageAlt: "Jeger i kamuflasje med rød beret",
    correct: {
      value: "ja-unntatt-rod",
      label:
        "Ja, med unntak av de røde detaljene. Fugler har tetrakromatisk syn og ser farger bedre enn mennesker. Som toppjeger bør du også kamuflere tennene dine så de ikke lyser opp.",
    },
    wrong: [
      {
        value: "fugler-ser-ikke-farger",
        label:
          "Ja — fugler ser ikke farger, så du kan gi blanke i hva du har på deg.",
      },
      {
        value: "separatist-russisk",
        label:
          "Separatist-russisk kamuflasje fungerer kun øst for Eden og nord for Rubicon-elven. Det der hadde skremt en tiur på tusen meter.",
      },
    ],
  },
];

const RINGO_IMAGE = "/images/jegerprove/ringo-lekehagle.png";
const BOLTRIFLE_IMAGE = "/images/jegerprove/boltrifle-sb.png";

/** Toy / gear recognition bank. */
const GEAR_KNOWLEDGE_DRAFTS: KnowledgeDraft[] = [
  {
    id: "gear-ringo-hagle",
    prompt: "Børsa på bildet er en typisk … (fyll inn riktig):",
    imageSrc: RINGO_IMAGE,
    imageAlt: "Lekehagle i plast",
    correct: {
      value: "ringo-plast",
      label:
        "Det ser ut som noe fra Ringo som lager lyd og som trolig er laget av en plast som blir sprø og falmer om den ligger ute i solen en hel sommer.",
    },
    wrong: [
      {
        value: "over-under",
        label: "Over-under-hagle",
      },
      {
        value: "sniper-krigen",
        label:
          "Sniper-rifle fra krigen. Noe av det beste du kan oppdrive til toppjakt.",
      },
    ],
  },
  {
    id: "gear-boltrifle-lovlig",
    prompt: "Børsa på bildet er ulovlig til toppjakt:",
    imageSrc: BOLTRIFLE_IMAGE,
    imageAlt: "Boltrifle med kikkert og bipod",
    correct: {
      value: "tja-lovlig-sb",
      label:
        "Tja. Politiet bryr seg jo om hva den er registrert som, men det ser ut som en boltrifle med en lengde og utførelse som bør være lovlig brukt på jakt i Norge. Om den er i 12,7×99 mm så er saken en annen, men kikkerten er hvertfall en kul Schmidt & Bender med bra klikknøyaktighet og meget god zero retention.",
    },
    wrong: [
      {
        value: "ja-alle-ser",
        label: "JA! Alle ser jo det.",
      },
      {
        value: "ammo-umulig",
        label:
          "Bildet viser ikke hva slags ammunisjon børsa er ladet med, og det er umulig å svare på.",
      },
    ],
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
  random: () => number,
): JegerproveChoice[] {
  const order = shuffleInPlace([...SPECIES_CHOICES], random);
  const keys: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  return order.map((value, i) => ({
    key: keys[i]!,
    label: SPECIES_LABEL[value],
    value,
  }));
}

function buildKnowledgeQuestion(
  draft: KnowledgeDraft,
  random: () => number,
): JegerproveKnowledgeQuestion {
  return {
    kind: "knowledge",
    id: draft.id,
    prompt: draft.prompt,
    imageSrc: draft.imageSrc,
    imageAlt: draft.imageAlt,
    imageNote: draft.imageNote,
    choices: choicesFromPool([draft.correct, ...draft.wrong], random),
    correctValue: draft.correct.value,
  };
}

/** All in-game topp sprites (not target-guide analysis PNGs). */
export function allExamBirdSpriteIds(): BirdSpriteId[] {
  return Object.keys(BIRD_SPRITES) as BirdSpriteId[];
}

export function buildSpeciesIdQuestion(
  spriteId: BirdSpriteId,
  random: () => number = Math.random,
): JegerproveSpeciesQuestion {
  const sprite = BIRD_SPRITES[spriteId];
  const correct = speciesToChoice(sprite.species);
  return {
    kind: "species-id",
    id: `bird-${spriteId}`,
    prompt: "Kryss av for riktig fugl:",
    imageSrc: sprite.toppSrc,
    imageAlt: `Fugl — hvilken art?`,
    choices: randomizedAbcChoices(correct, random),
    correctValue: correct,
  };
}

/**
 * Exactly 20 questions: all bird sprites + knowledge bank (trimmed/padded).
 * Pass requires {@link JEGERPROVE_PASS_MIN_CORRECT} correct.
 */
export function buildJegerproveSession(
  random: () => number = Math.random,
): JegerproveSession {
  const birdIds = shuffleInPlace(allExamBirdSpriteIds(), random);
  const birdQs = birdIds.map((id) => buildSpeciesIdQuestion(id, random));
  const knowledgeQs = shuffleInPlace(
    [
      ...PATRON_KNOWLEDGE_DRAFTS,
      ...CAMO_KNOWLEDGE_DRAFTS,
      ...GEAR_KNOWLEDGE_DRAFTS,
    ].map((d) => buildKnowledgeQuestion(d, random)),
    random,
  );
  let questions = [...birdQs, ...knowledgeQs];
  if (questions.length > JEGERPROVE_QUESTION_COUNT) {
    questions = questions.slice(0, JEGERPROVE_QUESTION_COUNT);
  } else if (questions.length < JEGERPROVE_QUESTION_COUNT) {
    // Should not happen with current banks — pad from birds if needed.
    const extra = shuffleInPlace(allExamBirdSpriteIds(), random);
    for (const id of extra) {
      if (questions.length >= JEGERPROVE_QUESTION_COUNT) break;
      const q = buildSpeciesIdQuestion(id, random);
      if (questions.some((x) => x.id === q.id)) continue;
      questions.push(q);
    }
  }
  return {
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
): string {
  const hit = question.choices.find((c) => c.value === value);
  if (hit) return hit.label;
  if (value === "tiur" || value === "orre" || value === "ugle") {
    return SPECIES_LABEL[value];
  }
  return value;
}

/** @deprecated Prefer formatChoiceLabel with the question. */
export function formatSpeciesChoiceNb(value: string): string {
  if (value === "tiur" || value === "orre" || value === "ugle") {
    return SPECIES_LABEL[value];
  }
  return value;
}
