# Cold Bore Toppjakt - The Game

## 🎮 Spillkonsept

Et **realistisk jakt-simulator spill** inspirert av "The Lost Dutchman Mine" og "The Lost Patrol". Fokus på realisme, taktikk, skill-utvikling og beslutningstaking.

## 🎯 Kjernefilosofi

**"Realisme i alle aspekter"** - spilleren skal gå gjennom alle steg en ekte jeger gjør:
- Våpenvalg og testing
- Ammunisjonsvalg
- Terrenganalyse
- Taktisk bevegelse
- Presis skyting med balistikk
- Etisk jakt (minimere lidelse/ødeleggelse)

---

## 🧭 Realisme-kjernen (levende dokument)

Dette er **essensen** av hva som gjør spillet realistisk. Tall og kataloger justeres underveis (Tomas eier jakt-/våpenfag; kode speiler dette). Implementasjon i dag: `src/lib/ammo/`, `src/lib/shop/`.

### Designregler for game engine

1. **Aldri forenkle til arcade-DPS.** «Damage» betyr kjøttødelegging / ekspansjon — ikke hitpoints.
2. **Presisjon måles i MOA**, ikke magiske accuracy-prosent uten fysisk mening.
3. **Alt man bærer har vekt** (gram). Vekt påvirker bevegelse, utholdenhet, støy og valg.
4. **Priser i NOK** skal føles som norsk gatepris (Biltema-budget → Leica/ZCO-premium).
5. **Trade-offs er poenget:** billig/tung/dårlig glass vs. dyrt/lett/presist; rent kjøtt vs. tilgivende ekspansjon; papirbyråkrati vs. arvet .22.

### Town-hub (Lost Dutchman-stil)

Etter intro står spilleren i byen og velger destinasjon:

| Sted | Rolle |
|------|--------|
| **Pike Pro Shop** | Kjøp våpen, ammo, glass, dempere, stokker, misc kit |
| **Sheriff** | Søke nye våpen (norsk byråkrati-satire midlertidig) |
| **Home** | Kit-bygger + **Current rig** (rifle / scope / stock / bipod / can + **flere ammo** til range-sekvens) → total vekt + top speed; lisensstatus (ikke i inventory) |
| **Shooting Range** | CBA 100 m: kit-rig, piltaster + wobble (calm/bipod×3), +/− zoom, 5-skudds serie, hull + mål i MOA/mm. Låneutstyr senere |

### Player stats (HUD)

Alltid synlig etter karakterskaping:

- **Navn** / **Nick** (kun epithet, f.eks. `"Sniper Slim"`)
- **Konto** (NOK)
- **Orrhaner** / **Tiur** (antall felt)
- **Max Range** (lengste jakt-treff i meter)

### Vær (HUD — kun mission)

**Ikke** synlig i by / Pike Pro / Sheriff / Home. Under jakt: kompakt **hjørne-chip** (nede til høyre) som ekspanderer til live + forecast.  
Kode: `src/lib/weather/spec.ts`, UI: `WeatherFrame` (FAB).

### Startkit / narrativ / startkapital

- Onkel gir bort **CZ 452 .22 LR** (iron sights, ingen picatinny) via `grantUncleRifle` (normale starter).
- Spilleren må kjøpe ammo, evt. demper, øve på range, og senere søke/kjøpe bedre våpen.
- **Startkapital** (`startingBalanceForName` i `src/lib/player.ts`):

| Navn ved registrering | Saldo |
|-----------------------|-------|
| Vanlig | **10 000 kr** (`STARTING_BALANCE`) |
| Fornavn **Jørn / Ivar / Tomas** (ordtreff, case-insensitive; f.eks. «Jørn Nilsson») | **100 000 kr** (`VIP_STARTING_BALANCE`) |
| **Neppe** (cheat) | **500 000 kr** + full `grantStarterGear` |

- Starter-hunt kit (ikke VIP) er onkel-rifle + Biltema-kikkert + gift-lisens — ikke full premium-loadout. Neppe får test/jakt-loadout (Sauer, NF, Kestrel, …). Loading **1 s**.

---

### Ammunisjon — ballistikk og terminal effekt

Hver ammo-type i katalog har:

| Felt | Synlig for spiller? | Betydning |
|------|---------------------|-----------|
| `caliber` | Ja | 6,5×55, 6,5 Creedmoor, .223, .22 LR, .17 HMR, .308, .30-06, … |
| `projectileType` | Ja | `FMJ` \| `OTM` \| `SP` |
| `v0` | Ja | Utgangshastighet (m/s) **ved 15 °C kruttemperatur** |
| `bc` + `bcModel` | Ja | Ballistisk koeffisient (G1/G7) |
| `damageFactor` | Ja (senere/engine) | Kjøttødelegging / ekspansjon (0–1) |
| `maxAchievableMoa` | **Nei — internt** | Beste (laveste) spredning ammo kan bidra til |

#### Powder temperature (dV/dT) — ✅ wired

Katalog-`v0` er referanse ved **15 °C**. Live luft/krut-temp justerer realisert munningshastighet før drop/hold:

```
v0(T) = catalogV0 + (T − 15) × dV/dT
dV/dT = 1 m/s/°C   (centerfire)
      = 2 m/s/°C   (.22 LR)
```

Eksempel centerfire 800 m/s @ 15 °C → 785 @ 0 °C → 775 @ −10 °C.  
.22 LR 360 @ 15 → 350 @ 10 → 340 @ 0 → 330 @ −5.

- **Kestrel / exact hold:** bruker live temp automatisk (tetthet + powder temp).
- **Lapua-app (Enviro):** spilleren må stille **Temp** (−25…30 °C) i tillegg til range/vind.
- Kode: `src/lib/ballistics/powderTemp.ts`, brukt i `solver.ts` / `dispersion.ts` / skudd-UI.

#### damageFactor — hvordan vi setter den

Utgangspunkt: **prosjektilkonstruksjon**, ikke «stopping power».

| Konstruksjon | Typisk faktor | Eksempler |
|--------------|---------------|-----------|
| FMJ / match OTM | **Lav** ≈ 0.18–0.28 | Lapua Scenar, ELD-M, MatchKing |
| Kontrollert jaktekspansjon | **Midt** ≈ 0.55–0.70 | Gamehead, Speedhead, Bondstrike |
| Agressiv ekspansjon | **Høy** ≈ 0.70–0.85 | Oryx, Hammerhead, Core-Lokt, V-MAX |

**Lav ≠ dårlig / svak.** Lav factor = mindre ødelagt kjøtt, men spilleren må treffe vitalt bedre for å unngå ettersøk. Høy factor = mer tilgivende treff, mer ødelagt kjøtt.

**Game engine-regel:** `damageFactor` = meat-ruin + placement forgiveness. Aldri «damage points» / DPS.

Sortering i butikk: kaliber → type (eller type → kaliber), med filter.

#### maxAchievableMoa — intern presisjon

- Spredning måles i **MOA**. **1 MOA ≈ 29.4 mm** gruppe på **100 m**.
- `maxAchievableMoa` = beste (laveste) vinkelspredning denne ammoen kan bidra til i et kapabelt våpen (f.eks. Tikka T3x Varmint).
- Eksempel-intensjon:
  - Lapua Scenar 136gr / Norma Black Diamond → ca. **0.25–0.28 MOA**
  - Sako Speedhead / Gamehead → ca. **0.5 MOA**
  - Trenings-FMJ / budget-bulk → høyere (dårligere gulv)
- **Endelig treffpunkt i engine** (range + jakt):
  - **Siktepunkt (POA)** = retikkel når skuddet går
  - **Treffpunkt (POI)** = POA + gaussisk vinkel-spredning (+ v0-vertikal)
  - Envelope MOA = `rifle.averageBestAccuracyMoa + ammo.maxAchievableMoa × affinity + stock.moaDelta`
  - Envelope = **N σ** (default **N=2**, bytt `DISPERSION_MOA_SIGMA_LEVEL` til 1 eller 3)
  - σ = envelope / N → hovedvekten av skudd tettere enn envelope; outliers finnes
  - **v0-variasjon** separat (m/s SD); påvirker drop mer på lang hold enn 100 m-gruppe
  - scope zero / vind / skytter (pust, fokus) kommer i tillegg
- Spilleren ser **ikke** ammo-MOA i butikk; de oppdager det gjennom testing på range og jaktresultat. Rifle «avg best» vises som referanse — faktisk gruppe krever riktig ammo + hell.
- **Ingen nullfaktorer i Pike Pro:** hvert produkt skal flytte nålen. Mangler noe faktor → spør Tomas.

```typescript
// src/lib/ballistics/dispersion.ts
envelopeMoa = rifleMoa + ammoMoa * affinity  // + stock.moaDelta
sigmaMoa    = envelopeMoa / DISPERSION_MOA_SIGMA_LEVEL  // default 2
// sample X,Y ~ N(0, sigmaMoa); POI = POA + mm(offset, distance)
// + sample v0 ~ N(ammo.v0, v0Sigma); vertical miss grows with distance²
```

**Skala (guide):** ~0.25 megabra (Sauer 200 STR + Krieger-type) · ~0.50 bra-bra · >1.0 budget.

Tune-liste: `src/lib/rifle/spec.ts` → `RIFLE_AVERAGE_BEST_MOA`.  
Dispersion: `src/lib/ballistics/dispersion.ts`.  
**Full error budget (hjørnestein):** `src/lib/ballistics/errorBudget.ts` + seksjon **Ballistikkmotor** under.

Kode: `src/lib/ammo/spec.ts`, `src/lib/rifle/spec.ts`, `src/lib/stock/spec.ts`, `src/lib/optics/spec.ts`, katalogverdier i `src/lib/shop/catalog.ts`.

---

### Ballistikkmotor — hjørnestein (jakt P(hit) på avstand)

Sannsynlighet for å treffe jaktmål på lenger hold er **ikke** bare 100 m-gruppe. Engine skal stable hele feilbudsjettet før vital/body/miss-geometri:

| # | Faktor | Status / kilde |
|---|--------|----------------|
| 1 | **POA** (retikkel ved avtrekk) | Range/jakt: pust/fokus, calm, wobble; jakt: BODY→calm, MIND→MOA |
| 2 | **Vinkel-spredning** rifle+ammo(+stock, affinity), N σ Gauss | `dispersion.ts` (+ MIND scale) |
| 3 | **v0-variasjon** (drop/TOF) + **powder temp dV/dT** | `dispersion.ts`, `powderTemp.ts` |
| 4 | **Vind** — sann vs trodd (Kestrel lokal vs LRF/AB forecast); spillvind **0–5 m/s** | `weather/spec.ts` |
| 5 | **Kikkert-klikk / zero** — `clickErrorPercent` (±% på dialte klikk) | Scope-katalog / `optics/spec.ts` |
| 6 | **Avstandsmåling** — LRF `rangeErrorPercent` | `optics/spec.ts` |
| 7 | **Atmosfære** — tetthet fra live temp + powder temp → v0 | ✅ `densityRatioFromTempC` + dV/dT |
| 8 | **Zero-tilstand** (cold bore, cant, sist verifisert) | Planlagt |
| 9 | **Vital-sone geometri** — ikke loot-roll | ✅ jakt (`shoot.ts`) |

**Prinsipp:** Sample (eller integrer) full miss-vektor i målplanet, *deretter* klassifiser vital/body/miss. Aldri kollaps til én `accuracy × distance`-fudge.

Kontrakt i kode: `BALLISTIC_ENGINE_CORNERSTONE` + `BallisticErrorBudget` i `src/lib/ballistics/errorBudget.ts`.

---

### Vekt — alt bæres

Hvert produkt i Pike Pro Shop har **`weightGrams`** (realistisk gatevekt).

- Rifler: tomt våpen uten kikkert/demper
- Scopes / LRF / dempere / stokker: som solgt
- Ammo: **hele esken** som kjøpes
- Sekker: tom sekk (last kommer på toppen i engine)

**Engine skal bruke total bærevekt til:**

- effektiv ganghastighet
- utmattelse / tidsbruk
- støy / spooking (tungt + raskt = mer støy)
- valg: karbonstokk / lett demper / liten sekk vs. tung precision-rig

**Alt kjøp går inn i totalt gameplay:** hvor mye terreng du får dekket, hva kitet veier (rå + følt), og hva det koster i NOK. Algoritmene finpusses senere — knaggene finnes i katalogdata.

#### Misc — Weight + Endurance (enkel to-knapp-modell)

Misc-varer har alltid `weightGrams` **og** `misc.enduranceGrams`.

Placeholder (ikke endelig formel):

```
feltContribution ≈ weightGrams - enduranceGrams
```

Eksempel: Termos ~380 g + endurance 2000 → net negativ følt vekt (kaffe/utholdenhet).  
Futteral/veske: endurance 0 → ren vekt.  
Sittpute: litt endurance (tørr post = mer tålmodighet).

Kode: `src/lib/misc/spec.ts`. Flere faktortyper kan komme senere; misc holder seg til disse to nå.

Vekter: `src/lib/shop/weights.ts` (kan overstyres per vare).

#### Lyddempere — bærevekt vs weapon calm (2×)

Vekt er det **primære** attributtet for lyddempere. Masse langt fremme på munningen gir mer «rolig våpen» enn den koster i bæring:

| Bruk | Formel | Eksempel 300 g demper |
|------|--------|------------------------|
| Kit / bærevekt | `weightGrams × 1` | +300 g |
| Weapon calm mass | `weightGrams × 2` | +600 g |

Tung demper = tyngre å gå med, men våpenet ligger roligere i skuddet. Lett titan = lettere kit, mindre calm-bidrag.

Kode: `src/lib/suppressor/spec.ts` (`SUPPRESSOR_CALM_WEIGHT_FACTOR = 2`).

#### Bipods / tofot — vekt vs weapon calm

Tofot øker bærevekt, men gir **sterk calm** når den er ute under skuddet.

| | |
|--|--|
| Kit | `weightGrams` (full) |
| Weapon calm | `bipodWeaponCalmGrams(weight, weaponCalm)` — tung + dyr pod = høyere calm-mass |

`weaponCalm` (1–10): Game-On/Jula lavt; Accu-Tac FC / RRS = 10. Aldri nullfaktor.

**Shooting Range (senere — ikke implementert ennå):**  
På banen kan man låne «generisk tofot», «sandsekk» og lignende for å *føle* calm / støtte under zeroing — **kun om man ikke allerede eier dem eller har dem i kit**. Har du kjøpt Accu-Tac og pakket den, bruker du din egen (ikke lån). Poenget er fristelse: prøve utstyr man ikke har råd til ennå → bli gira → tilbake til Pike Pro og spille mer. Samme calm-prinsipp som eide bipods.

Kode: `src/lib/bipod/spec.ts`.

#### LRF — range error (±%)

Hver LRF har `rangeErrorPercent`. Engine sampler jevnt innenfor ±%-båndet (`measureDistanceWithLrf`):

| Tier | Eksempel | `rangeErrorPercent` |
|------|----------|---------------------|
| Premium | Sig, Leupold, Vortex, Leica, Zeiss, … | **1** (±1%) |
| Mid | Burris / Magasinet | **1.5–2.5** |
| Budget | Biltema, Jula, Clas Ohlson | **3** (±3%) |

Ved 300 m: ±1% ≈ ±3 m, ±3% ≈ ±9 m — nok til bom hvis hold er stramt. Oppgradering av LRF er derfor reell kit-gevinst, ikke kosmetikk.

Kode: `src/lib/optics/spec.ts`.

#### Weather forecast vs Kestrel / handheld meters

Hver **dag** har en `DayWeather`:

| Lag | Innhold |
|-----|---------|
| `forecast` | Morgenprognose (temp, vindstyrke, vindretning) — det LRF/AB/apper bruker |
| `live` | Sannhet på bakken; driver over `missionMinutes` |

**Vindstyrke er capped til 0–5 m/s** (`MAX_WIND_SPEED_MS`) — over det sitter det omtrent ikke fugl i trærne. Forecast-feil og live-drift respekterer samme tak.

Forecast har feil vs morgen-truth (`FORECAST_WIND_SPEED_ERROR_PERCENT ≈ 18%`, retning ±25°, temp ±2°C). I løpet av dagen driver `live` videre (vind/temp endres innen båndet).

| Kilde | Crosswind | Temp / dV/dT | Typisk vindfeil |
|-------|-----------|--------------|-----------------|
| **Kestrel 5700 Elite** (+ BDX) | Lokal live → **ekte crosswind** + auto hold | Live temp automatisk | ±3% (Elite) |
| **Lapua-app (Enviro)** | Spilleren dialer range + vind + **Temp** | Må stilles manuelt | Estimat (kan bomme på temp/vind) |
| **LRF med AB / forecast** | Ofte **full-value** (antar 90°) fra forecast | Forecast-temp | ≈ forecast ±18% + avrunding |

UI: Kestrel-fanen viser enhet + **forstørret LCD** (E/W/Tgt/Wind). Lapua: rød vindpil rundt sirkel + Temp-stepper.

Kode: `src/lib/weather/spec.ts`, `src/lib/ballistics/spec.ts`, `KestrelFasitView`, `LapuaBallisticsApp`, `HuntShotConditions`.

---

### Pike Pro Shop — katalogfilosofi

Kategorier:

1. **LRF / Avstandsmålere** — Biltema-monokkel → Leica / Zeiss / Vortex Fury. Felt `hasOnboardBallistics` + `rangeErrorPercent` (±% randomizer på målt avstand; premium ≈ ±1%, Biltema/Jula ≈ ±3%). Filter: «kun m/intern ballistikk».  
2. **Scopes** — sort/filter: pris, vekt, min/max zoom, MRAD vs MOA. Spec: `clickErrorPercent` (±% på dialte elev/windage-klikk ved skudd; premium NF/Kahles/ZCO/… = 0 %, Viper 3 %, budget Biltema/Jula/Clas 10 %). `zeroRetentionInaccuracy` (MOA) der relevant.  
3. **Lyddempere** — kun vekt for nå (kit +1×, weapon calm +2×). Ingen ekstra dB/POI-styr.  
3b. **Bipods / Tofot** — kit-vekt + `weaponCalm` (dyrere/tyngre → høyere calm). Score10: `weaponCalm`, `deploySpeed`, `tracking`. Calm gjelder når tofot er ute.  
4. **Stokker** — GRS / MDT / McMillan + budget. Spec: `moaDelta` (additivt; f.eks. −0.05 MOA; aldri 0).  
5. **Rifler** — `averageBestAccuracyMoa` (kjent gulv med matchende ammo). Tune-tabell: `RIFLE_AVERAGE_BEST_MOA`. Per-spiller ammo-affinity randomizer (uflaks) — må testes på range.  
6. **Ammunisjon** — Norma, Lapua, Sako, … + budget (`v0` @ 15 °C; se dV/dT)  
7. **Camouflage** — fullsett + apparel-slots: buff, beanie, hansker, boots, **skistøvler** (påkrevd med ski). Score: birdSpot (lav=bra) + `terrainSpeed`/`stamina` (høy=bra; dyrere ≈ bedre).  
8. **Ballistics** — Kestrel/ACE måler lokal **crosswind** + live temp (dV/dT). LRF med AB bruker **forecast** + typisk full-value windage (antar 90°) — større feil enn Kestrel. Garmin Foretrex ≈ forecast-path.  
9. **Backpacks** — Score10: `carryComfort`, `quickRelease` (+ `opticsAccess`). Høyere = bedre.  
10. **Chestrigs** — samme Score10-akse; `opticsAccess` er hovedknagg.  
11. **Skis/Snowshoes** — Score10: `maxSpeed`, `flowPerKg` + `widthMm` (brede = bedre i dyp snø med tung sekk).  
12. **Food** — Real turmat (krever MSR PocketRocket + gass for stamina), klar mat (brød/baguette/boller). Gassboks 230 g ≈ 10 turer.  
13. **Misc kult kit** — futteraler, soft cases, termos, sittpute, **Triggercam**, **jakt-camcorder** (Aware: +20 % nervøsitet ved oppsett; bedre ettersøk-cue), thermal (egen batteritid)

**Butikksortering (alle kategorier):** pris ↑↓, vekt ↑↓.

**Score10 (butikk-språk):** Alle spillbare kvalitetsfaktorer skal over tid bruke **1–10 der høyere alltid er bedre**. Rå fysikk (MOA, %, gram) kan leve internt; spilleren skal kunne søke «høy score» konsistent. Ingen nullfaktorer.

**Budget-hylla er bevisst:** Jula / Biltema / Clas Ohlson / Magasinet dekker primærbehov tidlig. Premium er valg når konto og skill tillater det — ikke «unlock level 10 magically».

**Sheriff / Lensmann (satire):** Velkommen + kølapp → meny (våpensøknad / selvinnsikt hjemmebrent / feil luke klamydia / kattesak). Våpensøknad: skjema → takk-valg → Digipost 45–55 uker → «50 uker»-ekspressdialog (4 valg) → gebyr **500 × 2^(betalte_lisenser)** (500 / 1000 / 2000 / 4000…) → **våpenlisens** GODKJENT (maks 8 lisenser). Lisens ≠ rifle: lisenser ligger ikke i inventory; Pike Pro krever ubrukt lisens for å kjøpe jaktrifle. Start: CZ 452 + 1 gift-lisens.

---

### Carry systems — faffe, nervøsitet og vekt

Chestrig og backpack er ikke bare «inventory slots». De påvirker **tid** og **følt vekt**.

#### CarrySpec (Score10 — høyere = bedre)

| Felt | Betydning |
|------|-----------|
| `carryComfort` (1–10) | Høyere = raskere gange / mindre utmattelse under last |
| `quickRelease` (1–10) | Høyere = kortere tid fra bærestilling til skuddklar |
| `opticsAccess` (1–10) | Høyere = raskere LRF/kikkert-tilgang |

Backpacks: comfort + QR er hovedknagger. Chestrigs: opticsAccess er kongen.  
Uten pack/chestrig: defaults comfort 2 / QR 3 / optics 1.  
Kombinasjon: **beste (høyeste) score** per akse vinner.  
Engine: `carryToEngine()` → sekunder + weightPenaltyFactor.  
Kode: `src/lib/carry/spec.ts`, `src/lib/shop/score.ts`.

```
effectiveCarryKg = rawKitKg * scoreToWeightPenaltyFactor(combined.carryComfort)
rifleDeploySeconds = scoreToDeploySeconds(combined.quickRelease)
```

#### Score10-migrering (alle kategorier)

Mål: spiller ser alltid «høy = bra». Planlagte butikk-scorer:

| Kategori | Score10-knagger (utkast) |
|----------|--------------------------|
| Backpack / Chestrig | comfort, QR, opticsAccess ✅ |
| Skis/Snowshoes | maxSpeed, flowPerKg (+ widthMm) ✅ |
| Bipod / Tofot | weaponCalm, deploySpeed, tracking ✅ |
| LRF | rangingAccuracy (fra ±%), ballisticCapability |
| Scope | clickAccuracy (fra `clickErrorPercent`), zeroRetention |
| Stock | rigidity / accuracyGain |
| Suppressor | calm (fra fremre masse), hush |
| Rifle | averageBestAccuracyMoa → Score10 ✅ (+ ammo affinity randomizer) |
| Camo | concealSnow, concealNoSnow (inverter birdSpot) |
| Ballistics | readingAccuracy ✅ · measuresCrosswind · windErrorPercent |
| Ammo | (precision skjult — evt. ikke Score10 i butikk) |
| Misc | enduranceScore |

Rå motorverdier beholdes der fysikk krever det; Score10 er UX-laget.

#### Nervøsitets-utregning (fugl sitter vs. letter)

Samme «trykk»-familie som dårlig kamo og mye bevegelse. Fuglen akkumulerer nervøsitet som **summen av alle valg** (avstand, bevegelse, camo, camcorder, Enviro-faffe, …); over terskel → flush.

**Aware encounter-tick** (primær modell i felt): `tickEncounterNerve` i `src/lib/game/nervousness.ts` — avstandsbånd (>350 m / 80–350 m / ≤80 m), bevegelse, camo `birdSpot`, cover/LOS-hooks.

**Baseline ved re-møte:**

| Situasjon | Start-nerve |
|-----------|-------------|
| Første møte (`spookCount === 0`) | `0` |
| Allerede skremt én gang (`spookCount ≥ 1`) | `0.40` (`RESPOOKED_BIRD_START_NERVE`) |

**Engangskostnader:**

| Handling | Δ nerve (0–1 skala) |
|----------|---------------------|
| Sett opp **jakt-camcorder** før skudd | `+0.20` (`CAMCORDER_SETUP_NERVE`) — umiddelbart på baren |

Camcorder gir bedre ettersøk-cue (retning + landingsavstand) etter treff, men kan trigge flush hvis nerve allerede er høy.

**Enviro / Lapua (skudd-HUD):** nerven fra Aware bæres inn. Mens Enviro-fanen er åpen går klokken ×5 (`ENVIRO_TIME_FACTOR`); nerve tickes videre med `tickEncounterNerve` (avstand + camo, still) **pluss** app-faffe (`ENVIRO_APP_FAFFE_NERVE_PER_GAME_SEC`) — ikke en egen nedtelling fra null. Flush ved `ENCOUNTER_NERVE.flushThreshold`.

Legacy snapshot-formel (range/HUD-placeholder):

```
nervousness ≈
    distancePressure(distance, dangerRadius)
  + effectiveBirdSpotFactor * spotWeight
  + timeInDangerZoneSec * timeWeight
  + faffeSeconds * faffeWeight
  + movementNoise * …

if nervousness >= flushThreshold → bird flies
```

**Faffe-sekunder** kommer typisk fra `carryToEngine()` (optics/rifle deploy) når spilleren faktisk tar fram kikkert eller rifle *mens* hen er i faresonen. Bra chestrig (høy `opticsAccess`) sparer observasjons-faffe; bra pack (høy `quickRelease`) sparer rifle-faffe.

Kode: `src/lib/game/nervousness.ts`, `CAMCORDER_SETUP_NERVE` i `src/lib/hunt/shoot.ts`, UI `AwareAppView`.

**Stamina / shake-avhengigheter** (BODY/MIND → skudd): se [`STAMINA_AND_SHAKE.md`](./STAMINA_AND_SHAKE.md).

---

### Camouflage vs fuglesyn

Fugler (orrhaner/tiur) har **ekstremt godt syn**. Kamuflasje gjør deg ikke usynlig — den reduserer hvor lett fuglen spotter menneskelig silhuett/kontrast.

Hver kamuflasje har **to** bird-spot-faktorer. Jegere trenger typisk **både** snøkamo og ikke-snøkamo — det koster penger og tvinger prioritering.

| Felt | Betydning |
|------|-----------|
| `birdSpotSnow` | Hvor lett fuglen spotter deg **i snø**. **Lav = bra.** |
| `birdSpotNoSnow` | Hvor lett fuglen spotter deg **uten snø** (høstskog, barskog, lyng, …). **Lav = bra.** |
| `bestTerrains` | Hvor mønsteret er ment å skinne (flavor + finjustering) |
| `availableInShop` | `false` = finnes i spilldata, kan ikke kjøpes (f.eks. Norwegian Snow Camo) |

**Engine-regel:** Bruk `birdSpotForConditions(camo, snowOnGround)` — ikke ett generisk tall. Snøkamo på bar mark / høstkamo på åpen snø skal være dyrt i nervøsitet.

Eksempel (placeholders):

| Kamo | Snow | No-snow |
|------|------|---------|
| Norwegian Snow (unobtainable) | 0.08 | 0.85 |
| Finnish M05 Snow | 0.10 | 0.84 |
| Vintage hvitt overtrekk | 0.18 | 0.88 |
| Sitka Subalpine | 0.72 | 0.22 |
| KUIU Verde | 0.74 | 0.24 |
| Biltema Leaf | 0.78 | 0.42 |

Kode: `src/lib/camo/spec.ts`.

---

### Observasjon, kikkert og «øyne»

*(Utvides med art / assets.)*

- Landskap som sett med øynene (stillbilde/lag), ikke full 3D-skog i MVP.
- Fugler kan være synlige eller ikke (LOS, avstand, **kamuflasje / birdSpotFactor**, observasjonsmodus).
- **Kikkert** = pan/zoom (crop + scale) av samme scene; synlige fugler i trær når logikk tillater.
- LRF / værstasjon / scope påvirker hva spilleren *vet* (avstand, vind, hold), ikke magisk auto-hit.

### Innskyting (range)

- CBA-blink (én diamant) i kikkertvindu med vignette; generisk tynt kors (per-scope retikkel senere).
- Blink-skala: `SCOPE_IMAGE_SCALE_PER_ZOOM` (apparent size ∝ optical zoom) — finjusteres for UX.
- Piltaster sikter; wobble dempes av weapon calm (bipod ≈ 3×, can bidrar).
- **F (hold):** fokus/pust — calm ×3 i 8 s, deretter fatigue (verre) til F slippes og trykkes på nytt.
- **Space (hold):** avtrekk — skudd etter tilfeldig 0–1 s; slipp F eller Space før det = avbrutt.
- `+` / `−` zoom mellom scope min–max (start max).
- 5 skudd/serie → hull på blink → **Mål serie** = stillbilde av hele blinken med nummererte treff, bounding box, mean radius, POI-linje + gul stats-banner (group size MOA/mm, area B×H, mean radius, POI).
- Ammo-affinity rulles per rifle×ammo ved første skudd og persisteres.
- Knappene: Mål serie / Ny serie / Ferdig.

### Jakt-etikk (scoring)

Belønnes:

- vital / clean kill
- lav kjøttskade (ofte lav `damageFactor` *og* godt treffpunkt)
- korrekt avstand/vind
- lite unødig lidelse / ettersøk

Straffes / koster:

- body/wing uten oppfølging
- høy meat-ruin uten grunn
- bom som spooker område

---

## 🗺️ Spillverdenen

### Kart og Terreng
- **Mocka kart-data** (ikke ekte kartintegrasjoner)
- **Lokale høydedata** for LOS (Line of Sight) beregninger
- **Multiple maps/levels** som unlockes progresivt
- Starter med **ÉN level** (ett kartutsnitt)

### Terrengkategorier
Hver kartrute har kategorier som påvirker gameplay:
- `skog` - Generell skog
- `myr` - Vanskelig terreng, redusert hastighet
- `fugleskog_bra` - Høy sannsynlighet for fugl
- `orrfugl_habitat` - Orrfugl-spesifikt
- `tiur_habitat` - Tiur-spesifikt
- `hogst` - Hogstfelt, annen dynamikk
- `bonitet_høy/lav` - Skogskvalitet påvirker viltstamme

### Game Engine Response
Basert på terrengkategori → game-logikk bestemmer:
- Fugl-spawning sannsynlighet
- Bevegelseshastighet
- Lyd-nivå (spooking)
- Siktbarhet

## 🎯 Spillmekanikk

### 1. Våpensystem

#### Startfase
- Spiller starter med **enkelt våpen** (arvet/billig)
- Må **teste våpenet** for å finne egenskaper
- Må **finne riktig ammunisjon** gjennom testing

#### Våpenattributter (konsept — speiles i shop/rifle-katalog)
```typescript
interface Weapon {
  name: string;
  caliber: string; // f.eks. ".22 LR", "6,5 Creedmoor"
  weightGrams: number; // tomt våpen
  /** @internal Beste spredning våpenet kan bidra til (MOA), før ammo/skytter */
  maxAchievableMoa: number;
  effectiveRange: number; // meter (praktisk, ikke magisk)
  recoil: number;
  priceNok: number;
  // thread, rail/picatinny, stock inlet-kompatibilitet, …
}
```

#### Ammunisjon (gjeldende modell)
```typescript
type ProjectileType = "FMJ" | "OTM" | "SP";

interface AmmoSpec {
  caliber: string;
  projectileType: ProjectileType;
  v0: number;              // m/s
  bc: number;
  bcModel: "G1" | "G7";
  damageFactor: number;    // kjøttødelegging 0–1; LAV ≠ dårlig
  /** @internal aldri vis til spiller */
  maxAchievableMoa: number;
}
```

Se **Realisme-kjernen** over for tolkning og engine-regler.

#### Våpen + ammo + skytter = treff
Ikke en enkel `accuracy * modifier`-formel. Se **Ballistikkmotor — hjørnestein**: full feilbudsjett (v0, vind, klikk, LRF, atmosfære, zero, POA) → miss-vektor i målplanet → vital/body/miss-geometri. Aldri loot-roll.
### 2. Skytesystem

#### Spilleren MÅ:
1. **Bedømme avstand** korrekt (uten avstandsmåler i starten)
2. **Justere for vind** (vindstyrke varierer)
3. **Stille inn våpen** korrekt
4. **Velge riktig ammunisjon** for situasjonen

#### Feil = Bom
- Feil avstandsbedømming → Kulen/haglet treffer feil
- Feil vindjustering → Lateral miss
- Dårlig ammunisjon → Lavere presisjon
- Dårlig teknikk → Penalty på treffer

#### Treffer-system
```typescript
interface Shot {
  distance: number;
  windSpeed: number;
  windDirection: number;
  playerEstimatedDistance: number;
  playerWindAdjustment: number;
  
  // Resultat
  hit: boolean;
  hitLocation: 'vital' | 'body' | 'wing' | 'miss';
  damageToMeat: number; // 0-100 (lavere = bedre)
  cleanKill: boolean; // instant death, minimal suffering
}
```

### 3. Poengsystem

#### Poeng tildeles for:
- ✅ **Treff** (basis poeng)
- ✅ **Presis avstandsbedømming** (+bonus)
- ✅ **Korrekt vindjustering** (+bonus)
- ✅ **Vital hit** (instant kill) (+bonus)
- ✅ **Minimal kjøttskade** (+bonus)
- ✅ **Riktig ammunisjon** for situasjonen (+bonus)
- ✅ **Etisk jakt** (minimere lidelse) (+bonus)
- ✅ **Effektiv rute** (areal dekket vs tid) (+bonus)

#### Poeng brukes til:
- 🛒 Kontantkjøp i **Pike Pro Shop** (NOK — realistiske priser)
- 🛒 Bedre våpen / ammo / glass / dempere / stokker / sekker / værstasjon
- 🛒 Lettere utstyr (lavere bærevekt → bedre bevegelse)

### 4. Bevegelsessystem

#### Hastighet vs Forsiktighet Trade-off
```
Rask bevegelse → Større område dekket → Mer spooking
Langsom bevegelse → Mindre område → Bedre observasjon
```

#### Vekt-system
```typescript
interface PlayerLoadout {
  baseSpeed: number; // m per tidsenhet
  inventory: { itemId: string; qty: number }[];
  // totalCarryWeightKg = sum(item.weightGrams) / 1000  (+ evt. felt-last)
  // actualSpeed = f(baseSpeed, totalCarryWeightKg, terrain, sneak|move|scan)
}
```

Alt i butikken har `weightGrams`. Tomme tall er uakseptable — bruk realistiske verdier og juster i `weights.ts` / katalog.

**Carry-effektivitet:** Equipped backpack/chestrig sin `carryComfort` (Score10) → `scoreToWeightPenaltyFactor` reduserer hvor mye kit-vekt straffer fart/støy (se Carry systems over).

**Eksempel (retning, ikke endelig formel):**
- Basis hastighet: 100 m/time
- Lett rifle (~3 kg) + minimal utstyr ≈ raskere tempo
- Tung precision-rig (~8–12 kg+) uten bra pack ≈ saktere, mer støy
- Samme rig med Vorn + chestrig ≈ mer av vekten «bæres effektivt»
#### Støy-system
```
Hastighet → Støy-nivå → Spooking-radius
Fast movement → Høy støy → 100m spooking
Normal → Medium → 50m spooking
Sneak → Lav → 20m spooking
```

### 5. Observasjonssystem

#### Fugl-adferd
- Fugl spawner i passende habitat
- Fugl har **spooking-radius**
- Fugl flyr hvis:
  - Spilleren kommer for nært for raskt
  - Høy støy
  - Dårlig vind-retning (fugl lukter spilleren)

#### Observasjons-modus
```typescript
type ObservationMode = 'scan' | 'move' | 'sneak' | 'still';

// Scan: Stopp, observer grundig
// Move: Normal bevegelse
// Sneak: Langsom, forsiktig
// Still: Fullstendig stillestående (best observasjon)
```

### 6. En "Runde" (En Dag)

#### Tidsramme
- En runde = en jaktdag
- Begrenset tid (f.eks. 6 timer spilletid)
- Må balansere:
  - Areal dekket
  - Observasjoner
  - Skudd-muligheter
  - Retur til base

#### Mål for runden
- Dekke mest mulig relevant terreng
- Observere og registrere fugl
- Ta etiske, presise skudd
- Maksimere poeng

## 📊 Progresjonssystem

### Level 1: Nybegynner
- Enkelt arvet våpen
- Ingen utstyr
- Må lære å bedømme avstand
- Starter med ett map/level

### Level 2-5: Utvikling
- Kjøper første avstandsmåler
- Oppgraderer ammunisjon
- Lærer vindlesning
- Unlocker nye maps

### Level 6-10: Ekspert
- Presis rifle med balistikk-computer
- Fullt utstyr
- Alle maps unlocked
- Fokus på perfeksjon og høyest score

## 🎨 Spillmodus

### Single Player
- Hver spiller har egen **historie**
- Egne **skuddpar** (shots taken)
- Egne **observasjoner**
- Egen **progresjon**
- Egen **utstyr-samling**

### Ingen Teams
- Fokus på individuell progresjon
- Leaderboards (valgfritt)

## 💾 Datamodell (Supabase)

### Delt med Aware-appen
- Bruker samme **Supabase-instans**
- Samme **authentication**
- ÉN bruker fungerer i både Aware og Game

### Game-spesifikke Tabeller

```sql
-- Player profile
CREATE TABLE game_player (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Weapons owned
CREATE TABLE game_weapons (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES game_player,
  weapon_type TEXT,
  purchased_at TIMESTAMP
);

-- Equipment owned
CREATE TABLE game_equipment (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES game_player,
  equipment_type TEXT,
  purchased_at TIMESTAMP
);

-- Game rounds (sessions)
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES game_player,
  map_id TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  points_earned INTEGER,
  shots_taken INTEGER,
  shots_hit INTEGER,
  distance_covered FLOAT
);

-- Shots taken
CREATE TABLE game_shots (
  id UUID PRIMARY KEY,
  round_id UUID REFERENCES game_rounds,
  weapon_id UUID REFERENCES game_weapons,
  ammo_type TEXT,
  distance FLOAT,
  estimated_distance FLOAT,
  hit BOOLEAN,
  hit_location TEXT,
  points_earned INTEGER,
  timestamp TIMESTAMP
);

-- Observations
CREATE TABLE game_observations (
  id UUID PRIMARY KEY,
  round_id UUID REFERENCES game_rounds,
  bird_type TEXT,
  lat FLOAT,
  lng FLOAT,
  timestamp TIMESTAMP
);
```

## 🛠️ Teknisk Stack

### Frontend
- **Next.js 15** (samme som Aware)
- **React 19**
- **TypeScript**
- **Leaflet** (for kart-visning, men med mocka data)
- **Tailwind CSS**

### Backend
- **Supabase** (delt med Aware)
- **PostgreSQL** (game-tables)
- **Edge Functions** (game-logikk)

### Game Engine
- **Custom TypeScript game engine**
- Komponenter:
  - Balistikk-kalkulator
  - Terreng-motor
  - Fugl-AI (spawning, spooking)
  - LOS-beregninger (med lokale høydedata)
  - Vekt/hastighet-system
  - Poeng-kalkulator

## 🗺️ Kart og Levels

### Level Design
```typescript
interface GameLevel {
  id: string;
  name: string;
  description: string;
  unlockRequirement: number; // poeng/level nødvendig
  size: { width: number; height: number }; // meter
  
  // Terreng-data (mocka)
  terrain: TerrainTile[][]; // Grid av terreng-tiles
  elevationData: number[][]; // Høydedata for LOS
  
  // Fugl-konfigurasjon
  birdSpawnRates: {
    orrfugl: number;
    tiur: number;
    // ... andre fugletyper
  };
}

interface TerrainTile {
  x: number;
  y: number;
  type: TerrainType;
  elevation: number;
  bonitet?: number;
}

type TerrainType = 
  | 'skog'
  | 'myr'
  | 'fugleskog_bra'
  | 'orrfugl_habitat'
  | 'tiur_habitat'
  | 'hogst'
  | 'vei'
  | 'bekk'
  | 'fjell';
```

### Starter Level
```typescript
const LEVEL_1: GameLevel = {
  id: 'intro_forest',
  name: 'Nybegynner-skogen',
  description: 'Et moderat skogområde for å lære grunnleggende',
  unlockRequirement: 0,
  size: { width: 2000, height: 2000 }, // 2x2 km
  // ... terreng-data genereres eller lastes
};
```

## 🎯 MVP (Minimum Viable Product)

### Fase 1: Grunnleggende
- ✅ Ett level/map
- ✅ Ett startvåpen
- ✅ Grunnleggende bevegelse
- ✅ Enkel skyte-mekanikk
- ✅ Basis poeng-system
- ✅ Fugl spawning og spooking

### Fase 2: Utvidelse
- ✅ Flere våpen og ammunisjon
- ✅ Utstyr-butikk
- ✅ Avansert balistikk
- ✅ Vind-system
- ✅ Detaljert poeng-beregning

### Fase 3: Polering
- ✅ Flere levels
- ✅ Leaderboards
- ✅ Achievements
- ✅ Tutorial
- ✅ Sound effects

## 📝 Kontekst fra Aware-appen

### Relevante Konsepter som kan Adapteres
1. **LOS (Line of Sight) beregninger**
   - Bruker høydedata
   - Beregner siktlinjer
   - → Kan brukes i spillet for å se om fugl er synlig

2. **Offline-kart funksjonalitet**
   - Tile-basert system
   - Caching
   - → Spillets maps kan bruke lignende tile-system

3. **Tracking og Points**
   - Aware har tracks, shots, observations
   - → Spillet har samme konsepter, men i game-kontekst

4. **Settings og Konfigurasjon**
   - Aware har omfattende settings
   - → Spillet trenger liknende (kontroller, grafikk, lyd)

### MÅ IKKE Gjenbruke
- ❌ Ekte kart-integrasjoner (Kartverket, Google, etc.)
- ❌ Ekte GPS-tracking
- ❌ Team-funksjonalitet
- ❌ Kompleks hunting area management

## 🎮 UI/UX Skisser

### Hovedskjerm (Game Hub)
```
+----------------------------------+
|  [Logo] Cold Bore Toppjakt      |
|  [Player] Level 5 | 1250 pts    |
+----------------------------------+
|                                  |
|     KART-VISNING                 |
|     (Leaflet med mocka data)     |
|     - Spillerposisjon            |
|     - Fugl (hvis observert)      |
|     - Terreng-farger             |
|                                  |
+----------------------------------+
| [Bevegelse] [Observere] [Skyting]|
+----------------------------------+
```

### Skyte-Skjerm
```
+----------------------------------+
|  Avstand: [____] m (Estimat)     |
|  Vind: ≤5 m/s fra NØ             |
|  Vindjustering: [____]           |
|                                  |
|       [KIKKERT-VISNING]          |
|       Fugl i sikte               |
|       [Retikkel]                 |
|                                  |
|  [Våpen: .22LR] [Ammo: Subsonic] |
|  [SKYT]                          |
+----------------------------------+
```

### Butikk
```
+----------------------------------+
|  UTSTYR-BUTIKK                   |
|  Dine poeng: 1250                |
+----------------------------------+
| Våpen:                           |
| [ ] .22LR Upgraded - 500p        |
| [ ] 12ga Pump - 800p             |
|                                  |
| Utstyr:                          |
| [ ] Avstandsmåler - 300p         |
| [ ] Balistikk-comp - 600p        |
+----------------------------------+
```

## 🔄 Utviklingsfaser

### 1. Setup (1 dag)
- [ ] Nytt GitHub repo
- [ ] Next.js prosjekt
- [ ] Supabase connection
- [ ] Basic routing

### 2. Core Game Engine (1 uke)
- [ ] Terreng-system
- [ ] Bevegelse-logikk
- [ ] LOS-beregninger
- [ ] Fugl-spawning

### 3. Våpen & Skyting (1 uke)
- [ ] Våpen-system
- [ ] Ammunisjon-typer
- [ ] Skyte-mekanikk
- [ ] Balistikk-beregninger

### 4. Progresjon (3 dager)
- [ ] Poeng-system
- [ ] Butikk
- [ ] Database-integrasjon

### 5. UI/Polish (1 uke)
- [ ] Kart-visning
- [ ] Skyte-interface
- [ ] Animasjoner
- [ ] Sound

## 📚 Referanser og Inspirasjon

### Gameplay
- "The Lost Dutchman Mine" - Exploration og resource management
- "The Lost Patrol" - Taktisk bevegelse og beslutninger
- "DayZ" - Realisme og overlevelse
- "Hunt: Showdown" - Lyd og stealth-mekanikk

### Jakt-Realisme
- Ballistic calculators (Applied Ballistics, Strelok)
- Hunting simulators (theHunter: Call of the Wild)
- Real jakt-erfaring og best practices

## 🎯 Suksess-Kriterier

### Spillbarhet
- ✅ Intuitiv kontroller
- ✅ Tydelig feedback
- ✅ Balansert vanskelighetsgrad
- ✅ Meningsfull progresjon

### Realisme
- ✅ Realistisk balistikk
- ✅ Troverdig fugl-adferd
- ✅ Etisk jakt-perspektiv
- ✅ Logiske konsekvenser

### Teknisk
- ✅ Smooth performance
- ✅ Mobile-friendly (responsive)
- ✅ Offline-kapabilitet (som Aware)
- ✅ Pålitelig data-lagring

---

**Dokument opprettet:** 2026-07-19  
**Sist oppdatert:** 2026-07-22  
**Versjon:** 1.2 — startkapital (VIP/Neppe), dV/dT + vind ≤5 m/s, clickErrorPercent, Kestrel/Lapua/camcorder/nerv, kryssref til STAMINA_AND_SHAKE

**Kontakt:** Tomas Henningsen  
**Prosjekt:** Cold Bore Toppjakt - The Game  
**Relatert:** Aware hunting app · [`STAMINA_AND_SHAKE.md`](./STAMINA_AND_SHAKE.md)

> **Vedlikehold:** Når du utvider tall (MOA, v0, BC, damageFactor, vekter, priser, dV/dT, vindtak) eller nye produkter — oppdater både katalogkode *og* denne seksjonen hvis regelen endres. Tall kan leve i kode; **regler og intensjon** skal stå her.
