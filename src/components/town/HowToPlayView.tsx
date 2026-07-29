"use client";

import { LocationNav } from "@/components/town/LocationNav";

type HowToPlayViewProps = {
  onLeave: () => void;
};

type GuideSection = {
  title: string;
  bullets: string[];
};

const SECTIONS: GuideSection[] = [
  {
    title: "Realism (Low / Medium / High)",
    bullets: [
      "Hunter Status → ☰ → Realism.",
      "Low: halv MOA-spredning, tårn justeres automatisk etter LRF-avstand og vind, skuddmarkør lagres i Aware ved skudd uten Triggercam/camcorder, dobbelt så lett ettersøk, halv bird-nerve.",
      "Medium = klassiske HUD-tårn. High = tårn på kikkerttuben (elev/wind/parallax/illum).",
      "High: cant finnes alltid når funksjonen er på — boblelevel måler og viser vinkelen; uten boble må du rette på feeling (Q/E). Parallax-DOF og retikkel-belysning.",
      "F (fokus) og avtrekksbar (Space) finnes på begge nivåer når de er påslått — roligere sikte og «slipp på merket» for best pull.",
      "Noen premium-kikkerter har Focus zoom (hold F): glass + retikkel forstørrer sammen — mil/hash/drop forblir riktig.",
      "Music: Off i statuslinjen muter også SFX (skudd, hylse, turret-klikk). Volum for musikk/SFX justeres under ☰ → Avansert.",
    ],
  },
  {
    title: "BODY & MIND",
    bullets: [
      "Lav BODY → våpenet rister mer (mindre calm). Tom BODY → tvungen hvile.",
      "Lav MIND → større spredning på skudd (opptil 2× MOA-envelope når MIND er tom).",
      "Gåing, spotting og bom/flush tærer på stamina. Hvile, mat og leir over natten bygger den opp igjen.",
      "Mat: noen Real-turmat krever PocketRocket + gassboks (kokeklar) for full BODY/MIND-effekt — ellers 0.",
      "Miss på jakt: −10 % MIND. Fugl som skremmes bort for godt: −15 % MIND.",
      "Avslutt ettersøk uten funn: ekstra MIND-straff (−30 %).",
    ],
  },
  {
    title: "Ballistikk & vær",
    bullets: [
      "Kestrel Elite måler lokal vind → beste løsning inkl. ekte sidevind.",
      "Clas Ohlson vindmåler: fane «Vindmåler» viser bare ustabil vindstyrke fra der det blåser — ingen sidevindvinkel. Windage må du regne i Enviro/App.",
      "LRF med Applied Ballistics / BDX uten Kestrel bruker ofte prognose og «full-value» vind (antar 90°) — større feil.",
      "LRF med onboard ballistics (BDX) + Kestrel Elite → nøyaktig fasit (Kestrel/LRF); du skrur tårnene selv.",
      "Habrok (termisk binokular med LRF) + Kestrel Elite → samme fasit; manuell dial.",
      "Budsjett-LRF uten ballistikk: sett hold selv (Enviro / DOPE / øyemål).",
      "Vind i spillet er 0–5 m/s. Retning: vind fra venstre blåser kula til høyre → hold LEFT.",
      "CB Real / Real data: egne målte drop-tabeller per våpen — kan styre simulasjon når «bruk Real data» er på.",
    ],
  },
  {
    title: "Zero, dV/dT, DOPE & Shotlog",
    bullets: [
      "Zero: hver rifle×scope×ammo-kombo må lagres på skytebanen («Lagre zero») før du kan dra på jakt.",
      "Bytt eller fjern kikkert/rifle → zero nullstilles for den komboen. Du må skyte inn på nytt.",
      "dV/dT: katalog-v0 er ved 15 °C. Kaldere krut → lavere v0 → mer drop. Centerfire ≈ 1 m/s per °C; .22 LR ≈ 2 m/s per °C.",
      "Enviro/Kestrel bruker temp til både lufttetthet og powder-temp (dV/dT). Sett riktig °C — default i appen er 0 °C uten Kestrel-prefill.",
      "Chrono i kit logger v0 (+ temp) i shotlog — nyttig for å se dV/dT i praksis.",
      "Ammo-affinity: første serie på en rifle×ammo-kombo ruller en skjult faktor. Butikken skjuler ammo-MOA — test på banen.",
      "Shotlog: lagrede serier fra banen (gruppe MOA/mm, POI, zero-state). Brukes til å lære ammo/affinity.",
      "DOPE-kort: dine feltklikks (elev/wind) per avstand. Dial fra DOPE på jakt for rask hold.",
      "Home → Shotlog/Dope: se og rediger kortet. Range «Mål serie» / lagre DOPE fyller listene.",
    ],
  },
  {
    title: "Kikkert, LRF & Habrok",
    bullets: [
      "Spotting: øyne ser til ~230 m. Kikkert/termisk ser lengre. Habrok termisk/outline: grønn fugl over ~10×, gul over ~15×.",
      "LRF har feilmargin (±%). Dyrere glass treffer nærmere sann avstand.",
      "Habrok: B/T åpner Fusion. WH/BH/Outline/Fusion på verktøylinjen. OFF = dagoptikk og sparer batteri.",
      "Tomt Habrok-batteri → kun dagoptikk (ingen termisk).",
      "I Habrok termisk/outline: Fusion viser alle, outline følger zoom.",
      "FFP-retikkel skalerer med zoom — 1 mil på glass ≈ distanceM mm på fugl/skive (når kalibrert). Hold-over matcher dial.",
      "Triggercam kan begrense zoom-området på noen kikkerter (katalog) — VIP/admin kan ha fri zoom.",
    ],
  },
  {
    title: "Track, skuddmarkør & ettersøk",
    bullets: [
      "Etter treff: Track-modus i Aware — legg søkespor på kartet, deretter «Utfør ettersøk». Tid: 3 min/punkt + meter.",
      "Uten Triggercam og uten oppsatt camcorder: skuddmarkør autofylles ikke — still retning og avstand selv (unntak: Swarovski EL Range lagrer skuddmarkør eksakt automatisk). Fluktcue er grov (±~30° σ) og snapper til 8-kompass (N, NØ, …). Ingen landingsavstand.",
      "Swarovski EL Range i kit: skuddmarkør lagres eksakt automatisk. Ettersøk-fluktcue krever fortsatt Triggercam eller camcorder.",
      "Triggercam i kit: after-action replay av treffpunkt; autofyll skuddmarkør med ±~30 m støy; fluktretning ±~10° σ (finere enn nakent øye).",
      "Camcorder: Sony-kamera + stativ i kit, sett opp før skudd. Biltema stål: +20 % nervøsitet. Manfrotto karbon: +15 %. Triggerstick Gen3: +13 % (raskere oppsett). Gir beste cue alene — autofyll ±~10 m, fluktretning ±~5° σ, pluss observert landingsavstand (±~12 %).",
      "Camcorder + Triggercam: dobbelt så nøyaktige ettersøkshint — halv feil i vinkel (±~2.5° σ) og avstand (landingscue ±~6 %, skuddmarkør ±~5 m).",
      "Bare Triggercam uten camcorder: middels nøyaktighet (±~10° / ±~30 m).",
      "Ettersøk: følg fluktretningen fra der fuglen satt. Spor nær sann landing + riktig retning → høy funnsjanse. Feil vei / for langt unna → ofte «ikke funnet» — legg nytt spor.",
      "Treff: instant/vital i treet → «Hent ved treet». Instant kill under 200 m: hent ved treet uten cam/lagret skuddmarkør. Såret fugl krever sporarbeid. Ren bom = ingen Track.",
      "Track viser bare treff med høsting (cam/EL Range/lagret skuddmarkør etter skudd, eller nærhold-instant). Planlagt skuddmarkør uten skudd er bare kartmarkering.",
      "«Til spotting» / gå til annen rute uten funn: −30 % mind (fuglen kan ligge til senere). «Gi opp søket» mister fuglen (+ samme MIND-hit).",
      "Gun / sekk|tofot / Kestrel kan følge med til spotting; camcorder, chrono og Triggercam resettes ved Til spotting.",
    ],
  },
  {
    title: "På jakt — tempo & fugl",
    bullets: [
      "Pace styrer tid, flush-risiko og (ved extreme caution) sjanse for auto-spot.",
      "Extreme caution / caution: færre flush, mer tid. Rush: raskere, mer stress på fugl.",
      "Habitat: tiur på myrer og furuhøyder; orre i frøfurufelt, beite og bjørk.",
      "Første spook flytter fuglen. Andre spook → borte fra jakten.",
      "Subsonic (.22 LR / .300 BLK) + demper = stille skudd — 0 % sjanse for at fugler flusher av skuddet.",
      "Supersonisk ammo + demper: flush-sjanse styres av demperens dB (0 dB → 100 %, −40 dB → 65 %). Dyrere cans demper mer.",
      "Aware: nervøsitet bygger med nærhet/bevegelse. Camcorder-oppsett gjør dem mer nervøse.",
      "Deploy / Mount gun: våpen i sekk eller på stativ før skudd — QR og rest koster; redeploy refunderer Deploy-QR.",
      "Jaktdag: skuddlys til ~17:00. Uten hodelykt: vær ved bilen før mørket — ellers camp ute. Fortsatt ute etter midnatt → mister fangsten og må overnatte (jaktkort).",
      "Study på kartet for å inspisere celle uten å gå dit med en gang.",
      "I felt høres skudd uten hylse-klink (range har after-shot/hylse).",
    ],
  },
  {
    title: "Skyting på banen & jakt",
    bullets: [
      "F (fokus) på range/jakt: roligere sikte og setter et «slipp trigger her»-merke på avtrekksbaren — slipp Space på merket for best presisjon. Hold for lenge → fatigue til du slipper F og trykker på nytt.",
      "Rifle + ammo + stock + affinity bestemmer gruppestørrelse. Test ammo på range — butikken skjuler ammo-MOA.",
      "Bipod / tofot: øker weapon calm (mindre wobble) — ikke det samme som katalog-MOA, men treffer lettere.",
      "CB Bagrider (Customs): +15 % calm og −0.05 MOA — bakre bag-rider for mer stabilt anlegg.",
      "Flere CB-jobber: action trueing (−0.04 MOA), cheek riser (+8 % calm), barrel crown (−0.03 MOA).",
      "MOA-kikkert (f.eks. Nightforce MOA): 0.25 MOA/klikk — Enviro/Kestrel/tårn viser MOA i stedet for mil.",
      "Pipe-slitasje: skudd pr rifle telles i Shotlog. CrMo/carbon/fabrikk: 300 skudd frisk, stainless: 200 — deretter stiger rifle-MOA mot 2× over +100 skudd. Bytt pipe hos CB Customs (eller kjøp nytt våpen).",
      "Scope click-error: budsjettglass kan «lyve» litt på klikk; premium (NF/Kahles/…) er eksakt.",
      "Jakt-skudd: POA (wobble/avtrekk) + MOA-spredning + vind + zero + LRF-feil + temp/dV/dT stables — ikke én magisk treffsjanse.",
      "Tracking-test på banen: 10 mm-rute = 0.1 mil @ 100 m — øv dial vs hash. Zeroing-skiver kan være «lesbare» (ikke 1:1 vinkel) for innskyting.",
    ],
  },
  {
    title: "Kit, by & progresjon",
    bullets: [
      "Jegerprøven: nye jegere må bestå 18 av 20 før byen åpnes (fugl, patron, kamuflasje). Du får bevis med navn og nickname.",
      "Bygg kit hjemme: rifle, scope, ammo, optikk, camo, mat. Uten jaktkort (inatur.no) kommer du ikke ut.",
      "Camo/klær: sneak % reduserer bird nerve (summeres). Speed % endrer gangtid. Focus % øker caution-prespot og demper Mind-drain. Recovery % øker Body i rest/pause. Ghillie eksklusiv mot jakke+bukse. Arc'teryx LEAF = VIP. Snøkamo/M05 kommer i sesong.",
      "Gange på kartet: pace + celle-effort styrer minutter. Kit «top speed» (Home) påvirkes av ski vs støvler, ski-max/flyt/bredde, sekk-vekt og carry comfort — skistøvler kreves hvis du har ski i kit.",
      "Chestrig: QR ved kikkert opp (10 = 0 %, 1 = +10 % bird-nerve). Comfort = andel av binovekt på Body (10 = 0 %, 1 = 100 %). Sekk: QR ved Klar til skudd (samme skala). Sekk-comfort: 10 = 25 % lettere felt last (20 kg → 15 kg), 1 = full vekt. Du må ha sekk i kit for å jakte.",
      "Google-innlogging synker save til skyen (samme konto som Aware) — last inn eller overskriv ved konflikt. Sky-sync skjer etter intro-kortet.",
      "Meat Market selger fugl for cash. XXL selger greier. Lensmannen gir lisens før rifle-kjøp.",
      "Rulles kebab: snakk med folk for å låse opp nye jaktterreng. Blakk? Ta oppvasken for en slant.",
      "Skytebanen: MOA-konkurranse og Field Impact — tjen penger som konkurranseskytter (i tillegg til oppvask hos Rulles).",
    ],
  },
];

export function HowToPlayView({ onLeave }: HowToPlayViewProps) {
  return (
    <div className="how-to-play">
      <LocationNav
        onBackToTown={onLeave}
        hint="Kort oversikt over det som faktisk påvirker treff, flush og kit."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">How to play</p>
        <p className="shop-row-note">
          Ikke en tutorial — en sjekkliste over avhengigheter. Tall kan tunes,
          men logikken under er det du spiller mot.
        </p>
      </header>

      <div className="how-to-play-sections">
        {SECTIONS.map((section) => (
          <section key={section.title} className="how-to-play-section">
            <h2 className="how-to-play-heading">{section.title}</h2>
            <ul className="how-to-play-list">
              {section.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
