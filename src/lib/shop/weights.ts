import type { ShopCategory } from "./types";

/**
 * Packed / ready-to-carry weight in grams (realistic street specs).
 * Ammo weights are for the sold unit (eske), not per round.
 */
export const WEIGHT_G_BY_ID: Record<string, number> = {
  // LRF
  "lrf-sig-kilo3000-bdx-10x42": 878,
  "lrf-leica-geovid-r-10x42": 945,
  "lrf-leica-geovid-r-8x42": 960,
  "lrf-leica-geovid-pro-10x42": 970,
  "lrf-vortex-fury-hd-5000-10x42": 910,
  "lrf-vortex-ranger-1800": 220,
  "lrf-zeiss-victory-rf-10x42": 950,
  "lrf-zeiss-victory-rf-8x42": 935,
  "lrf-kahles-helia-rf-10x42": 940,
  "lrf-leupold-rx-2800-tbr-w": 220,
  "lrf-leupold-bx-4-rangeguide-10x42": 900,
  "lrf-burris-signature-lrf-10x42": 880,
  "lrf-swarovski-el-range-10x42": 930,
  "lrf-biltema-monocular": 185,
  "lrf-jula-pocket": 160,
  "lrf-clas-ohlson-golf": 175,
  "lrf-magasinet-budget-binos": 650,

  // Thermal
  "thermal-hikmicro-lynx-le10": 420,
  "thermal-hikmicro-condor-cq35-lrf": 890,

  // Scopes
  "scope-nf-nx8-4-32-moa": 810,
  "scope-nf-nx8-4-32-mrad": 810,
  "scope-nf-atacr-5-25-f1": 1080,
  "scope-nf-atacr-7-35-f1": 1110,
  "scope-zco-527-mct": 1045,
  "scope-element-titan-5-20-mrad": 980,
  "scope-element-theos-5-25-mrad": 1030,
  "scope-leupold-mk5hd-5-25-mrad": 850,
  "scope-kahles-k318i-3-18-mrad": 940,
  "scope-kahles-k525i-5-25-mrad": 990,
  "scope-kahles-k624i-6-24-mrad": 950,
  "scope-kahles-k16i-1-6": 480,
  "scope-zeiss-lrp-s5-6-36-mrad": 1100,
  "scope-sb-pmii-5-25-mrad": 1120,
  "scope-sb-pmii-3-20-mrad": 980,
  "scope-sb-pmii-high-power-5-45": 1180,
  "scope-burris-fullfield-3-9x40": 370,
  "scope-burris-eliminator-6": 850,
  "scope-vortex-razor-gen3-6-36-mrad": 1210,
  "scope-vortex-viper-pst-gen2-5-25-mrad": 890,
  "scope-biltema-3-9x40": 420,
  "scope-jula-4-12x40": 480,
  "scope-clas-ohlson-4x32": 310,

  // Suppressors
  "sup-svemko-hunter-1": 380,
  "sup-svemko-magnum-1": 420,
  "sup-svemko-pure-m": 350,
  "sup-svemko-genesis-30": 395,
  "sup-hausken-jd184-xtrm": 340,
  "sup-hausken-jd224-xtrm": 390,
  "sup-hausken-jd151-xtrm": 310,
  "sup-hausken-jd252-xtrm": 450,
  "sup-atec-h2": 360,
  "sup-atec-optima-50": 400,
  "sup-atec-nordic": 320,
  "sup-atec-wave-22": 95,
  "sup-freyr-devik-3d-231": 280,
  "sup-freyr-devik-3d-131": 250,
  "sup-tronrud-gen1": 320,
  "sup-vanguard-titan": 300,
  "sup-aimsport-triton": 380,
  "sup-stalon-victor": 350,
  "sup-biltema-22-can": 110,
  "sup-jula-economy-30": 480,

  // Stocks
  "stock-grs-berserk-t3x": 1350,
  "stock-grs-hunter-light-t3x": 1100,
  "stock-grs-bifrost-sako85": 1400,
  "stock-grs-sportsmann-rem700": 1300,
  "stock-mdt-lss-xl-gen2-t3x": 1600,
  "stock-mdt-acc-elite-rem700": 2100,
  "stock-mdt-hnt26-rem700": 740,
  "stock-mdt-ors-t3x": 1450,
  "stock-mcmillan-a5-rem700": 1250,
  "stock-mcmillan-game-hunter-sako": 1200,
  "stock-biltema-synthetic-rem700": 900,
  "stock-jula-plastic-tikka": 850,

  // Rifles (typical empty rifle, no optic/can)
  "rifle-cz452": 2700,
  "rifle-tikka-t3x-lite": 2900,
  "rifle-tikka-t3x-super-varminter": 3600,
  "rifle-tikka-t3x-tac-a1": 4700,
  "rifle-sako-s20": 3200,
  "rifle-sako-85-finnlight": 2700,
  "rifle-sako-85-carbonwolf": 3300,
  "rifle-carbonwolf-berillium": 2950,
  "rifle-sako-90-peak": 2800,
  "rifle-sauer-200str": 5200,
  "rifle-sauer-404": 3400,
  "rifle-rem-700-sps": 3400,
  "rifle-rem-700-sa-65cm": 3500,
  "rifle-rem-700-sa-hansen-custom": 3400,
  "rifle-rem-700-aac-sd": 3800,
  "rifle-bergara-b14-hmr": 4100,
  "rifle-bergara-b14-ridge": 3300,
  "rifle-howa-1500-hs": 3600,
  "rifle-ruger-american-predator": 2900,
  "rifle-ruger-american-ranch-300blk": 2700,
  "rifle-browning-xbolt-pro": 2700,
  "rifle-blaser-r8": 3100,
  "rifle-ai-at-x": 6500,
  "rifle-cz455": 2500,
  "rifle-cz457": 3100,
  "rifle-magasinet-budget-308": 3200,
  "rifle-jula-youth-22": 2400,

  // Ammo boxes (sold unit)
  "ammo-norma-65x55-fmj": 1100,
  "ammo-lapua-65x55-scenar": 480,
  "ammo-norma-65x55-black-diamond": 490,
  "ammo-sako-65x55-gamehead": 470,
  "ammo-sako-65x55-speedhead": 460,
  "ammo-norma-65x55-orca": 500,
  "ammo-norma-65cm-fmj": 1100,
  "ammo-lapua-65cm-scenar-l": 470,
  "ammo-hornady-65cm-eldm": 460,
  "ammo-federal-65cm-goldmedal": 470,
  "ammo-norma-65cm-black-diamond": 480,
  "ammo-norma-65cm-bondstrike": 470,
  "ammo-norma-223-fmj": 900,
  "ammo-lapua-223-scenar": 380,
  "ammo-sako-223-gamehead": 360,
  "ammo-cci-22lr-standard": 200,
  "ammo-eley-22lr-match": 220,
  "ammo-lapua-22lr-center-x": 210,
  "ammo-norma-22lr-hunter": 190,
  "ammo-cci-22lr-subsonic": 200,
  "ammo-hornady-300blk-subsonic": 480,
  "ammo-hornady-17hmr-varmint": 180,
  "ammo-cci-17hmr-tnt": 175,
  "ammo-norma-308-fmj": 1200,
  "ammo-lapua-308-scenar": 520,
  "ammo-federal-308-goldmedal": 510,
  "ammo-sako-308-hammerhead": 530,
  "ammo-norma-308-orca": 540,
  "ammo-norma-3006-alaska": 550,
  "ammo-sako-3006-gamehead": 540,
  "ammo-remington-3006-corelokt": 520,
  "ammo-biltema-22lr-bulk": 350,
  "ammo-jula-308-fmj": 1000,
  "ammo-cb-homeload-65x55": 22,
  "ammo-cb-homeload-65cm": 22,
  "ammo-cb-homeload-308": 24,
  "ammo-cb-homeload-3006": 25,
  "ammo-cb-homeload-223": 14,
  "ammo-cb-homeload-22lr": 4,

  "misc-vorn-deer-42": 3100,
  "misc-eberlestock-gunrunner-h2": 1600,
  "misc-eberlestock-x1-euro": 2800,
  "pack-fjellsekk-budget": 900,
  "pack-jula-daypack": 550,
  "misc-kestrel-5700-elite": 150,
  "misc-kestrel-5500": 130,
  "misc-vortex-ace-ballistic": 162,
  "misc-skywatch-bl": 85,
  "misc-weatherflow-weathermeter": 70,
  "misc-clas-ohlson-anemometer": 95,
  "misc-garmin-foretrex-801": 88,
  "misc-suunto-a-10": 48,
  "misc-sittpute-biltema": 120,
  "misc-thermos-jula": 380,
  "misc-nightcore-nu21": 68,
  "misc-nightcore-hc60": 128,
  "misc-triggercam": 460,
  "misc-hunt-camcorder": 890,
  "misc-garmin-xero-c1-pro": 108,
  "misc-fx-true-ballistic": 820,

  // Chestrigs
  "chest-cds-binocular-harness": 380,
  "chest-badlands-bino-harness": 420,
  "chest-marsupial-bino": 400,
  "chest-kuiu-pro": 350,
  "chest-sitka-mountain": 360,
  "chest-biltema-strap": 120,
  "chest-jula-neck": 80,

  // Camouflage (suit / oversuit as sold)
  "camo-kuiu-valo": 1200,
  "camo-kuiu-vias": 1200,
  "camo-kuiu-verde": 1200,
  "camo-sitka-subalpine": 1300,
  "camo-sitka-open-country": 1300,
  "camo-finnish-m05-snow": 1400,
  "camo-finnish-m05-winter": 1450,
  "camo-norwegian-snow": 1300,
  "camo-norwegian-vintage-snow": 600,
  "camo-harkila-pro-hunter": 1500,
  "camo-pinewood-lappland": 1100,
  "camo-m05-woodland": 1250,
  "camo-nordic-autumn-brush": 1000,
  "camo-biltema-leaf": 800,
  "camo-jula-forest": 750,

  // Camo apparel
  "camo-buff-mesh-multicam": 35,
  "camo-buff-mesh-snow-temu": 28,
  "camo-buff-mesh-multicam-temu": 28,
  "camo-buff-snow-realtree": 40,
  "camo-buff-autumn-realtree": 40,
  "camo-beanie-snow-swedteam": 85,
  "camo-beanie-forest-swedteam": 85,
  "camo-gloves-snow-swedteam": 140,
  "camo-gloves-forest-swedteam": 140,
  "camo-boots-crispi-titan-evo": 1850,
  "camo-boots-lowa": 1650,
  "camo-boots-scarpa": 1580,
  "camo-boots-haix": 1720,
  "camo-ski-boots-budget": 2200,
  "camo-ski-boots-mid": 2400,
  "camo-ski-boots-pro": 2350,

  "ski-asnes-kongsvoll": 2200,
  "ski-asnes-combat": 2800,
  "ski-natoplank": 3500,
  "ski-sgn-togga": 2400,
  "ski-dps-judas": 2600,
  "ski-joggepinner": 1600,
  "ski-jobbepinner-feller": 2100,

  // Bipods / tofot
  "bipod-game-on-softgun": 280,
  "bipod-jula-budget": 320,
  "bipod-utg-shooter": 380,
  "bipod-caldwell-xla": 340,
  "bipod-harris-s-brm": 520,
  "bipod-magpul-bipod": 310,
  "bipod-atlas-bt65": 450,
  "bipod-spartan-javelin": 220,
  "bipod-accu-tac-br4": 580,
  "bipod-mdt-ckye-pod": 620,
  "bipod-accu-tac-fc5": 980,
  "bipod-phoenix-precision": 410,
  "bipod-trs-really-right": 720,

  // Food / cook (packed kit weight)
  "food-real-turmat": 135, // dry pouch ~125–150 g
  "food-msr-pocketrocket": 73, // MSR PocketRocket 2 ~73 g
  "food-msr-isopro-230": 360, // 230 g fuel + canister ~130 g
  "food-rema-brod": 550, // loff
  "food-polarbrod-ost-skinke": 420, // pack + toppings
  "food-circlek-baguette": 260,
  "food-boller-5pk": 400,
  "food-dronning-kokesjokolade": 100,
};

/** Fallback if an id is missing — keep catalog from crashing; fix weights map. */
export function defaultWeightGrams(category: ShopCategory): number {
  switch (category) {
    case "lrf":
      return 500;
    case "thermal":
      return 500;
    case "scope":
      return 700;
    case "suppressor":
      return 350;
    case "stock":
      return 1200;
    case "rifle":
      return 3500;
    case "ammo":
      return 400;
    case "misc":
      return 500;
    case "camo":
      return 1100;
    case "ballistics":
      return 150;
    case "backpack":
      return 2000;
    case "chestrig":
      return 350;
    case "skis":
      return 2200;
    case "bipod":
      return 400;
    case "food":
      return 300;
  }
}

export function resolveWeightGrams(
  id: string,
  category: ShopCategory,
  explicit?: number,
): number {
  if (explicit != null) return explicit;
  return WEIGHT_G_BY_ID[id] ?? defaultWeightGrams(category);
}

export function formatWeightKg(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)} kg`;
}
