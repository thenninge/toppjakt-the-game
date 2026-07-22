"use client";

export type TownLocationId =
  | "xxl"
  | "sheriff"
  | "home"
  | "shooting-range"
  | "meat-market"
  | "rulles"
  | "cb-customs";

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
    id: "xxl",
    name: "XXL",
    blurb: "Buy weapons and ammo.",
  },
  {
    id: "cb-customs",
    name: "CB Customs",
    blurb: "Børsemaker, bil og 3D-print — custom rifle (kommer).",
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
];

type TownHubProps = {
  playerName: string;
  nickname: string;
  onEnter: (location: TownLocationId) => void;
};

export function TownHub({ playerName, nickname, onEnter }: TownHubProps) {
  return (
    <div className="town-hub">
      <p className="intro-line">
        Du er i byen, {playerName} &quot;{nickname}&quot;. Hvor skal du?
      </p>

      <ul className="town-list">
        {LOCATIONS.map((loc) => (
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
