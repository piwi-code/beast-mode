# Project Roadmap & Task Tracker

## Phase 1: Foundation & Clean Architecture (Current MVP)
- [x] Define domain specification and rules engine (`docs/WORKOUT_LOGIC.md`)
- [x] Define layered architecture and migration strategy (`docs/ARCHITECTURE.md`)
- [x] Implement pure TypeScript domain models (`src/domain/models/`)
- [x] Build comprehensive seed catalog (`src/domain/seed/`) covering PPL, Buddy Upper/Lower, and Hybrid Solo/Buddy splits
- [x] Implement pure Domain Engine (`src/domain/engine/`):
  - [x] Next-Session & Primary Lift Sequencer (supports 2, 3, or 4 days/week for PPL & Upper/Lower)
  - [x] Rule 1: Axial Load Ceiling (`> 4` spinal compression warning)
  - [x] Rule 2: Antagonist / Non-Competing Superset Validator & Intra-Session Primary/Secondary Muscle Conflict Detector
  - [x] Rule 3: Rolling 48-Hour Recovery Lookback (`> 6` working sets warning + lengthened/isolation recommendations)
  - [x] Rule 4: Rolling 7-Day & 14-Day Muscle Volume Distribution & Superset Recommender
  - [x] Main Lift 1RM Estimator (Epley formula) & progression tracking
- [x] Implement Data Layer (`src/data/`):
  - [x] Repository interfaces (`IExerciseRepository`, `IPlanRepository`, `ISessionRepository`)
  - [x] Dexie.js (IndexedDB) local persistence + JSON export/import for sharing & backups
- [x] Build Mobile-First PWA UI (`src/ui/`):
  - [x] Plan & Schedule Configurator (PPL vs Upper/Lower, 2/3/4 sessions/week, Solo/Buddy/Hybrid)
  - [x] Smart Session Builder with 2–4 Supersets, 1–2 Finishers, and **1-tap Split-to-Single-Exercise toggle** for busy gym floors
  - [x] Live Set/Rep/Weight/RPE Logger + Sled Dosing Protocol card
  - [x] Main Lift Progression Dashboard (Squat, Bench, RDL/Deadlift, OHP, Pull-ups)
  - [x] Weekly & Fortnightly Muscle Volume & Recovery Analytics view
- [x] Configure Vite PWA plugin & GitHub Pages deployment workflow (`.github/workflows/deploy.yml`)

---

## Phase 2: Polish & Gym-Floor Ergonomics
- [ ] Built-in auto-starting rest timer (60–90s for supersets/sleds, 2–3m for heavy primary anchors) with Web Audio/Vibration alerts
- [ ] Shareable Workout Template URLs (encode a planned session into a URL query string so you can text a link to your gym buddy)
- [ ] Custom Exercise & Custom Superset creator in the UI
- [ ] Plate calculator for Barbell Primary Lifts (Squat, Bench, Deadlift/RDL, OHP)

---

## Phase 3: Cross-Device Sync & Self-Hosted / Hobby Backend
- [ ] Implement `RemoteSyncRepository` adapter (compatible with PocketBase over Cloudflare Tunnel/Tailscale or Supabase free tier)
- [ ] Offline-first sync queue (log workouts offline in the gym basement, sync automatically when back on Wi-Fi)
- [ ] Multi-user "Buddy Mode" live session sharing (Partner A and Partner B see shared bar loads and alternating set prompts)
