<div align="center">

# ⛏️ LbinCraft

### A browser-based voxel sandbox game built with Three.js

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.169-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

No external assets. No textures. No sound files.  
Every block, every sound, every world — **generated entirely in code.**

</div>

---

## 🎮 Play

```bash
git clone git@github.com:Lbin91/lbincraft.git
cd lbincraft
npm install
npm run dev
```

Open `http://localhost:5173` and click to play.

### Build

```bash
npm run build    # Type-check + production bundle
npm run preview  # Preview production build
```

---

## ✨ Features

### World Generation

| Feature | Details |
|---------|---------|
| **Voxel Terrain** | Infinite procedural terrain via 4-octave simplex noise |
| **5 Biomes** | Plains · Desert · Forest · Mountains · Snowy Tundra — bilinear blended transitions |
| **Cave Systems** | Underground 3D noise carving below y=28 |
| **Ore Deposits** | Coal, Iron, Gold, Diamond — depth-gated rarity distribution |
| **Falling Blocks** | Sand obeys gravity, cascades on break |
| **Water** | Transparent fluid with swimming physics |

### Gameplay

- **Block Interaction** — DDA raycasting for precise block targeting, highlight wireframe, break particles
- **Day/Night Cycle** — 10-minute full cycle with dynamic sky colors, sun/moon orbit, ambient lighting transitions
- **Survival Mode** — Health (10 hearts), hunger system, fall damage, drowning
- **Inventory & Crafting** — 36-slot inventory + 3×3 crafting grid with drag-and-drop
- **12 Tools** — Pickaxe/Axe/Sword in Wood/Stone/Iron/Diamond, each with durability and mining tiers
- **Recipes** — Shaped crafting (tools) + shapeless (ore → ingot smelting)
- **Animals & Mobs** — Pigs and chickens roam during day, zombies spawn at night with AI pathfinding

### Audio

- **100% Procedural** — Web Audio API synthesis, zero external sound files
- Block break/place sounds vary by material
- Footstep cadence synced to movement
- Day ambient (soft pad) / night ambient (drone + crickets) auto-transition
- `M` key to toggle mute

### Visuals

- **Real-time Minimap** — Canvas 2D top-down render at 10fps, player position arrow
- **First/Third Person Camera** — `F` to toggle, DDA collision in third-person prevents wall clipping
- **Held Item** — Block mesh attached to camera, color-matched to selected slot
- **Walk Animation** — Arm/leg swing via sine wave in third-person mode

### Engineering

- **Chunk-based Rendering** — Greedy mesh merging, frustum culling, dirty chunk rebuilds
- **Physics** — Per-axis AABB collision with epsilon-gapped boundary detection, substep anti-tunneling
- **Save/Load** — LocalStorage world persistence, 30-second autosave + manual `O` key
- **Configurable Render Distance** — Dynamic chunk load/unload around player

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| `Mouse` | Look around |
| `Space` | Jump / Swim up |
| `Left Click` | Break block / Attack |
| `Right Click` | Place block |
| `1–9` / `Wheel` | Select hotbar slot |
| `E` | Open inventory + crafting |
| `F` | Toggle 1st / 3rd person |
| `M` | Toggle sound |
| `O` | Manual save |
| `ESC` | Pause |

---

## 📐 Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | Three.js 0.169 (WebGL) |
| Language | TypeScript 5.6 (strict mode) |
| Build | Vite 5.4 |
| Noise | simplex-noise 4.0 |
| Audio | Web Audio API (native) |
| 2D UI | Canvas 2D API (native) |

**Bundle:** ~535 KB (137 KB gzipped) — including Three.js.

---

## 🏗️ Architecture

```
src/
├── engine/          # Core game systems
│   ├── Game.ts          # Main loop, state management
│   ├── World.ts         # Voxel world data (block get/set)
│   ├── Chunk.ts         # 16×16×64 chunk storage
│   ├── ChunkManager.ts  # Chunk load/unload, mesh queue
│   ├── MeshBuilder.ts   # Greedy mesh generation
│   ├── TerrainGenerator.ts  # Biome + noise terrain
│   ├── VoxelRaycaster.ts    # DDA block targeting
│   └── DayNightCycle.ts     # Sky/light transitions
├── player/          # Player systems
│   ├── Player.ts        # Entity, AABB, look math
│   ├── Physics.ts       # Gravity, collision resolution
│   ├── Controls.ts      # Mouse/keyboard input
│   ├── PlayerView.ts    # 3D body model + held item
│   └── Survival.ts      # Health, hunger, damage
├── inventory/       # Items and crafting
│   ├── Inventory.ts     # Slot management
│   ├── InventoryUI.ts   # Drag-and-drop panel
│   ├── CraftingGrid.ts  # 3×3 recipe matching
│   ├── Recipe.ts        # Shaped + shapeless recipes
│   └── ToolType.ts      # Tool tiers, durability
├── blocks/          # Block definitions
│   └── BlockType.ts     # 15 block types + properties
├── entities/        # Mobs
│   ├── Entity.ts        # Base entity
│   ├── Animal.ts        # Passive AI (pigs, chickens)
│   ├── Zombie.ts        # Hostile AI (night spawn)
│   └── EntityManager.ts # Spawn/despawn lifecycle
├── audio/           # Procedural sound
│   └── AudioManager.ts  # Web Audio API synthesis
├── effects/         # Visual effects
│   └── ParticleManager.ts  # Block-break particles
├── ui/              # Overlay rendering
│   └── Minimap.ts       # Canvas 2D top-down map
└── main.ts          # Entry point, UI setup
```

---

## 🗺️ Roadmap

- [ ] Multiplayer (WebRTC peer-to-peer)
- [ ] Redstone circuits
- [ ] Nether dimension
- [ ] Custom texture pack support
- [ ] Mobile touch controls

---

## 📄 License

MIT — see [LICENSE](LICENSE).

<div align="center">

Built as a TypeScript rendering engine and game architecture showcase.

⭐ Star if you find it interesting!

</div>
