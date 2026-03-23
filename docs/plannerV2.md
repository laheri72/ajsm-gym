Good research question. Let me read the actual schema definitions for all 6 tables plus the broader schema context.

Viewed 2026-03-14_planner_overhaul_phase1_phase2.sql:1-222
Viewed DATABASE_SCHEMA.md:148-308

Now I have everything I need — the full column definitions, FKs, indexes, and the migration design intent. Let me also quickly check what the other supporting tables look like for cross-reference.

Viewed DATABASE_SCHEMA.md:1-150

Now I have everything. This is a research/analysis task — let me write a thorough explanation directly.

---

## Deep-Dive: The 6 V2 Planner Tables — Purpose, Design & Potential

Here's the expert-level breakdown. I'll answer your specific question about `WorkoutDays` first, then cover the entire system.

---

### Your specific question: Why does `WorkoutDays` create rows for each day name?

Short answer: **it's not creating columns — it's creating rows.** Each row = one specific training day in one specific week. This is **normalized row-per-entity design**, deliberately opposite to the old `WorkoutPlan` which had one JSON blob per day per student. The reason to model it this way is so that each day becomes a **first-class entity with its own ID (`DayID`)**, which other tables can reference with a foreign key. The old design couldn't do that — you can't foreign-key into a JSON string.

---

### The Full Picture: What These 6 Tables Are and Why They Exist

Think of it as a **3-layer plan → prescription → execution** system:

```
Layer 1: PLAN STRUCTURE
  Exercises ← the exercise dictionary (what moves exist)
  WorkoutPrograms ← the program container per student
  WorkoutWeeks ← weeks within that program
  WorkoutDays ← days within each week (the "DayID" rows)

Layer 2: PRESCRIPTION
  PlannedExercises ← what exercises to do on each day, with targets (sets/reps)

Layer 3: EXECUTION (not yet built)
  PerformanceLogs ← what the student actually did (actual sets, reps, weight, RPE)
```

---

### Table-by-Table Purpose

#### 1. `Exercises` — The Master Exercise Dictionary

**What it does:** A central, reusable lookup for every exercise movement.

**Key design:**
- Linked to `BodyParts` (Chest, Back, Core, etc.)
- Has `Difficulty`, `Equipment`, `VideoURL` fields
- Unique constraint [(Name, BodyPartID)](cci:1://file:///d:/My%20Sites/ajsm-gym/routes/staff.js:1019:4-1019:85) prevents duplicates

**Why it matters:** Without this, every exercise is a free-text string buried in a JSON blob. With this table, you can query "how many students did Deadlifts this week?" — something impossible with the legacy `WorkoutPlan`.

**Future potential:**
- Trainer curates approved exercises
- Students can browse exercises by body part/difficulty
- Video tutorial links per exercise
- Equipment filter ("no equipment" workout mode)

---

#### 2. `WorkoutPrograms` — The Program Container

**What it does:** One row per student's active training program. Think of it as a folder that holds all their weekly plans.

**Key design:**
- `TR` → links to student identity (`TestMaster`)
- `IsActive` flag — allowing multiple historical programs (one active at a time)
- `Branch` + `Gender` — enforces the gym's data isolation rules
- `TR = NULL` reserved for **staff-assigned system templates**

**Why it matters:** The legacy system had no concept of a "program". Every week was independent. Now a student can have a 12-week program that persists and evolves over time. Staff can also create shared templates (`TR = NULL`) that auto-fill students' planners.

**Future potential:**
- Staff/trainer assigns a **program template** to a student (`TR = studentTR` but created by trainer UserID)
- Program phases: Bulking phase → Cutting phase → Maintenance
- View program history (past completed programs)
- Compare program performance over time

---

#### 3. `WorkoutWeeks` — Weeks Within a Program

**What it does:** Each row represents one week inside a program. `WeekNumber` = `AttendanceWeek.WeekID` (your existing calendar system), so they stay in sync with the attendance system.

**Key design:**
- `UNIQUE (ProgramID, WeekNumber)` — no duplicate weeks per program
- `Theme` field: optional weekly focus label (`"Deload Week"`, `"Strength Focus"`, `"HIIT Week"`)
- `ON DELETE CASCADE` from `WorkoutPrograms` — clean data if program is deleted

**Why it matters:** A program isn't useful if you can't tell what week you're on and plan differently per week. `WorkoutWeeks` is the bridge between the abstract program concept and the real calendar.

**Future potential:**
- **Progressive overload tracking** — compare Week 1 vs Week 4 planned loads
- **Deload weeks** — automatically lower volume every 4th week using the `Theme` field
- **Week-on-week adherence** — "You completed 80% of week 1, 60% of week 2, etc."
- Re-usable templates where weeks are numbered 1–12 regardless of calendar

---

#### 4. `WorkoutDays` — Days Within a Week

**What it does:** Each row is one specific training day (e.g., Monday of Week 22 of Program 1).

**Key design:**
- `DayName` constrained to `Monday–Sunday` (CHECK constraint)
- `UNIQUE (WeekID, DayName)` — one row per day per week, no duplicates
- `OrderIndex` — display ordering (Monday=0, Tuesday=1, etc.)
- `Notes` — day-level notes (`"Focus on form today"`, `"Rest day"`)
- `ON DELETE CASCADE` from `WorkoutWeeks`

**Why it matters:** This is the row you were questioning. The reason it exists as its own table — instead of just storing day names as strings in `PlannedExercises` — is that `DayID` becomes the anchor for everything on that day. Without it, you'd have to query `WHERE DayName = 'Monday' AND WeekNumber = X AND ProgramID = Y` every time. With `DayID`, all queries on a specific day become a single FK join.

**An important distinction:** The old `WorkoutPlan` had one row per day with a JSON blob. `WorkoutDays` has one row per day too — BUT it's now separately linked to many `PlannedExercises` rows, each normalized with real FKs. The day is no longer "metadata attached to a JSON blob" — it's its own entity.

**Future potential:**
- **Rest day marking** — `Notes = "Rest"` or a `IsRestDay BIT` column
- **Day summaries** — total planned volume per day (sum of sets × reps)
- **Muscle balance visualization** — which muscle groups are hit on which days
- Staff can assign a specific day's plan without changing other days

---

#### 5. `PlannedExercises` — The Workout Prescription

**What it does:** The actual workout script — what exercises to do on each day, in what order, targeting how many sets/reps.

**Key design:**
- `DayID` FK — belongs to a specific `WorkoutDays` row
- `ExerciseID` FK — links to the `Exercises` master table
- `TargetSets`, `TargetReps` (e.g., `"8-12"` as text for ranges), `TargetDurationMinutes`
- `RestSeconds` — prescribed rest between sets
- `OrderIndex` — exercise ordering within the day
- `Source` — `"manual"`, `"autofill"`, `"copied"`, `"staff_assigned"`
- `ON DELETE CASCADE` from `WorkoutDays`

**Why it matters:** Every row is a queryable, joinable exercise prescription. You can now answer: `"Which exercises appear most in students' Monday plans?"` or `"How many students planned Deadlifts this week?"` — completely impossible with the old JSON blob.

**Future potential:**
- **Plan vs. performance comparison** — join with `PerformanceLogs` to see if the student actually did what they planned
- **Volume calculator** — `SUM(TargetSets × TargetReps)` per body part per day
- **Staff plan override** — trainer replaces a student's exercise prescriptions without the student doing it themselves
- **Template propagation** — when admin assigns a template program, `PlannedExercises` rows are bulk-inserted for all weeks at once

---

#### 6. `PerformanceLogs` — The Execution Journal (Not Yet Used)

**What it does:** Records what actually happened during a workout — set by set, rep by rep.

**Key design:**
- `PlanID` FK → `TrainingPlan` — the session header (check-in event)
- `PlannedID` FK → `PlannedExercises` — nullable! (`NULL` = ad-hoc exercise, not pre-planned)
- `ExerciseID` FK — the exercise performed
- `SetNumber`, `RepsPerformed`, `WeightUsed` — the actual execution
- `RPE` (Rate of Perceived Exertion, 1–10) — workout intensity self-report
- `IsPR` BIT — auto-flagged if this set beats the student's previous best
- `TR`, `Branch`, `Gender` — denormalized for fast filtering without joins

**Why it matters (and why it's the most powerful table):** This is where **planned vs. actual** divergence becomes measurable. `PlannedExercises` says "do 3×10 Bench Press at 60kg". `PerformanceLogs` says "you actually did 3 sets: 10 reps, 8 reps, 6 reps at 62.5kg". That gap is your progress data.

**Future potential (the big ones):**
- **Personal Records (PR) system** — auto-detect when `WeightUsed` exceeds historical max → set `IsPR = 1` → award achievement badge
- **Progressive overload tracking** — week-over-week weight increase per exercise
- **1-Rep Max estimator** — calculate from logged sets/reps (Epley formula)
- **RPE trend analysis** — same exercise getting easier over weeks = adaptation
- **Volume progression charts** — total weekly kg lifted per body part
- **Plan adherence scoring** — compare `PlannedExercises` vs logged `PerformanceLogs` for each session
- **Trainer performance review** — trainer can see which students are actually lifting vs. planned

---

### How the 24 Other Tables Cross-Reference

| Existing Table | Connection to V2 Planner |
|---|---|
| `TestMaster` | `WorkoutPrograms.TR` → student identity anchor |
| `AttendanceWeek` | `WorkoutWeeks.WeekNumber` = `AttendanceWeek.WeekID` → keeps planner in sync with attendance calendar |
| `TrainingPlan` | `PerformanceLogs.PlanID` → the session check-in header (existing table now feeds into V2 execution logs) |
| `TrainingLog` | Legacy body-part logging; runs alongside V2 (every PerformanceLog session also writes a TrainingLog entry for backward compat with analytics/gamification) |
| `BodyParts` | `Exercises.BodyPartID` → Chest/Back/etc. tag on each exercise |
| `Achievements` | Can be triggered by `PerformanceLogs.IsPR`, volume milestones, streak counts |
| `Attendance` | Duration data used for planner insights sidebar |
| `WeightTracking` | Cross-referenced with `PerformanceLogs.WeightUsed` for body-weight exercises |

---

### Summary: The Full System When Fully Built

| Feature | Status | Requires |
|---|---|---|
| Student self-plans weekly workout | ✅ Done | Plan + Week + Days + PlannedExercises |
| Dynamic Exercise Library (API + UI) | ✅ Done | Exercises + BodyParts seeded + Video URLs |
| In-session set logging modal | ✅ Done | PerformanceLogs write path |
| PR detection + achievement notification | ✅ Done | depends on PerformanceLogs |
| Trainer assigns program to student | 🔲 Not built | WorkoutPrograms with trainer UserID, TR=student |
| Progressive overload chart | 🔲 Not built | PerformanceLogs aggregation over weeks |
| Plan vs. actual comparison | 🔲 Not built | join PlannedExercises + PerformanceLogs |
| Volume per body part per week | 🔲 Not built | aggregate query over both tables |
| Staff-assigned program templates | 🔲 Not built | WorkoutPrograms with TR=NULL |



# Phase 3 Status (Active Progress)

| Phase | Who | What | Status |
|---|---|---|---|
| 3A | AI | Seed SQL for YouTube Video URLs | ✅ Completed |
| 3B | AI | GET /api/exercises — Dynamic Exercise Library | ✅ Completed |
| 3C | AI | Student in-session logging modal → PerformanceLogs | ✅ Completed |
| 3D | Me | Staff program template builder → assign to branch | 🔲 Pending |
| 3E | Me | Trainer plan oversight — see planned vs. actual | 🔲 Pending |
| 3F | Me | Progressive overload chart — history analytics | 🔲 Pending |