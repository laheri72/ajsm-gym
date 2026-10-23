# API Routes Reference: AJSM Gym Management System

This document provides a technical reference for the application's API endpoints, grouped by their primary feature area.

## 🔐 Authentication (`routes/auth.js`)
Endpoints for user login, logout, and initial password setup.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/student-login` | Student | Log in using TR and password. | `{ tr, password }` |
| POST | `/api/trainer-login` | Trainer | Log in using Username and password. | `{ username, password }` |
| POST | `/api/staff-login` | Staff/Admin | Log in using Username and password. | `{ username, password }` |
| POST | `/api/student/set-initial-password` | Student | Force password change for first-time login. | `{ newPassword }` |
| PUT | `/api/staff/set-initial-password` | Staff/Trainer/Evaluator/Admin | Replace a temporary staff password before other staff APIs become available. The replacement cannot be `jamea1446`. | `{ newPassword }` |
| GET | `/api/session-user` | All | Get the current logged-in user profile from the session. | None |
| GET | `/api/student-session` | Student | Get a detailed student session profile with fitness data. | None |
| POST | `/api/logout` | All | Destroy the current session and log out. | None |

## 📊 Student Dashboard & Analytics (`routes/stu-routes.js`)
Endpoints for student progress, weight tracking, and workout analytics.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/student/achievements/progress` | Student | Calculate live progress for all 5 achievements. | None |
| GET | `/api/achievements/leaderboard` | Student/Staff | Fetch the branch/gender Hall of Fame top 10, ranked by badges first, then cumulative XP/level from `TestMaster.FitnessLevel` and `CurrentXP`. | None |
| GET | `/api/leaderboard` | Student | Fetch the top 3 students based on yesterday's activity. | None |
| POST | `/api/student/log-weight` | Student | Log an ad-hoc weight measurement. | `{ weight }` |
| GET | `/api/student/weight-history` | Student | Fetch all weight logs for the current student. | None |
| DELETE | `/api/student/log-weight/:id` | Student | Delete a specific weight log by its ID. | None |
| POST | `/api/student/set-height` | Student | Update the student's height (stored in `TestMaster`). | `{ heightInCm }` |
| GET | `/api/student/fitness-test-history` | Student | Combined history from `TestRecords` and `WeightTracking`. | None |
| GET | `/api/student/analytics/overview` | Student | Average workout duration and weekly total hours. | None |
| GET | `/api/student/analytics/history` | Student | Recent session history (timestamps and duration). | None |
| GET | `/api/student/workout-calendar` | Student | 6-month workout consistency dates for heatmap. | None |
| POST | `/api/student/set-goal` | Student | Update student's fitness goal in `TestMaster`. | `{ goal }` |

## 📅 Workout Planner (V2) & Logs (`routes/stu-routes.js` & `routes/staff.js`)
Endpoints for managing weekly workout schedules and daily exercise logs.
All planner data is stored in the normalized V2 tables (`WorkoutPrograms → WorkoutWeeks → WorkoutDays → PlannedExercises`). The legacy `WorkoutPlan` table has been dropped.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/student/planner/insights` | Student | Fetch planner intelligence (weekday history, duration baseline, adherence counts from V2 `WorkoutDays`). | None |
| POST | `/api/save-workout-plan` | Student | Save weekly plan → writes to `WorkoutPrograms/WorkoutWeeks/WorkoutDays/PlannedExercises`. Exercises resolved via `Exercises` table. | `{ schemaVersion, days: { Monday..Sunday } }` |
| GET | `/api/student/workout-plan` | Student | Fetch current week planner from V2 tables as structured day plans + insight summary. | None |
| POST | `/api/student/apply-last-week` | Student | Copy previous week V2 plan to current week, or fallback to autofill if no prior plan. | None |
| GET | `/api/student/planner/v2` | Student | V2 planner bridge (redirects to structured current planner endpoint). | None |
| POST | `/api/student/planner/v2` | Student | V2 planner bridge save endpoint (redirects to structured save endpoint). | `{ schemaVersion, days }` |
| POST | `/api/student/planner/v2/autofill` | Student | Auto-fill planner from deterministic recommendations → writes to V2 tables. | `{ mode }` |
| POST | `/api/student/planner/v2/complete-item` | Student | Mark a body-part planner item as completed by creating `TrainingPlan/TrainingLog`. | `{ bodyPart }` |
| GET | `/api/student/training-plans` | Student | Fetch historical workout logs (date + body parts). | None |
| GET | `/api/student/training-analytics` | Student | Counts of body parts trained (for pie charts). | None |
| GET | `/api/trainer/student-plan/:tr` | Trainer | Shows a specific student's V2 weekly plan (reads from `WorkoutDays/PlannedExercises`). | None |
| POST | `/api/log-training-plan` | Trainer | Log a completed workout session; keeps body-part logs and optionally records exercise-level execution into `PerformanceLogs`. | `{ TR, BodyParts, Exercises? }` |

## 🏥 Fitness Tests & Medical History (`routes/fitnessTest.js`)
Endpoints for recording physical measurements and medical status.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/testmaster/me` | Student | Fetch current student profile data. | None |
| PUT | `/api/testmaster/me/dob` | Student | Update the student's date of birth. | `{ DOB }` |
| GET | `/api/medical-history/me` | Student | Fetch the student's medical history. | None |
| POST | `/api/medical-history/me` | Student | Create or update medical history (Upsert). | `{ Allergies, etc. }` |
| POST | `/api/testrecords` | Student | Save a new self-reported fitness test record. | `{ Weight, Height, ..., PushUps, etc. }` |
| GET | `/api/testrecords/me` | Student | Fetch all fitness test records for the current student. | None |
| GET | `/api/testactivity/me` | Student | Fetch all activity-specific logs (PushUps, SitUps, etc.). | None |
| GET | `/api/evaluations/me` | Student | Fetch trainer-submitted tests with evaluator comments. | None |

## Unified fitness profiles (`routes/fitnessProfiles.js`)

All profile routes require an authenticated session. A student can access only their own TR. Staff, trainers, and evaluators are limited to their branch and gender; admins can access both genders in their branch. Medical history is returned only to the student or an evaluator and is excluded from PDFs.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/fitness-profiles/me` | Student | Identity, ordered self/trainer/legacy tests, activity values, batches, comments, per-test reference assessments, medical history, next self test time. | None |
| GET | `/api/fitness-profiles/search` | Staff/Admin/Trainer/Evaluator | Scoped TR or name search. | `?q=` |
| GET | `/api/fitness-profiles/:tr` | Authorized viewer | Scoped student report data. | TR |
| GET | `/api/fitness-cohorts/batches` | Staff/Admin/Trainer/Evaluator | Scoped batch choices. | None |
| GET | `/api/fitness-cohorts/darajahs` | Staff/Admin/Trainer/Evaluator | Distinct scoped `TestMaster` Darajahs for the cohort dropdown, across all gym statuses. | `gender` (admin only, optional) |
| GET | `/api/fitness-cohorts` | Staff/Admin/Trainer/Evaluator | Latest trainer test per student in a batch, batch size, four metric summaries and tie aware percentiles, filters, sort and pagination. | `batchId`, `q`, `gender` (admin), `darajah`, `grade`, `metric`, `min`, `max`, `sort`, `direction`, `page` |
| GET | `/api/fitness-reports/:testLog.pdf` | Student or authorized staff role | Selected one-page test PDF without medical history; inline preview or attachment. Dark teal report is the default. | TestLog, `preview=1` (optional), `template=light` (admin only) |
| GET | `/api/fitness-cohorts/:batchId/reports.pdf` | Staff/Admin | Combined PDF with one page per matching student's latest trainer test, across all result pages. Returns `X-Report-Count`; dark teal is the default. | BatchID, cohort `q`, `gender` (admin), `darajah`, `grade`, `metric`, `min`, `max`, `sort`, `direction`; `template=light` (admin only) |

Student self tests use a server enforced rolling seven day interval. A blocked POST returns HTTP 409 with `nextEligibleAt`. Gym APIs require `TestMaster.Status = 'Active'` and a non-null `JoinedAt`; fitness profile access only requires a master record. Initial student passwords must be changed before accessing other APIs.

## 👨‍💼 Staff & Trainer Management (`routes/staff.js`)
Endpoints for gym operations, attendance, enrollment, and leave management.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/daily-attendance` | Trainer | Fetch attendance status for all active students today. | None |
| POST | `/api/checkout` | Trainer | Mark a student's checkout and award XP for duration. | `{ TR }` |
| GET | `/api/active-sessions` | Trainer | Fetch all students currently checked in (not checked out). | None |
| GET | `/api/verify-tr/:tr` | Trainer | Verify a student TR is active and belongs to the section. | None |
| GET | `/api/recent-activations` | Staff | Fetch students activated today in IST. | None |
| POST | `/api/add-student` | Staff | Register and directly activate a student in `TestMaster`. | `{ TR, ITS, Name, Darajah, SlotID, Goal, ForceActive, preview }` |
| POST | `/api/assign-student-slot` | Staff | Update an active student's time slot. | `{ WaitingID, SlotID }` |
| GET | `/api/weekly-attendance/:weekId` | Staff | Fetch a grid of attendance for a specific week. | None |
| PUT | `/api/attendance-record` | Staff | Manually update attendance/leave status for a student. | `{ TR, CreatedAt, IsPresent, OnLeave }` |
| POST | `/api/attendance/bulk-leave` | Staff | Mark all active students as "On Leave" for a specific date. | `{ date }` |
| GET | `/api/staff/leaves/pending` | Staff | Fetch all pending and on-hold leave requests. | None |
| PUT | `/api/staff/leaves/:id/status` | Staff | Approve, reject, or put a leave request on hold. | `{ status, remarks }` |
| GET | `/api/staff/progress-page-data` | Staff | Fetch bundled analytics payload for Progress page cards/charts/tables. | None |
| GET | `/api/staff/workout-summary-by-bodypart` | Staff | Rank students by workouts for selected body part in staff section. | `?partName=Legs` |
| GET | `/api/staff/goal-alignment` | Staff | Goal vs body-part alignment table for students in staff section. | `?goal=Weight Loss&partName=Cardio` |

## 👑 Admin Control (`routes/admin.js`)
High-level administrative and system configuration endpoints.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/admin/users/:branch` | Admin | Fetch users only when `:branch` matches the admin's session branch. | None |
| GET | `/api/admin/trainers` | Admin | List every trainer account in the admin's branch, including accounts awaiting a profile name. | None |
| PUT | `/api/admin/users/:username/reset-password` | Admin | Reset a Trainer, Staff, or Evaluator in the admin's own branch to the temporary password, require a password change, and end their open sessions. Admin accounts cannot be targets. | None |
| POST | `/api/admin/add-user` | Admin | Create a new system user account. | `{ username, gender, role, branch }` |
| DELETE | `/api/admin/delete-user/:username` | Admin | Delete a user account from `PassBank`. | None |
| PUT | `/api/admin/revoke-student/:tr` | Admin | Mark a student as 'Revoked' and clear their slot. | None |
| PUT | `/api/admin/reset-testmaster-password/:tr` | Admin | Reset a student's password to their TR/ITS. | None |
| GET | `/api/admin/batches` | Admin | Branch batches grouped by gender, with trainer test and student counts. | None |
| POST | `/api/admin/batches` | Admin | Create an active batch or locked draft; omitted `activate` keeps active creation for older clients. | `{ BatchName, Gender, activate?: boolean }` |
| PATCH | `/api/admin/batches/:id` | Admin | Rename an active or locked batch in the admin's branch. | `{ BatchName }` |
| PUT | `/api/admin/batches/:id/lock` | Admin | Lock the active batch. | BatchID |
| PUT | `/api/admin/batches/:id/activate` | Admin | Activate an empty locked draft or reopen the newest batch containing trainer tests, only when that branch and gender have no active batch. | BatchID |
| GET | `/api/admin/evaluation-logs` | Admin | Audit log of all evaluator comments. | `?gender=Male` |
| GET | `/api/admin/unbatched-records` | Admin | Count Trainer-submitted records waiting for a batch. | None |
| POST | `/api/admin/assign-unbatched` | Admin | Assign unbatched records to a locked batch for evaluation. | `{ Gender, TargetBatchID }` |

## 🏆 Gamification (`routes/gamification.js`)
Internal system routes for background evaluation.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/achievements/evaluate` | Internal | Manually trigger the background achievement evaluation. | `x-internal-secret` header |

## 📊 Generic Data & Lookup
Shared endpoints for common data needs.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/weeks` | Staff/Admin | Fetch all defined `AttendanceWeek` periods. | None |
| GET | `/api/slots` | Staff/Trainer | Fetch all available time slots and their capacity. | None |
| GET | `/api/student-lookup/:query` | Staff/Trainer | Search for active students by TR or partial name. | None |
