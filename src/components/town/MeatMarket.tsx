"use client";

import { useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import {
  computeCarcassValuation,
  formatFactor,
  formatMarketKr,
  formatPct01,
  formatWeightKg,
  meatQualityLabelNb,
  speciesLabelNb,
  valuationDragNotes,
  zoneLabelNb,
  type CarcassValuation,
  type GameCarcass,
} from "@/lib/hunt/carcass";

type MeatMarketProps = {
  playerName: string;
  nickname: string;
  balance: number;
  carcasses: GameCarcass[];
  onSell: (carcassIds: string[]) => void;
  onLeave: () => void;
};

type Step =
  | "welcome"
  | "menu"
  | "browse"
  | "detail"
  | "sold"
  | "empty"
  | "haggle";

/**
 * Meat Market — sell harvested birds for XXL money.
 * Dialogue tone matches Lensmannen (dry municipal satire).
 */
export function MeatMarket({
  playerName,
  nickname,
  balance,
  carcasses,
  onSell,
  onLeave,
}: MeatMarketProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSaleNok, setLastSaleNok] = useState(0);
  const [lastSaleLabel, setLastSaleLabel] = useState("");

  const selected = useMemo(
    () => carcasses.find((c) => c.id === selectedId) ?? null,
    [carcasses, selectedId],
  );

  const selectedValuation: CarcassValuation | null = useMemo(() => {
    if (!selected) return null;
    return (
      selected.valuation ??
      computeCarcassValuation({
        species: selected.species,
        weightKg: selected.weightKg,
        zone: selected.zone,
        damageFactor: selected.damageFactor,
        impactVelocityMps: selected.impactVelocityMps,
      })
    );
  }, [selected]);

  const totalOffer = useMemo(
    () => carcasses.reduce((s, c) => s + c.marketValueNok, 0),
    [carcasses],
  );

  function sellOne(c: GameCarcass) {
    if (c.species === "ugle") {
      setLastSaleNok(0);
      setLastSaleLabel("ugle");
      setStep("haggle");
      return;
    }
    setLastSaleNok(c.marketValueNok);
    setLastSaleLabel(
      `${speciesLabelNb(c.species)} ${formatWeightKg(c.weightKg)}`,
    );
    onSell([c.id]);
    setSelectedId(null);
    setStep("sold");
  }

  function sellAll() {
    const sellable = carcasses.filter((c) => c.species !== "ugle");
    if (sellable.length === 0) {
      if (carcasses.some((c) => c.species === "ugle")) {
        setLastSaleLabel("ugle");
        setStep("haggle");
        return;
      }
      setStep("empty");
      return;
    }
    const offer = sellable.reduce((s, c) => s + c.marketValueNok, 0);
    setLastSaleNok(offer);
    setLastSaleLabel(
      sellable.length === 1 ? `1 fugl` : `${sellable.length} fugler`,
    );
    onSell(sellable.map((c) => c.id));
    setSelectedId(null);
    setStep("sold");
  }

  return (
    <div className="intro-dialogue sheriff-office meat-market">
      <LocationNav onBackToTown={onLeave} />

      {step === "welcome" ? (
        <>
          <h2 className="intro-title">Meat Market</h2>
          <p className="intro-line">
            En luker seg opp bak disken. Mannen tørker hendene i et forkle som
            har sett mer blod enn en ettersøkshund.
          </p>
          <p className="intro-line">
            «{playerName} &quot;{nickname}&quot;? Jeg er Vebjørn. Vi tar imot
            lovlig felt vilt. Vi veier. Vi ser på kulen. Vi betaler. Ingen
            vipps-gebyr for tårer.»
          </p>
          <p className="intro-hint-balance">
            Konto: {balance.toLocaleString("nb-NO")} kr · Til salgs:{" "}
            {carcasses.length} fugl
            {carcasses.length === 1 ? "" : "er"}
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() =>
              setStep(carcasses.length === 0 ? "empty" : "menu")
            }
          >
            Trekk kølapp (viltluke)
          </button>
        </>
      ) : null}

      {step === "empty" ? (
        <>
          <h2 className="intro-title">Tom bil</h2>
          <p className="intro-line">
            Vebjørn kikker ut bak deg. «Ingen fjær. Ingen lukt. Enten har du
            bomma, eller så har du allerede solgt til svogeren. Kom tilbake når
            du har noe i fryseren.»
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("welcome")}
          >
            Tilbake
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

      {step === "menu" ? (
        <>
          <h2 className="intro-title">Viltluke</h2>
          <p className="intro-line">
            «Hva skal det være? Vi har åpent til kjøleskapet sier stopp.»
          </p>
          <p className="intro-hint-balance">
            Samlet tilbud nå: {formatMarketKr(totalOffer)}
          </p>
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => setStep("browse")}
              >
                <span className="town-location-name">Se viltet mitt</span>
                <span className="town-location-blurb">
                  Vekt, treffsone, kjøttskade og bud.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={sellAll}
              >
                <span className="town-location-name">Selg alt</span>
                <span className="town-location-blurb">
                  {formatMarketKr(totalOffer)} — ferdig snakka.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => setStep("haggle")}
              >
                <span className="town-location-name">Prute</span>
                <span className="town-location-blurb">
                  Alle prøver. Nesten ingen lykkes.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={onLeave}
              >
                <span className="town-location-name">Gå</span>
                <span className="town-location-blurb">
                  XXL venter. Viltet også — i bilen.
                </span>
              </button>
            </li>
          </ul>
        </>
      ) : null}

      {step === "haggle" ? (
        <>
          <h2 className="intro-title">
            {lastSaleLabel === "ugle" ? "Ugle?" : "Pruting"}
          </h2>
          {lastSaleLabel === "ugle" ? (
            <>
              <p className="intro-line">
                Vebjørn ser på posen. Så på deg. Så på posen. «Nei. Absolutt
                nei. Det der er ikke vilt. Det er en… situasjon. Jeg kjøper ikke
                ugler. Ikke i dag. Ikke i morgen. Ikke om Stortinget ber.»
              </p>
              <p className="intro-line">
                «Ta den med deg. Helst ut av bygget. Og ikke si at du var her.»
              </p>
            </>
          ) : (
            <>
              <p className="intro-line">
                Vebjørn smiler uten tenner foran. «Prisene er satt etter vekt og
                hvor mye kule som har gjort kjøttet til saus. Grønn sone betaler
                bedre enn rød. Rød bedre enn «jeg traff vingen og håpte».»
              </p>
              <p className="intro-line">
                «Du kan prute. Jeg kan late som jeg hører. Budet står.»
              </p>
            </>
          )}
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("menu")}
          >
            Greit. Vis menyen igjen
          </button>
        </>
      ) : null}

      {step === "browse" ? (
        <>
          <h2 className="intro-title">Ditt vilt</h2>
          {carcasses.length === 0 ? (
            <p className="intro-line">Ingenting igjen. Bilens baksete er tomt.</p>
          ) : (
            <ul className="town-list">
              {carcasses.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="town-location"
                    onClick={() => {
                      setSelectedId(c.id);
                      setStep("detail");
                    }}
                  >
                    <span className="town-location-name">
                      {speciesLabelNb(c.species)} · {formatWeightKg(c.weightKg)}
                    </span>
                    <span className="town-location-blurb">
                      {meatQualityLabelNb(c.meatRuin)} · {zoneLabelNb(c.zone)} ·{" "}
                      {formatMarketKr(c.marketValueNok)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setStep(carcasses.length ? "menu" : "empty")}
          >
            Tilbake
          </button>
        </>
      ) : null}

      {step === "detail" && selected && selectedValuation ? (
        <>
          <h2 className="intro-title">
            {speciesLabelNb(selected.species)} ({selected.birdId})
          </h2>
          <p className="intro-line">
            Vebjørn løfter fuglen, sjekker vekta, prikker i treffet og mumler
            tall. «Her er hele regnestykket — så du skjønner hvorfor budet ikke
            er maks.»
          </p>

          <h3 className="meat-market-subhead">Fugl</h3>
          <ul className="meat-market-facts">
            <li>
              <strong>Art / ID:</strong> {speciesLabelNb(selected.species)} ·{" "}
              {selected.birdId}
            </li>
            <li>
              <strong>Vekt:</strong> {formatWeightKg(selected.weightKg)}{" "}
              <span className="meat-market-muted">
                (vekt-score {formatPct01(selectedValuation.weightNorm)})
              </span>
            </li>
            <li>
              <strong>Avstand:</strong> {selected.distanceM} m
            </li>
          </ul>

          <h3 className="meat-market-subhead">Skudd</h3>
          <ul className="meat-market-facts">
            <li>
              <strong>Treffsone:</strong> {zoneLabelNb(selected.zone)}
            </li>
            <li>
              <strong>Treff-score:</strong>{" "}
              {formatFactor(selectedValuation.hitScore, 1)}/10{" "}
              <span className="meat-market-muted">
                (sonefaktor {formatFactor(selectedValuation.zoneBase)})
              </span>
            </li>
            <li>
              <strong>Kule:</strong>{" "}
              {selected.ammoLabel ?? "Ukjent ammunisjon"}
              {selected.caliber ? ` · ${selected.caliber}` : ""}
              {selected.projectileType ? ` · ${selected.projectileType}` : ""}
            </li>
            <li>
              <strong>damageFactor:</strong>{" "}
              {formatFactor(selectedValuation.damageFactor)}{" "}
              <span className="meat-market-muted">
                → kulefaktor {formatFactor(selectedValuation.ammoFactor)}
              </span>
            </li>
            <li>
              <strong>v₀ / anslag:</strong>{" "}
              {selected.v0 != null ? `${selected.v0} → ` : ""}
              {selected.impactVelocityMps} m/s{" "}
              <span className="meat-market-muted">
                (norm {formatPct01(selectedValuation.velocityNorm)} →
                hastighetsfaktor{" "}
                {formatFactor(selectedValuation.velocityFactor)})
              </span>
            </li>
          </ul>

          <h3 className="meat-market-subhead">Kjøtt & bud</h3>
          <ul className="meat-market-facts">
            <li>
              <strong>Kjøttskade:</strong>{" "}
              {meatQualityLabelNb(selectedValuation.meatRuin)} ·{" "}
              {formatPct01(selectedValuation.meatRuin)}{" "}
              <span className="meat-market-muted">
                = sone × kule × hastighet
              </span>
            </li>
            <li>
              <strong>Kvalitet:</strong>{" "}
              {formatPct01(selectedValuation.quality)}{" "}
              <span className="meat-market-muted">(1 − skade)</span>
            </li>
            <li>
              <strong>Verdi-score:</strong>{" "}
              {formatPct01(selectedValuation.score)}{" "}
              <span className="meat-market-muted">
                = vekt^0,85 × kvalitet^1,15
              </span>
            </li>
            <li>
              <strong>Skala:</strong>{" "}
              {formatMarketKr(selectedValuation.minNok)} –{" "}
              {formatMarketKr(selectedValuation.maxNok)}
            </li>
            <li>
              <strong>Bud:</strong>{" "}
              {formatMarketKr(selectedValuation.marketValueNok)}
            </li>
          </ul>

          <h3 className="meat-market-subhead">Hva trakk ned</h3>
          <ul className="meat-market-facts meat-market-drags">
            <li>
              <strong>Mot maks:</strong> −
              {formatMarketKr(selectedValuation.lostVsMaxNok)}
            </li>
            <li>
              <strong>Pga. vekt:</strong> −
              {formatMarketKr(selectedValuation.lostToWeightNok)}
            </li>
            <li>
              <strong>Pga. kjøtt:</strong> −
              {formatMarketKr(selectedValuation.lostToMeatNok)}
            </li>
            {valuationDragNotes(selectedValuation).map((note) => (
              <li key={note} className="meat-market-note">
                {note}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="intro-button"
            onClick={() => sellOne(selected)}
          >
            Selg for {formatMarketKr(selected.marketValueNok)}
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => {
              setSelectedId(null);
              setStep("browse");
            }}
          >
            Behold denne
          </button>
        </>
      ) : null}

      {step === "sold" ? (
        <>
          <h2 className="intro-title">Handel</h2>
          <p className="intro-line">
            Stempel i boka. Pengene på konto. «{lastSaleLabel} —{" "}
            {formatMarketKr(lastSaleNok)}. Bruk dem fornuftig. Eller i XXL.
            Samme sak.»
          </p>
          <p className="intro-hint-balance">
            Ny saldo: {balance.toLocaleString("nb-NO")} kr · Igjen i bilen:{" "}
            {carcasses.length}
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() =>
              setStep(carcasses.length === 0 ? "empty" : "menu")
            }
          >
            {carcasses.length === 0 ? "Ferdig for i dag" : "Mer vilt?"}
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
