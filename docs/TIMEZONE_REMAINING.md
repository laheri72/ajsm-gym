# Timezone Follow-Up Notes (Deferred)

Updated: 2026-03-28

## Fixed In This Pass

1. TrainingPlan session inserts now write UTC explicitly (`GETUTCDATE()`) instead of relying on DB server-local defaults.
2. Weekly attendance day-name derivation now uses IST day mapping (`DATEADD(MINUTE, 330, CreatedAt)` before weekday extraction).
3. Staff attendance record fetch/merge date matching now compares by IST day bucket, including bulk leave and leave-approval merges.

## Remaining Timing Risks (Deferred)

1. Achievement/progress aggregations still use raw `CAST(CreatedAt AS DATE)` in multiple places.
   - Impact: streak/attendance counters can be off around midnight boundaries.
   - Likely files: `routes/staff.js`, `routes/stu-routes.js`, `routes/gamification.js`.

2. TrainingPlan historical filters still mix server-local date logic (`GETDATE()`) and UTC/IST logic.
   - Impact: month/week windows may shift for near-boundary sessions.
   - Likely files: `routes/staff.js`, `routes/stu-routes.js`.

3. Some frontend screens still render with browser-local `new Date(...).toLocaleDateString()` instead of explicit IST conversion.
   - Impact: date display differences across user machines/timezones.
   - Likely files: `public/staff/js/profile.js`, `public/staff/js/progress.js`, and related staff analytics views.

4. Trainer home banner date uses `new Date().toISOString().split('T')[0]` (UTC date) instead of IST date.
   - Impact: wrong "today" date display during IST/UTC boundary hours.
   - File: `public/trainer/trainer.js`.

## Suggested Next Pass Order

1. Normalize all date-bucket queries to IST-day logic for attendance/training counters.
2. Standardize rolling window filters (last week/month) to consistent IST-aware UTC boundaries.
3. Standardize frontend display helpers to explicit IST formatting where business requirement is IST-first.
