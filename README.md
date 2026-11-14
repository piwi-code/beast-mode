# Beast Mode — Gym Session Planner & Main Lift Tracker

A local-first Progressive Web Application (PWA) for planning modular gym sessions (**Primary Lift $\rightarrow$ 2–4 Supersets $\rightarrow$ 1–2 Finishers**), tracking main compound lift progression, and dynamically guarding against **axial spinal overload**, **competing superset fatigue**, **48-hour short-turnaround conflicts**, and **weekly/fortnightly muscle volume imbalances**.

**Live app (GitHub Pages):** https://piwi-code.github.io/beast-mode/ — installable as a PWA from your phone's browser ("Add to Home Screen").

> **Status: pre-alpha / proof of concept.** Changes are committed directly to `main`, which auto-deploys to GitHub Pages. Once the POC phase is complete, `main` will be locked down and all changes will go through pull requests. See [Development Workflow](docs/ROADMAP.md#development-workflow).

## Key Features

- **Flexible Schedule & Split Sequencer**:
  - Choose between **Push / Pull / Legs (PPL)** or **Upper / Lower** across **2, 3, or 4 sessions per week**.
  - **Buddy vs. Solo per session**: mark your usual buddy (spotter) weekdays in Settings and tick Buddy on/off for any session. Solo sessions automatically swap spotter-dependent lifts (Barbell Bench → Dumbbell Bench, Back Squat → Leg Press) and warn if you pick one anyway.
  - Automatically suggests the next logical session in your rotation and recommends the primary anchor lift (plus alternative main lifts).
- **Modular Supersets with On-the-Fly Splitting**:
  - Add **2, 3, or 4 supersets** and **1 or 2 finishers** (including the standardized **Turf Sled Forward Push + Backward Drag protocol**).
  - Gym busy? Toggle any superset between **Paired Superset (`A1 / A2`)** and **Split Standalone Exercises (`A` then `B`)** with a single tap during your workout.
- **4-Tier Safeguard & Recommendation Engine**:
  1. **Axial Load Ceiling**: Alerts when cumulative spinal compression exceeds `4` in a single session.
  2. **Antagonist / Non-Competing Mandate**: Flags intra-session muscle stacking (e.g., Flat Bench + Incline DB Press) and grip-tax clashes.
  3. **Rolling 48-Hour Recovery Lookback**: Warns when a muscle group exceeds `6` working sets within 48 hours (e.g. Upper $\rightarrow$ Lower $\rightarrow$ Upper) and recommends joint-friendly/lengthened alternatives.
  4. **7-Day & 14-Day Muscle Volume Balance**: Tracks working sets across weekly and fortnightly windows so supersets are allocated evenly without overtraining.
- **Touch-Friendly Exercise Picker**:
  - Search by name, muscle or equipment, filter by equipment, and browse by muscle-group sub-headings (supersets appear under both muscle groups). Every option shows a plain-language name, a one-line description, and labels such as equipment, main lift, and spine load.
- **Share a Workout**:
  - From History, share a completed session as a clean image (date started, top weight and sets per exercise) via your phone's share sheet.
- **Main Lift Progression Tracker**:
  - Logs sets, reps, weight (kg), and RPE for primary lifts and accessories, with automatic **Estimated 1RM (Epley)** calculation and historical charts.
- **Clean, Backend-Ready Architecture**:
  - Pure TypeScript domain engine (`src/domain/`), async Repository interfaces (`src/data/interfaces/`), and a local IndexedDB (`Dexie.js`) adapter (`src/data/local/`) with JSON export/import—ready to lift-and-shift to PocketBase/SQLite (via Cloudflare Tunnel or Tailscale) or Supabase when needed.

## Documentation

- [Workout Logic & Rules Engine Specification](docs/WORKOUT_LOGIC.md)
- [System Architecture & Backend Migration Guide](docs/ARCHITECTURE.md)
- [Project Roadmap & Task Tracker](docs/ROADMAP.md)

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run domain engine unit tests
npm run test

# Build production PWA bundle
npm run build
```
