# 🎮 Cold Bore Toppjakt - The Game

Et realistisk web-basert jakt-simulator spill.

## 🎯 Om Spillet

"Cold Bore Toppjakt" er et realistisk jakt-simulator som fokuserer på:
- Realistisk våpen og balistikk
- Taktisk bevegelse og terreng-analyse  
- Skill-basert progresjon
- Etisk jakt-perspektiv

Se [GAME_DESIGN.md](./GAME_DESIGN.md) for fullstendig dokumentasjon.

## 🛠️ Tech Stack

- **Framework:** Next.js 15
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Maps:** Leaflet (mocka data)

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/              # Next.js app router
├── components/       # React components
├── lib/              # Utilities and game engine
│   ├── game/         # Game engine
│   ├── ballistics/   # Balistikk-beregninger
│   └── terrain/      # Terreng-system
└── types/            # TypeScript types
```

## 🎮 Development Status

- [ ] Phase 1: Setup & Core Engine
- [ ] Phase 2: Weapons & Shooting
- [ ] Phase 3: Progression System
- [ ] Phase 4: UI/Polish

## 📝 License

MIT

## 👤 Author

Tomas Henningsen
