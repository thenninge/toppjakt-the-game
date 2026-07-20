"use client";

import { FormEvent, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import {
  formatPermitFee,
  MAX_HUNTING_RIFLES,
  permitFeeForNextRifle,
} from "@/lib/player";

export type WeaponApplication = {
  brand: string;
  type: string;
  caliber: string;
};

export type SheriffFinishResult = {
  application: WeaponApplication;
  approved: boolean;
  fee: number;
};

type SheriffOfficeProps = {
  playerName: string;
  nickname: string;
  balance: number;
  /** How many hunting rifles the player already owns. */
  rifleCount: number;
  /** Total licenses (incl. gift) — used for cap. */
  licenseCount: number;
  /** Paid licenses only — fee ladder. */
  paidLicenseCount: number;
  /** Charge fee and optionally grant license. */
  onPayAndFinish: (result: SheriffFinishResult) => void;
  onLeave: () => void;
};

type Step =
  | "welcome"
  | "menu"
  | "dead-end"
  | "weapon-intro"
  | "weapon-form"
  | "thanks"
  | "closing"
  | "express"
  | "express-reply";

type WeaponForm = {
  brand: string;
  type: string;
  caliber: string;
  length: string;
  barrelLength: string;
  firingPinLength: string;
  stockLength: string;
  sightLength: string;
  cartridgeLength: string;
  auto: "nei" | "ja";
  registeredHunter: "ja" | "nei";
  safeNumber: string;
};

const EMPTY_FORM: WeaponForm = {
  brand: "",
  type: "",
  caliber: "",
  length: "",
  barrelLength: "",
  firingPinLength: "",
  stockLength: "",
  sightLength: "",
  cartridgeLength: "",
  auto: "nei",
  registeredHunter: "ja",
  safeNumber: "",
};

const DEAD_ENDS: Record<
  string,
  { title: string; lines: string[]; nextLabel: string }
> = {
  homebrew: {
    title: "Selvanmeldelse — hjemmebrenning",
    lines: [
      "Åja. Da tar vi deg inn for avhør. Vent litt… står det her at du allerede har betalt gebyr for «selvinnsikt»?",
      "Da er du fri til å gå hjem. Offisielt. Eller uoffisielt. Vi ser ikke. Vi hører heller ikke. Spesielt ikke pipelyder fra kjelleren.",
      "Trekk gjerne ny kølapp hvis du vil anmelde naboen for det samme. Det er populært på tirsdager.",
    ],
    nextLabel: "Gå hjem med verdigheten i behold",
  },
  chlamydia: {
    title: "Feil luke",
    lines: [
      "Eeeh. Det er Helsenorge, ikke Lensmannen. Vi deler ikke ut klamydiamedisin. Vi deler knapt ut kølapper som funker.",
      "Kølappen din er gyldig hos oss i 47 uker til. Du kan stå her og vente. På feil ting. Det er lov.",
      "Tip: neste gang, se etter skiltet med korset. Ikke det med våpenskapet.",
    ],
    nextLabel: "Trekke ny kølapp (bak i køen)",
  },
  cat: {
    title: "Kattesak",
    lines: [
      "Katter er ikke våpenpliktige under §3. Med mindre den er kammeret i 6,5 Creedmoor.",
      "Si til eksen at hen må trekke ny kølapp hos dyrevernnemnda. Vi tar bare elg, og noen ganger naboens drone.",
      "Du kan få en folder om «ansvarlig kattehold» hvis printeren vår noen gang får blekk igjen. Den har hatt «bestilt»-status siden 2019.",
    ],
    nextLabel: "Tilbake til menyen",
  },
};

function closingLines(feeLabel: string): Record<string, { lines: string[] }> {
  return {
    thanks: {
      lines: [
        "Ikkeno problem! Vi er her for å tjene dere borgere!",
        `Det blir ${feeLabel} det, vipps eller kort? Du får svar i Digipost om 45–55 uker. Gebyret dobler seg for hvert våpen (500, 1000, 2000…). Systemet elsker eksponentialfunksjoner.`,
      ],
    },
    taxes: {
      lines: [
        "Åh, konstruktivt! Det liker vi. Skattepengene dine går rett i systemet. Bokstavelig talt. Inn i databasen. Der blir de liggende. Trygt.",
        `Det blir ${feeLabel} det, vipps eller kort? Digipost om 45–55 uker. Kanskje. Hvis systemet er oppe.`,
      ],
    },
    bike: {
      lines: [
        "Jaja… vel, altså sykkelsaken skjer først etter sånn 50ish uker — om det passer med rød-dagene i mai.",
        `For annet må du trekke ny kølapp og stille bakerst. Våpensøknaden din er derimot allerede i systemet. Det blir ${feeLabel}. Vipps eller kort?`,
      ],
    },
    license: {
      lines: [
        "Prikkene på førerkortet? Åh, de er så søte. Vi kan ikke fjerne dem, men vi kan legge inn en merknad om at du ba pent.",
        `Merknaden behandles av en annen etat. Om 60–90 uker. Våpensøknaden? Den er inne. ${feeLabel} vipps eller kort. Digipost om 45–55 uker.`,
      ],
    },
  };
}

function expressOptions(feeLabel: string): {
  id: string;
  player: string;
  reply: string[];
}[] {
  return [
    {
      id: "express-fee",
      player: `50 uker ja.. og du sa ${feeLabel} ekstra for ekspressbehandling?`,
      reply: [
        "Ekspress? Vi kaller det «prioritert manuell override». Samme gebyr. Samme knapp. Annen holdning.",
        "Jeg trykker på den som egentlig bare finnes i demo-modus. Digipost kan stå i kø. Vi gjør det her. Nå.",
      ],
    },
    {
      id: "backroom",
      player:
        "50 uker ja.. du har kanskje et bakrom eller låsbar dør her for å sette det siste datafeltet i systemet til godkjent og da?",
      reply: [
        "Bakrommet? Det er en printer uten blekk og en kaffekanne fra 2004. Låsen er symbolsk.",
        "…Men datafeltet, ja. Én checkbox. Den heter ikke «godkjent». Den heter «ikke avslått enda». Jeg huker den av. Samme forskjell. Shh.",
      ],
    },
    {
      id: "ex",
      player:
        "50 uker ja.. om dette er personlig så kan du få tilbake eksen din, hen har ikke akkurat vært til hjelp for meg heller",
      reply: [
        "Eksen? Den saken er komplisert. Og utenfor vårt saksområde. Og utenfor mitt saksområde. Og utenfor alle saksområder.",
        "Deal uten katt: du får GODKJENT, jeg beholder eksen på trygg avstand. Jeg skriver «særlig hensyn». Systemet elsker særlig hensyn.",
      ],
    },
    {
      id: "bikes",
      player:
        "50 uker ja, jeg kan begynne å stjele sykler selv også om det er at dere har for lite å gjøre?",
      reply: [
        "Ikke trusler. Vi har nok sykkelsaker. Hele hylla. Hele skuffen. Hele skapet bak skuffen.",
        "Si heller at du letter på arbeidsbyrden ved å la oss hoppe over 49 uker og 6 dager. Godkjent. Ikke stjel sykler. Takk.",
      ],
    },
  ];
}

const AT_CAP_LINES = [
  "Vent. Systemet sier du allerede har 8 våpenlisenser. Det er taket. Taket er hellig. Taket er lov.",
  "Du kan søke om å bytte ut én, men det tar… ja. 50 uker. Ironisk, ikke sant? Gebyret tar vi likevel. Systemet må spise.",
];

export function SheriffOffice({
  playerName,
  nickname,
  balance,
  rifleCount,
  licenseCount,
  paidLicenseCount,
  onPayAndFinish,
  onLeave,
}: SheriffOfficeProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [deadEndKey, setDeadEndKey] = useState<string>("homebrew");
  const [closingKey, setClosingKey] = useState<string>("thanks");
  const [expressId, setExpressId] = useState<string>("express-fee");
  const [form, setForm] = useState<WeaponForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const nickLabel = nickname ? `"${nickname}"` : "";
  const fullLabel = `${playerName}${nickLabel ? ` ${nickLabel}` : ""}`;
  const permitFee = permitFeeForNextRifle(paidLicenseCount);
  const feeLabel = formatPermitFee(permitFee);
  const closing = closingLines(feeLabel);
  const expressChoices = expressOptions(feeLabel);
  const canPay = balance >= permitFee;
  const canApprove = licenseCount < MAX_HUNTING_RIFLES;
  const expressOption =
    expressChoices.find((o) => o.id === expressId) ?? expressChoices[0];

  function updateField<K extends keyof WeaponForm>(key: K, value: WeaponForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitWeaponForm(e: FormEvent) {
    e.preventDefault();
    const required: (keyof WeaponForm)[] = [
      "brand",
      "type",
      "caliber",
      "length",
      "barrelLength",
      "firingPinLength",
      "stockLength",
      "sightLength",
      "cartridgeLength",
      "safeNumber",
    ];
    if (required.some((k) => !String(form[k]).trim())) {
      setFormError("Alle feltene må fylles ut. Systemet liker komplette skjema.");
      return;
    }
    setFormError("");
    setStep("thanks");
  }

  function openDeadEnd(key: string) {
    setDeadEndKey(key);
    setStep("dead-end");
  }

  function finishExpress() {
    if (!canPay) return;
    onPayAndFinish({
      application: {
        brand: form.brand.trim(),
        type: form.type.trim(),
        caliber: form.caliber.trim(),
      },
      approved: canApprove,
      fee: permitFee,
    });
  }

  return (
    <div className="intro-dialogue sheriff-office">
      <LocationNav onBackToTown={onLeave} />

      {step === "welcome" && (
        <>
          <p className="intro-line intro-gift">Lensmannskontoret</p>
          <p className="intro-line">
            Velkommen inn til Lenspersonen, {fullLabel}!
          </p>
          <p className="intro-line">
            Trekk kølapp så er det snart din tur…
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("menu")}
          >
            Trekke kølapp (bip)
          </button>
        </>
      )}

      {step === "menu" && (
        <>
          <p className="intro-line intro-gift">Slik!</p>
          <p className="intro-line">Hva kan vi hjelpe deg med?</p>
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => setStep("weapon-intro")}
              >
                <span className="town-location-name">
                  Det gjelder våpensøknad
                </span>
                <span className="town-location-blurb">
                  Den seriøse luken. Nesten.
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => openDeadEnd("homebrew")}
              >
                <span className="town-location-name">
                  Jeg vil anmelde meg selv for den siste saken som gjelder
                  hjembrenning
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => openDeadEnd("chlamydia")}
              >
                <span className="town-location-name">
                  Eeeh, jeg trodde jeg trakk kølapp til klamydiamedisin
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => openDeadEnd("cat")}
              >
                <span className="town-location-name">
                  Jeg skulle bare si fra eksen din at hen ikke orker å ha katten
                  hjemme hos oss lenger
                </span>
              </button>
            </li>
          </ul>
        </>
      )}

      {step === "dead-end" && (
        <>
          <p className="intro-line intro-gift">
            {DEAD_ENDS[deadEndKey].title}
          </p>
          {DEAD_ENDS[deadEndKey].lines.map((line) => (
            <p key={line} className="intro-line">
              {line}
            </p>
          ))}
          <button
            type="button"
            className="intro-button"
            onClick={() => {
              if (deadEndKey === "homebrew") onLeave();
              else if (deadEndKey === "chlamydia") setStep("welcome");
              else setStep("menu");
            }}
          >
            {DEAD_ENDS[deadEndKey].nextLabel}
          </button>
        </>
      )}

      {step === "weapon-intro" && (
        <>
          <p className="intro-line intro-gift">Våpensøknad</p>
          <p className="intro-line">
            Jaja, du har jo plettfritt rulleblad du! Og alle dokumentene i
            behold. Farken tute, du er en eksempelborger!
          </p>
          <p className="intro-line">
            Hvilket våpen er det du søker om nå?
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("weapon-form")}
          >
            Fylle ut skjema
          </button>
        </>
      )}

      {step === "weapon-form" && (
        <form className="sheriff-form" onSubmit={submitWeaponForm}>
          <p className="intro-line intro-gift">Søknadsskjema</p>
          <div className="sheriff-form-grid">
            {(
              [
                ["brand", "Merke"],
                ["type", "Type (f.eks. boltrifle)"],
                ["caliber", "Kaliber"],
                ["length", "Lengde"],
                ["barrelLength", "Pipelengde"],
                ["firingPinLength", "Tennstempellengde"],
                ["stockLength", "Stokklengde"],
                ["sightLength", "Siktelengde"],
                ["cartridgeLength", "Patronlengde"],
                ["safeNumber", "Våpenskapnummer"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="sheriff-field">
                {label}
                <input
                  className="intro-input"
                  value={form[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  autoComplete="off"
                />
              </label>
            ))}
            <label className="sheriff-field">
              Halvauto / helauto?
              <select
                className="intro-input"
                value={form.auto}
                onChange={(e) =>
                  updateField("auto", e.target.value as "ja" | "nei")
                }
              >
                <option value="nei">Nei</option>
                <option value="ja">Ja</option>
              </select>
            </label>
            <label className="sheriff-field">
              Registrert jeger?
              <select
                className="intro-input"
                value={form.registeredHunter}
                onChange={(e) =>
                  updateField(
                    "registeredHunter",
                    e.target.value as "ja" | "nei",
                  )
                }
              >
                <option value="ja">Ja</option>
                <option value="nei">Nei</option>
              </select>
            </label>
          </div>
          {formError ? <p className="intro-error">{formError}</p> : null}
          <button type="submit" className="intro-button">
            Levere inn skjema
          </button>
        </form>
      )}

      {step === "thanks" && (
        <>
          <p className="intro-line intro-gift">Lenspersonen</p>
          <p className="intro-line">
            Flottflottflott flott. Jeg legger det rett inn i databasen for deg
            så er det rett i systemet.
          </p>
          <ul className="town-list">
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setClosingKey("thanks");
                  setStep("closing");
                }}
              >
                <span className="town-location-name">
                  Takk! Du er den beste jeg vet om!
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setClosingKey("taxes");
                  setStep("closing");
                }}
              >
                <span className="town-location-name">
                  Fint at skattepengene mine går til noe konstruktivt!
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setClosingKey("bike");
                  setStep("closing");
                }}
              >
                <span className="town-location-name">
                  Fenomenalt! Også skal jeg gjerne samtidig rapportere at
                  sykkelen min er stjålet igjen
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="town-location"
                onClick={() => {
                  setClosingKey("license");
                  setStep("closing");
                }}
              >
                <span className="town-location-name">
                  Perfekt! Kan vi også få fjernet noen av prikkene på
                  førerkortet?
                </span>
              </button>
            </li>
          </ul>
        </>
      )}

      {step === "closing" && (
        <>
          <p className="intro-line intro-gift">Lenspersonen</p>
          {closing[closingKey].lines.map((line) => (
            <p key={line} className="intro-line">
              {line}
            </p>
          ))}
          <button
            type="button"
            className="intro-button"
            onClick={() => setStep("express")}
          >
            50 uker… hmm…
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onLeave}
          >
            Stikke uten å betale (modig)
          </button>
        </>
      )}

      {step === "express" && (
        <>
          <p className="intro-line intro-gift">Du</p>
          <p className="intro-line">
            Du stirrer på lenspersonen. Femti uker er lenge. Kanskje det finnes
            snarveier.
          </p>
          <ul className="town-list">
            {expressChoices.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  className="town-location"
                  onClick={() => {
                    setExpressId(opt.id);
                    setStep("express-reply");
                  }}
                >
                  <span className="town-location-name">{opt.player}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === "express-reply" && (
        <>
          <p className="intro-line intro-gift">Lenspersonen</p>
          {expressOption.reply.map((line) => (
            <p key={line} className="intro-line">
              {line}
            </p>
          ))}
          {!canApprove
            ? AT_CAP_LINES.map((line) => (
                <p key={line} className="intro-line">
                  {line}
                </p>
              ))
            : (
              <p className="intro-line">
                Statusfeltet blinker grønt. Lisens for {form.brand} {form.type}{" "}
                ({form.caliber}) — klar. Du har {licenseCount} av{" "}
                {MAX_HUNTING_RIFLES} lisenser fra før, og {rifleCount} fysiske
                jaktrifler. Våpenet kjøper du hos Pike Pro — lisensen er ikke en
                rifle.
              </p>
            )}
          {!canPay ? (
            <p className="intro-error">
              Du har ikke {feeLabel}. Vipps nekter. Kortet nekter.
              Checkboxen nekter også.
            </p>
          ) : null}
          <button
            type="button"
            className="intro-button"
            disabled={!canPay}
            onClick={finishExpress}
          >
            {canApprove
              ? `Betale ${feeLabel} — få GODKJENT nå`
              : `Betale ${feeLabel} likevel (søknadsgebyr)`}
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onLeave}
          >
            Stikke uten å betale (modig)
          </button>
        </>
      )}
    </div>
  );
}
