/*
  Migration: Seed VideoURL into Exercises table
  Date: 2026-03-18
  Source: youtube.com search links hardcoded in student-dashboard.html
  Pattern: https://www.youtube.com/results?search_query=Exercise+Name+tutorial
  Safe to re-run (only UPDATE WHERE VideoURL IS NULL - won't overwrite custom URLs).
*/

-- Cardio
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Jump+Rope+tutorial' WHERE Name = 'Jump Rope' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Running+cardio+workout' WHERE Name = 'Running' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=High+Knees+exercise' WHERE Name = 'High Knees' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Mountain+Climbers+exercise' WHERE Name = 'Mountain Climbers' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Jumping+Jacks+exercise' WHERE Name = 'Jumping Jacks' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Burpees+exercise' WHERE Name = 'Burpees' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Cycling+exercise' WHERE Name = 'Cycling' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Rowing+Machine+workout' WHERE Name = 'Rowing Machine' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Shadow+Boxing+workout' WHERE Name = 'Shadow Boxing' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Stair+Climbing+workout' WHERE Name = 'Stair Climbing' AND VideoURL IS NULL;

-- Chest
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Push-Ups+tutorial' WHERE Name = 'Push-Ups' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Barbell+Bench+Press+tutorial' WHERE Name = 'Barbell Bench Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Dumbbell+Bench+Press+tutorial' WHERE Name = 'Dumbbell Bench Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Incline+Bench+Press+tutorial' WHERE Name = 'Incline Bench Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Decline+Bench+Press+tutorial' WHERE Name = 'Decline Bench Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Cable+Chest+Fly+tutorial' WHERE Name = 'Cable Chest Fly' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Dumbbell+Fly+tutorial' WHERE Name = 'Dumbbell Fly' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Chest+Dips+tutorial' WHERE Name = 'Chest Dips' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Machine+Press+chest+tutorial' WHERE Name = 'Machine Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Plyo+Push-Ups+tutorial' WHERE Name = 'Plyo Push-Ups' AND VideoURL IS NULL;

-- Back
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Pull-Ups+tutorial' WHERE Name = 'Pull-Ups' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Chin-Ups+tutorial' WHERE Name = 'Chin-Ups' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Lat+Pulldown+tutorial' WHERE Name = 'Lat Pulldown' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Barbell+Bent+over+Rows+tutorial' WHERE Name = 'Barbell Bent-over Rows' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Dumbbell+Rows+tutorial' WHERE Name = 'Dumbbell Rows' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Deadlifts+tutorial' WHERE Name = 'Deadlifts' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Seated+Cable+Row+tutorial' WHERE Name = 'Seated Cable Row' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=T-Bar+Row+tutorial' WHERE Name = 'T-Bar Row' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Inverted+Rows+tutorial' WHERE Name = 'Inverted Rows' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Face+Pulls+tutorial' WHERE Name = 'Face Pulls' AND VideoURL IS NULL;

-- Shoulders
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Barbell+Shoulder+Press+tutorial' WHERE Name = 'Barbell Shoulder Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Dumbbell+Shoulder+Press+tutorial' WHERE Name = 'Dumbbell Shoulder Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Arnold+Press+tutorial' WHERE Name = 'Arnold Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Lateral+Raises+shoulders+tutorial' WHERE Name = 'Lateral Raises' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Front+Raises+shoulders+tutorial' WHERE Name = 'Front Raises' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Rear+Delt+Fly+tutorial' WHERE Name = 'Rear Delt Fly' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Upright+Row+tutorial' WHERE Name = 'Upright Row' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Cable+Lateral+Raise+tutorial' WHERE Name = 'Cable Lateral Raise' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Pike+Push-Ups+tutorial' WHERE Name = 'Pike Push-Ups' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Shrugs+trap+exercise+tutorial' WHERE Name = 'Shrugs' AND VideoURL IS NULL;

-- Biceps
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Barbell+Curl+tutorial' WHERE Name = 'Barbell Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Dumbbell+Curl+tutorial' WHERE Name = 'Dumbbell Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Hammer+Curl+tutorial' WHERE Name = 'Hammer Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Concentration+Curl+tutorial' WHERE Name = 'Concentration Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Preacher+Curl+tutorial' WHERE Name = 'Preacher Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Incline+Dumbbell+Curl+tutorial' WHERE Name = 'Incline Dumbbell Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Cable+Curl+tutorial' WHERE Name = 'Cable Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Spider+Curl+tutorial' WHERE Name = 'Spider Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Zottman+Curl+tutorial' WHERE Name = 'Zottman Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Resistance+Band+Curl+tutorial' WHERE Name = 'Resistance Band Curl' AND VideoURL IS NULL;

-- Triceps
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Triceps+Pushdown+tutorial' WHERE Name = 'Triceps Pushdown' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Overhead+Triceps+Extension+tutorial' WHERE Name = 'Overhead Triceps Extension' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Skull+Crushers+triceps+tutorial' WHERE Name = 'Skull Crushers' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Close+Grip+Bench+Press+tutorial' WHERE Name = 'Close-Grip Bench Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Dips+triceps+tutorial' WHERE Name = 'Dips' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Triceps+Kickbacks+tutorial' WHERE Name = 'Kickbacks' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Diamond+Push-Ups+tutorial' WHERE Name = 'Diamond Push-Ups' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Rope+Triceps+Extensions+tutorial' WHERE Name = 'Rope Extensions' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Single+arm+Overhead+Cable+Extension+tutorial' WHERE Name = 'Single-arm Overhead Cable Extension' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Reverse+Grip+Pushdown+triceps+tutorial' WHERE Name = 'Reverse Grip Pushdown' AND VideoURL IS NULL;

-- Legs
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Barbell+Squat+tutorial' WHERE Name = 'Barbell Squat' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Front+Squat+tutorial' WHERE Name = 'Front Squat' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Lunges+leg+exercise+tutorial' WHERE Name = 'Lunges' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Bulgarian+Split+Squat+tutorial' WHERE Name = 'Bulgarian Split Squat' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Leg+Press+tutorial' WHERE Name = 'Leg Press' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Romanian+Deadlift+tutorial' WHERE Name = 'Romanian Deadlift' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Calf+Raise+tutorial' WHERE Name = 'Calf Raise' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Leg+Extension+machine+tutorial' WHERE Name = 'Leg Extension' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Hamstring+Curl+tutorial' WHERE Name = 'Hamstring Curl' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Step+ups+leg+exercise+tutorial' WHERE Name = 'Step-ups' AND VideoURL IS NULL;

-- Core
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Plank+exercise+tutorial' WHERE Name = 'Plank' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Crunches+abs+tutorial' WHERE Name = 'Crunches' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Leg+Raises+abs+tutorial' WHERE Name = 'Leg Raises' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Russian+Twist+abs+tutorial' WHERE Name = 'Russian Twist' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Hanging+Leg+Raise+tutorial' WHERE Name = 'Hanging Leg Raise' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Bicycle+Crunch+tutorial' WHERE Name = 'Bicycle Crunch' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Cable+Woodchopper+tutorial' WHERE Name = 'Cable Woodchopper' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=V+ups+abs+tutorial' WHERE Name = 'V-ups' AND VideoURL IS NULL;
UPDATE Exercises SET VideoURL = 'https://www.youtube.com/results?search_query=Side+Plank+tutorial' WHERE Name = 'Side Plank' AND VideoURL IS NULL;

-- Verify
SELECT e.Name, bp.Name AS BodyPart, e.VideoURL
FROM Exercises e
JOIN BodyParts bp ON bp.BodyPartID = e.BodyPartID
ORDER BY bp.Name, e.Name;
-- All 98 rows should have a non-null VideoURL
