/*
  Migration: Drop WorkoutPlan table
  Date: 2026-03-18

  ⚠️  RUN THIS ONLY AFTER verifying the new V2 planner routes
       are writing correctly to WorkoutPrograms / WorkoutWeeks /
       WorkoutDays / PlannedExercises.

  Steps:
  1. Drop foreign key constraints on WorkoutPlan
  2. Drop the WorkoutPlan table
*/

-- Drop FK constraints first
IF EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_WorkoutPlan_AttendanceWeek'
      AND parent_object_id = OBJECT_ID('dbo.WorkoutPlan')
)
    ALTER TABLE dbo.WorkoutPlan DROP CONSTRAINT FK_WorkoutPlan_AttendanceWeek;

IF EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_WorkoutPlan_TestMaster'
      AND parent_object_id = OBJECT_ID('dbo.WorkoutPlan')
)
    ALTER TABLE dbo.WorkoutPlan DROP CONSTRAINT FK_WorkoutPlan_TestMaster;

-- Drop the unique index if it was created by the Phase 1 migration
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_WorkoutPlan_TR_WeekID_Day'
      AND object_id = OBJECT_ID('dbo.WorkoutPlan')
)
    DROP INDEX UX_WorkoutPlan_TR_WeekID_Day ON dbo.WorkoutPlan;

-- Drop check constraint if it exists
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_WorkoutPlan_Day_Valid'
      AND parent_object_id = OBJECT_ID('dbo.WorkoutPlan')
)
    ALTER TABLE dbo.WorkoutPlan DROP CONSTRAINT CK_WorkoutPlan_Day_Valid;

-- Finally drop the table
DROP TABLE dbo.WorkoutPlan;

PRINT 'WorkoutPlan table dropped successfully.';
