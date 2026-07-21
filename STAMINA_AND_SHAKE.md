# Stamina, shake, verditap og krysspåvirkning

Teknisk referanse for hvordan systemene er koblet i koden **i dag**.
Tall og formler er hentet fra kildekoden — ikke designønsker.

Høy-nivå spillfilosofi: se [`GAME_DESIGN.md`](./GAME_DESIGN.md).

---

## Innhold

1. [Fatigue vs stamina](#1-to-lag-fatigue-vs-stamina)
2. [BODY](#2-body-fysisk-fatigue)
3. [MIND](#3-mind-mental-fatigue)
4. [Stamina-drivere: terreng, pace, tid, mat, hvile, kit-vekt](#4-stamina-drivere)
5. [Våpen-shake](#5-våpen-shake-poa-wobble)
6. [Verditap på fugl (treffpunkt × ammo)](#6-verditap-på-fugl-treffpunkt--ammo)
7. [Koblingskart](#7-koblingskart)
8. [Gaps](#8-gaps--definert-men-ikke-koblet)
9. [Fil-kart](#9-fil-kart)
10. [Tunables](#10-hurtig-tunables)

---

## 1. To lag: fatigue vs stamina

| Lag | Navn i kode | 0 | 1 |
|-----|-------------|---|---|
| **Intern state** | `mentalFatigue` / `physicalFatigue` | uthvilt | utkjørt |
| **HUD / bars** | `mentalStamina` / `physicalStamina` | tom | full (god form) |

```
stamina = clamp(1 − fatigue)     // 0…1
```

- State eies av `HuntMapView` (`useState(0)` for begge).
- Bars (`HuntStaminaBars`) og tekst (`Mental X% · Fysisk Y%`) viser **gjenstående stamina**.
- Skytemotoren (`HuntShootView` → `precision.ts`) får **fatigue** (1 = sliten).

**Designer-konsekvens:** «−20 % mind» = `mentalFatigue += 0.2` (baren synker 20 prosentpoeng).

---

## 2. BODY (fysisk fatigue)

### Hva øker fatigue (implementert)

| Kilde | Formel |
|-------|--------|
| Gå (per rute i path) | `physicalStrain × 0.045 × effort` |

### Hva senker fatigue (implementert)

| Handling | Δ fatigue | Spilltid |
|----------|-----------|----------|
| Rest 10 min | `−0.12` | 10 min |
| Spise | `−(staminaGain/10) × 0.35` | 5 min |
| Tvungen hvile (slutt) | **settes til `0.15`** | 60 min |
| Camp over natten | `−0.35` | til neste 08:00 |

### Hva BODY påvirker

| Effekt | Status |
|--------|--------|
| Tvungen hvile når `≥ 1` | ✅ |
| Våpen-shake (`×0.55` penalty) | ✅ jakt-skudd |
| Spotting-sannsynlighet | ❌ formel finnes, kalles ikke |
| Gangtid / flush / trigger-delay | ❌ |
| Kit-vekt | ❌ ikke wired inn i fatigue |

---

## 3. MIND (mental fatigue)

### Hva øker fatigue (implementert)

| Kilde | Formel / verdi |
|-------|----------------|
| Gå (per rute) | `mentalStrain × 0.035 × effort` |
| Spot ferdig (øyne) | `+0.015 × mentalStrain × max(1, lookMin)` |
| Spot / overgang til Aware (binos/thermal) | `+0.02 × mentalStrain × max(1, lookMin)` |
| Fugl borte for godt (2. spook) | `+0.2` (`GONE_BIRD_MENTAL_HIT`) |

Første flush (fugl flytter): **ingen** mind-straff.  
Andre flush (`gone`): demotivering + flukt-tekst 5 s.

### Hva senker fatigue (implementert)

| Handling | Δ fatigue |
|----------|-----------|
| Rest 10 min | `−0.15` |
| Spise | `−(staminaGain/10) × 0.2` |
| Tvungen hvile (slutt) | `−0.25` |
| Camp over natten | `−0.2` |

### Hva MIND påvirker

| Effekt | Status |
|--------|--------|
| Våpen-shake (`×0.40` penalty) | ✅ jakt-skudd |
| Spotting-sannsynlighet | ❌ ikke wired |
| Soft-lock ved 0 % | ❌ (kun BODY tvinger pause) |
| Fokus-vindu (F) | ❌ uavhengig |

---

## 4. Stamina-drivere

Dette er «hvordan du blir sliten / restituerer» — terreng, tempo, klokke, mat, hvile og (planlagt) kit-vekt.

### 4.1 Terreng (effort) — ✅ wired

Kilde: `src/lib/hunt/travel.ts`  
Kart `midtnorge1`: rute-grid A–F × 1–7 med effort **1–5**. Andre kart: default effort **3**.

```
baseMinutes(effort) = 10 + ((effort − 1) / 4) × 20
                    // effort 1 → 10 min, effort 5 → 30 min @ speed 1
travelMinutes       = round(baseMinutes / pace.speed)
celle               = 500 m
```

Fatigue per celle du **går inn i**:

```
Δmental   = mentalStrain   × 0.035 × effort
Δphysical = physicalStrain × 0.045 × effort
```

**Tyngre terreng = mer tid + mer stamina-tap** (begge skalert med effort).

### 4.2 Pace — ✅ wired (strain + tid + flush)

| Pace | Speed | Spotting* | Flush P | Mental strain | Physical strain |
|------|-------|-----------|---------|---------------|-----------------|
| Extreme caution | 0.3 | 0.95 | **0** | 1.0 | 0.1 |
| Caution | 0.5 | 0.75 | 0.2 | 0.8 | 0.2 |
| Normal | 0.7 | 0.6 | 0.5 | 0.5 | 0.5 |
| Speedy | 1.0 | 0.2 | **1.0** | 0.1 | 1.0 |

\* `spottingProbability` = UI-label only.

Trade-off i praksis:

- **Forsiktig** → tregere, mer MIND-slitasje, nesten ingen flush, lite BODY-slitasje.
- **Speedy** → raskt, lite MIND, hard BODY, alltid flush.

Fatigue påvirker **ikke** gangtid tilbake.

### 4.3 Tid / klokke — ✅ delvis wired

| Konstant | Verdi | Effekt på stamina / handling |
|----------|-------|------------------------------|
| Jaktdag start | 08:00 | klokke reset |
| Skuddlys slutt | 17:00 | spot/skudd stengt; gå krever hodelykt |
| Spot-handling | ~reell look-tid | øker **MIND** (se §3) |
| Eat / rest | 5 / 10 min | restituerer + brukerker klokke |
| Forced rest | 60 min | se §4.5 |
| Overnight camp | til neste 08:00 | stor restore; **spiser alle carcasses** |

Klokka alene øker **ikke** fatigue kontinuerlig (ingen «passiv tretthet per time»).  
Mørke multipliserer spotting-formel med `×0.05`, men den formelen **kalles ikke** i spill-loop.

### 4.4 Mat — ✅ wired

Kilde: `food/spec.ts` + katalog + `HuntMapView` eat.

```
effective = 0  hvis staminaGain≤0 ELLER (requiresBoil og mangler stove+fuel)
         = staminaGain ellers

restore = effective / 10
physicalFatigue −= restore × 0.35
mentalFatigue   −= restore × 0.2
klokke          += 5 min
```

| Item | `staminaGain` | Krever koking | Eks. ΔBODY / ΔMIND (fatigue) |
|------|---------------|---------------|------------------------------|
| Real turmat | 9 | ja | −0.315 / −0.18 |
| Polarbrød | 5 | nei | −0.175 / −0.10 |
| Rema brød | 4 | nei | −0.140 / −0.08 |
| Baguette / boller | 3 | nei | −0.105 / −0.06 |
| MSR / IsoPro | 0 | — | kun kokeutstyr |

Real uten kokeutstyr = **0 restore** (du bruker 5 min, men ingen stamina).

### 4.5 Hvile — ✅ wired

**Frivillig rest (10 min):**

```
mentalFatigue   −= 0.15
physicalFatigue −= 0.12
```

**Tvungen hvile (BODY = 0 %):**

Trigges når `physicalFatigue ≥ 1`. Etter 60 min:

```
physicalFatigue = 0.15      // ikke helt frisk
mentalFatigue  −= 0.25
klokke         += 60
```

**Camp overnight** (stranded uten hodelykt / valgt camp):

```
physicalFatigue −= 0.35
mentalFatigue   −= 0.2
alle carcasses forbrukes (spist / mistet i leir)
klokke → neste 08:00
```

### 4.6 Kit-vekt — ❌ ikke wired til stamina (kun display)

Disse finnes i data/UI, men **påvirker ikke** `fatigueFromStep` eller `travelMinutesForCell`:

| Felt | Fil | Hva det *skulle* gjøre (design-kommentar) | Faktisk |
|------|-----|-------------------------------------------|---------|
| Sum `weightGrams` i kit | `HomeBase` | tyngre pack → mer fatigue / tregere | kun vist |
| `carry.carryComfort` | `carry/spec.ts` | lavere felt-vekt | kun i **top speed km/h**-UI |
| `misc.enduranceGrams` | `misc/spec.ts` | `felt ≈ weight − endurance` (termos) | kun shop-label |
| `camo.stamina` / `terrainSpeed` | `camo/spec.ts` | utholdenhet / fart i terreng | kun label |
| `computeKitTopSpeedKmh` | `kit/speed.ts` | | **HomeBase-display only** |

Placeholder top-speed (ikke brukt i jakt-path):

```
feltKg = (totalGrams/1000) × (1.05 − carryComfort×0.04)
kmh    = 5.5 × (0.55 + 0.7×ski.maxSpeed/10) × loadRelief × widthHelp / weightDrag
```

**Det kit-vekt *gjør* i gameplay i dag:**

- Demper-gram ×2 → **weapon calm** (mindre shake), ikke fatigue.
- Camo `birdSpot` → Aware nerve (fugl skremmes raskere/sakter), ikke stamina.

---

## 5. Våpen-shake (POA wobble)

Kilde: `src/lib/range/precision.ts`  
Runtime: `HuntShootView` (med fatigue) · `ShootingRange` (uten).

```
amp ∝ 1 / effectiveCalm

effectiveCalm =
    weaponCalm          // bipod + demper
  × focusMult           // F / pust
  × fatigueCalmFactor   // BODY + MIND (kun jakt)
```

### Gear calm

```
calm = 1
hvis bipod i kit:
  calm *= 3
  calm *= (0.85 + bipod.weaponCalm × 0.03)   // Score 1–10
hvis demper:
  calmMass = weightGrams × 2
  calm *= 1 + calmMass / 4000
```

Rifle-/kit-totalvekt er **ikke** i calm.

### Fokus (F)

| Konstant | Verdi |
|----------|-------|
| Rent vindu | 8000 ms → calm ×3 |
| Etter 8 s fortsatt hold | calm ×0.65 (verre enn idle) |

### Fatigue → calm

```
(1 − physicalFatigue × 0.55) × (1 − mentalFatigue × 0.40)
gulv = 0.25
```

| Tilstand | Faktor |
|----------|--------|
| Fresh | 1.00 |
| BODY tom | 0.45 |
| MIND tom | 0.60 |
| Begge tomme | 0.27 |

### Amplitude

```
amp_mm = (18 / max(0.35, calm)) × (distanceM / 100)
```

```
POA = aimMm + wobbleMm
```

Trigger-delay 0–1000 ms: **ikke** fatigue-skalert.

---

## 6. Verditap på fugl (treffpunkt × ammo)

Kjeden: **treffsone → kill/ettersøk → kjøttødeleggelse → Meat Market-pris**.

Kilder: `src/lib/hunt/shoot.ts`, `src/lib/hunt/carcass.ts`, `src/lib/ammo/spec.ts`.

### 6.1 Treffsone → skuddresultat

| Sone | Geometri | Resultat |
|------|----------|----------|
| **instant** (grønn) | Ø 66 mm | alltid `instant_kill` |
| **vital** (rød ring utenfor grønn) | Ø 114 mm | `vital_kill` **eller** `ettersok` |
| **body** | ellipse rundt kropp | alltid `ettersok` |
| **none** | utenfor | `miss` |

Vital-ring clean-kill-sjanse (ammo-forgiveness):

```
P(clean) = 0.1 + damageFactor × 0.9
```

| Typisk ammo | `damageFactor` | P(clean) i rød ring |
|-------------|----------------|---------------------|
| Match OTM / FMJ | ~0.18–0.28 | ~0.26–0.35 |
| Controlled SP | ~0.55–0.70 | ~0.60–0.73 |
| Aggressive SP | ~0.72–0.85 | ~0.75–0.87 |

**Poenget:** Lav `damageFactor` = pent kjøtt, men krever bedre treffpunkt (oftere ettersøk i rød). Høy = mer tilgivende kill, mer ruin.

### 6.2 Kjøttødeleggelse (`meatRuin`)

```
zoneBase       = { instant: 0.14, vital: 0.48, body: 0.82, none: 1 }
ammoFactor     = 0.28 + 0.72 × damageFactor
velocityNorm   = clamp(impactVelocityMps / 900)
velocityFactor = 0.5 + 0.5 × velocityNorm

meatRuin = clamp(zoneBase × ammoFactor × velocityFactor)   // 0 = pent, 1 = ødelagt
```

`impactVelocityMps` = terminalhastighet fra ballistikk ved skuddavstand (ikke v0).

**Eksempler (forenklet, v ≈ 700 m/s → velocityFactor ≈ 0.89):**

| Sone | FMJ dF=0.20 | SP dF=0.75 |
|------|-------------|------------|
| instant | ~0.05 | ~0.10 |
| vital | ~0.18 | ~0.35 |
| body | ~0.31 | ~0.59 |

(Nøyaktige tall: `zoneBase × (0.28+0.72×dF) × velocityFactor`.)

### 6.3 Markedspris (NOK)

Vekt samples skjev-gauss per art; pris låses ved harvest.

| Art | Vekt min / median / max | Pris min–maks |
|-----|-------------------------|---------------|
| Tiur | 3.5 / 4.1 / 5.5 kg | 1000–5500 kr |
| Orrhane | 0.8 / 1.3 / 2.0 kg | 500–2000 kr |

```
weightNorm = (weight − min) / (max − min)
quality    = 1 − meatRuin
score      = weightNorm^0.85 × quality^1.15

marketValueNok = round(minNok + (maxNok − minNok) × score)
```

Valuation lagrer også:

- `lostToWeightNok` — tap vs maks kun pga. lett fugl (perfekt kjøtt)
- `lostToMeatNok` — tap vs vekt-perfekt bud kun pga. kjøttskade
- `lostVsMaxNok` — totalt under teoretisk maks (tung + pent)

`ZONE_HIT_SCORE` (instant 10 / vital 5.5 / body 2) er **UI-smak**, ikke i prisformelen.

Meat Market selger låst `marketValueNok` — ingen pruting.

### 6.4 Kryss til stamina / shake

| Kobling | Status |
|---------|--------|
| Dårlig treffpunkt → mer ettersøk / ruin → lavere kr | ✅ |
| Ammo choice → kill-forgiveness + ruin | ✅ |
| Sliten jeger → mer shake → verre treffpunkt → verditap | ✅ **indirekte** (via POA) |
| Carcass-vekt i sekk → ekstra fatigue | ❌ ikke wired |
| Overnight camp | ✅ **konsumerer alle carcasses** |

---

## 7. Koblingskart

```
  kit weight / endurance / camo.stamina     (DISPLAY ONLY)
              │
              ✗ ikke til fatigue/travel
              │
  terreng effort ──┬── travel minutes
                   └── ΔBODY / ΔMIND per rute
  pace ────────────┬── speed (tid)
                   ├── strain (fatigue)
                   └── flush probability
  klokke ──────────┬── skuddlys / hodelykt
                   ├── eat/rest/forced/camp duration
                   └── spotting×0.05 i mørke* (ikke kalt)
  mat / hvile ─────┴── senker fatigue

              ▼
     physicalFatigue / mentalFatigue
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
 forced   fatigueCalm  spotting*
  rest      Factor      (ikke wired)
              │
   gearCalm × focus(F) × fatigue
              ▼
         wobble → POA → treffsone
              ▼
     damageFactor × zone × v_impact
              ▼
         meatRuin → marketValueNok
```

---

## 8. Gaps — definert, men ikke koblet

1. **Kit-vekt / felt weight / enduranceGrams / camo.stamina** → fatigue eller travel-tid.
2. **`computeKitTopSpeedKmh`** → kun HomeBase-UI, ikke path-minutter.
3. **`effectiveSpottingProbability`** og **`pace.spottingProbability`**.
4. **Riflevekt** i weapon calm (kun demper forward-mass + bipod).
5. **Bipod deploy/fold** (`deploySpeed` unused).
6. **Carcass i sekk** → ingen ekstra pack-fatigue.
7. **Trigger delay / aim speed** uavhengig av fatigue.
8. **MIND = 0** → ingen soft-lock.
9. **Passiv tretthet over tid** (klokke uten handling).
10. **Shooting range** har ingen BODY/MIND (med vilje).

---

## 9. Fil-kart

| Tema | Fil |
|------|-----|
| Fatigue state, eat/rest/camp, pass til skudd | `src/components/hunt/HuntMapView.tsx` |
| BODY/MIND bars | `src/components/hunt/HuntStaminaBars.tsx` |
| Travel, effort, fatigueFromStep, spotting-formel | `src/lib/hunt/travel.ts` |
| Pace | `src/lib/hunt/pace.ts` |
| Spook / gone mind-hit | `src/lib/hunt/birds.ts` |
| Mat effective stamina | `src/lib/food/spec.ts` |
| Calm / wobble / fatigue→shake | `src/lib/range/precision.ts` |
| Treffsone / vital kill-roll | `src/lib/hunt/shoot.ts` |
| meatRuin / marketValue | `src/lib/hunt/carcass.ts` |
| damageFactor-filosofi | `src/lib/ammo/spec.ts` |
| Kit top-speed (display) | `src/lib/kit/speed.ts` |
| Carry / endurance (display) | `src/lib/carry/spec.ts`, `src/lib/misc/spec.ts` |
| Meat Market UI | `src/components/town/MeatMarket.tsx` |

---

## 10. Hurtig-tunables

| Følelse | Hvor |
|---------|------|
| BODY ødelegger hold | `PHYSICAL_FATIGUE_CALM_PENALTY` (0.55) |
| MIND ødelegger hold | `MENTAL_FATIGUE_CALM_PENALTY` (0.40) |
| Fatigue per rute | `0.045` / `0.035` × effort × strain |
| Pace-balanse | `HUNT_PACES` |
| Rest / eat restore | hardkodet i `HuntMapView` |
| Gone-bird demotivering | `GONE_BIRD_MENTAL_HIT` (0.2) |
| Sone-ruin | `ZONE_RUIN_BASE` (0.14 / 0.48 / 0.82) |
| Ammo → ruin | `ammoFactor = 0.28 + 0.72×damageFactor` |
| Ammo → vital forgiveness | `P = 0.1 + damageFactor×0.9` |
| Hastighet → ruin | `impactVelocity / 900` |
| Pris-kurve | `weightNorm^0.85 × quality^1.15` |
| Art min/maks kr | `SPECIES_MARKET` |
| Baseline wobble | `BASE_WOBBLE_MM` (18) |

---

*Sist synket mot kode: fatigue↔shake, gone-bird mind-hit, carcass verditap (zone×ammo×velocity), kit-vekt ennå ikke i stamina.*
