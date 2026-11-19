# Kili Streets Client (`Ushirika wa Neema & KCMC`)

Dedicated frontend client repository for **Kili Streets: Ushirika wa Neema & KCMC (Moshi, Kilimanjaro)**, decoupled from [`kili-streets-backend`](https://github.com/cleven12/kili-streets-backend).

## Key Engineering Features
- **Client-Side SQLite Engine (`src/sqlite/`):** Maintains local relational tables (`zones`, `buildings`, `roads`, `trees`, `vehicles`, `missions`, `npcs`, `wallet_ledger`, and `sync_queue`) for `<0.1ms` 60 FPS game loop reads and offline-first persistence.
- **Real-Time Backend SQLite Sync:** Bootstraps from `GET /api/v1/world/bootstrap` and flushes player movement, vehicle hijacking, mission completions, and *Duka la Mangi / Kwa Mama Ntilie* purchases via `POST /api/v1/sync/batch` and WebSocket `/ws/world`.
- **2.5D Oblique Extruded World Renderer:** Renders multi-story buildings with facades, windows, roof overhangs, zebra crossings at KCMC Main Gate, Chagga banana groves (*migomba*), and red volcanic murram dust trails.
- **Tactical Kilimanjaro Street UI:** Includes a live **Client SQLite Inspector Drawer**, **M-Pesa / TZS Shop Modal**, circular compass radar mini-map, and dual PC Keyboard + Mobile Multi-Touch controls.
