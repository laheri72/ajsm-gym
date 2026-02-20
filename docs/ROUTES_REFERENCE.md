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
| PUT | `/api/staff/set-initial-password` | Staff/Trainer | Force password change for first-time login. | `{ newPassword }` |
| GET | `/api/session-user` | All | Get the current logged-in user profile from the session. | None |
| GET | `/api/student-session` | Student | Get a detailed student session profile with fitness data. | None |
| POST | `/api/logout` | All | Destroy the current session and log out. | None |

## 📊 Student Dashboard & Analytics (`routes/stu-routes.js`)
Endpoints for student progress, weight tracking, and workout analytics.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/student/achievements/progress` | Student | Calculate live progress for all 5 achievements. | None |
| GET | `/api/leaderboard` | Student | Fetch the top 3 students based on yesterday's activity. | None |
| POST | `/api/student/log-weight` | Student | Log an ad-hoc weight measurement. | `{ weight }` |
| GET | `/api/student/weight-history` | Student | Fetch all weight logs for the current student. | None |
| DELETE | `/api/student/log-weight/:id` | Student | Delete a specific weight log by its ID. | None |
| POST | `/api/student/set-height` | Student | Update the student's height (stored in `TestMaster`). | `{ heightInCm }` |
| GET | `/api/student/fitness-test-history` | Student | Combined history from `TestRecords` and `WeightTracking`. | None |
| GET | `/api/student/analytics/overview` | Student | Average workout duration and weekly total hours. | None |
| GET | `/api/student/analytics/history` | Student | Recent session history (timestamps and duration). | None |
| GET | `/api/student/workout-calendar` | Student | 6-month workout consistency dates for heatmap. | None |

## 📅 Workout Planner & Logs (`routes/stu-routes.js` & `routes/staff.js`)
Endpoints for managing weekly workout schedules and daily exercise logs.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/save-workout-plan` | Student | Save a weekly workout plan (Monday-Saturday). | `{ Monday, ..., Saturday }` |
| GET | `/api/student/workout-plan` | Student | Fetch the workout plan for the current week. | None |
| POST | `/api/student/apply-last-week` | Student | Copy the most recent previous workout plan to the current week. | None |
| GET | `/api/student/training-plans` | Student | Fetch historical workout logs (date + body parts). | None |
| GET | `/api/student/training-analytics` | Student | Counts of body parts trained (for pie charts). | None |
| POST | `/api/log-training-plan` | Trainer | Log a student's completed workout session. | `{ TR, BodyParts }` |

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

## 👨‍💼 Staff & Trainer Management (`routes/staff.js`)
Endpoints for gym operations, attendance, enrollment, and leave management.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/daily-attendance` | Trainer | Fetch attendance status for all active students today. | None |
| POST | `/api/checkout` | Trainer | Mark a student's checkout and award XP for duration. | `{ TR }` |
| GET | `/api/active-sessions` | Trainer | Fetch all students currently checked in (not checked out). | None |
| GET | `/api/verify-tr/:tr` | Trainer | Verify a student TR is active and belongs to the section. | None |
| GET | `/api/waiting-list` | Staff | Fetch the waiting list for the current section. | None |
| POST | `/api/add-student` | Staff | Add a student from `TestMaster` to the `WaitingList`. | `{ TR, preview }` |
| POST | `/api/assign-student-slot` | Staff | Activate a waiting list student and assign a time slot. | `{ WaitingID, SlotID }` |
| GET | `/api/weekly-attendance/:weekId` | Staff | Fetch a grid of attendance for a specific week. | None |
| PUT | `/api/attendance-record` | Staff | Manually update attendance/leave status for a student. | `{ TR, CreatedAt, IsPresent, OnLeave }` |
| POST | `/api/attendance/bulk-leave` | Staff | Mark all active students as "On Leave" for a specific date. | `{ date }` |
| GET | `/api/staff/leaves/pending` | Staff | Fetch all pending and on-hold leave requests. | None |
| PUT | `/api/staff/leaves/:id/status` | Staff | Approve, reject, or put a leave request on hold. | `{ status, remarks }` |

## 👑 Admin Control (`routes/admin.js`)
High-level administrative and system configuration endpoints.

| Method | Endpoint | Role | Purpose | Input |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/admin/users/:branch` | Admin | Fetch all users (Staff, Trainers, Evaluators) for a branch. | None |
| POST | `/api/admin/add-user` | Admin | Create a new system user account. | `{ username, gender, role, branch }` |
| DELETE | `/api/admin/delete-user/:username` | Admin | Delete a user account from `PassBank`. | None |
| PUT | `/api/admin/reset-testmaster-password/:tr` | Admin | Reset a student's password to their TR/ITS. | None |
| POST | `/api/admin/batches` | Admin | Create a new active evaluation batch. | `{ BatchName, Gender }` |
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
