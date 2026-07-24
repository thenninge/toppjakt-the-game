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
    title: "BODY & MIND",
    bullets: [
      "Lav BODY → våpenet rister mer (mindre calm). Tom BODY → tvungen hvile.",
      "Lav MIND → større spredning på skudd (opptil 2× MOA-envelope når MIND er tom).",
      "Gåing, spotting og bom/flush tærer på stamina. Hvile, mat og leir over natten bygger den opp igjen.",
      "Miss på jakt: −10 % MIND. Fugl som skremmes bort for godt: −15 % MIND.",
      "Avslutt ettersøk uten funn: ekstra MIND-straff (−30 %).",
    ],
  },
  {
    title: "Ballistikk & vær",
    bullets: [
      "Kestrel Elite måler lokal vind → beste løsning inkl. ekte sidevind.",
      "LRF med Applied Ballistics / BDX uten Kestrel bruker ofte prognose og «full-value» vind (antar 90°) — større feil.",
      "LRF med onboard ballistics (BDX) + Kestrel Elite → auto-dial av tårnene på jakt.",
      "Habrok (termisk binokular med LRF) + Kestrel Elite → også auto-dial.",
      "Budsjett-LRF uten ballistikk auto-dialer ikke — du må sette hold selv (Enviro / DOPE).",
      "Vind i spillet er 0–5 m/s. Retning: vind fra venstre blåser kula til høyre → hold LEFT.",
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
      "Shotlog: lagrede serier fra banen (gruppe MOA/mm, POI, zero-state). Brukes til å lære ammo/affinity.",
      "DOPE-kort: dine feltklikks (elev/wind) per avstand. Dial fra DOPE på jakt når du ikke har auto-dial.",
      "Home → Shotlog/Dope: se og rediger kortet. Range «Mål serie» / lagre DOPE fyller listene.",
    ],
  },
  {
    title: "Kikkert, LRF & Habrok",
    bullets: [
      "LRF har feilmargin (±%). Dyrere glass treffer nærmere sann avstand.",
      "Habrok: B/T åpner Fusion. WH/BH/Outline/Fusion på verktøylinjen. OFF = dagoptikk og sparer batteri.",
      "Tomt Habrok-batteri → kun dagoptikk (ingen termisk).",
      "I Habrok termisk/outline: grønn fugl synlig over ~10×, gul over ~15×. Fusion viser alle, outline følger zoom.",
    ],
  },
  {
    title: "Track, skuddpar & ettersøk",
    bullets: [
      "Etter treff: Track-modus i Aware — legg søkespor på kartet, deretter «Utfør ettersøk». Tid koster (min per punkt + meter).",
      "Uten Triggercam og uten oppsatt camcorder: skuddpar autofylles ikke — still retning og avstand selv. Fluktcue er grov (±~30° σ) og snapper til 8-kompass (N, NØ, …). Ingen landingsavstand.",
      "Triggercam i kit: after-action replay av treffpunkt; autofyll skuddpar med ±~30 m støy; fluktretning ±~10° σ (finere enn nakent øye).",
      "Camcorder: må settes opp før skudd (+20 % nervøsitet). Gir beste cue — autofyll ±~10 m, fluktretning ±~5° σ, pluss observert landingsavstand (±~12 %).",
      "Camcorder slår Triggercam når begge er aktive. Bare Triggercam uten camcorder: middels nøyaktighet.",
      "Ettersøk: følg fluktretningen fra der fuglen satt. Spor nær sann landing + riktig retning → høy funnsjanse. Feil vei / for langt unna → ofte «ikke funnet» — legg nytt spor.",
      "Vital/instant kill i treet: «Hent ved treet» (enklere enn såret ettersøk). Såret fugl krever sporarbeid.",
      "Avbryt lukker Track midlertidig. «Avslutt ettersøk» gir opp fuglen (MIND-hit).",
    ],
  },
  {
    title: "På jakt — tempo & fugl",
    bullets: [
      "Pace styrer tid, flush-risiko og (ved extreme caution) sjanse for auto-spot.",
      "Extreme caution / caution: færre flush, mer tid. Rush: raskere, mer stress på fugl.",
      "Første spook flytter fuglen. Andre spook → borte fra jakten.",
      "Subsonic + demper = stille skudd — fugler flusher ikke av skuddet.",
      "Aware: nervøsitet bygger med nærhet/bevegelse. Camcorder-oppsett gjør dem mer nervøse.",
      "Study på kartet for å inspisere celle uten å gå dit med en gang.",
    ],
  },
  {
    title: "Skyting på banen & jakt",
    bullets: [
      "F (fokus) på range/jakt: roligere sikte og setter et «slipp trigger her»-merke på avtrekksbaren — slipp Space på merket for best presisjon. Hold for lenge → fatigue til du slipper F og trykker på nytt.",
      "Rifle + ammo + stock + affinity bestemmer gruppestørrelse. Test ammo på range — butikken skjuler ammo-MOA.",
      "Pipe-slitasje: skudd pr rifle telles i Shotlog. Etter 300 skudd stiger rifle-MOA mot 2× ved 400 — bytt pipe hos CB Customs (eller kjøp nytt våpen).",
      "Scope click-error: budsjettglass kan «lyve» litt på klikk; premium (NF/Kahles/…) er eksakt.",
      "Jakt-skudd: POA (wobble/avtrekk) + MOA-spredning + vind + zero + LRF-feil + temp/dV/dT stables — ikke én magisk treffsjanse.",
    ],
  },
  {
    title: "Kit, by & progresjon",
    bullets: [
      "Bygg kit hjemme: rifle, scope, ammo, optikk, camo, mat. Uten jaktkort (inatur.no) kommer du ikke ut.",
      "Camo: lav birdSpot = fuglen bygger nerve saktere (snø- vs barmark-tall). Suit veier tyngst; buff/lue/hansker/støvler demper silhuetten. Feil mønster (snøkamo på bar mark) straffer deg. Custom camo hos CB hjelper litt mer.",
      "Gange på kartet: pace + celle-effort styrer minutter. Kit «top speed» (Home) påvirkes av ski vs støvler, ski-max/flyt/bredde, sekk-vekt og carry comfort — skistøvler kreves hvis du har ski i kit.",
      "Chestrig/sekk: opticsAccess og quickRelease er ment for raskere kikkert-/rifle-deploy (mindre faffe nær fugl) — ikke aktivt knyttet til nerve ennå.",
      "Google-innlogging synker save til skyen (samme konto som Aware) — last inn eller overskriv ved konflikt.",
      "Meat Market selger fugl for cash. XXL selger greier. Lensmannen gir lisens før rifle-kjøp.",
      "Rulles kebab: snakk med folk for å låse opp nye jaktterreng. Blakk? Ta oppvasken for en slant.",
      "Skytebanen: MOA-konkurranse — tjen penger som konkurranseskytter (i tillegg til oppvask hos Rulles).",
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
