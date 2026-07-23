"use client";

import { useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import {
  formatBirdRating,
  getHuntingTerrain,
  type HuntingTerrainId,
} from "@/lib/hunt/terrain";
import {
  checkAudience,
  RULLES_AUDIENCE,
} from "@/lib/rulles/audience";

type HunterRésumé = {
  tiur: number;
  orrhaner: number;
  lifetimeTiur: number;
  lifetimeOrrhaner: number;
  maxRange: number;
};

type RullesBarProps = {
  playerName: string;
  nickname: string;
  balance: number;
  unlockedTerrainIds: string[];
  hunter: HunterRésumé;
  onSpend: (amountNok: number) => boolean;
  /** Earn cash (e.g. dishwashing). */
  onEarn: (amountNok: number) => void;
  onUnlockTerrain: (terrainId: HuntingTerrainId) => void;
  onLeave: () => void;
};

type Step =
  | "welcome"
  | "floor"
  | "rulle"
  | "kari"
  | "kristian"
  | "lovenskiold"
  | "enrique"
  | "result";

type DrinkId = "ol" | "pizza" | "champagne" | "kebab" | "whisky";

const DRINKS: Record<
  DrinkId,
  { label: string; priceNok: number; blurb: string }
> = {
  ol: {
    label: "Pils (halvliter)",
    priceNok: 129,
    blurb: "Klassisk påspandering. Fungerer på 80 % av Norge.",
  },
  pizza: {
    label: "Rulles Grandiosa-fin (deles)",
    priceNok: 289,
    blurb: "Fine dining ifølge menyen. Ost ifølge fysikken.",
  },
  kebab: {
    label: "Kebab i pita + dressing-valg",
    priceNok: 189,
    blurb: "Sterk valuta blant folk som faktisk eier jord.",
  },
  champagne: {
    label: "Champagne «tilnærmet Moët»",
    priceNok: 1890,
    blurb: "Rulle sverger den er ekte. Korken lyver aldri. Nesten.",
  },
  whisky: {
    label: "Single malt (ukjent øy)",
    priceNok: 420,
    blurb: "Til dem som snakker om «tradisjon» før de snakker om pris.",
  },
};

function formatKr(n: number): string {
  return `${n.toLocaleString("nb-NO")} kr`;
}

function formatRange(m: number): string {
  return m > 0 ? `${m} m` : "—";
}

/** Dishwashing shift when the wallet is empty. */
const DISHWASH_PAY_NOK = 500;

/**
 * Rulles — kebab, pizza, bar & fine dining.
 * Snøvling + påspandering + hunt résumé → handshake-jaktterreng.
 */
export function RullesBar({
  playerName,
  nickname,
  balance,
  unlockedTerrainIds,
  hunter,
  onSpend,
  onEarn,
  onUnlockTerrain,
  onLeave,
}: RullesBarProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [status, setStatus] = useState("");
  const [kariRound, setKariRound] = useState(0);
  const [kristianTrust, setKristianTrust] = useState(0);
  const [loveCharm, setLoveCharm] = useState(0);

  const unlocked = useMemo(
    () => new Set(unlockedTerrainIds),
    [unlockedTerrainIds],
  );

  const kariGate = useMemo(
    () => checkAudience(hunter, RULLES_AUDIENCE.kari),
    [hunter],
  );
  const kristianGate = useMemo(
    () => checkAudience(hunter, RULLES_AUDIENCE.kristian),
    [hunter],
  );
  const loveGate = useMemo(
    () => checkAudience(hunter, RULLES_AUDIENCE.lovenskiold),
    [hunter],
  );

  const birdsTotal = hunter.lifetimeTiur + hunter.lifetimeOrrhaner;

  function buy(drink: DrinkId): boolean {
    const d = DRINKS[drink];
    if (balance < d.priceNok) {
      setStatus(
        `Rulle rister på hodet. «${formatKr(d.priceNok)}. Kontoen din er mer «kebab uten dressing».»`,
      );
      return false;
    }
    if (!onSpend(d.priceNok)) {
      setStatus("Betalingen feilet. Rulle later som han ikke så det.");
      return false;
    }
    return true;
  }

  function unlock(id: HuntingTerrainId, line: string) {
    if (unlocked.has(id)) {
      setStatus("Du har allerede håndtrykket. Ikke overspill det.");
      setStep("result");
      return;
    }
    onUnlockTerrain(id);
    const t = getHuntingTerrain(id);
    setStatus(
      `${line}${
        t
          ? ` «${t.name}» ligger nå på inatur (tiur ${formatBirdRating(t.tiurRating)}, orre ${formatBirdRating(t.orrhaneRating)}, ${formatKr(t.pricePerDayNok)}/dag).`
          : ""
      }`,
    );
    setStep("result");
  }

  return (
    <div className="intro-dialogue sheriff-office rulles-bar">
      <LocationNav onBackToTown={onLeave} />

      {step === "welcome" ? (
        <>
          <h2 className="intro-title">
            Rulles Kebab, Pizza, Bar &amp; Fine Dining
          </h2>
          <p className="intro-line">
            Neonet sier «FINE DINING». Lukta sier «løk og ambisjon». Inne sitter
            folk som eier skog — og som sjekker jaktlista di før de sier hei.
          </p>
          <p className="intro-line">
            Rulle vinker deg inn. «{playerName} &quot;{nickname}&quot;? Her blir
            man kjent med grunneiere. Det koster pils, pizza, og resultater. Ingen
            resultater? Da er du bare tørst.»
          </p>
          <p className="intro-hint-balance">
            Konto: {formatKr(balance)} · Lista (livstid): {hunter.lifetimeTiur}{" "}
            tiur / {hunter.lifetimeOrrhaner} orre ({birdsTotal} totalt) · Max
            range {formatRange(hunter.maxRange)}
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("floor")}
          >
            Gå inn blant bordene
          </button>
        </>
      ) : null}

      {step === "floor" ? (
        <>
          <h2 className="intro-title">Salongen</h2>
          <p className="intro-line">
            Rulle peker diskret. «Stubb vil se ti fugl og 250 m. Kristian Olav
            vil ha tjue fugl og 300 m. Løvenskiold? Tyve tiur, ti orre, og over
            400 m — ellers er du usynlig.»
          </p>
          {status ? <p className="shop-row-note">{status}</p> : null}
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setStatus("");
                  setStep("rulle");
                }}
              >
                <span className="town-location-name">Rulle (vert)</span>
                <span className="town-location-blurb">
                  Meny, råd, og «jeg kjenner en fyr»-energi.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setStatus("");
                  setStep("kari");
                }}
              >
                <span className="town-location-name">
                  Kari Stubb {unlocked.has("rulles-stubb-teig") ? "✓" : ""}
                  {!kariGate.ok ? " · låst" : ""}
                </span>
                <span className="town-location-blurb">
                  Krav: 10 fugl · 250 m max range
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setStatus("");
                  setStep("kristian");
                }}
              >
                <span className="town-location-name">
                  Kristian Olav{" "}
                  {unlocked.has("rulles-kristian-li") ? "✓" : ""}
                  {!kristianGate.ok ? " · låst" : ""}
                </span>
                <span className="town-location-blurb">
                  Krav: 20 fugl · 300 m max range
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setStatus("");
                  setStep("lovenskiold");
                }}
              >
                <span className="town-location-name">
                  Carl Otto Løvenskiold{" "}
                  {unlocked.has("rulles-lovenskiold") ? "✓" : ""}
                  {!loveGate.ok ? " · låst" : ""}
                </span>
                <span className="town-location-blurb">
                  Krav: 20 tiur · 10 orre · max range over 400 m
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setStatus("");
                  setStep("enrique");
                }}
              >
                <span className="town-location-name">Enrique (kjøkken)</span>
                <span className="town-location-blurb">
                  {balance < DISHWASH_PAY_NOK
                    ? "Pizza, hemmeligheter — og oppvask hvis du er blakk."
                    : "Pizza, hemmeligheter, og null jaktkort."}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={onLeave}
              >
                <span className="town-location-name">Ut i natta</span>
                <span className="town-location-blurb">
                  Før noen spør om «en runde til» du ikke ba om.
                </span>
              </button>
            </li>
          </ul>
        </>
      ) : null}

      {step === "rulle" ? (
        <>
          <h2 className="intro-title">Rulle</h2>
          <p className="intro-line">
            «Vi har kebab, pizza, bar, og fine dining. Fine dining er pizza med
            basilikum tegnet på med tusj. Men stemningen? Fem stjerner på
            Trustpilot skrevet av min fetter.»
          </p>
          <p className="intro-line">
            «Tips: Stubb tar kebab. Kristian Olav tar pils — men ikke for mange,
            da begynner han om EU. Løvenskiold tar bobler. Og alle tre sjekker
            lista di før de smiler.»
          </p>
          <ul className="town-list">
            {(Object.keys(DRINKS) as DrinkId[]).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="town-location"
                  onClick={() => {
                    if (!buy(id)) return;
                    setStatus(
                      `Du betaler ${formatKr(DRINKS[id].priceNok)} for ${DRINKS[id].label}. Rulle nikker som en FN-observatør.`,
                    );
                  }}
                >
                  <span className="town-location-name">
                    Bestill: {DRINKS[id].label}
                  </span>
                  <span className="town-location-blurb">
                    {formatKr(DRINKS[id].priceNok)} — {DRINKS[id].blurb}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {status ? <p className="shop-row-note">{status}</p> : null}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setStep("floor")}
          >
            Tilbake til salongen
          </button>
        </>
      ) : null}

      {step === "kari" && !kariGate.ok ? (
        <>
          <h2 className="intro-title">Kari Stubb — ikke ennå</h2>
          <p className="intro-line">
            Kari ser deg opp og ned. «Hyggelig. Men jeg åpner ikke teigen for
            turister med tom sekk. Kom tilbake når lista di sier innsats.»
          </p>
          <ul className="meat-market-facts">
            {kariGate.progress.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="shop-row-note">Mangler: {kariGate.missing.join(" · ")}</p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("floor")}
          >
            Tilbake — mer jakt først
          </button>
        </>
      ) : null}

      {step === "kari" && kariGate.ok ? (
        <>
          <h2 className="intro-title">Kari Stubb</h2>
          <p className="intro-line">
            Kari smiler med hele ansiktet. «Ti fugl og 250 meter? Da er du ikke
            bare her for stemninga. Jeg har en teig. Ikke Louvre. Men orrene
            synes den er fin.»
          </p>
          {unlocked.has("rulles-stubb-teig") ? (
            <p className="shop-row-note">
              Dere har allerede håndtrykk. Kari vinker deg videre mot Kristian
              Olav.
            </p>
          ) : null}
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  if (!buy("kebab")) return;
                  setKariRound((n) => n + 1);
                  setStatus(
                    "Kari tar en bit. «Dressing valg B. Du er ikke helt by. Bra.»",
                  );
                }}
              >
                <span className="town-location-name">
                  Spander kebab ({formatKr(DRINKS.kebab.priceNok)})
                </span>
                <span className="town-location-blurb">
                  Ærlig valuta. Hun husker dressingvalg.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setStatus(
                    "«Jeg er egentlig bare her for stemninga,» sier du. Kari ler. «Da er du på feil bord, men rett sted.»",
                  );
                }}
              >
                <span className="town-location-name">Snøvle mildt</span>
                <span className="town-location-blurb">
                  «Så fin teig du må ha… sikkert mye liv.»
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                disabled={unlocked.has("rulles-stubb-teig")}
                onClick={() => {
                  if (kariRound < 1) {
                    setStatus(
                      "Kari hever øyebrynet. «Først mat. Så jaktkort. Sånn er sivilisasjonen.»",
                    );
                    return;
                  }
                  unlock(
                    "rulles-stubb-teig",
                    "Kari tørker saus av hånda og strekker den fram. «Velkommen. Ikke skyt mot hytta.»",
                  );
                }}
              >
                <span className="town-location-name">Be om handshake</span>
                <span className="town-location-blurb">
                  Krever minst én kebab i magen hennes.
                </span>
              </button>
            </li>
          </ul>
          {status ? <p className="shop-row-note">{status}</p> : null}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setStep("floor")}
          >
            Tilbake
          </button>
        </>
      ) : null}

      {step === "kristian" && !kristianGate.ok ? (
        <>
          <h2 className="intro-title">Kristian Olav — ikke ennå</h2>
          <p className="intro-line">
            Han ser på støvlene dine. Så på deg. «Audiens? Når lista di viser
            tjue fugl og tre hundre meter. Ikke før. Jeg har poteter som krever
            mer respekt enn tomme historier.»
          </p>
          <ul className="meat-market-facts">
            {kristianGate.progress.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="shop-row-note">
            Mangler: {kristianGate.missing.join(" · ")}
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("floor")}
          >
            Tilbake — mer jakt først
          </button>
        </>
      ) : null}

      {step === "kristian" && kristianGate.ok ? (
        <>
          <h2 className="intro-title">Kristian Olav</h2>
          <p className="intro-line">
            Kristian Olav nikker mot lista. «Tjue fugl. Tre hundre meter. Da kan
            vi snakke. Byfolk kommer hit med kikkert til tjue tusen — jeg spør om
            du kan skille potet fra tiur.»
          </p>
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  if (!buy("ol")) return;
                  setKristianTrust((t) => t + 1);
                  setStatus(
                    "Kristian Olav drikker. «Pils er pils. Du er ikke verst — ennå.»",
                  );
                }}
              >
                <span className="town-location-name">
                  Spander pils ({formatKr(DRINKS.ol.priceNok)})
                </span>
                <span className="town-location-blurb">Trygg åpning.</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setKristianTrust((t) => t + 2);
                  setStatus(
                    "Han rynker panna, så nikker. «Endelig. En som ikke sier «habitat» på norsk.»",
                  );
                }}
              >
                <span className="town-location-name">Snøvle bonde-vennlig</span>
                <span className="town-location-blurb">
                  «Fine lier. Ser ut som skikkelig arbeid bak.»
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setKristianTrust((t) => Math.max(0, t - 2));
                  setStatus(
                    "Han setter glasset hardt. «EU-regler? Her? Ut. Nesten. Drikk ferdig først.»",
                  );
                }}
              >
                <span className="town-location-name">Feil snøvl: EU &amp; GPS</span>
                <span className="town-location-blurb">
                  «Med satellitt og direktiv blir jakta mer effektiv…»
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                disabled={unlocked.has("rulles-kristian-li")}
                onClick={() => {
                  if (kristianTrust < 2) {
                    setStatus(
                      "Kristian Olav rister. «Vi er ikke venner. Vi er… midlertidig tørste.»",
                    );
                    return;
                  }
                  unlock(
                    "rulles-kristian-li",
                    "Han kniper hånda di. «Lien er din noen dager. Tråkk utenom potetene, så overlever vennskapet.»",
                  );
                }}
              >
                <span className="town-location-name">Be om lien</span>
                <span className="town-location-blurb">
                  Trenger tillit (pils + rett snøvl).
                </span>
              </button>
            </li>
          </ul>
          <p className="shop-row-note">
            Tillit hos Kristian Olav: {kristianTrust}/2+
          </p>
          {status ? <p className="shop-row-note">{status}</p> : null}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setStep("floor")}
          >
            Tilbake
          </button>
        </>
      ) : null}

      {step === "lovenskiold" && !loveGate.ok ? (
        <>
          <h2 className="intro-title">Carl Otto Løvenskiold — usynlig</h2>
          <p className="intro-line">
            Han ser gjennom deg. «Tyve tiur. Ti orrhaner. Max range over fire
            hundre meter. Da finnes du. Før det er du… atmosfære.»
          </p>
          <ul className="meat-market-facts">
            {loveGate.progress.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="shop-row-note">Mangler: {loveGate.missing.join(" · ")}</p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("floor")}
          >
            Tilbake — mer jakt først
          </button>
        </>
      ) : null}

      {step === "lovenskiold" && loveGate.ok ? (
        <>
          <h2 className="intro-title">Carl Otto Løvenskiold</h2>
          <p className="intro-line">
            Han sitter som om stolen eier lokalet. «Tyve tiur. Ti orre. Over fire
            hundre meter. Da fortjener du å bli sett. Spørsmålet er om du klarer
            champagne uten å skjelve.»
          </p>
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  if (!buy("champagne")) return;
                  setLoveCharm((c) => c + 2);
                  setStatus(
                    "Carl Otto smiler med 14 % av munnen. «Akseptabelt. Korken lød… nesten fransk.»",
                  );
                }}
              >
                <span className="town-location-name">
                  Champagne ({formatKr(DRINKS.champagne.priceNok)})
                </span>
                <span className="town-location-blurb">
                  Påkrevd språk. Bobler eller bortvist.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  if (!buy("whisky")) return;
                  setLoveCharm((c) => c + 1);
                  setStatus(
                    "Han snurrer glasset. «Øy ukjent, men intensjonen… bemerkelsesverdig.»",
                  );
                }}
              >
                <span className="town-location-name">
                  Whisky ({formatKr(DRINKS.whisky.priceNok)})
                </span>
                <span className="town-location-blurb">
                  Bonuspoeng, ikke erstatning.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setLoveCharm((c) => c + 2);
                  setStatus(
                    "Carl Otto lener seg fram. «Endelig. Noen som forstår at skog er kultur, ikke «content».»",
                  );
                }}
              >
                <span className="town-location-name">Snøvle aristokratisk</span>
                <span className="town-location-blurb">
                  «En ære bare å sitte i nærheten av slik tradisjon…»
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setLoveCharm(0);
                  setStatus(
                    "Luften blir tynn. «Kebab? Ved mitt bord? Rulle — regningen. Og et forheng.»",
                  );
                }}
              >
                <span className="town-location-name">Feil: tilby kebab</span>
                <span className="town-location-blurb">
                  Sosialt selvmord i tre stavelser.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                disabled={unlocked.has("rulles-lovenskiold")}
                onClick={() => {
                  if (loveCharm < 4) {
                    setStatus(
                      "Han løfter et øyenbryn millimetervis. «Vi er ikke der. Enda. Mer champagne. Mer… deg, men bedre.»",
                    );
                    return;
                  }
                  unlock(
                    "rulles-lovenskiold",
                    "Carl Otto gir deg et håndtrykk som veier mer enn lisensen. «Finmarka åpnes. Mist ikke verdigheten — eller patronene.»",
                  );
                }}
              >
                <span className="town-location-name">Be om finmarka</span>
                <span className="town-location-blurb">
                  Charm ≥ 4 (champagne + snøvl). Dyrt jaktkort etterpå.
                </span>
              </button>
            </li>
          </ul>
          <p className="shop-row-note">Løvenskiold-charm: {loveCharm}/4</p>
          {status ? <p className="shop-row-note">{status}</p> : null}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setStep("floor")}
          >
            Tilbake (med eller uten verdighet)
          </button>
        </>
      ) : null}

      {step === "enrique" ? (
        <>
          <h2 className="intro-title">Enrique — kjøkkenet</h2>
          <p className="intro-line">
            Røyk, oregano, og en radio på portugisisk. «Jeg eier ingen skog. Jeg
            eier ovnen. Men jeg har sett Løvenskiold spise pizza med kniv og
            gaffel. Det sier mer enn jaktkortet.»
          </p>
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  if (!buy("pizza")) return;
                  setStatus(
                    "Enrique setter fram et stykke. «Tips: Carl Otto liker når du later som du ikke er sulten. Stubb liker når du er det.»",
                  );
                }}
              >
                <span className="town-location-name">
                  Kjøp pizza-tips ({formatKr(DRINKS.pizza.priceNok)})
                </span>
                <span className="town-location-blurb">
                  Ingen terreng — bare overlevelsesråd.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() =>
                  setStatus(
                    "Enrique hvisker: «Kristian Olav hater ordet habitat. Si «skog som funker» i stedet.»",
                  )
                }
              >
                <span className="town-location-name">Be om gratis tips</span>
                <span className="town-location-blurb">Han gir dem likevel.</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                disabled={balance >= DISHWASH_PAY_NOK}
                onClick={() => {
                  if (balance >= DISHWASH_PAY_NOK) {
                    setStatus(
                      "Enrique ser på hendene dine. «Du er ikke blakk nok. Kom tilbake når kontoen skriker.»",
                    );
                    return;
                  }
                  onEarn(DISHWASH_PAY_NOK);
                  setStatus(
                    `Du tar oppvasken i to timer. Enrique dytter ${formatKr(DISHWASH_PAY_NOK)} i lomma di. «Nå lukter du løk og muligheter. Ikke spill det bort på champagne.»`,
                  );
                }}
              >
                <span className="town-location-name">
                  Tilby å ta oppvasken (+{formatKr(DISHWASH_PAY_NOK)})
                </span>
                <span className="town-location-blurb">
                  {balance >= DISHWASH_PAY_NOK
                    ? "Bare når du er blakk (under 500 kr)."
                    : "Rulle nikker. Stablen vokser. Hendene dine også."}
                </span>
              </button>
            </li>
          </ul>
          {status ? <p className="shop-row-note">{status}</p> : null}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setStep("floor")}
          >
            Ut av kjøkkenet
          </button>
        </>
      ) : null}

      {step === "result" ? (
        <>
          <h2 className="intro-title">Handshake</h2>
          <p className="intro-line">{status}</p>
          <p className="intro-hint-balance">
            Book terrenget under Home → inatur.no når du er klar til å jakte.
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => {
              setStatus("");
              setStep("floor");
            }}
          >
            Flere bord
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onLeave}
          >
            Ut i byen
          </button>
        </>
      ) : null}
    </div>
  );
}
