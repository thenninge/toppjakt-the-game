/**
 * Jegerprøve copy — Norwegian (source), English, Japanese.
 * Stable choice `value` ids stay language-agnostic; only labels/prompts localize.
 */

import {
  GAME_LANG_LABEL,
  GAME_LANGS,
  type GameLang,
} from "@/lib/i18n/lang";

export type JegerproveLang = GameLang;

export const JEGERPROVE_LANGS = GAME_LANGS;
export const JEGERPROVE_LANG_LABEL = GAME_LANG_LABEL;

export type JegerproveSpeciesChoice = "tiur" | "orre" | "ugle";

export type JegerproveUiCopy = {
  lockBanner: (min: number, total: number) => string;
  navHintLocked: string;
  navHintOpen: string;
  title: string;
  subtitle: (min: number, total: number) => string;
  langLabel: string;
  alreadyPassedTitle: string;
  alreadyPassedBody: string;
  welcomeLocked: string;
  welcomeOpen: string;
  introBody: (min: number, total: number) => string;
  start: string;
  practiceAgain: string;
  back: string;
  questionProgress: (label: string) => string;
  answersAria: string;
  next: string;
  submit: string;
  passedTitle: string;
  scoreLine: (correct: number, total: number) => string;
  continueTown: string;
  failedTitle: string;
  failedBody: (correct: number, total: number, need: number) => string;
  correctPrefix: string;
  yourAnswerPrefix: string;
  tryAgain: string;
  backTown: string;
  /** LocationNav back button while taking / reviewing the exam. */
  backNav: string;
  speciesPrompt: string;
  speciesImageAlt: string;
  species: Record<JegerproveSpeciesChoice, string>;
  certificateCourse: (min: number, total: number) => string;
  certificateAria: (name: string) => string;
  months: readonly string[];
};

export type KnowledgeLocaleEntry = {
  prompt: string;
  imageAlt?: string;
  imageNote?: string;
  labels: Record<string, string>;
};

export type JegerproveLocale = {
  ui: JegerproveUiCopy;
  knowledge: Record<string, KnowledgeLocaleEntry>;
};

const UI_NB: JegerproveUiCopy = {
  lockBanner: (min, total) =>
    `Obligatorisk — bestå jegerprøven (${min}/${total}) før byen åpnes.`,
  navHintLocked: "Bestått — byen er åpen.",
  navHintOpen: "Obligatorisk før jakt — som i virkeligheten.",
  title: "Jegerprøven",
  subtitle: (min, total) =>
    `Alle jegere i Norge må gjennom jegerprøven. Her er Cold Bore-varianten: art, patroner, kamuflasje og litt sunn skepsis. Bestått krever ${min} av ${total} riktige.`,
  langLabel: "Språk",
  alreadyPassedTitle: "Du har allerede bestått.",
  alreadyPassedBody:
    "Du kan ta prøven på nytt for moro skyld — resultatet endrer ikke status.",
  welcomeLocked: "Velkommen, fersk jeger — først prøven",
  welcomeOpen: "Artskunnskap, patroner og kamuflasje",
  introBody: (min, total) =>
    `${total} spørsmål med A/B/C tilfeldig blandet. Du må ha minst ${min} riktige for å få bevis og låse opp byen.`,
  start: "Start prøven",
  practiceAgain: "Øv på nytt",
  back: "Tilbake",
  questionProgress: (label) => `Spørsmål ${label}`,
  answersAria: "Svar",
  next: "Neste",
  submit: "Lever besvarelse",
  passedTitle: "Bestått — her er beviset ditt.",
  scoreLine: (c, t) => `${c} av ${t} riktige.`,
  continueTown: "Fortsett til byen",
  failedTitle: "Ikke bestått — mer øving i skogen.",
  failedBody: (c, t, need) =>
    `${c} av ${t} riktige (trenger ${need}). Se gjennom feilene og prøv igjen.`,
  correctPrefix: "Riktig",
  yourAnswerPrefix: "ditt svar",
  tryAgain: "Prøv igjen",
  backTown: "Tilbake til byen",
  backNav: "← Tilbake til byen",
  speciesPrompt: "Kryss av for riktig fugl:",
  speciesImageAlt: "Fugl — hvilken art?",
  species: { tiur: "Tiur", orre: "Orre", ugle: "Ugle" },
  certificateCourse: (min, total) =>
    `Cold Bore Jegerprøven (${min}/${total})`,
  certificateAria: (name) => `Jegerprøvebevis for ${name}`,
  months: [
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
  ],
};

const UI_EN: JegerproveUiCopy = {
  lockBanner: (min, total) =>
    `Required — pass the hunter exam (${min}/${total}) before the town opens.`,
  navHintLocked: "Passed — the town is open.",
  navHintOpen: "Required before hunting — as in real life.",
  title: "Hunter exam",
  subtitle: (min, total) =>
    `Every hunter in Norway takes a hunter exam. This is the Cold Bore version: species, cartridges, camo, and a little healthy skepticism. Pass requires ${min} of ${total} correct.`,
  langLabel: "Language",
  alreadyPassedTitle: "You have already passed.",
  alreadyPassedBody:
    "You can retake it for fun — the result will not change your status.",
  welcomeLocked: "Welcome, new hunter — exam first",
  welcomeOpen: "Species, cartridges, and camouflage",
  introBody: (min, total) =>
    `${total} questions with A/B/C randomly shuffled. You need at least ${min} correct for a certificate and to unlock the town.`,
  start: "Start exam",
  practiceAgain: "Practice again",
  back: "Back",
  questionProgress: (label) => `Question ${label}`,
  answersAria: "Answers",
  next: "Next",
  submit: "Submit answers",
  passedTitle: "Passed — here is your certificate.",
  scoreLine: (c, t) => `${c} of ${t} correct.`,
  continueTown: "Continue to town",
  failedTitle: "Not passed — more practice in the woods.",
  failedBody: (c, t, need) =>
    `${c} of ${t} correct (need ${need}). Review the mistakes and try again.`,
  correctPrefix: "Correct",
  yourAnswerPrefix: "your answer",
  tryAgain: "Try again",
  backTown: "Back to town",
  backNav: "← Back to town",
  speciesPrompt: "Select the correct bird:",
  speciesImageAlt: "Bird — which species?",
  species: {
    tiur: "Capercaillie (tiur)",
    orre: "Black grouse (orre)",
    ugle: "Owl",
  },
  certificateCourse: (min, total) =>
    `Cold Bore Hunter Exam (${min}/${total})`,
  certificateAria: (name) => `Hunter exam certificate for ${name}`,
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

const UI_JA: JegerproveUiCopy = {
  lockBanner: (min, total) =>
    `必須 — 町が開く前に狩猟試験に合格してください（${min}/${total}）。`,
  navHintLocked: "合格済み — 町が開いています。",
  navHintOpen: "狩猟の前に必須 — 現実と同じです。",
  title: "狩猟試験",
  subtitle: (min, total) =>
    `ノルウェーではすべてのハンターが試験を受けます。これは Cold Bore 版です：鳥種、弾薬、迷彩、そして少しの健全な疑い。合格には ${total} 問中 ${min} 問正解が必要です。`,
  langLabel: "言語",
  alreadyPassedTitle: "すでに合格しています。",
  alreadyPassedBody:
    "練習のために再受験できます — 結果はステータスを変えません。",
  welcomeLocked: "ようこそ、新人ハンター — まず試験から",
  welcomeOpen: "鳥種・弾薬・迷彩",
  introBody: (min, total) =>
    `${total} 問、A/B/C はランダム順。証明書と町の解除には最低 ${min} 問正解が必要です。`,
  start: "試験を開始",
  practiceAgain: "もう一度練習",
  back: "戻る",
  questionProgress: (label) => `問題 ${label}`,
  answersAria: "回答",
  next: "次へ",
  submit: "提出する",
  passedTitle: "合格 — 証明書です。",
  scoreLine: (c, t) => `${t} 問中 ${c} 問正解。`,
  continueTown: "町へ進む",
  failedTitle: "不合格 — 森でもっと練習を。",
  failedBody: (c, t, need) =>
    `${t} 問中 ${c} 問正解（必要 ${need}）。間違いを確認して再挑戦してください。`,
  correctPrefix: "正解",
  yourAnswerPrefix: "あなたの回答",
  tryAgain: "再挑戦",
  backTown: "町へ戻る",
  backNav: "← 町へ戻る",
  speciesPrompt: "正しい鳥を選んでください：",
  speciesImageAlt: "鳥 — どの種類？",
  species: {
    tiur: "オオライチョウ（tiur）",
    orre: "クロライチョウ（orre）",
    ugle: "フクロウ",
  },
  certificateCourse: (min, total) =>
    `Cold Bore 狩猟試験（${min}/${total}）`,
  certificateAria: (name) => `${name} の狩猟試験証明書`,
  months: [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
};

const KNOWLEDGE_NB: Record<string, KnowledgeLocaleEntry> = {
  "patron-kuletype": {
    prompt:
      "Har denne patronen en kule som er helmantel, blyspiss eller hulspiss?",
    imageAlt: "Patron med kule, hylse og tennhette",
    imageNote: "Patron: kule, hylse og tennhette (bunn).",
    labels: {
      blyspiss: "Blyspiss",
      helmantel: "Helmantel",
      hulspiss: "Hulspiss",
    },
  },
  "patron-blyspiss-toppjakt": {
    prompt: "Er blyspiss normalt brukt på toppjakt?",
    imageAlt: "Patron med blyspisskule",
    labels: {
      "nei-presisjon":
        "Nei — det gir vanligvis ikke den beste presisjonen og gir mye kjøttødeleggelse.",
      "ja-blas": "Ja! De blæster fuglen i tusen knas.",
      "nja-onkel":
        "Nja, både og. Man tager hva man haver. Mauseren til onkelen min lager hull i det meste med både blyspiss og helmantel og svartspiss panserbrytende. Sporlys har vi sluttet å bruke etter lensmannen lagde bråk.",
    },
  },
  "patron-toppjakt-kuler": {
    prompt: "Hva slags kuler bruker man gjerne på toppjakt?",
    imageAlt: "Patron — til sammenligning",
    labels: {
      "fmj-otm":
        "Både helmantel og hulspiss matchkuler er mye brukt. Hulspiss konkurransekuler kalles gjerne OTM — open tip match. Hulspissen er ikke for ekspansjon, men er et resultat av en produksjonsmetode som gir gode ballistiske egenskaper og god presisjon.",
      "pil-to-fiender":
        "Man bruker en kule som går igjennom som en pil — da kan den gå langt og ta ut to fiender eller fugl på ett skudd.",
      "sporlys-bygd":
        "Med sporlys ser du best hvor du bommer — eller om skuddet går helt inn til bygda som ligger bak der du skyter.",
    },
  },
  "camo-rod-detaljer": {
    prompt: "Kamuflasjen han har på seg fungerer bra på toppjakt:",
    imageAlt: "Jeger i kamuflasje med rød beret",
    labels: {
      "ja-unntatt-rod":
        "Ja, med unntak av de røde detaljene. Fugler har tetrakromatisk syn og ser farger bedre enn mennesker. Som toppjeger bør du også kamuflere tennene dine så de ikke lyser opp.",
      "fugler-ser-ikke-farger":
        "Ja — fugler ser ikke farger, så du kan gi blanke i hva du har på deg.",
      "separatist-russisk":
        "Separatist-russisk kamuflasje fungerer kun øst for Eden og nord for Rubicon-elven. Det der hadde skremt en tiur på tusen meter.",
    },
  },
  "gear-ringo-hagle": {
    prompt: "Børsa på bildet er en typisk … (fyll inn riktig):",
    imageAlt: "Lekehagle i plast",
    labels: {
      "ringo-plast":
        "Det ser ut som noe fra Ringo som lager lyd og som trolig er laget av en plast som blir sprø og falmer om den ligger ute i solen en hel sommer.",
      "over-under": "Over-under-hagle",
      "sniper-krigen":
        "Sniper-rifle fra krigen. Noe av det beste du kan oppdrive til toppjakt.",
    },
  },
  "gear-boltrifle-lovlig": {
    prompt: "Børsa på bildet er ulovlig til toppjakt:",
    imageAlt: "Boltrifle med kikkert og bipod",
    labels: {
      "tja-lovlig-sb":
        "Tja. Politiet bryr seg jo om hva den er registrert som, men det ser ut som en boltrifle med en lengde og utførelse som bør være lovlig brukt på jakt i Norge. Om den er i 12,7×99 mm så er saken en annen, men kikkerten er hvertfall en kul Schmidt & Bender med bra klikknøyaktighet og meget god zero retention.",
      "ja-alle-ser": "JA! Alle ser jo det.",
      "ammo-umulig":
        "Bildet viser ikke hva slags ammunisjon børsa er ladet med, og det er umulig å svare på.",
    },
  },
};

const KNOWLEDGE_EN: Record<string, KnowledgeLocaleEntry> = {
  "patron-kuletype": {
    prompt:
      "Is the bullet on this cartridge full metal jacket, soft point, or hollow point?",
    imageAlt: "Cartridge with bullet, case, and primer",
    imageNote: "Cartridge: bullet, case, and primer (base).",
    labels: {
      blyspiss: "Soft point",
      helmantel: "Full metal jacket",
      hulspiss: "Hollow point",
    },
  },
  "patron-blyspiss-toppjakt": {
    prompt: "Is soft point normally used for tree-stand / toppjakt bird hunting?",
    imageAlt: "Cartridge with soft-point bullet",
    labels: {
      "nei-presisjon":
        "No — it usually is not the most precise choice and ruins a lot of meat.",
      "ja-blas": "Yes! They blast the bird into a thousand pieces.",
      "nja-onkel":
        "Kinda both. You use what you have. My uncle’s Mauser punches holes in most things with soft point, FMJ, and black-tip AP. We stopped using tracers after the sheriff made a fuss.",
    },
  },
  "patron-toppjakt-kuler": {
    prompt: "What kind of bullets are commonly used for toppjakt?",
    imageAlt: "Cartridge — for reference",
    labels: {
      "fmj-otm":
        "Both FMJ and hollow-point match bullets are common. Hollow-point competition bullets are often called OTM — open tip match. The open tip is not for expansion; it comes from a manufacturing method that yields good ballistics and accuracy.",
      "pil-to-fiender":
        "You use a bullet that goes through like an arrow — then it can travel far and take out two enemies or birds with one shot.",
      "sporlys-bygd":
        "With tracers you see best where you miss — or whether the shot goes all the way into the village behind your target.",
    },
  },
  "camo-rod-detaljer": {
    prompt: "The camouflage he is wearing works well for toppjakt:",
    imageAlt: "Hunter in camouflage with a red beret",
    labels: {
      "ja-unntatt-rod":
        "Yes, except for the red details. Birds have tetrachromatic vision and see colors better than humans. As a toppjakt hunter you should also camouflage your teeth so they do not shine.",
      "fugler-ser-ikke-farger":
        "Yes — birds cannot see color, so wear whatever you like.",
      "separatist-russisk":
        "Separatist Russian camo only works east of Eden and north of the Rubicon. That kit would spook a capercaillie at a thousand meters.",
    },
  },
  "gear-ringo-hagle": {
    prompt: "The gun in the picture is a typical … (fill in correctly):",
    imageAlt: "Plastic toy shotgun",
    labels: {
      "ringo-plast":
        "It looks like something from Ringo that makes noise and is probably made of plastic that turns brittle and fades if left in the sun all summer.",
      "over-under": "Over-under shotgun",
      "sniper-krigen":
        "A wartime sniper rifle. Some of the best gear you can find for toppjakt.",
    },
  },
  "gear-boltrifle-lovlig": {
    prompt: "The gun in the picture is illegal for toppjakt:",
    imageAlt: "Bolt-action rifle with scope and bipod",
    labels: {
      "tja-lovlig-sb":
        "Well. The police care what it is registered as, but it looks like a bolt-action with length and build that should be legal for hunting in Norway. If it is 12.7×99 mm that is another matter — but the scope is at least a sweet Schmidt & Bender with good click accuracy and excellent zero retention.",
      "ja-alle-ser": "YES! Everyone can see that.",
      "ammo-umulig":
        "The picture does not show what ammunition is loaded, so it is impossible to answer.",
    },
  },
};

const KNOWLEDGE_JA: Record<string, KnowledgeLocaleEntry> = {
  "patron-kuletype": {
    prompt:
      "この薬莢の弾はフルメタルジャケット、ソフトポイント、ホローポイントのどれですか？",
    imageAlt: "弾・薬莢・雷管のある弾薬",
    imageNote: "弾薬：弾、薬莢、雷管（底部）。",
    labels: {
      blyspiss: "ソフトポイント",
      helmantel: "フルメタルジャケット",
      hulspiss: "ホローポイント",
    },
  },
  "patron-blyspiss-toppjakt": {
    prompt: "ソフトポイントは通常、木の上の鳥猟（toppjakt）に使われますか？",
    imageAlt: "ソフトポイント弾の弾薬",
    labels: {
      "nei-presisjon":
        "いいえ — 通常いちばん精密ではなく、肉を大きく損ないます。",
      "ja-blas": "はい！鳥を粉々に吹き飛ばします。",
      "nja-onkel":
        "まあどちらとも。あるものを使う。叔父のモーゼルはソフトポイントでもFMJでも黒先端徹甲弾でもだいたい穴を開ける。トレーサーは保安官が騒いだあと使わなくなった。",
    },
  },
  "patron-toppjakt-kuler": {
    prompt: "toppjakt ではどんな弾がよく使われますか？",
    imageAlt: "比較用の弾薬",
    labels: {
      "fmj-otm":
        "FMJ とホローポイントのマッチ弾の両方がよく使われます。競技用ホローポイントは OTM（open tip match）と呼ばれることが多いです。先端の穴は膨張のためではなく、弾道性と精度の良い製法の結果です。",
      "pil-to-fiender":
        "矢のように貫通する弾を使う — 遠くまで飛び、一発で敵や鳥を二体倒せる。",
      "sporlys-bygd":
        "トレーサーなら弾着がよく見える — あるいは射撃方向の向こうの村まで飛んでいるかも。",
    },
  },
  "camo-rod-detaljer": {
    prompt: "彼の迷彩は toppjakt でよく効く：",
    imageAlt: "赤いベレーの迷彩を着たハンター",
    labels: {
      "ja-unntatt-rod":
        "はい、赤い部分を除いて。鳥は四色型の視覚で、人より色がよく見える。toppjakt ハンターは歯もカモフラージュして光らないようにすべきだ。",
      "fugler-ser-ikke-farger":
        "はい — 鳥は色が見えないので、何を着ても構わない。",
      "separatist-russisk":
        "分離派ロシア迷彩はエデンの東・ルビコンの北でしか効かない。あれなら千メートル先のオオライチョウを驚かせる。",
    },
  },
  "gear-ringo-hagle": {
    prompt: "写真の銃は典型的な……（正しく埋めてください）：",
    imageAlt: "プラスチックの玩具散弾銃",
    labels: {
      "ringo-plast":
        "音がする Ringo 製のおもちゃに見える。夏中日差しにさらすと脆く色あせるプラスチック製だろう。",
      "over-under": "上下二連散弾銃",
      "sniper-krigen":
        "戦時のスナイパーライフル。toppjakt に手に入る最高の装備の一つ。",
    },
  },
  "gear-boltrifle-lovlig": {
    prompt: "写真の銃は toppjakt では違法である：",
    imageAlt: "スコープとバイポッド付きボルトアクション",
    labels: {
      "tja-lovlig-sb":
        "まあ。警察は登録内容を気にするが、ノルウェーの狩猟に使える長さ・仕様のボルトアクションに見える。12.7×99 mm なら別だが、スコープは少なくともクリック精度が良くゼロ保持に優れた Schmidt & Bender だ。",
      "ja-alle-ser": "はい！誰が見てもそうだ。",
      "ammo-umulig":
        "写真には装填弾薬が写っておらず、答えようがない。",
    },
  },
};

export const JEGERPROVE_LOCALES: Record<JegerproveLang, JegerproveLocale> = {
  nb: { ui: UI_NB, knowledge: KNOWLEDGE_NB },
  en: { ui: UI_EN, knowledge: KNOWLEDGE_EN },
  ja: { ui: UI_JA, knowledge: KNOWLEDGE_JA },
};

export function getJegerproveLocale(lang: JegerproveLang): JegerproveLocale {
  return JEGERPROVE_LOCALES[lang] ?? JEGERPROVE_LOCALES.nb;
}
