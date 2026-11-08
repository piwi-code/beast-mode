# Architecture & System Design

## 1. Architectural Goals

**Beast Mode** is architected as a **Clean / Hexagonal Progressive Web Application (PWA)**:
1. **Local-First Today**: Runs 100% in the browser using **IndexedDB (via Dexie.js)** with zero server costs, full offline support, and static hosting on **GitHub Pages**.
2. **Backend-Ready Tomorrow**: All business rules (`src/domain/`) and storage contracts (`src/data/repositories/`) are decoupled from React components and IndexedDB. Moving to a hosted backend (e.g., Supabase, PocketBase/SQLite over Cloudflare Tunnels or Tailscale, or a custom REST/GraphQL server) only requires implementing the repository interfaces in `src/data/remote/` and adding an authentication wrapper.

---

## 2. Layered Directory Structure

```text
beast-mode/
├── docs/
│   ├── ARCHITECTURE.md      # System architecture & migration guide
│   ├── WORKOUT_LOGIC.md     # Domain rules, splits, safeguards & seed spec
│   └── ROADMAP.md           # Phased milestones & task tracker
├── src/
│   ├── domain/              # PURE TYPESCRIPT — Zero UI or DB dependencies
│   │   ├── models/          # Entities: Exercise, SupersetPair, WorkoutSession, LiftSet, PlanConfig
│   │   ├── engine/          # Pure business logic:
│   │   │   ├── sequencer.ts         # Next session & primary lift recommendation engine
│   │   │   ├── rulesEngine.ts       # Axial load, antagonist pairing, intra-session overlap, 48h lookback
│   │   │   ├── volumeTracker.ts     # 7-day & 14-day muscle volume balance & superset recommender
│   │   │   └── oneRepMax.ts         # Epley/Brzycki 1RM & main lift progression calculators
│   │   └── seed/            # Default exercises, curated supersets, finisher protocols, split templates
│   ├── data/                # DATA ACCESS LAYER — Repository interfaces & adapters
│   │   ├── interfaces/      # Async repository contracts (IWorkoutRepository, IPlanRepository, etc.)
│   │   ├── local/           # Dexie.js (IndexedDB) implementation + JSON export/import backup
│   │   └── context/         # Dependency Injection provider so UI only talks to IRepository interfaces
│   └── ui/                  # PRESENTATION LAYER — React + TypeScript + Tailwind CSS
│       ├── components/      # Reusable UI building blocks (SafeguardBanners, SupersetCard, VolumeChart)
│       ├── views/           # Core screens:
│       │   ├── SessionBuilderView.tsx   # Build & log active workout, toggle Paired vs Split exercises
│       │   ├── LiftTrackerView.tsx      # Main lift 1RM & top-set progression history
│       │   ├── VolumeAnalyticsView.tsx  # 48h recovery, 7d/14d muscle distribution & fatigue status
│       │   └── PlanSettingsView.tsx     # Configure PPL vs Upper/Lower (2, 3, or 4 days) & JSON share/backup
│       └── App.tsx
```

---

## 3. Repository Pattern & Future Hosting Migration Path

### Repository Contract (`src/data/interfaces/repositories.ts`)
All data operations are asynchronous (`Promise<T>`) even when backed by local IndexedDB:
- `IExerciseRepository`: Query seed and custom exercises, curated supersets, and finisher templates.
- `IPlanRepository`: Read and update the active training schedule (`PPL` vs `UPPER_LOWER`, `2 | 3 | 4` days/week, `SOLO | BUDDY | HYBRID`).
- `ISessionRepository`: Save, update, list, and query `WorkoutSession` logs across arbitrary date windows (48h, 7d, 14d, all-time) and export/import full JSON snapshots.

### Migration Options When Moving Beyond Local-Only

| Hosting Strategy | How It Fits This Architecture | Cost |
| :--- | :--- | :--- |
| **Phase 1: GitHub Pages + IndexedDB (Current)** | Static PWA deployed via GitHub Actions. Uses `DexieRepository`. Users can share/backup data via JSON export/import. | **$0 / mo** |
| **Phase 2A: Self-Hosted (PocketBase / SQLite) + Cloudflare Tunnel or Tailscale** | Run a single PocketBase binary or lightweight Node/Go container on a home server/Raspberry Pi/NAS. Expose privately via Tailscale or publicly via Cloudflare Zero Trust Tunnel. Implement `PocketBaseRepository`. | **$0 / mo** |
| **Phase 2B: Cloud Hobby Tier (Supabase / Turso / Cloudflare D1 + Workers)** | Keep GitHub Pages (or Cloudflare Pages) for frontend; swap `RepositoryContext` to `SupabaseRepository` or keep `DexieRepository` with a background sync queue. | **$0 / mo** (Free Tier) |

---

## 4. Data Flow Diagram

```mermaid
flowchart LR
    UI["React PWA Views\n(src/ui/)"] --> Engine["Pure Domain Engine\n(src/domain/engine/)"]
    UI --> RepoPort["Repository Interfaces\n(src/data/interfaces/)"]
    RepoPort --> DexieAdapter["Local IndexedDB Adapter\n(src/data/local/dexie)"]
    RepoPort -. "Future Swap / Sync" .-> RemoteAdapter["Remote API / Self-Hosted DB\n(Cloudflare Tunnel / Supabase)"]
```
