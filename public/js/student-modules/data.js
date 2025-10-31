export { exerciseDatabase, goalTipsDatabase };
// REPLACE your old exerciseDatabase object with this complete version.
const exerciseDatabase = [
    // Cardio
    { name: 'Jump Rope', difficulty: 'Beginner', primaryMuscle: 'Cardio', secondaryMuscles: ['Calves'] },
    { name: 'Running', difficulty: 'Beginner', primaryMuscle: 'Cardio', secondaryMuscles: ['Legs'] },
    { name: 'High Knees', difficulty: 'Beginner', primaryMuscle: 'Cardio', secondaryMuscles: ['Core'] },
    { name: 'Mountain Climbers', difficulty: 'Intermediate', primaryMuscle: 'Cardio', secondaryMuscles: ['Core', 'Shoulders'] },
    { name: 'Jumping Jacks', difficulty: 'Beginner', primaryMuscle: 'Cardio', secondaryMuscles: ['Full Body'] },
    { name: 'Burpees', difficulty: 'Advanced', primaryMuscle: 'Cardio', secondaryMuscles: ['Full Body'] },
    { name: 'Cycling', difficulty: 'Beginner', primaryMuscle: 'Cardio', secondaryMuscles: ['Legs'] },
    { name: 'Rowing Machine', difficulty: 'Intermediate', primaryMuscle: 'Cardio', secondaryMuscles: ['Back', 'Legs'] },
    { name: 'Shadow Boxing', difficulty: 'Intermediate', primaryMuscle: 'Cardio', secondaryMuscles: ['Shoulders', 'Core'] },
    { name: 'Stair Climbing', difficulty: 'Beginner', primaryMuscle: 'Cardio', secondaryMuscles: ['Glutes'] },

    // Chest
    { name: 'Push-Ups', difficulty: 'Beginner', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
    { name: 'Barbell Bench Press', difficulty: 'Intermediate', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
    { name: 'Dumbbell Bench Press', difficulty: 'Intermediate', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },
    { name: 'Incline Bench Press', difficulty: 'Intermediate', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders'] },
    { name: 'Decline Bench Press', difficulty: 'Intermediate', primaryMuscle: 'Chest', secondaryMuscles: [] },
    { name: 'Cable Chest Fly', difficulty: 'Intermediate', primaryMuscle: 'Chest', secondaryMuscles: [] },
    { name: 'Dumbbell Fly', difficulty: 'Advanced', primaryMuscle: 'Chest', secondaryMuscles: [] },
    { name: 'Chest Dips', difficulty: 'Advanced', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps'] },
    { name: 'Machine Press', difficulty: 'Beginner', primaryMuscle: 'Chest', secondaryMuscles: [] },
    { name: 'Plyo Push-Ups', difficulty: 'Advanced', primaryMuscle: 'Chest', secondaryMuscles: ['Shoulders', 'Triceps'] },

    // Back
    { name: 'Pull-Ups', difficulty: 'Intermediate', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Chin-Ups', difficulty: 'Intermediate', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Lat Pulldown', difficulty: 'Beginner', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Barbell Bent-over Rows', difficulty: 'Intermediate', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Dumbbell Rows', difficulty: 'Beginner', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Deadlifts', difficulty: 'Advanced', primaryMuscle: 'Back', secondaryMuscles: ['Legs', 'Glutes', 'Core'] },
    { name: 'Seated Cable Row', difficulty: 'Beginner', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'T-Bar Row', difficulty: 'Intermediate', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Inverted Rows', difficulty: 'Beginner', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
    { name: 'Face Pulls', difficulty: 'Beginner', primaryMuscle: 'Back', secondaryMuscles: ['Shoulders'] },

    // Shoulders
    { name: 'Barbell Shoulder Press', difficulty: 'Intermediate', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps'] },
    { name: 'Dumbbell Shoulder Press', difficulty: 'Intermediate', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps'] },
    { name: 'Arnold Press', difficulty: 'Advanced', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Lateral Raises', difficulty: 'Beginner', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Front Raises', difficulty: 'Beginner', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Rear Delt Fly', difficulty: 'Beginner', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Upright Row', difficulty: 'Intermediate', primaryMuscle: 'Shoulders', secondaryMuscles: ['Traps'] },
    { name: 'Cable Lateral Raise', difficulty: 'Intermediate', primaryMuscle: 'Shoulders', secondaryMuscles: [] },
    { name: 'Pike Push-Ups', difficulty: 'Advanced', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps'] },
    { name: 'Shrugs', difficulty: 'Beginner', primaryMuscle: 'Shoulders', secondaryMuscles: ['Traps'] },

    // Biceps
    { name: 'Barbell Curl', difficulty: 'Intermediate', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Dumbbell Curl', difficulty: 'Beginner', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Hammer Curl', difficulty: 'Beginner', primaryMuscle: 'Biceps', secondaryMuscles: ['Forearms'] },
    { name: 'Concentration Curl', difficulty: 'Intermediate', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Preacher Curl', difficulty: 'Intermediate', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Incline Dumbbell Curl', difficulty: 'Advanced', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Cable Curl', difficulty: 'Beginner', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Spider Curl', difficulty: 'Advanced', primaryMuscle: 'Biceps', secondaryMuscles: [] },
    { name: 'Zottman Curl', difficulty: 'Advanced', primaryMuscle: 'Biceps', secondaryMuscles: ['Forearms'] },
    { name: 'Resistance Band Curl', difficulty: 'Beginner', primaryMuscle: 'Biceps', secondaryMuscles: [] },

    // Triceps
    { name: 'Triceps Pushdown', difficulty: 'Beginner', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Overhead Triceps Extension', difficulty: 'Intermediate', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Skull Crushers', difficulty: 'Advanced', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Close-Grip Bench Press', difficulty: 'Intermediate', primaryMuscle: 'Triceps', secondaryMuscles: ['Chest'] },
    { name: 'Dips', difficulty: 'Intermediate', primaryMuscle: 'Triceps', secondaryMuscles: ['Chest'] },
    { name: 'Kickbacks', difficulty: 'Beginner', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Diamond Push-Ups', difficulty: 'Advanced', primaryMuscle: 'Triceps', secondaryMuscles: ['Chest'] },
    { name: 'Rope Extensions', difficulty: 'Beginner', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Single-arm Overhead Cable Extension', difficulty: 'Intermediate', primaryMuscle: 'Triceps', secondaryMuscles: [] },
    { name: 'Reverse Grip Pushdown', difficulty: 'Intermediate', primaryMuscle: 'Triceps', secondaryMuscles: [] },

    // Legs
    { name: 'Barbell Squat', difficulty: 'Intermediate', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes', 'Core'] },
    { name: 'Front Squat', difficulty: 'Advanced', primaryMuscle: 'Legs', secondaryMuscles: ['Core'] },
    { name: 'Lunges', difficulty: 'Beginner', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes'] },
    { name: 'Bulgarian Split Squat', difficulty: 'Advanced', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes'] },
    { name: 'Leg Press', difficulty: 'Beginner', primaryMuscle: 'Legs', secondaryMuscles: [] },
    { name: 'Romanian Deadlift', difficulty: 'Intermediate', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes', 'Back'] },
    { name: 'Calf Raise', difficulty: 'Beginner', primaryMuscle: 'Legs', secondaryMuscles: [] },
    { name: 'Leg Extension', difficulty: 'Beginner', primaryMuscle: 'Legs', secondaryMuscles: [] },
    { name: 'Hamstring Curl', difficulty: 'Beginner', primaryMuscle: 'Legs', secondaryMuscles: [] },
    { name: 'Step-ups', difficulty: 'Beginner', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes', 'Cardio'] },

    // Core
    { name: 'Plank', difficulty: 'Beginner', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Crunches', difficulty: 'Beginner', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Leg Raises', difficulty: 'Beginner', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Russian Twist', difficulty: 'Intermediate', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Hanging Leg Raise', difficulty: 'Advanced', primaryMuscle: 'Core', secondaryMuscles: ['Grip'] },
    { name: 'Bicycle Crunch', difficulty: 'Intermediate', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Cable Woodchopper', difficulty: 'Intermediate', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'V-ups', difficulty: 'Advanced', primaryMuscle: 'Core', secondaryMuscles: [] },
    { name: 'Side Plank', difficulty: 'Beginner', primaryMuscle: 'Core', secondaryMuscles: [] }
];

// NEW: Goal-Specific Tips Database
const goalTipsDatabase = {
    "General Fitness": {
        emoji: "🌟",
        title: "All-Around Fitness",
        description: "Your goal is to build a well-rounded, healthy body. This is a fantastic journey of balance, consistency, and feeling great every day!",
        tips: [
            "Aim for 3-4 sessions per week, mixing cardio and strength.",
            "Don't skip your warm-ups! 5-10 minutes of light cardio and dynamic stretching is key.",
            "Listen to your body. Rest days are just as important as workout days.",
            "Stay hydrated! Water is your best friend."
        ],
        proTip: "Try 'full-body' workouts 2-3 times a week to hit every muscle group and maximize efficiency.",
        youtubeQuery: "full body workout for general fitness"
    },
    "Weight Loss": {
        emoji: "🔥",
        title: "Weight Loss",
        description: "You're focused on becoming a healthier, leaner version of yourself. Consistency is your superpower! Let's get it.",
        tips: [
            "Focus on a sustainable calorie deficit. You can't out-train a bad diet.",
            "Combine strength training (to build muscle) with cardio (to burn calories).",
            "Prioritize protein in your meals to stay full and preserve muscle.",
            "Get 7-8 hours of quality sleep. Poor sleep can stall fat loss."
        ],
        proTip: "Try 'NEAT' (Non-Exercise Activity Thermogenesis) — take the stairs, walk while on the phone. These small movements add up!",
        youtubeQuery: "beginner weight loss workout plan"
    },
    "Muscle Gain": {
        emoji: "💪",
        title: "Muscle Gain",
        description: "Your goal is to build strength and size. This requires dedication in the gym and in the kitchen. Time to build!",
        tips: [
            "You must be in a slight calorie surplus. You can't build muscle from nothing!",
            "Eat plenty of protein (1.6-2.2g per kg of body weight) spread throughout the day.",
            "Focus on 'Progressive Overload'—consistently lift heavier or do more reps than last time.",
            "Train each muscle group 2-3 times per week for optimal growth."
        ],
        proTip: "The 'big 5' lifts are your best friends: Squats, Deadlifts, Bench Press, Overhead Press, and Rows. Master them.",
        youtubeQuery: "science of muscle gain"
    },
    "Strength": {
        emoji: "🏋️",
        title: "Pure Strength",
        description: "You're here to get stronger. This is about training your nervous system and muscles to move serious weight. Let's move it!",
        tips: [
            "Focus on compound lifts: squats, bench press, deadlifts, and overhead press.",
            "Train in lower rep ranges (e.g., 3-6 reps) with heavier weight.",
            "Take longer rest periods between sets (3-5 minutes) to fully recover your power.",
            "Perfect your form. Good technique is the key to lifting heavy *and* staying safe."
        ],
        proTip: "Don't neglect 'accessory' work. Exercises like pull-ups, rows, and lunges build the supporting muscles that boost your main lifts.",
        youtubeQuery: "how to get stronger fast strength training"
    },
    "Endurance": {
        emoji: "🏃",
        title: "Endurance",
        description: "Your goal is to go longer and harder, to be the last one standing. This is all about building your body's 'engine'.",
        tips: [
            "Incorporate both LISS (Low-Intensity Steady-State) cardio, like a long jog, and HIIT (High-Intensity Interval Training).",
            "Proper hydration and electrolytes are non-negotiable for long-duration efforts.",
            "Focus on your breathing. Controlled breathing can dramatically improve your stamina.",
            "Train your legs and core. A strong foundation supports your cardiovascular system."
        ],
        proTip: "Try 'Tempo Runs'—run at a comfortably hard pace for 20-30 minutes. This is one of the best ways to raise your lactate threshold.",
        youtubeQuery: "how to increase running endurance"
    },
    "Flexibility": {
        emoji: "🧘",
        title: "Flexibility & Mobility",
        description: "You're working to improve your range of motion, reduce tightness, and move more freely. This is key for long-term health.",
        tips: [
            "Warm up *before* static stretching. Stretch warm muscles, not cold ones.",
            "Hold static stretches for 30-60 seconds. Don't bounce!",
            "Try 'dynamic stretching' (like leg swings) before workouts and 'static stretching' (like a hamstring hold) after workouts.",
            "Consistency is everything. 10 minutes every day is far better than 1 hour once a week."
        ],
        proTip: "Explore PNF (Proprioceptive Neuromuscular Facilitation) stretching with a partner or band. It's an advanced way to 'trick' your muscles into a deeper stretch.",
        youtubeQuery: "full body flexibility routine for beginners"
    },
    "Energy Boost": {
        emoji: "⚡",
        title: "Energy Boost",
        description: "Your goal is to feel more energized and vital in your daily life. The gym is the perfect place to build that energy!",
        tips: [
            "Regular exercise (even 20-30 minutes) is proven to boost energy levels.",
            "Focus on your sleep schedule. A consistent wake-up time is crucial.",
            "Eat whole foods. Processed sugars cause an energy crash. Fuel with proteins, healthy fats, and complex carbs.",
            "Start your day with a glass of water *before* anything else."
        ],
        proTip: "A short, intense workout (like a 10-minute HIIT session) can be more energizing than a long, slow one.",
        youtubeQuery: "morning workout for energy"
    },
    "Stress Relief": {
        emoji: "😌",
        title: "Stress Relief",
        description: "You're using exercise as a powerful tool to manage stress and clear your mind. This is one of the best things you can do for your mental health.",
        tips: [
            "Any movement you *enjoy* is a stress reliever. It could be lifting, running, or just walking.",
            "Rhythmic exercises like running, swimming, or cycling are especially good for zoning out.",
            "Focus on the mind-muscle connection. Feel the muscle working, not the worries in your head.",
            "End your workout with 5 minutes of mindful breathing and light stretching."
        ],
        proTip: "Try a 'box breathing' exercise: Inhale for 4 seconds, hold for 4, exhale for 4, hold for 4. Repeat 5-10 times.",
        youtubeQuery: "exercise for stress and anxiety relief"
    },
    "Overall Health": {
        emoji: "❤️",
        title: "Overall Health",
        description: "Your goal is long-term health and wellness. You're playing the long game, building a resilient body and mind for a better life.",
        tips: [
            "Find a balance of cardio (for heart health) and strength (for bone/muscle health).",
            "Focus on consistency over intensity. Just showing up is a huge win.",
            "Pay attention to your nutrition. Aim for whole foods and a colorful plate.",
            "Manage stress and prioritize sleep. They are pillars of health."
        ],
        proTip: "Don't just track your weight. Track how you feel, your energy levels, your sleep quality, and your mood. These are the true markers of health.",
        youtubeQuery: "best workout for overall health"
    }
};
