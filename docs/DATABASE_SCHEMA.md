# Database Schema Reference: AJSM Gym Management System

The AJSM Gym Management System uses a Microsoft SQL Server (MSSQL) database. The schema is optimized for multi-role access, partitioned primarily by `Branch` and `Gender`.

## Core Identity & Authentication

### `PassBank`
Stores login credentials and roles for Staff, Trainers, Admins, and Evaluators.
- `Username` (VARCHAR(50), PK)
- `Password` (NVARCHAR(100)) - Hashed with bcrypt.
- `Role` (VARCHAR(9)) - 'Admin', 'Staff', 'Trainer', 'Evaluator'.
- `Branch` (VARCHAR(7)) - The physical gym branch.
- `Gender` (VARCHAR(6)) - 'Male' or 'Female'.
- `IsDefaultPassword` (BIT) - Flag for mandatory first-time password change.
- `UserID` (INT, UNIQUE, IDENTITY)

### `TestMaster`
The central identity table for Students.
- `TR` (INT, PK) - Student's unique TR number.
- `ITS` (INT, UNIQUE) - Student's ITS number.
- `Darajah` (VARCHAR(15)) - Student's class/grade level.
- `Name` (NVARCHAR(100))
- `DOB` (DATE)
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `Password` (NVARCHAR(100)) - Hashed with bcrypt. NULL for first-time login.
- `FitnessLevel` (INT) - Current gamification level (starts at 1).
- `CurrentXP` (INT) - Current XP towards next level.
- `Status` (VARCHAR(8)) - 'Active', 'Inactive'.
- `SlotID` (INT, FK) -> `Slots.SlotID`
- `JoinedAt` (DATETIME)
- `BestStreak` (INT) - Student's personal best workout streak.
- `TotalMinutesLogged` (INT) - Running total for 'Iron Dedication' badge.
- `Goal` (VARCHAR(50)) - Fitness goal.
- `Height` (DECIMAL(5,2)) - Height in meters.
- `HasLoggedInBefore` (BIT)

## Gym Operations

### `Slots`
Defines available gym timing sessions.
- `SlotID` (INT, PK, IDENTITY)
- `SlotName` (NVARCHAR(25))
- `MaxCapacity` (INT)
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `IsActive` (BIT)

### `Attendance`
Logs daily gym check-ins and check-outs.
- `AttendanceID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `WeekID` (INT, FK) -> `AttendanceWeek.WeekID`
- `IsPresent` (BIT)
- `CreatedAt` (DATETIME) - Timestamp of check-in.
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `OnLeave` (BIT)
- `OutTime` (DATETIME) - Timestamp of check-out.
- `DurationInMinutes` (INT) - Calculated duration of the session.

### `AttendanceWeek`
Defines the ISO week boundaries for attendance tracking.
- `WeekID` (INT, PK, IDENTITY)
- `WeekStartDate` (DATE)
- `WeekEndDate` (DATE)

### `WaitingList`
Students waiting to be assigned to a gym slot.
- `WaitingID` (INT, PK, IDENTITY)
- `LeaveStartDate` (DATE)
- `LeaveEndDate` (DATE)
- `Reason` (NVARCHAR(500))
- `Status` (VARCHAR(10)) - 'Pending', 'Approved', 'Rejected'.
- `RequestedAt` (DATETIME)
- `ReviewedBy` (VARCHAR(50))
- `ReviewedAt` (DATETIME)
- `Remarks` (NVARCHAR(500))

## Fitness & Medical

### `TestRecords`
Stores results of comprehensive fitness tests.
- `TestLog` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `Weight`, `Height`, `Waist`, `Hips`, `Neck` (FLOAT)
- `BMI` (FLOAT)
- `BMIStatus` (VARCHAR(20))
- `BodyFat`, `BMR`, `CalorieIntake`, `VO2Max` (FLOAT)
- `Total` (FLOAT) - Aggregated fitness score.
- `Grade` (NVARCHAR(2)) - A, B, C, etc.
- `CreatedAt` (DATETIME)
- `SubmittedBy` (VARCHAR(7)) - 'Student' or 'Trainer'.
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `BatchID` (INT, FK) -> `EvaluationBatches.BatchID`
- `TrainerID` (INT, FK) -> `Trainers.TrainerID`

### `TestActivityLog`
Specific physical activity counts associated with a `TestRecord`.
- `ActivityLogID` (INT, PK, IDENTITY)
- `TestLog` (INT, FK) -> `TestRecords.TestLog` (ON DELETE CASCADE)
- `PushUps`, `SitUps`, `Squats`, `SitAndReach`, `StepUpPulseRate` (SMALLINT)

### `WeightTracking`
Ad-hoc weight logs for progression tracking.
- `LogID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `Weight` (DECIMAL(5,2))
- `CreatedAt` (DATETIME)

### `MedicalHistory`
One-to-one record for student health disclosures.
- `HistoryID` (INT, PK, IDENTITY)
- `TR` (INT, FK, UNIQUE) -> `TestMaster.TR` (ON DELETE CASCADE)
- `Allergies`, `Medications`, `FamilyHistory`, `PreviousInjuries` (NVARCHAR(MAX))

## Evaluation & Feedback

### `Evaluators`
Profiles for the expert evaluator role.
- `EvaluatorID` (INT, PK, IDENTITY)
- `UserID` (INT, FK) -> `PassBank.UserID` (ON DELETE SET NULL)
- `Name`, `Profession`, `Contact`, `Email` (NVARCHAR(100))

### `Evaluations`
Feedback comments on specific fitness tests.
- `EvaluationID` (INT, PK, IDENTITY)
- `LogID` (INT, FK) -> `TestRecords.TestLog` (ON DELETE CASCADE)
- `EvaluatorID` (INT, FK) -> `Evaluators.EvaluatorID`
- `CategoryID` (INT, FK) -> `CommentCategories.CategoryID`
- `CommentText` (NVARCHAR(MAX))
- `DateEvaluated` (DATETIME)

### `EvaluationBatches`
Groupings of tests for periodic grading.
- `BatchID` (INT, PK, IDENTITY)
- `BatchName` (NVARCHAR(100))
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `IsActive` (BIT)
- `CreatedAt` (DATETIME)
- `CreatedBy` (VARCHAR(50))

### `CommentCategories`
Categories for evaluation comments.
- `CategoryID` (INT, PK, IDENTITY)
- `CategoryName` (NVARCHAR(100))
- `Description` (NVARCHAR(255))

## Structured Workout Planner (V2)

### `Exercises`
Master lookup list for movements.
- `ExerciseID` (INT, PK, IDENTITY)
- `Name` (NVARCHAR(100))
- `BodyPartID` (INT, FK) -> `BodyParts.BodyPartID`
- `Equipment` (NVARCHAR(50))
- `Difficulty` (NVARCHAR(20)) - 'Beginner', 'Intermediate', 'Advanced'.
- `VideoURL` (NVARCHAR(255))
- `IsActive` (BIT)
- `CreatedAt` (DATETIME)

### `WorkoutPrograms`
High-level training blocks (Global or Custom).
- `ProgramID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR` (NULL for System Templates)
- `ProgramName` (NVARCHAR(100))
- `Description` (NVARCHAR(500))
- `IsActive` (BIT)
- `CreatedAt` (DATETIME)
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))

### `WorkoutWeeks`
Relative weeks within a program.
- `WeekID` (INT, PK, IDENTITY)
- `ProgramID` (INT, FK) -> `WorkoutPrograms.ProgramID` (ON DELETE CASCADE)
- `WeekNumber` (INT)
- `Theme` (NVARCHAR(50))

### `WorkoutDays`
Specific day definitions within a week.
- `DayID` (INT, PK, IDENTITY)
- `WeekID` (INT, FK) -> `WorkoutWeeks.WeekID` (ON DELETE CASCADE)
- `DayName` (NVARCHAR(20))
- `OrderIndex` (INT)

### `PlannedExercises`
The workout "prescription" (Target Sets/Reps).
- `PlannedID` (INT, PK, IDENTITY)
- `DayID` (INT, FK) -> `WorkoutDays.DayID` (ON DELETE CASCADE)
- `ExerciseID` (INT, FK) -> `Exercises.ExerciseID`
- `TargetSets` (INT)
- `TargetReps` (NVARCHAR(20))
- `RestSeconds` (INT)
- `OrderIndex` (INT)
- `Notes` (NVARCHAR(255))

### `PerformanceLogs`
Granular set-by-set execution results.
- `LogID` (INT, PK, IDENTITY)
- `PlanID` (INT, FK) -> `TrainingPlan.PlanID` (ON DELETE CASCADE)
- `PlannedID` (INT, FK) -> `PlannedExercises.PlannedID` (NULL for ad-hoc)
- `ExerciseID` (INT, FK) -> `Exercises.ExerciseID`
- `SetNumber` (INT)
- `RepsPerformed` (INT)
- `WeightUsed` (DECIMAL(10,2))
- `DurationMinutes` (INT)
- `RPE` (INT)
- `IsPR` (BIT)
- `CompletedAt` (DATETIME)
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `TR` (INT, FK) -> `TestMaster.TR`

### `StudentPRs`
Personal records snapshot for quick lookup.
- `PRID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `ExerciseID` (INT, FK) -> `Exercises.ExerciseID`
- `OneRepMax` (DECIMAL(10,2))
- `AchievedAt` (DATETIME)
- `PlanID` (INT, FK) -> `TrainingPlan.PlanID`

## Training & Gamification (Legacy & Helpers)

### `BodyParts`
Lookup table for target muscle groups.
- `BodyPartID` (INT, PK, IDENTITY)
- `Name` (VARCHAR(25), UNIQUE)

### `TrainingPlan`
Session header for a completed workout.
- `PlanID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `CreatedAt` (DATETIME)
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))

### `TrainingLog` (Legacy Support)
Junction table linking workout sessions to specific body parts.
- `LogID` (INT, PK, IDENTITY)
- `PlanID` (INT, FK) -> `TrainingPlan.PlanID` (ON DELETE CASCADE)
- `BodyPartID` (INT, FK) -> `BodyParts.BodyPartID`

### `Achievements`
Metadata for system badges and milestones.
- `AchievementID` (INT, PK, IDENTITY)
- `AchievementName` (NVARCHAR(100))
- `Description` (NVARCHAR(255))
- `BadgeImageURL` (NVARCHAR(255))

### `StudentAchievements`
Junction table for earned achievements.
- `StudentAchievementID` (INT, PK, IDENTITY)
- `TR` (INT, FK) -> `TestMaster.TR`
- `AchievementID` (INT, FK) -> `Achievements.AchievementID`
- `DateEarned` (DATETIME)
- `Context` (NVARCHAR(50))

### `WorkoutPlan` (Legacy-Compatible Structured Content)
Student-defined weekly workout schedules (now stored as structured JSON text, with legacy HTML/plain-text still readable by APIs).
- `TR` (INT, FK) -> `TestMaster.TR`
- `Day` (VARCHAR(20))
- `Content` (NVARCHAR(MAX)) - JSON payload: `{ schemaVersion, items[], notes }`
- `Branch` (VARCHAR(7))
- `Gender` (VARCHAR(6))
- `WeekID` (INT, FK) -> `AttendanceWeek.WeekID`
- Unique index: `(TR, WeekID, Day)` (filtered on non-null values)
- Check constraint: `Day` must be one of `Monday`...`Sunday` (or `NULL` for legacy rows)

## Relationships Summary
- **Sectioning:** Data isolation is maintained via `Branch` and `Gender` columns across core tables.
- **Identity:** `PassBank` (Internal Users) and `TestMaster` (Students) are the primary identity anchors.
- **Cascading:** `ON DELETE CASCADE` is used for dependent logs (`TestActivityLog`, `MedicalHistory`, `Evaluations`, `TrainingLog`, `PerformanceLogs`) to ensure cleanup.
- **Set Null:** `ON DELETE SET NULL` is used for profile links (`Evaluators`, `Trainers`) to preserve records if the login account is removed.
