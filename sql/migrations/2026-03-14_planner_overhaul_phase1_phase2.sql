/*
  Planner Overhaul Migration (Phase 1 + Phase 2)
  Date: 2026-03-14
  Scope:
    1) Enforce WorkoutPlan data integrity (day enum + unique TR/week/day)
    2) Add normalized planner/execution tables for V2
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

BEGIN TRY
    -- ------------------------------------------------------------
    -- Phase 1: WorkoutPlan data integrity hardening
    -- ------------------------------------------------------------

    -- Remove duplicate planner rows so unique index creation is safe.
    ;WITH Dedup AS (
        SELECT
            TR,
            WeekID,
            Day,
            Content,
            Branch,
            Gender,
            ROW_NUMBER() OVER (
                PARTITION BY TR, WeekID, Day
                ORDER BY
                    CASE WHEN LEN(LTRIM(RTRIM(ISNULL(Content, '')))) > 0 THEN 0 ELSE 1 END,
                    LEN(ISNULL(Content, '')) DESC,
                    Branch,
                    Gender
            ) AS rn
        FROM dbo.WorkoutPlan
        WHERE TR IS NOT NULL
          AND WeekID IS NOT NULL
          AND Day IS NOT NULL
    )
    DELETE FROM Dedup
    WHERE rn > 1;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_WorkoutPlan_Day_Valid'
          AND parent_object_id = OBJECT_ID('dbo.WorkoutPlan')
    )
    BEGIN
        ALTER TABLE dbo.WorkoutPlan
        ADD CONSTRAINT CK_WorkoutPlan_Day_Valid
        CHECK (
            Day IS NULL OR Day IN (
                'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                'Friday', 'Saturday', 'Sunday'
            )
        );
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UX_WorkoutPlan_TR_WeekID_Day'
          AND object_id = OBJECT_ID('dbo.WorkoutPlan')
    )
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UX_WorkoutPlan_TR_WeekID_Day
            ON dbo.WorkoutPlan (TR, WeekID, Day)
            WHERE TR IS NOT NULL
              AND WeekID IS NOT NULL
              AND Day IS NOT NULL;
    END;

    -- ------------------------------------------------------------
    -- Phase 2: Normalized planner + execution model
    -- ------------------------------------------------------------

    IF OBJECT_ID('dbo.Exercises', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Exercises (
            ExerciseID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            Name NVARCHAR(100) NOT NULL,
            BodyPartID INT NOT NULL,
            Equipment NVARCHAR(50) NULL,
            Difficulty NVARCHAR(20) NOT NULL CONSTRAINT DF_Exercises_Difficulty DEFAULT ('Beginner'),
            VideoURL NVARCHAR(255) NULL,
            IsActive BIT NOT NULL CONSTRAINT DF_Exercises_IsActive DEFAULT (1),
            CreatedAt DATETIME NOT NULL CONSTRAINT DF_Exercises_CreatedAt DEFAULT (GETDATE()),
            CONSTRAINT FK_Exercises_BodyParts FOREIGN KEY (BodyPartID)
                REFERENCES dbo.BodyParts (BodyPartID)
        );

        CREATE UNIQUE NONCLUSTERED INDEX UX_Exercises_Name_BodyPart
            ON dbo.Exercises (Name, BodyPartID);
    END;

    IF OBJECT_ID('dbo.WorkoutPrograms', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.WorkoutPrograms (
            ProgramID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            TR INT NULL,
            ProgramName NVARCHAR(100) NOT NULL,
            Description NVARCHAR(500) NULL,
            IsActive BIT NOT NULL CONSTRAINT DF_WorkoutPrograms_IsActive DEFAULT (1),
            CreatedAt DATETIME NOT NULL CONSTRAINT DF_WorkoutPrograms_CreatedAt DEFAULT (GETDATE()),
            Branch VARCHAR(7) NULL,
            Gender VARCHAR(6) NULL,
            CONSTRAINT FK_WorkoutPrograms_TestMaster FOREIGN KEY (TR)
                REFERENCES dbo.TestMaster (TR)
        );

        CREATE INDEX IX_WorkoutPrograms_TR
            ON dbo.WorkoutPrograms (TR);
    END;

    IF OBJECT_ID('dbo.WorkoutWeeks', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.WorkoutWeeks (
            WeekID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            ProgramID INT NOT NULL,
            WeekNumber INT NOT NULL,
            Theme NVARCHAR(50) NULL,
            CONSTRAINT FK_WorkoutWeeks_Programs FOREIGN KEY (ProgramID)
                REFERENCES dbo.WorkoutPrograms (ProgramID) ON DELETE CASCADE,
            CONSTRAINT UX_WorkoutWeeks_Program_Week UNIQUE (ProgramID, WeekNumber)
        );

        CREATE INDEX IX_WorkoutWeeks_ProgramID
            ON dbo.WorkoutWeeks (ProgramID);
    END;

    IF OBJECT_ID('dbo.WorkoutDays', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.WorkoutDays (
            DayID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            WeekID INT NOT NULL,
            DayName VARCHAR(20) NOT NULL,
            OrderIndex INT NOT NULL,
            Notes NVARCHAR(500) NULL,
            CONSTRAINT FK_WorkoutDays_Weeks FOREIGN KEY (WeekID)
                REFERENCES dbo.WorkoutWeeks (WeekID) ON DELETE CASCADE,
            CONSTRAINT CK_WorkoutDays_DayName_Valid CHECK (
                DayName IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
            ),
            CONSTRAINT UX_WorkoutDays_Week_Day UNIQUE (WeekID, DayName)
        );

        CREATE INDEX IX_WorkoutDays_WeekID
            ON dbo.WorkoutDays (WeekID);
    END;

    IF OBJECT_ID('dbo.PlannedExercises', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.PlannedExercises (
            PlannedID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            DayID INT NOT NULL,
            ExerciseID INT NOT NULL,
            TargetSets INT NULL,
            TargetReps NVARCHAR(20) NULL,
            TargetDurationMinutes INT NULL,
            RestSeconds INT NULL,
            OrderIndex INT NOT NULL CONSTRAINT DF_PlannedExercises_OrderIndex DEFAULT (1),
            Notes NVARCHAR(255) NULL,
            Source NVARCHAR(30) NULL,
            CONSTRAINT FK_PlannedExercises_Days FOREIGN KEY (DayID)
                REFERENCES dbo.WorkoutDays (DayID) ON DELETE CASCADE,
            CONSTRAINT FK_PlannedExercises_Exercises FOREIGN KEY (ExerciseID)
                REFERENCES dbo.Exercises (ExerciseID)
        );

        CREATE INDEX IX_PlannedExercises_DayID
            ON dbo.PlannedExercises (DayID, OrderIndex);

        CREATE INDEX IX_PlannedExercises_ExerciseID
            ON dbo.PlannedExercises (ExerciseID);
    END;

    IF OBJECT_ID('dbo.PerformanceLogs', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.PerformanceLogs (
            LogID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            PlanID INT NOT NULL,
            PlannedID INT NULL,
            ExerciseID INT NOT NULL,
            SetNumber INT NULL,
            RepsPerformed INT NULL,
            WeightUsed DECIMAL(10,2) NULL,
            DurationMinutes INT NULL,
            RPE INT NULL,
            IsPR BIT NOT NULL CONSTRAINT DF_PerformanceLogs_IsPR DEFAULT (0),
            CompletedAt DATETIME NOT NULL CONSTRAINT DF_PerformanceLogs_CompletedAt DEFAULT (GETDATE()),
            Branch VARCHAR(7) NULL,
            Gender VARCHAR(6) NULL,
            TR INT NULL,
            CONSTRAINT FK_PerformanceLogs_TrainingPlan FOREIGN KEY (PlanID)
                REFERENCES dbo.TrainingPlan (PlanID) ON DELETE CASCADE,
            CONSTRAINT FK_PerformanceLogs_PlannedExercises FOREIGN KEY (PlannedID)
                REFERENCES dbo.PlannedExercises (PlannedID),
            CONSTRAINT FK_PerformanceLogs_Exercises FOREIGN KEY (ExerciseID)
                REFERENCES dbo.Exercises (ExerciseID),
            CONSTRAINT FK_PerformanceLogs_TestMaster FOREIGN KEY (TR)
                REFERENCES dbo.TestMaster (TR)
        );

        CREATE INDEX IX_PerformanceLogs_PlanID
            ON dbo.PerformanceLogs (PlanID);

        CREATE INDEX IX_PerformanceLogs_TR_CompletedAt
            ON dbo.PerformanceLogs (TR, CompletedAt DESC);

        CREATE INDEX IX_PerformanceLogs_ExerciseID
            ON dbo.PerformanceLogs (ExerciseID, CompletedAt DESC);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

