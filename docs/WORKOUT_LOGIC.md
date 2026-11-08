# Workout Tracker & Superset Recommendation Engine: Specification

This document provides the foundational domain logic, training philosophies, historical split configurations, recommendation rules engine, data schemas, and seed dataset for **Beast Mode** — a specialized workout planning and main-lift tracking application tailored for lifters balancing heavy compound strength with running performance and postural joint preservation.

---

## 1. Core Philosophy & Architectural Intent

The application solves key pain points that standard fitness trackers overlook:

1. **Dynamic Daily Superset Generation & On-the-Fly Splitting**:
   - Allow users to construct workouts modularly: **Primary Anchor Lift $\rightarrow$ 2–4 Superset Pairs $\rightarrow$ 1–2 Conditioners/Finishers**.
   - Support **On-the-Fly Execution Modes**: Any superset can be executed as a paired superset (`PAIRED`) or split into sequential standalone exercises (`SPLIT_STANDALONE`) on the gym floor when equipment or stations are occupied.
2. **Cumulative Fatigue & Safety Safeguards**:
   - Dynamically monitor **Axial Loading** (spinal compression), **Joint Shear**, **Grip Fatigue**, and **Intra-Session Muscle Overlap** (e.g., Flat Barbell Bench + Incline DB Press) to alert users when a chosen pairing or subsequent exercise overtaxes pre-fatigued structures.
3. **Rolling Recovery Lookback (36–48h Windows)**:
   - When sessions happen with short turnaround (e.g., `SOLO_UPPER` $\rightarrow$ `SOLO_LOWER` $\rightarrow$ `BUDDY_UPPER` within 36–48 hours), the engine flags conflicting muscle groups (e.g., triceps/front delts pre-fatigued from benching) and shifts recommendations to joint-friendly or antagonist variations.
4. **Weekly & Fortnightly Muscle Volume Distribution (7-Day & 14-Day Windows)**:
   - Track working sets per muscle region over rolling 7-day and 14-day periods so that supersets are allocated with an even spread of focus and avoid overtraining a single region.
5. **Running-Specific Integration**:
   - Prioritize single-leg stability, hamstring knee flexion (sprint deceleration), Achilles/calf deficit loading, and forward/backward turf locomotion.

---

## 2. Program Split Configurations & Session Sequencing

The app supports choosing a **Plan Type** (`PPL` or `UPPER_LOWER`) and a **Weekly Session Target** (`2`, `3`, or `4` sessions per week).

### Split 1: Push / Pull / Legs (PPL)
Classic rolling split separating movement planes. Works across 2, 3, or 4 sessions/week by cycling `PUSH` $\rightarrow$ `PULL` $\rightarrow$ `LEGS` continuously across weeks:
- **Push Day (`PPL_PUSH`)**: Heavy pressing (Flat Barbell Bench, Overhead Press), triceps isolation (pushdowns/skull crushers), chest flyes, lateral delts.
- **Pull Day (`PPL_PULL`)**: Vertical pulls (Lat Pulldowns, Pull-ups), horizontal rows, rear delts, and bicep volume.
- **Leg Day (`PPL_LEGS`)**: Knee-dominant compound (Back Squat), posterior chain hinge (Deadlift/RDL), hamstring curls, calf raises, core decompression, and turf sled finisher.

### Split 2: Buddy Upper / Lower Split (Partner Optimized)
Structured for 2, 3, or 4 sessions/week (`BUDDY_UPPER` $\leftrightarrow$ `BUDDY_LOWER`) to minimize station contention and maximize gym-partner flow:
- **Upper Day (`BUDDY_UPPER`)**:
  - **Primary**: Flat Barbell Bench Press (heavy alternating sets with active spotter).
  - **Superset 1**: Antagonist Machine Row (Narrow/Neutral grip) paired with Low-to-High Cable Flyes (one partner rows while the other flyes; instantaneous swap).
  - **Superset 2**: Shared bench station — Dumbbell/EZ-Bar Skull Crushers paired with Seated Isolated Curls.
  - **Optional Superset 3 / 4**: Cable Lateral Raises + Tricep Rope Pushdowns or Postural Back work.
  - **Finisher**: High-Pulley Long-Rope Face Pulls for external rotation and postural reset.
- **Lower Day (`BUDDY_LOWER`)**:
  - **Primary**: Barbell Back Squat (heavy alternating sets with spotter).
  - **Superset 1**: Seated Machine Hamstring Curls paired with Standing Deficit Machine Calf Raises (spares the spine after squats).
  - **Superset 2**: Neutral-Grip Lat Pulldown paired with Captain's Chair Knee Raises (decompresses the lumbar spine after heavy axial load).
  - **Finisher**: Turf Sled "Down & Back" rounds (Buddy A pushes/pulls while Buddy B times/rests).

### Split 3: Hybrid Solo + Buddy Upper / Lower (4-Session Active Split)
Accounts for solo sessions early in the week followed by quick-turnaround partner sessions:
- **Session 1 — `SOLO_UPPER`**: Dumbbell bench or Barbell Bench focus, single-arm/machine cable work, arm pump stations.
- **Session 2 — `SOLO_LOWER`**: Barbell Back Squat (or RDL), Dumbbell Walking Lunges paired with DB Hammer Curls, Sled Finisher.
- **Session 3 — `BUDDY_UPPER` (36–48h turnaround)**: Flat Barbell Bench, Incline/Chest-Supported Rows, Cable Lateral Raises, Long-Rope Face Pulls.
- **Session 4 — `BUDDY_LOWER`**: Barbell Back Squats, Machine Hamstring Flexion, Standing Deficit Calves, Lat Pulldowns, Core Decompression, Sled Finisher.

### Next-Session Sequencer Logic
As sessions are logged, the engine inspects the most recent completed session and active plan:
- **Upper / Lower (2, 3, or 4 days/week)**:
  - If previous session was Lower (`SOLO_LOWER` or `BUDDY_LOWER`), suggest Upper (`SOLO_UPPER` or `BUDDY_UPPER` depending on schedule mode and day index).
  - If previous session was Upper, suggest Lower.
- **PPL (2, 3, or 4 days/week)**:
  - Cycles `PPL_PUSH` $\rightarrow$ `PPL_PULL` $\rightarrow$ `PPL_LEGS` $\rightarrow$ `PPL_PUSH`.
- **Primary Lift Suggestion**:
  - Automatically selects the default primary anchor lift for the suggested session (e.g., `bb_flat_bench` for Upper/Push, `bb_back_squat` for Lower/Legs, `weighted_pullup` or `bb_pendlay_row` for Pull) while offering valid alternative anchor lifts.

---

## 3. Rules Engine: Thresholds & Constraints

The application executes dynamic validation checks in real time as exercises, supersets, and finishers are added to a session:

### Rule 1: Axial Load Ceiling (Spinal Compression Limit)
- **Definition**: Heavy spinal loading from compressive movements (Back Squats, Barbell Deadlifts, Barbell RDLs, Standing Overhead Barbell Press).
- **Scoring**: Each exercise has an `axialLoadScore` from `0` (none) to `3` (heavy).
- **Trigger**: If the session cumulative `axialLoadScore` exceeds `4`, the engine triggers a warning:
  > *"High axial loading detected following primary lift. Recommend substituting secondary hinges (e.g., Barbell RDL) with supported knee flexion (e.g., Machine Leg Curl) or supported pulls."*

### Rule 2: Non-Competing / Antagonist Superset Mandate & Intra-Session Overlap
- **Definition**: A valid superset must not cause primary mover or grip exhaustion before target muscular failure, nor should secondary supersets excessively stack onto the primary lift's primary movers.
- **Incompatible Pairings (Flagged as Conflicts)**:
  - **Compound Press + Compound Press** (e.g., Flat Barbell Bench + Incline DB Press) — flagged both within a superset AND when an accessory superset duplicates the primary lift's high-stress pressing pattern.
  - **Double Compound Back Pulls** (e.g., Lat Pulldown + Chest-Supported Heavy Row) $\rightarrow$ excessive grip (`combined gripTax >= 3`) and bicep fatigue.
  - **Heavy Lower Hinge + Heavy Lower Quad Compound** (e.g., Squat into Barbell Deadlift/RDL).
- **Valid / Recommended Pairings**:
  - Horizontal Pull + Chest Flye (Chest rests while back works; no forearm/grip clash).
  - Knee Flexion (Leg Curl) + Ankle Extension (Calf Raise).
  - Unilateral Leg Drive (Walking Lunges) + Biceps/Triceps Isolation.
  - Lat Width (Pulldown) + Abdominal Pelvic Curl (Captain's Chair / Reverse Crunch).

### Rule 3: Rolling 48-Hour Recovery Flag
- If a muscle group (e.g., `TRICEPS`, `ANTERIOR_DELT`, `LATS`, `CHEST`, `QUADS`, `HAMSTRINGS`) accumulated **$> 6$ working sets** within the past 48 hours:
  - Flag the muscle group with a 48h Recovery Warning.
  - Restrict additional compound pressing/overhead jerks or heavy axial hinges for that group.
  - Direct isolation toward lengthened-state or underworked divisions (e.g., Low-to-High Cable Flyes for upper pecs, Long-Rope Face Pulls for external rotators, Cable Lateral Raises for side delts, Seated Hamstring Curls for knee flexion).

### Rule 4: Weekly (7-Day) & Fortnightly (14-Day) Volume Balance
- Tracks working sets across all logged sessions in the past 7 and 14 days:
  - **Optimal Weekly Band**: 6–14 working sets per primary muscle group (scaled to 2, 3, or 4 sessions/week).
  - **Overtraining Ceiling**: $> 16$ sets/week (or $> 30$ sets/fortnight) in a single muscle region triggers an **Over-Concentration Warning** and deprioritizes supersets targeting that muscle.
  - **Under-Stimulated Floor**: Muscle regions with $< 4$ sets/week are highlighted as **Recommended Focus Areas** when selecting the next superset.

---

## 4. Sled Finisher Dosing Protocol

For lower body sessions, the turf sled module follows a standardized protocol:
- **Format**: 1 Set = 15–20m Forward Push immediately followed by 15–20m Backward Drag holding mid-posts.
- **Volume**: 3 rounds total.
- **Rest**: 60–90 seconds between rounds (or "You-Go-I-Go" partner rotation).
- **Load Guideline**: Sled tare weight + 20–30 kg initial plate load.
- **Runner Benefit**: Zero eccentric DOMS, patellar tendon health via reverse drag, propulsive concentric power.
