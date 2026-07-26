/**
 * Active kit overview — home inventory coaching for precision, speed, sneak.
 *
 * Numbers mirror hunt/range engines where possible. Tips are advisory and
 * may mention apparel scores that are shown in shop even if not fully wired.
 */

import { combinedDispersionMoa } from "@/lib/ballistics/dispersion";
import {
  applyCustomCamoSneakPct,
  customsBeddingMoaDelta,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  applyCustomBarrelMoa,
  rifleSpecWithCustomBarrel,
  type InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  camoSlot,
  kitCamoStatSum,
  sneakPctToScore,
} from "@/lib/camo/spec";
import {
  computeKitTopSpeedKmh,
  formatTopSpeed,
} from "@/lib/kit/speed";
import { computePackLoad } from "@/lib/kit/pack";
import type { GameCarcass } from "@/lib/hunt/carcass";
import {
  isAmmoItem,
  isBipodItem,
  isCamoItem,
  isCarryItem,
  isFoodItem,
  isLrfItem,
  isRifleItem,
  isSkiItem,
  isStockItem,
  isThermalItem,
  type ShopItem,
} from "@/lib/shop/types";
import { clampScore10, formatScore10, type Score10 } from "@/lib/shop/score";
import { kitCanBoil } from "@/lib/food/spec";

export type KitPrecisionAmmoRow = {
  ammoId: string;
  label: string;
  envelopeMoa: number;
};

export type KitOverview = {
  precision: {
    /** Best (tightest) ammo envelope in kit, or null if incomplete. */
    bestMoa: number | null;
    /** Worst ammo envelope when several loads are packed. */
    worstMoa: number | null;
    rows: KitPrecisionAmmoRow[];
    missing: string[];
    tips: string[];
  };
  speed: {
    topSpeedKmh: number;
    topSpeedLabel: string;
    weightKg: number;
    carcassKg: number;
    fatigueLoadFactor: number;
    carryComfort: Score10;
    hasSkis: boolean;
    tips: string[];
  };
  sneak: {
    /** Additive clothing sneak % (custom camo included). */
    sneakPct: number;
    speedPct: number;
    focusPct: number;
    recoveryPct: number;
    /** 1–10 player score from sneak %. */
    sneakScore: Score10;
    hasSuit: boolean;
    hasJacketOrPants: boolean;
    apparelSlots: number;
    tips: string[];
  };
  overall: {
    tips: string[];
  };
  summary: string;
};

function formatMoa(moa: number): string {
  return `${moa.toFixed(2)} MOA`;
}

/**
 * Analyse equipped kit for the Home «Active kit overview» panel.
 * Affinity assumed 1.0 (typical) — live groups also roll player×ammo luck.
 */
export function computeKitOverview(input: {
  kitItems: ShopItem[];
  customsMods: CustomsMods;
  carcasses?: Pick<GameCarcass, "weightKg">[];
  customBarrels?: Record<string, InstalledCustomBarrel>;
}): KitOverview {
  const { kitItems, customsMods, carcasses = [], customBarrels = {} } = input;

  const rifle = kitItems.find(isRifleItem) ?? null;
  const stock = kitItems.find(isStockItem) ?? null;
  const bipod = kitItems.find(isBipodItem) ?? null;
  const ammoItems = kitItems.filter(isAmmoItem);
  const carryPieces = kitItems.filter(isCarryItem).map((i) => i.carry);
  const camoPieces = kitItems.filter(isCamoItem).map((i) => i.camo);
  const skiBoardsItem = kitItems.find(
    (i) => isSkiItem(i) && !i.ski.isBoots,
  );
  const skiBoards =
    skiBoardsItem && isSkiItem(skiBoardsItem) ? skiBoardsItem.ski : null;
  const hasLrf = kitItems.some(isLrfItem);
  const hasThermal = kitItems.some(isThermalItem);
  const foodPieces = kitItems.filter(isFoodItem).map((i) => i.food);
  const canBoil = kitCanBoil(foodPieces);
  const hasSuit = camoPieces.some((c) => camoSlot(c) === "suit");
  const hasJacketOrPants = camoPieces.some((c) => {
    const s = camoSlot(c);
    return s === "jacket" || s === "pants";
  });
  const apparelSlots = new Set(
    camoPieces.map((c) => camoSlot(c)),
  ).size;
  const hasSkiBoots = kitItems.some((i) => isSkiItem(i) && !!i.ski.isBoots);

  const pack = computePackLoad({
    kitItems,
    customsMods,
    carcasses,
    customBarrels,
  });
  const totalWeightGrams = pack.totalGrams;
  const carryComfort: Score10 =
    carryPieces.length > 0
      ? (Math.max(...carryPieces.map((p) => p.carryComfort)) as Score10)
      : (2 as Score10);

  const topSpeedKmh = computeKitTopSpeedKmh({
    totalWeightGrams,
    carryPieces,
    ski: skiBoards,
  });

  // —— Precision ——
  const precisionMissing: string[] = [];
  if (!rifle) precisionMissing.push("Rifle mangler i kit");
  if (ammoItems.length === 0) precisionMissing.push("Ammo mangler i kit");

  const beddingDelta = customsBeddingMoaDelta(customsMods);
  const rows: KitPrecisionAmmoRow[] = [];
  if (rifle && ammoItems.length > 0) {
    for (const ammo of ammoItems) {
      const envelopeMoa = combinedDispersionMoa({
        rifle: rifleSpecWithCustomBarrel(
          rifle.rifle,
          customBarrels[rifle.id],
        ),
        ammo: ammo.ammo,
        stock: stock?.stock ?? null,
        affinity: 1,
        customsMoaDelta: beddingDelta,
      });
      rows.push({
        ammoId: ammo.id,
        label: `${ammo.brand} ${ammo.name}`,
        envelopeMoa,
      });
    }
    rows.sort((a, b) => a.envelopeMoa - b.envelopeMoa);
  }

  const bestMoa = rows[0]?.envelopeMoa ?? null;
  const worstMoa =
    rows.length > 1 ? rows[rows.length - 1]!.envelopeMoa : bestMoa;

  const precisionTips: string[] = [];
  if (!rifle) {
    precisionTips.push("Ta med en rifle — uten den finnes ingen gruppe.");
  } else if (
    applyCustomBarrelMoa(
      rifle.rifle.averageBestAccuracyMoa,
      customBarrels[rifle.id],
    ) > 0.7
  ) {
    precisionTips.push(
      `Rifle-gulvet er ${applyCustomBarrelMoa(rifle.rifle.averageBestAccuracyMoa, customBarrels[rifle.id]).toFixed(2)} MOA — dyrere/presisere rifle eller custom pipe hos CB senker bunnen.`,
    );
  }
  if (ammoItems.length === 0) {
    precisionTips.push("Legg match-/jaktammo i kit for å se faktisk envelope.");
  } else if (bestMoa != null && bestMoa > 0.9) {
    precisionTips.push(
      "Beste loaden din er over 0.9 MOA — bytt til match/OTM eller CB home loads.",
    );
  }
  if (!stock) {
    precisionTips.push(
      "Chassis/stock kan shave MOA (negativ moaDelta) — se XXL stock-hylla.",
    );
  } else if (stock.stock.moaDelta > 0) {
    precisionTips.push(
      `Nåværende stock gir +${stock.stock.moaDelta.toFixed(2)} MOA (verre) — bytt til stivere stock.`,
    );
  }
  if (!customsMods.pillarBedding && !customsMods.bedding) {
    precisionTips.push(
      "CB Customs bedding / søylebedding strammer gruppen (lavere MOA).",
    );
  } else if (customsMods.bedding && !customsMods.pillarBedding) {
    precisionTips.push(
      "Oppgrader til søylebedding for litt strammere grupper.",
    );
  }
  if (!customsMods.homeLoadsSetup) {
    precisionTips.push(
      "Home loads-oppsett hos CB låser opp spesialammo med ekstra stram MOA.",
    );
  }
  if (!bipod) {
    precisionTips.push(
      "Bipod øker våpen-calm (mindre wobble) — ikke katalog-MOA, men treffer lettere på jakt.",
    );
  }
  if (!customsMods.bagrider) {
    precisionTips.push(
      "CB Bagrider (+15% calm, −0.05 MOA) hos CB Customs stabiliserer bakenden.",
    );
  }
  if (!customsMods.actionTrueing) {
    precisionTips.push("Action trueing hos CB shaver ~0.04 MOA.");
  }
  if (!customsMods.cheekRiser) {
    precisionTips.push("Cheek riser hos CB gir litt mer calm (kinnfeste).");
  }
  if (!customsMods.barrelCrown) {
    precisionTips.push("Barrel crown hos CB: −0.03 MOA.");
  }
  precisionTips.push(
    "På jakt: tom Mind-stamina sprer gruppen; hold fokus og rent avtrekk.",
  );

  // —— Speed ——
  const speedTips: string[] = [];
  if (totalWeightGrams > 12000) {
    speedTips.push(
      `Kit veier ${(totalWeightGrams / 1000).toFixed(1)} kg — dropp unødvendig gear, lettere rifle/scope, eller fluting/slanking hos CB.`,
    );
  } else if (totalWeightGrams > 8000) {
    speedTips.push(
      "Vekt begynner å merkes — fluting / stock slim hos CB, eller lettere sekk/optik.",
    );
  }
  if (!customsMods.fluting) {
    speedTips.push("Pipe-fluting (−500 g) hos CB øker top speed uten å røre MOA.");
  }
  if (!customsMods.stockSlim) {
    speedTips.push("Slanking av stokk hos CB kutter vekt uten å røre MOA.");
  }
  if (carryPieces.length === 0) {
    speedTips.push(
      "Ingen sekk/chestrig — carry comfort er lav; en god ryggsekk gjør tung last mindre trettende.",
    );
  } else if (carryComfort < 6) {
    speedTips.push(
      `Carry comfort ${formatScore10(carryComfort)} — bedre chestrig = mindre binovekt på Body; bedre sekk = lettere felt last.`,
    );
  }
  if (pack.carcassGrams > 0) {
    speedTips.push(
      `Vilt i sekken: ${(pack.carcassGrams / 1000).toFixed(1).replace(".", ",")} kg → +${Math.round((pack.fatigueLoadFactor - 1) * 100)}% fysisk fatigue per rute.`,
    );
  }
  if (!skiBoards) {
    speedTips.push(
      "Ingen ski/truger — top speed beregnes som støvler (lav). Ski med høy max speed / flyt hjelper.",
    );
  } else {
    if (skiBoards.maxSpeed < 6) {
      speedTips.push(
        "Ski max-speed er lav — se etter raskere ski i XXL.",
      );
    }
    if (skiBoards.flowPerKg < 5) {
      speedTips.push(
        "Lav flyt/kg på ski — bedre flyt demper vektstraff under tung sekk.",
      );
    }
    if (!hasSkiBoots) {
      speedTips.push(
        "Ski uten skistøvler — du kommer ikke videre før skistøvler er i kit.",
      );
    }
  }
  const clothingSpeedPct = kitCamoStatSum(camoPieces, "speedPct");
  if (clothingSpeedPct < 0) {
    speedTips.push(
      `Klær gir ${clothingSpeedPct}% speed — turen tar lengre tid (ghillie er treg).`,
    );
  } else if (clothingSpeedPct > 0) {
    speedTips.push(
      `Støvler/klær: +${clothingSpeedPct}% felt-speed (kortere gangtid mellom ruter).`,
    );
  } else if (camoPieces.length > 0) {
    speedTips.push(
      "Ingen clothing speed ennå — Crispi/Härkila/M77 støvler øker gangfart i felt.",
    );
  }
  if (speedTips.length === 0) {
    speedTips.push("Speed-kittet ser solid ut — finpuss vekt vs. hva du faktisk trenger på tur.");
  }

  // —— Sneak / clothing % ——
  const sneakPct = applyCustomCamoSneakPct(
    kitCamoStatSum(camoPieces, "sneakPct"),
    customsMods,
  );
  const focusPct = kitCamoStatSum(camoPieces, "focusPct");
  const recoveryPct = kitCamoStatSum(camoPieces, "recoveryPct");
  const sneakScore = clampScore10(sneakPctToScore(sneakPct)) as Score10;

  const sneakTips: string[] = [];
  sneakTips.push(
    "Sneak % reduserer bird nerve (10 % sneak → 30 % nerve blir 27 %). Tall summeres fra klær i kit.",
  );
  if (!hasSuit && !hasJacketOrPants) {
    sneakTips.push(
      "Ingen jakke/bukse eller ghillie — start med yttertøy for sneak.",
    );
  } else if (hasSuit) {
    sneakTips.push(
      "Ghillie er på — eksklusiv mot jakke og bukse. Sterk sneak, tregere gang.",
    );
  }
  if (sneakPct < 8) {
    sneakTips.push(
      "Lav sneak-sum — buff, lue, cap, hansker og bedre jakke/bukse hjelper nerve.",
    );
  }
  if (apparelSlots < 4) {
    sneakTips.push(
      "Flere slots (buff, lue, cap, hansker, sokker, ull, dunis) gir små % — fyll på.",
    );
  }
  if (!customsMods.customCamo) {
    sneakTips.push("Custom camo hos CB gir +15 % sneak.");
  }
  if (focusPct > 0) {
    sneakTips.push(
      `Focus +${focusPct}% — bedre caution/extreme-caution prespot, litt mindre Mind-drain.`,
    );
  }
  if (recoveryPct !== 0) {
    sneakTips.push(
      `Recovery ${recoveryPct > 0 ? "+" : ""}${recoveryPct}% Body i rest/pause (dunis/ull/sokker).`,
    );
  }
  sneakTips.push(
    "På jakt: extreme caution / caution + stå stille nær fugl. Bevegelse øker nerve.",
  );
  if (sneakTips.length <= 2 && sneakScore >= 7) {
    sneakTips.push("Sneak er allerede sterk — hold fokus på tempo og stillhet nær sittende fugl.");
  }

  // —— Overall coaching ——
  const overall: string[] = [];
  overall.push(
    "Finne fugl: LRF-kikkert ser lengre enn øyne; termisk avslører silhuetter. Chestrig med høy optics-access sparer tid til spotting.",
  );
  if (!hasLrf) {
    overall.push("Du mangler LRF/binos i kit — uten dem er du begrenset til øyne (~230 m).");
  }
  if (!hasThermal) {
    overall.push("Termisk er valgfritt men sterkt for å finne fugl raskt, spesielt i skumring.");
  }
  overall.push(
    "Gå langt/fort: lav kit-vekt + høy carry comfort + ski (med støvler) + clothing speed % + fornuftig pace.",
  );
  if (!canBoil) {
    overall.push(
      "Lite sliten: pack mat + PocketRocket/gass (kokeklar) så Real turmat faktisk gir Body/Mind tilbake. Rest/mat på kartet.",
    );
  } else {
    overall.push(
      "Lite sliten: du er kokeklar — bruk mat/rest på tur, og unngå «speedy» når Body er lav.",
    );
  }
  if (recoveryPct < 4 && camoPieces.length > 0) {
    overall.push(
      "Pause-recovery: ull, dunis og gode sokker øker Body-gevinst på rest/tyribål.",
    );
  }
  if (bestMoa != null) {
    overall.push(
      `Presisjon: beste load nå ${formatMoa(bestMoa)} (rifle+ammo+stock+bedding, affinity 1.0). Bipod + fokus hjelper holdet.`,
    );
  } else {
    overall.push(
      "Presisjon: fullfør rifle + ammo (+ gjerne stock/bedding) for en målbar MOA-envelope.",
    );
  }
  overall.push(
    `Ikke bli sett: sneak −${sneakPct}% nerve (${formatScore10(sneakScore)}/10). Klær + rolig pace + stå stille.`,
  );

  const summaryParts: string[] = [];
  if (bestMoa != null) summaryParts.push(formatMoa(bestMoa));
  else summaryParts.push("MOA —");
  summaryParts.push(formatTopSpeed(topSpeedKmh));
  summaryParts.push(`sneak −${sneakPct}%`);

  return {
    precision: {
      bestMoa,
      worstMoa,
      rows,
      missing: precisionMissing,
      tips: precisionTips,
    },
    speed: {
      topSpeedKmh,
      topSpeedLabel: formatTopSpeed(topSpeedKmh),
      weightKg: Math.round((totalWeightGrams / 1000) * 10) / 10,
      carcassKg: Math.round((pack.carcassGrams / 1000) * 100) / 100,
      fatigueLoadFactor: pack.fatigueLoadFactor,
      carryComfort,
      hasSkis: !!skiBoards,
      tips: speedTips,
    },
    sneak: {
      sneakPct,
      speedPct: clothingSpeedPct,
      focusPct,
      recoveryPct,
      sneakScore,
      hasSuit,
      hasJacketOrPants,
      apparelSlots,
      tips: sneakTips,
    },
    overall: { tips: overall },
    summary: summaryParts.join(" · "),
  };
}
