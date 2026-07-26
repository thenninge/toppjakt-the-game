"use client";

export type TownLocationId =
  | "xxl"
  | "sheriff"
  | "home"
  | "shooting-range"
  | "how-to-play"
  | "admin-office"
  | "meat-market"
  | "rulles"
  | "cb-customs"
  | "jegerprove";

type TownLocation = {
  id: TownLocationId;
  name: string;
  blurb: string;
};

const LOCATIONS: TownLocation[] = [
  {
    id: "home",
    name: "Home",
    blurb: "Inventory, kit, kart — og ut på jakt.",
  },
  {
    id: "jegerprove",
    name: "Jegerprøven",
    blurb: "Ta prøven på nytt — eller se beviset (byen krever bestått).",
  },
  {
    id: "xxl",
    name: "XXL",
    blurb: "Buy weapons and ammo.",
  },
  {
    id: "cb-customs",
    name: "CB Customs",
    blurb: "Børsemaker, CNC-pipe, finish og home loads.",
  },
  {
    id: "meat-market",
    name: "Meat Market",
    blurb: "Selg tiur og orrfugl — finansier mer kit.",
  },
  {
    id: "rulles",
    name: "Rulles Kebab, Pizza, Bar & Fine Dining",
    blurb: "Snøvling, påspandering — og nye grunneiere.",
  },
  {
    id: "sheriff",
    name: "Lensmannen",
    blurb: "Kølapp, våpensøknad, og andre feil luke.",
  },
  {
    id: "shooting-range",
    name: "Shooting Range",
    blurb: "Zeroing, practice, and pattern boards.",
  },
  {
    id: "how-to-play",
    name: "How to play",
    blurb:
      "BODY/MIND, Kestrel, Track/ettersøk, zero, dV/dT, DOPE — det som faktisk betyr noe.",
  },
  {
    id: "admin-office",
    name: "Admin office",
    blurb: "Kalibrer spotting-percher og test optikk.",
  },
];

type TownHubProps = {
  playerName: string;
  nickname: string;
  onEnter: (location: TownLocationId) => void;
  /** When true, show Admin office under How to play. */
  adminUnlocked?: boolean;
};

export function TownHub({
  playerName,
  nickname,
  onEnter,
  adminUnlocked = false,
}: TownHubProps) {
  const locations = adminUnlocked
    ? LOCATIONS
    : LOCATIONS.filter((loc) => loc.id !== "admin-office");

  return (
    <div className="town-hub">
      <p className="intro-line">
        Du er i byen, {playerName} &quot;{nickname}&quot;. Hvor skal du?
      </p>

      <ul className="town-list">
        {locations.map((loc) => (
          <li key={loc.id}>
            <button
              type="button"
              className="town-location"
              onClick={() => onEnter(loc.id)}
            >
              <span className="town-location-name">{loc.name}</span>
              <span className="town-location-blurb">{loc.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
