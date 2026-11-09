# Project Roadmap & Task Tracker

## Development Workflow

| Phase | Branching & review |
| --- | --- |
| **Pre-alpha / POC (current)** | Commit directly to `main` — one squashed commit per feature, pushed straight to `main`. Every push to `main` runs the tests and deploys to GitHub Pages. No PRs required. |
| **After POC sign-off** | `main` becomes a protected branch. All changes go through feature branches and pull requests, with passing CI (tests + build) required before merge. |

When the POC phase ends: enable branch protection on `main` (require PR + passing `Deploy to GitHub Pages` build/test job) and update this table.

## Phase 1: Foundation & Clean Architecture (Current MVP)
- [x] Define domain specification and rules engine (`docs/WORKOUT_LOGIC.md`)
- [x] Define layered architecture and migration strategy (`docs/ARCHITECTURE.md`)
- [x] Implement pure TypeScript domain models (`src/domain/models/`)
- [x] Build comprehensive seed catalog (`src/domain/seed/`) covering PPL and Upper/Lower splits
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
  - [x] Plan & Schedule Configurator (PPL vs Upper/Lower, 2/3/4 sessions/week, buddy days)
  - [x] Smart Session Builder with 2–4 Supersets, 1–2 Finishers, and **1-tap Split-to-Single-Exercise toggle** for busy gym floors
  - [x] Live Set/Rep/Weight/RPE Logger + Sled Dosing Protocol card
  - [x] Main Lift Progression Dashboard (Squat, Bench, RDL/Deadlift, OHP, Pull-ups)
  - [x] Weekly & Fortnightly Muscle Volume & Recovery Analytics view
- [x] Configure Vite PWA plugin & GitHub Pages deployment workflow (`.github/workflows/deploy.yml`)

---

## Phase 2: Polish & Gym-Floor Ergonomics
- [x] Standard searchable picker (`SelectSheet`) replacing native dropdowns: muscle-group sub-headings, equipment filter chips, plain-language names, one-line descriptions & labels (equipment, main lift, spine load, grip, pairing type)
- [x] Swipe carousel for the 14-day planner (no scrollbar, edge arrows) & multi-select Muscle/Equipment filters in the Catalog
- [x] Per-session Buddy/Solo (spotter) toggle with weekday defaults; spotter-safe auto-selection & "Needs a Spotter" warnings (replaces Buddy/Solo/Hybrid split types)
- [x] Equipment filter inside the exercise picker is a multi-select dropdown
- [x] Back Squat flagged as needing a spotter (solo alternative: Dumbbell Bulgarian Split Squat); set-logging rows fit any phone width
- [x] Switching a session's split (Plan or live Pivot) re-picks primary, supersets and finishers for the new focus
- [ ] Built-in auto-starting rest timer (60–90s for supersets/sleds, 2–3m for heavy primary anchors) with Web Audio/Vibration alerts
- [ ] Shareable Workout Template URLs (encode a planned session into a URL query string so you can text a link to your gym buddy)
- [ ] Custom Exercise & Custom Superset creator in the UI
- [ ] Plate calculator for Barbell Primary Lifts (Squat, Bench, Deadlift/RDL, OHP)

---

## Phase 3: Cross-Device Sync & Self-Hosted / Hobby Backend
- [ ] Implement `RemoteSyncRepository` adapter (compatible with PocketBase over Cloudflare Tunnel/Tailscale or Supabase free tier)
- [ ] Offline-first sync queue (log workouts offline in the gym basement, sync automatically when back on Wi-Fi)
- [ ] Multi-user "Buddy Mode" live session sharing (Partner A and Partner B see shared bar loads and alternating set prompts)
