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

#### Våpenattributter
```typescript
interface Weapon {
  name: string;
  caliber: string; // f.eks. ".22 LR", "12ga"
  baseAccuracy: number; // 0-100
  weight: number; // kg
  effectiveRange: number; // meter
  recoil: number; // påvirker oppfølgingsskudd
  cost: number; // pris i poeng
}
```

#### Ammunisjonstyper
```typescript
interface Ammunition {
  type: string; // "blyhagl", "stålhagl", "subsonic", etc.
  accuracy: number; // modifikator
  damage: number; // kjøttskade (lavere = bedre)
  penetration: number; // for ulike fugletyper
  cost: number; // pris per skudd
}
```

#### Våpen + Ammunisjon = Treffsannsynlighet
```
baseTrefffSannsynlighet = weapon.baseAccuracy * ammo.accuracy * distance_modifier
```

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
- 🛒 Bedre våpen
- 🛒 Bedre ammunisjon
- 🛒 Utstyr:
  - Avstandsmåler (laser rangefinder)
  - Bedre kikkert
  - Balistikk-computer
  - Vær-stasjon
  - Lettere utstyr (karbon-stock)

### 4. Bevegelsessystem

#### Hastighet vs Forsiktighet Trade-off
```
Rask bevegelse → Større område dekket → Mer spooking
Langsom bevegelse → Mindre område → Bedre observasjon
```

#### Vekt-system
```typescript
interface Player {
  baseSpeed: number; // meter per tidsenhet
  equipment: Equipment[];
  totalWeight: number; // sum av alt utstyr
  
  // Effektiv hastighet
  actualSpeed = baseSpeed * (1 - (totalWeight - 10) * 0.05);
}
```

**Eksempel:**
- Basis hastighet: 100 m/time
- Lett rifle (3kg) + minimal utstyr = 5kg total → 125% hastighet
- Tung rifle (5kg) + fullt utstyr = 15kg total → 75% hastighet

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
|  Vind: 5 m/s fra NØ              |
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
**Sist oppdatert:** 2026-07-19
**Versjon:** 1.0

**Kontakt:** Tomas Henningsen
**Prosjekt:** Cold Bore Toppjakt - The Game
**Relatert:** Aware hunting app
