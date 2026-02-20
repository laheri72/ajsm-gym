# Database Schema Reference: AJSM Gym Management System

The AJSM Gym Management System uses a Microsoft SQL Server (MSSQL) database. The schema is optimized for multi-role access, partitioned primarily by `Branch` and `Gender`.

## Core Identity & Authentication

### `PassBank`
Stores login credentials and roles for Staff, Trainers, Admins, and Evaluators.
- `UserID` (INT, PK, IDENTITY)
- `Username` (NVARCHAR(50), UNIQUE)
- `Password` (NVARCHAR(100)) - Hashed with bcrypt.
- `Gender` (NVARCHAR(10)) - 'Male' or 'Female'.
- `Role` (NVARCHAR(20)) - 'Admin', 'Staff', 'Trainer', 'Evaluator'.
- `Branch` (NVARCHAR(50)) - The physical gym branch.
- `IsDefaultPassword` (BIT) - Flag for mandatory first-time password change.

### `TestMaster`
The central identity table for Students.
- `TR` (INT, PK) - Student's unique TR number.
- `ITS` (BIGINT) - Student's ITS number.
- `Name` (NVARCHAR(100))
- `Branch` (NVARCHAR(50))
- `Gender` (NVARCHAR(10))
- `Status` (NVARCHAR(20)) - 'Active', 'Inactive'.
- `Password` (NVARCHAR(100)) - Hashed with bcrypt. NULL for first-time login.
- `HasLoggedInBefore` (BIT)
- `JoinedAt` (DATETIME)
- `DOB` (DATE, Nullable)
- `FitnessLevel` (INT) - Current gamification level (starts at 1).
- `CurrentXP` (INT) - Current XP towards next level.
- `SlotID` (INT, FK) -> `Slots.SlotID`
- `TotalMinutesLogged` (INT) - Running total for 'Iron Dedication' badge.
- `BestStreak` (INT) - Student's personal best workout streak.

## Gym Operations

### `Slots`
Defines available gym timing sessions.
- `SlotID` (INT, PK, IDENTITY)
- `SlotName` (NVARCHAR(50))
- `MaxCapacity` (INT)
- `Branch` (NVARCHAR(50))
- `Gender` (NVARCHAR(10))
- `IsActive` (BIT, Default 1)

### `Attendance`
Logs daily gym check-ins and check-outs.
- `AttendanceID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `WeekID` (INT, FK) -> `AttendanceWeek.WeekID`
- `IsPresent` (BIT)
- `OnLeave` (BIT)
- `CreatedAt` (DATETIME) - Timestamp of check-in.
- `OutTime` (DATETIME) - Timestamp of check-out.
- `DurationInMinutes` (INT) - Calculated duration of the session.
- `Branch` (NVARCHAR(50))
- `Gender` (NVARCHAR(10))

### `AttendanceWeek`
Defines the ISO week boundaries for attendance tracking.
- `WeekID` (INT, PK, IDENTITY)
- `WeekStartDate` (DATE)
- `WeekEndDate` (DATE)

### `WaitingList`
Students waiting to be assigned to a gym slot.
- `WaitingID` (INT, PK, IDENTITY)
- `TR` (INT)
- `Name` (NVARCHAR(100))
- `Darajah` (NVARCHAR(50))
- `Branch` (NVARCHAR(50))
- `Gender` (NVARCHAR(10))
- `RequestedAt` (DATETIME, Default GETDATE())

## Fitness & Medical

### `TestRecords`
Stores results of comprehensive fitness tests.
- `TestLog` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `Weight` (FLOAT)
- `Height` (FLOAT)
- `Waist`, `Hips`, `Neck` (FLOAT)
- `BMI`, `BodyFat`, `BMR`, `CalorieIntake`, `VO2Max` (FLOAT)
- `Total` (FLOAT) - Aggregated fitness score.
- `Grade` (NVARCHAR(2)) - A, B, C, etc.
- `CreatedAt` (DATETIME, Default GETUTCDATE())
- `SubmittedBy` (NVARCHAR(10)) - 'Student' or 'Trainer'.
- `Branch`, `Gender` (NVARCHAR)
- `BatchID` (INT, FK) -> `EvaluationBatches.BatchID`
- `TrainerID` (INT, FK) -> `Trainers.TrainerID` (Only if `SubmittedBy` = 'Trainer')

### `TestActivityLog`
Specific physical activity counts associated with a `TestRecord`.
- `ActivityLogID` (INT, PK, IDENTITY)
- `TestLog` (INT, FK) -> `TestRecords.TestLog`
- `PushUps`, `SitUps`, `Squats`, `SitAndReach`, `StepUpPulseRate` (SMALLINT)

### `MedicalHistory`
One-to-one record for student health disclosures.
- `MedicalID` (INT, PK, IDENTITY)
- `TR` (INT, FK, UNIQUE) -> `TestMaster.TR`
- `Allergies`, `Medications`, `FamilyHistory`, `PreviousInjuries` (NVARCHAR(MAX))

## Evaluation & Feedback

### `Evaluators`
Profiles for the expert evaluator role.
- `EvaluatorID` (INT, PK, IDENTITY)
- `UserID` (INT, FK) -> `PassBank.UserID`
- `Name`, `Profession`, `Contact`, `Email` (NVARCHAR)

### `Evaluations`
Feedback comments on specific fitness tests.
- `EvaluationID` (INT, PK, IDENTITY)
- `LogID` (INT, FK) -> `TestRecords.TestLog`
- `EvaluatorID` (INT, FK) -> `Evaluators.EvaluatorID`
- `CategoryID` (INT, FK) -> `CommentCategories.CategoryID`
- `CommentText` (NVARCHAR(MAX))
- `DateEvaluated` (DATETIME, Default GETUTCDATE())

### `EvaluationBatches`
Groupings of tests for periodic grading.
- `BatchID` (INT, PK, IDENTITY)
- `BatchName` (NVARCHAR(100))
- `Branch`, `Gender` (NVARCHAR)
- `IsActive` (BIT) - Only one active batch allowed per section.
- `CreatedAt` (DATETIME)
- `CreatedBy` (NVARCHAR) - Username from `PassBank`.

## Training & Gamification

### `TrainingPlan`
Logs a completed workout session (date and student).
- `PlanID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `CreatedAt` (DATETIME)
- `Branch`, `Gender` (NVARCHAR)

### `TrainingLog`
Junction table linking workout sessions to specific body parts.
- `LogID` (INT, PK, IDENTITY)
- `PlanID` (INT, FK) -> `TrainingPlan.PlanID`
- `BodyPartID` (INT, FK) -> `BodyParts.BodyPartID`

### `Achievements` & `StudentAchievements`
- `Achievements`: Lookup table for achievement metadata (Name, Description, Badge URL).
- `StudentAchievements`: Junction table linking earned achievements to students.

### `WorkoutPlan`
Student-defined weekly workout schedules.
- `WorkoutPlanID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `Day` (NVARCHAR(20)) - 'Monday' through 'Saturday'.
- `Content` (NVARCHAR(MAX)) - Exercise details.
- `WeekID` (INT, FK) -> `AttendanceWeek.WeekID`

## Relationships Summary
- **Sectioning:** Most operational tables (`TestMaster`, `Attendance`, `Slots`, `WaitingList`, `TestRecords`, `EvaluationBatches`) use a composite `Branch` + `Gender` scope for data isolation.
- **Cascading:** Users in `PassBank` link to role-specific profile tables (`Evaluators`, `Trainers`).
- **Activity Tracking:** `TestRecords` and `TestActivityLog` share a 1:1 relationship via `TestLog`.
- **Workouts:** `TrainingPlan` and `TrainingLog` have a 1:N relationship.
