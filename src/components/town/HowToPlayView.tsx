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
    title: "Kikkert, LRF & Habrok",
    bullets: [
      "LRF har feilmargin (±%). Dyrere glass treffer nærmere sann avstand.",
      "Habrok: B/T åpner Fusion. WH/BH/Outline/Fusion på verktøylinjen. OFF = dagoptikk og sparer batteri.",
      "Tomt Habrok-batteri → kun dagoptikk (ingen termisk).",
      "I Habrok termisk/outline: grønn fugl synlig over ~10×, gul over ~15×. Fusion viser alle, outline følger zoom.",
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
    title: "Skyting & zero",
    bullets: [
      "Zero på skytebanen (CBA) før jakt — feil zero = systematisk bom.",
      "DOPE-kortet er dine klikk. Bruk det (eller Kestrel/auto-dial) før skudd.",
      "F (fokus) på range/jakt: midlertidig roligere sikte — deretter fatigue til du slipper og trykker på nytt.",
      "Rifle + ammo + stock + affinity bestemmer gruppestørrelse. Test ammo på range — butikken skjuler ammo-MOA.",
      "Scope click-error: budsjettglass kan «lyve» litt på klikk; premium (NF/Kahles/…) er eksakt.",
    ],
  },
  {
    title: "Kit, by & progresjon",
    bullets: [
      "Bygg kit hjemme: rifle, scope, ammo, optikk, camo, mat. Uten jaktkort (inatur.no) kommer du ikke ut.",
      "Camo med lav birdSpot = vanskeligere å oppdage for fuglen; terreng-buff hjelper gange.",
      "Google-innlogging synker save til skyen (samme konto som Aware) — last inn eller overskriv ved konflikt.",
      "Meat Market selger fugl for cash. XXL selger greier. Lensmannen gir lisens før rifle-kjøp.",
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
