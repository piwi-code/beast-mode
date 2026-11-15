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
- [x] Back Squat flagged as needing a spotter (solo alternative: Leg Press); set-logging rows fit any phone width
- [x] Switching a session's split (Plan or live Pivot) re-picks primary, supersets and finishers for the new focus
- [x] Drop-set pump finishers (Barbell Curl, Cable Pushdown) with per-exercise finisher protocol/load; 10 more exercises and 6 more curated supersets; catalog integrity tests
- [x] Weights start from the last recorded load per exercise (estimate otherwise); drop-set bar suggestions in 5 kg jumps; Leg Press as the solo squat default; EZ-Bar Curl, Preacher Curl, Seated Calf Raise, Dips + 3 supersets
- [x] Weight suggestions ease back after a 3+ week break and step up when every set hit the top of the rep range, with an on-screen explanation
- [x] Share a completed workout as an image (phone share sheet for WhatsApp/Messenger, download on desktop)
- [x] Delete a completed session from History (with confirmation); dumbbell weights logged per dumbbell with ×2 totals
- [x] Starting weights: Settings entry for main lifts and ratio-based predictions for related exercises; set/round/session timestamps recorded; sample sessions no longer seeded (leftovers removed)
- [ ] Built-in auto-starting rest timer (60–90s for supersets/sleds, 2–3m for heavy primary anchors) with Web Audio/Vibration alerts
- [ ] Shareable Workout Template URLs (encode a planned session into a URL query string so you can text a link to your gym buddy)
- [ ] Custom Exercise & Custom Superset creator in the UI
- [ ] Plate calculator for Barbell Primary Lifts (Squat, Bench, Deadlift/RDL, OHP)

---

## Next up (V1): History analytics
- [ ] More analytics on the History page. Candidates, using data already recorded: session duration and rest times (set/round/session timestamps), weekly volume trend, per-exercise progress beyond the three main lifts, personal bests, training frequency per split.

---

## V2: Accounts, Social & Integrations

Not started. Everything below is deliberately out of scope for V1, which stays a local-only app (data in the browser, JSON export/import for backup). Ordered by dependency: each step relies on the one before it.

### V2.1 Auth & hosted database
The foundation for everything else in V2.
- [ ] Choose a backend (see the options table in `ARCHITECTURE.md` §3: self-hosted PocketBase, or a hosted free tier such as Supabase).
- [ ] Sign-in (email link or a social login) and a per-user data store.
- [ ] `RemoteSyncRepository` adapter behind the existing `IWorkoutRepository` interface, so the domain and UI layers do not change.
- [ ] Offline-first: keep IndexedDB as the working copy and sync in the background (log in the gym basement, sync when back on Wi-Fi).
- [ ] One-time import of a user's existing local data into their account.
- [ ] Protect `main` and move to pull requests before real user data is hosted (see Development Workflow above).
- Open questions: conflict handling when two devices edit the same session; whether using the app without an account stays supported.

### V2.2 Social
Needs V2.1 (identities and shared storage).
- [ ] Friends: find and add a training buddy.
- [ ] Linked buddy sessions: both partners attached to the same session, each logging their own weights; the Buddy toggle could become "training with <name>".
- [ ] Live "Buddy Mode": partners see shared bar loads and alternating set prompts during a session.
- [ ] Share a real workout page (a link, not only the image the app can share today), viewable by friends or anyone with the link.
- [ ] Shareable workout templates (send a planned session to your buddy).
- Open questions: privacy defaults (who can see what), and whether shared pages are public or sign-in only.

### V2.3 External services (e.g. Strava)
Needs V2.1 (a server to hold access tokens securely; they cannot live in a static site).
- [ ] Connect a Strava account (OAuth).
- [ ] Post completed workouts to Strava as an activity (duration from the session timestamps, summary of lifts).
- [ ] Read runs from Strava so the 48-hour recovery and weekly load rules can account for running, which is the app's reason for tracking leg fatigue in the first place.
- Open questions: which other services matter (Garmin, Apple Health, Google Fit) and whether import, export or both.
