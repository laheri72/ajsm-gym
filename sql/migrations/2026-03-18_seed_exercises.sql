/*
  Migration: Seed BodyParts + Exercises
  Date: 2026-03-18
  Source: public/js/student-modules/data.js (98 exercises)
  Safe to re-run (all MERGEs are idempotent).
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;
BEGIN TRY

-- ============================================================
-- STEP 1: Ensure all required BodyPart rows exist
-- ============================================================
MERGE dbo.BodyParts AS target
USING (VALUES
    ('Cardio'),
    ('Chest'),
    ('Back'),
    ('Shoulders'),
    ('Biceps'),
    ('Triceps'),
    ('Legs'),
    ('Core'),
    ('General')
) AS source (Name)
ON target.Name = source.Name
WHEN NOT MATCHED THEN
    INSERT (Name) VALUES (source.Name);

-- ============================================================
-- STEP 2: Seed all 98 exercises from data.js
-- ============================================================
MERGE dbo.Exercises AS target
USING (
    SELECT src.Name, bp.BodyPartID, src.Difficulty
    FROM (VALUES
        -- Cardio
        ('Jump Rope',           'Cardio',    'Beginner'),
        ('Running',             'Cardio',    'Beginner'),
        ('High Knees',          'Cardio',    'Beginner'),
        ('Mountain Climbers',   'Cardio',    'Intermediate'),
        ('Jumping Jacks',       'Cardio',    'Beginner'),
        ('Burpees',             'Cardio',    'Advanced'),
        ('Cycling',             'Cardio',    'Beginner'),
        ('Rowing Machine',      'Cardio',    'Intermediate'),
        ('Shadow Boxing',       'Cardio',    'Intermediate'),
        ('Stair Climbing',      'Cardio',    'Beginner'),
        -- Chest
        ('Push-Ups',                    'Chest', 'Beginner'),
        ('Barbell Bench Press',         'Chest', 'Intermediate'),
        ('Dumbbell Bench Press',        'Chest', 'Intermediate'),
        ('Incline Bench Press',         'Chest', 'Intermediate'),
        ('Decline Bench Press',         'Chest', 'Intermediate'),
        ('Cable Chest Fly',             'Chest', 'Intermediate'),
        ('Dumbbell Fly',                'Chest', 'Advanced'),
        ('Chest Dips',                  'Chest', 'Advanced'),
        ('Machine Press',               'Chest', 'Beginner'),
        ('Plyo Push-Ups',               'Chest', 'Advanced'),
        -- Back
        ('Pull-Ups',                 'Back', 'Intermediate'),
        ('Chin-Ups',                 'Back', 'Intermediate'),
        ('Lat Pulldown',             'Back', 'Beginner'),
        ('Barbell Bent-over Rows',   'Back', 'Intermediate'),
        ('Dumbbell Rows',            'Back', 'Beginner'),
        ('Deadlifts',                'Back', 'Advanced'),
        ('Seated Cable Row',         'Back', 'Beginner'),
        ('T-Bar Row',                'Back', 'Intermediate'),
        ('Inverted Rows',            'Back', 'Beginner'),
        ('Face Pulls',               'Back', 'Beginner'),
        -- Shoulders
        ('Barbell Shoulder Press',   'Shoulders', 'Intermediate'),
        ('Dumbbell Shoulder Press',  'Shoulders', 'Intermediate'),
        ('Arnold Press',             'Shoulders', 'Advanced'),
        ('Lateral Raises',           'Shoulders', 'Beginner'),
        ('Front Raises',             'Shoulders', 'Beginner'),
        ('Rear Delt Fly',            'Shoulders', 'Beginner'),
        ('Upright Row',              'Shoulders', 'Intermediate'),
        ('Cable Lateral Raise',      'Shoulders', 'Intermediate'),
        ('Pike Push-Ups',            'Shoulders', 'Advanced'),
        ('Shrugs',                   'Shoulders', 'Beginner'),
        -- Biceps
        ('Barbell Curl',             'Biceps', 'Intermediate'),
        ('Dumbbell Curl',            'Biceps', 'Beginner'),
        ('Hammer Curl',              'Biceps', 'Beginner'),
        ('Concentration Curl',       'Biceps', 'Intermediate'),
        ('Preacher Curl',            'Biceps', 'Intermediate'),
        ('Incline Dumbbell Curl',    'Biceps', 'Advanced'),
        ('Cable Curl',               'Biceps', 'Beginner'),
        ('Spider Curl',              'Biceps', 'Advanced'),
        ('Zottman Curl',             'Biceps', 'Advanced'),
        ('Resistance Band Curl',     'Biceps', 'Beginner'),
        -- Triceps
        ('Triceps Pushdown',                        'Triceps', 'Beginner'),
        ('Overhead Triceps Extension',              'Triceps', 'Intermediate'),
        ('Skull Crushers',                          'Triceps', 'Advanced'),
        ('Close-Grip Bench Press',                  'Triceps', 'Intermediate'),
        ('Dips',                                    'Triceps', 'Intermediate'),
        ('Kickbacks',                               'Triceps', 'Beginner'),
        ('Diamond Push-Ups',                        'Triceps', 'Advanced'),
        ('Rope Extensions',                         'Triceps', 'Beginner'),
        ('Single-arm Overhead Cable Extension',     'Triceps', 'Intermediate'),
        ('Reverse Grip Pushdown',                   'Triceps', 'Intermediate'),
        -- Legs
        ('Barbell Squat',        'Legs', 'Intermediate'),
        ('Front Squat',          'Legs', 'Advanced'),
        ('Lunges',               'Legs', 'Beginner'),
        ('Bulgarian Split Squat','Legs', 'Advanced'),
        ('Leg Press',            'Legs', 'Beginner'),
        ('Romanian Deadlift',    'Legs', 'Intermediate'),
        ('Calf Raise',           'Legs', 'Beginner'),
        ('Leg Extension',        'Legs', 'Beginner'),
        ('Hamstring Curl',       'Legs', 'Beginner'),
        ('Step-ups',             'Legs', 'Beginner'),
        -- Core
        ('Plank',               'Core', 'Beginner'),
        ('Crunches',            'Core', 'Beginner'),
        ('Leg Raises',          'Core', 'Beginner'),
        ('Russian Twist',       'Core', 'Intermediate'),
        ('Hanging Leg Raise',   'Core', 'Advanced'),
        ('Bicycle Crunch',      'Core', 'Intermediate'),
        ('Cable Woodchopper',   'Core', 'Intermediate'),
        ('V-ups',               'Core', 'Advanced'),
        ('Side Plank',          'Core', 'Beginner')
    ) AS src (Name, BodyPartName, Difficulty)
    JOIN dbo.BodyParts bp ON bp.Name = src.BodyPartName
) AS source (Name, BodyPartID, Difficulty)
ON target.Name = source.Name AND target.BodyPartID = source.BodyPartID
WHEN NOT MATCHED THEN
    INSERT (Name, BodyPartID, Difficulty, IsActive, CreatedAt)
    VALUES (source.Name, source.BodyPartID, source.Difficulty, 1, GETDATE());

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Verify
SELECT bp.Name AS BodyPart, COUNT(e.ExerciseID) AS ExerciseCount
FROM dbo.Exercises e
JOIN dbo.BodyParts bp ON bp.BodyPartID = e.BodyPartID
GROUP BY bp.Name
ORDER BY bp.Name;
-- Expected: 9 body parts, total 98 exercises
