let studentTR, studentName, branch, gender, membersince, studentHeight;
let bodyPartChart = null;
let fitnessProgressChart = null;
let weeklyHoursChart = null;
let cachedStudentWeeks = [];
let flatpickrInstance = null; // To hold the date picker instance

// Add this new data structure at the top of your student.js file
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

//--------------------------------------------------------------------------------------------

// ✅ REPLACED getStudentSession function (now only makes one call)
async function getStudentSession() {
  try {
    const res = await fetch('/api/student-session', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();

    if (!data.success) {
      window.location.href = '../Forbidden.html';
      return;
    }

    showLeaderboard();
    
    // All data is now in data.user
    const stu = data.user; 
    
    studentTR = stu.TR;
    studentName = stu.Name;
    branch = stu.Branch;
    gender = stu.Gender;
    studentHeight = stu.Height; // <-- Height is set here
    membersince = new Date(stu.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    // --- XP & Level ---
    document.getElementById('xpBarText').textContent = 'Loading...';
    const lastSeenLevel = parseInt(localStorage.getItem('lastSeenLevel') || '0');
    if (stu.FitnessLevel > lastSeenLevel) {
        showLevelUpAnimation(stu.FitnessLevel);
        localStorage.setItem('lastSeenLevel', stu.FitnessLevel);
    }
    updateXPBarUI(stu.FitnessLevel, stu.CurrentXP);

    // --- Welcome Text ---
    document.getElementById('studentName').innerText = studentName || 'Student';
    const title =
      gender?.toLowerCase() === 'male' ? 'Talabat'
      : gender?.toLowerCase() === 'female' ? 'Talebaat'
      : 'Student';
    
    document.getElementById('welcomeText').innerText =
      `Your personal Fitness Dashboard 
       Member Since ${membersince}
       ${branch} | ${title}`;

    // --- Password Check ---
    if (stu.HasLoggedInBefore === false) {
        const passwordModal = new bootstrap.Modal(document.getElementById('forcePasswordChangeModal'));
        passwordModal.show();
        handleInitialPasswordSet(); // Set up the form listener
    }

    // --- Student Info (from the same API call) ---
    document.getElementById('studentSlot').innerText = stu.SlotName ? `🕒  ${stu.SlotName}` : 'No slot assigned';
    document.getElementById('studentDarajah').innerText = stu.Darajah;
    document.getElementById('studentGoal').innerText = `🎯 Goal: ${stu.Goal}`;
    document.getElementById('studentTR').innerText = studentTR;
    
    // --- Load Other Dashboard Components ---
    loadTip(stu.Goal);
    loadWeeklyPlan();
    loadDashboardStats(); 
    loadCurrentWeightStat();

  } catch (err) {
    console.error('Error fetching student session:', err);
    window.location.href = '../Forbidden.html';
  }
}

//--------------------------------------------------------------------------------------------
// --- NEW FUNCTION: Fetch and display key stats ---
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/student/achievements/progress', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            const progress = result.data;
            const consistency = progress.consistency;

            const currentStreak = consistency.current || 0;
            const personalBest = consistency.personalBest || 0; 

            document.getElementById('stat-current-streak').textContent = `${currentStreak} Days`;
            document.getElementById('stat-best-streak').textContent = `(Best: ${personalBest} Days)`;

            // --- NEW LOGIC ---
            // Calculate progress percent against the personal best.
            // This handles the "divide by zero" case if personalBest is 0.
            const progressPercent = (personalBest > 0) 
                ? Math.min((currentStreak / personalBest) * 100, 100) 
                : 0;

            // --- NEW ID ---
            // Use the new, unique ID for the fill bar
            const streakFill = document.getElementById('stat-streak-progress-fill');
            if (streakFill) {
                streakFill.style.width = `${progressPercent}%`;
            }

            // --- Updated motivation text ---
            const motivationText = document.getElementById('streak-motivation-text');
            if (currentStreak > 0) {
                if (currentStreak >= personalBest && personalBest > 0) {
                     motivationText.textContent = "You're on a new personal best streak!";
                } else if (personalBest > 0) {
                     motivationText.textContent = `You're ${progressPercent.toFixed(0)}% of your personal best!`;
                } else {
                     motivationText.textContent = "Great start! Keep it up!";
                }
            } else {
                 motivationText.textContent = "Start a new streak today!";
            }
        }
    } catch (err) {
        console.error("Could not load dashboard stats:", err);
    }
}

//----------------------------------------------------------------------------------------------
// ADD THESE TWO NEW FUNCTIONS TO student.js
/**
 * Updates the XP bar UI with the student's current level and XP.
 * @param {number} level - The student's current fitness level.
 * @param {number} xp - The student's current XP.
 */
// --- REPLACEMENT for updateXPBarUI function ---
function updateXPBarUI(level, xp) {
    const xpForNextLevel = level * 100;
    const progressPercent = Math.min((xp / xpForNextLevel) * 100, 100);
    const appHeader = document.querySelector('.app-header');
    const rankTag = document.getElementById('rankTag');
    let tierClass = 'xp-tier-bronze';
    let rankName = 'Challenger';
    if (level < 5) { rankName = 'Rookie'; }
    if (level >= 10) { tierClass = 'xp-tier-silver'; rankName = 'Athlete'; }
    if (level >= 20) { tierClass = 'xp-tier-gold'; rankName = 'Pro'; }
    if (level >= 30) { tierClass = 'xp-tier-emerald'; rankName = 'Elite'; }

    if (appHeader) {
        appHeader.classList.remove('xp-tier-bronze', 'xp-tier-silver', 'xp-tier-gold', 'xp-tier-emerald');
        appHeader.classList.add(tierClass);
        appHeader.classList.remove('loading-theme');
    }
    if (rankTag) {
        rankTag.textContent = rankName;
        rankTag.className = `rank-tag`;
    }

    // --- UPDATE ALL XP BARS ---
    // Header Bar
    document.getElementById('fitnessLevel').textContent = level;
    document.getElementById('xpBarFill').style.width = `${progressPercent}%`;
    document.getElementById('xpBarText').textContent = `${xp} / ${xpForNextLevel} XP`;
    // Stats Module Bar (This element was removed, but we'll check if it exists)
    const statXpFill = document.getElementById('stat-xpBarFill');
    const statXpText = document.getElementById('stat-xpBarText');
    if (statXpFill) statXpFill.style.width = `${progressPercent}%`;
    if (statXpText) statXpText.textContent = `${xp} / ${xpForNextLevel} XP`;
}

/**
 * Displays a celebratory "Level Up!" animation.
 * @param {number} newLevel - The new level the student has reached.
 */
// REPLACE your old showLevelUpAnimation function in student.js

function showLevelUpAnimation(newLevel) {
    // 1. Determine the tier class based on the new level
    let tierClass = '';
    if (newLevel >= 10 && newLevel < 20) tierClass = 'swal-tier-silver';
    if (newLevel >= 20 && newLevel < 30) tierClass = 'swal-tier-gold';
    if (newLevel >= 30) tierClass = 'swal-tier-emerald';

    Swal.fire({
        title: 'LEVEL UP!',
        html: `
            <div class="level-up-animation">
                <span class="level-up-number">${newLevel}</span>
            </div>
            <h3 class="level-up-title">You've reached Level ${newLevel}!</h3>
            <p class="level-up-text">Your hard work is paying off. Keep pushing!</p>
        `,
        // 2. Apply the custom class to the pop-up
        customClass: {
            popup: tierClass
        },
        background: '#2c3e50', // Default background
        showConfirmButton: true,
        confirmButtonText: 'Let\'s Go!',
        confirmButtonColor: '#4CAF50'
    });
}

//----------------------------------------------------------------------------------------------

// Add this new function to student.js
function handleInitialPasswordSet() {
    const form = document.getElementById('setPasswordForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            return Swal.fire('Error', 'Passwords do not match.', 'error');
        }

        try {
            const res = await fetch('/api/student/set-initial-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            
            Swal.fire('Success!', 'Your new password has been set.', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('forcePasswordChangeModal'));
            modal.hide();

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });
}

// ADD THIS NEW HELPER FUNCTION
/**
/**
 * Programmatically switches the dashboard view to a specific section.
 * @param {string} targetSectionId - The ID of the content section to show (e.g., 'tips-low').
 */
function navigateToSection(targetSectionId) {
    const mainNav = document.querySelector('.navbar');
    const contentSections = document.querySelectorAll('.content .card');
    const targetLink = mainNav.querySelector(`[data-target="${targetSectionId}"]`);

    if (!targetLink) return;

    // Update nav link states
    mainNav.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    targetLink.classList.add('active');

    // Update section visibility
    contentSections.forEach(section => {
        section.style.display = (section.id === targetSectionId) ? 'block' : 'none';
    });

    // Trigger data loading for the new section if needed
    if (targetSectionId === 'fame-low') {
        loadHallOfFameData();
    }
    if (targetSectionId === 'leaves-low') {
        loadLeaveData();
    }
    
    // --- THIS IS THE FIX ---
    // When the 'Analysis' section is shown, load the
    // data for its default "Overview" tab immediately.
    if (targetSectionId === 'logs-low') {
        loadSessionAnalytics();
        loadWorkoutConsistency();
    }
    // --- END OF FIX ---
}


/**
 * Handles the submission of the new weight log form
 */
async function handleWeightLogSubmit(e) {
    e.preventDefault();
    const weightInput = document.getElementById('weightInput');
    const weight = weightInput.value;
    
    if (!weight) {
        Swal.fire('Error', 'Please enter a weight.', 'error');
        return;
    }
    
    const logButton = document.getElementById('logWeightBtn');
    const buttonText = logButton.querySelector('.button-text');
    const spinner = logButton.querySelector('.spinner-border');

    // Show spinner, hide text, disable button
    buttonText.classList.add('d-none');
    spinner.classList.remove('d-none');
    logButton.disabled = true;
    weightInput.disabled = true;

    try {
        const res = await fetch('/api/student/log-weight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ weight: parseFloat(weight) })
        });
        const result = await res.json();
        
        if (!res.ok) throw new Error(result.message);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Weight Logged!',
            showConfirmButton: false,
            timer: 2000
        });
        
        weightInput.value = ''; // Clear input
        
        // Refresh both the history table AND the main progression chart
        loadWeightLogHistory();
        loadFitnessProgress(); // This now fetches combined data
        loadCurrentWeightStat(); // <-- Add this

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        // Restore button state
        buttonText.classList.remove('d-none');
        spinner.classList.add('d-none');
        logButton.disabled = false;
        weightInput.disabled = false;
    }
}

/**
 * Fetches and renders the ad-hoc weight log history table
 */
async function loadWeightLogHistory() {
    const tbody = document.getElementById('weightHistoryBody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Loading...</td></tr>';
    
    try {
        const res = await fetch('/api/student/weight-history', { credentials: 'include' });
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message);
        
        if (result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">No weight logged yet.</td></tr>';
            return;
        }

        tbody.innerHTML = ''; // Clear loader
        result.data.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.FormattedDate}</td>
                <td>${log.Weight.toFixed(2)} kg</td>
                <td>
                    <button class="btn-delete-log" data-id="${log.LogID}" title="Delete this log">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error: ${err.message}</td></tr>`;
    }
}

/**
 * Handles the click event for deleting a weight log from the history table
 */
function handleWeightLogDelete(e) {
    // Use event delegation to find the delete button
    const deleteButton = e.target.closest('.btn-delete-log');
    if (!deleteButton) return;

    const logId = deleteButton.dataset.id;
    
    Swal.fire({
        title: 'Delete this log?',
        text: "This will remove the weight entry. This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        confirmButtonColor: '#d33'
    }).then(async (result) => {
        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`/api/student/log-weight/${logId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message);

            Swal.fire('Deleted!', 'The weight log has been removed.', 'success');
            
            // Refresh both the table and the main chart
            loadWeightLogHistory();
            loadFitnessProgress(); // This now fetches combined data
            loadCurrentWeightStat(); // <-- Add this

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });
}

/**
 * Fetches and displays the most recent weight log AND BMI on the dashboard stat card.
 * (This version reads the global studentHeight variable set on page load)
 */
async function loadCurrentWeightStat() {
    const weightEl = document.getElementById('stat-current-weight');
    const dateEl = document.getElementById('stat-weight-date');
    const motivationLink = document.getElementById('log-weight-shortcut');
    const bmiArea = document.getElementById('bmi-display-area');

    // Reset BMI area
    bmiArea.innerHTML = '<span class="bmi-value-loading">...</span>';

    try {
        // --- THIS IS THE UPDATED LOGIC ---
        // We ONLY need to fetch the weight history now.
        const weightRes = await fetch('/api/student/weight-history', { credentials: 'include' });
        const weightResult = await weightRes.json();
        
        let currentWeight = null;
        // studentHeight is now read from the global variable (set by getStudentSession)

        if (weightResult.success && weightResult.data.length > 0) {
            // API returns DESC, so the first item is the most recent
            const recentLog = weightResult.data[0];
            currentWeight = recentLog.Weight;
            
            weightEl.textContent = currentWeight.toFixed(1);
            dateEl.textContent = `Logged: ${recentLog.FormattedDate}`;
            motivationLink.textContent = "Great job! Keep logging to see your trend.";
            
        } else {
            // Default state if no weight is logged
            weightEl.textContent = '--';
            dateEl.textContent = 'Log your weight to start!';
            motivationLink.textContent = 'Log your weight frequently to see your progress.';
        }

        // --- NOW, HANDLE THE BMI DISPLAY (using the global studentHeight) ---
        if (studentHeight) {
            // We know the height. Do we know the weight?
            if (currentWeight) {
                // We have both! Calculate BMI.
                const bmi = currentWeight / (studentHeight * studentHeight);
                let category = 'Healthy';
                let categoryClass = 'bmi-healthy';

                if (bmi < 18.5) {
                    category = 'Underweight';
                    categoryClass = 'bmi-underweight';
                } else if (bmi >= 25 && bmi < 30) {
                    category = 'Overweight';
                    categoryClass = 'bmi-overweight';
                } else if (bmi >= 30) {
                    category = 'Obese';
                    categoryClass = 'bmi-obese';
                }
                
                bmiArea.innerHTML = `
                    <div class="bmi-value-wrapper">
                        <span class="bmi-value ${categoryClass}" id="stat-bmi-value">${bmi.toFixed(1)}</span>
                        <button id="edit-height-btn" class="btn-edit-height" title="Edit Height">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                    </div>
                    <p class="stat-category ${categoryClass}" id="stat-bmi-category">${category}</p>
                `;

                // Add event listener to the NEWLY created edit button
                document.getElementById('edit-height-btn').addEventListener('click', handleSetHeight);

            } else {
                // Have height, but no weight
                bmiArea.innerHTML = '<span class="bmi-value-loading">--.-</span>';
            }
        } else {
            // We don't know the height. Show the button.
            bmiArea.innerHTML = '<button id="add-height-btn" class="btn btn-sm btn-outline-primary">Add Height</button>';
            
            // Add an event listener to this new button
            document.getElementById('add-height-btn').addEventListener('click', handleSetHeight);
        }

    } catch (err) {
        console.error('Error loading current weight stat:', err);
        weightEl.textContent = 'Error';
        dateEl.textContent = 'Could not load data';
        bmiArea.innerHTML = '<span class="bmi-value-loading">Error</span>';
        motivationLink.textContent = 'Click here to log weight'; 
    }
}

/**
 * Shows a popup to ask for and save the student's height
 */
async function handleSetHeight() {
    const { value: heightCm } = await Swal.fire({
        title: 'Enter Your Height',
        input: 'number',
        inputLabel: 'Height (in cm)',
        inputPlaceholder: 'e.g., 175',
        inputAttributes: {
            min: 100,
            max: 300,
            step: 1
        },
        showCancelButton: true,
        confirmButtonText: 'Save',
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a value!'
            }
            if (value < 100 || value > 300) {
                return 'Please enter a realistic height (100-300 cm)'
            }
        }
    });

    if (heightCm) {
        try {
            const res = await fetch('/api/student/set-height', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ heightInCm: heightCm })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            Swal.fire('Saved!', 'Your height has been saved.', 'success');
            studentHeight = result.newHeight; // <-- ADD THIS LINE
            loadCurrentWeightStat(); // Re-run the stat card load to show the BMI

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }
}
//-------------------------------------------------------------------------------------------
// REPLACE your old loadAttendance function with this one

// REPLACE the entire loadAttendance function with this corrected version

function loadAttendance(selectedWeekId) { // Accepts the ID correctly

    if (!selectedWeekId) { // Check the passed ID correctly
        clearAttendanceTable("Invalid week selected.");
        return;
    }

    // Hide summary/warning (same as before)
    document.getElementById('attendanceSummaryCard').style.display = 'none';
    document.getElementById('attendanceWarning').style.display = 'none';

    const tbody = document.querySelector('#attendanceTable tbody');
    tbody.innerHTML = `<tr><td colspan="8" class="loader-cell"><div class="loader"></div></td></tr>`; // Show loader

    // --- !!! THE FIX IS HERE !!! ---
    // Use the function argument `selectedWeekId` in the URL, not the old `selectedWeek`
    fetch(`/api/student-attendance/${selectedWeekId}/me`, {
    // --- !!! END OF FIX !!! ---
        method: 'GET',
        credentials: 'include'
    }).then(res => res.json())
      .then(result => {
          if (!result.success) throw new Error(result.error || 'Failed to fetch data.');

          tbody.innerHTML = ''; // Clear the loader

          const data = result.attendance;
          // IMPORTANT: Check if result.weekStartDate exists before using it
          const weekStartDate = result.weekStartDate ? new Date(result.weekStartDate) : null;
          if (!weekStartDate) {
              throw new Error('Week start date missing from API response.');
          }

          if (data.length > 0 && data[0].JoinedAt) {
              const student = data[0];
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const joinedDate = new Date(student.JoinedAt);
              joinedDate.setHours(0, 0, 0, 0);

              const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

              let presentCount = 0;
              let absentCount = 0;
              let onLeaveCount = 0;

              const cells = daysOfWeek.map((day, i) => {
                  const status = student[day];
                  const currentDate = new Date(weekStartDate); // Use fetched start date
                  currentDate.setDate(weekStartDate.getDate() + i);

                  if (currentDate < joinedDate) return `<td>-</td>`;
                  if (status === 'Present') {
                      presentCount++;
                      return `<td class="present">Present</td>`;
                  } else if (status === 'On Leave') {
                      onLeaveCount++;
                      return `<td class="on-leave">On Leave</td>`;
                  } else if (currentDate <= today) { // Only count absence if the day has passed or is today
                      absentCount++;
                      return `<td class="absent">Absent</td>`;
                  } else {
                      return `<td></td>`; // Future days are blank
                  }
              });

              const row = document.createElement('tr');
              row.innerHTML = `
                  <td>${student.TR}</td>
                  <td>${student.Name}</td>
                  ${cells.join('')}
              `;
              tbody.appendChild(row);

              // Update summary card (check elements exist)
              const presentEl = document.getElementById('presentCount');
              const absentEl = document.getElementById('absentCount');
              const onLeaveEl = document.getElementById('onLeaveCount');
              if(presentEl) presentEl.innerText = presentCount;
              if(absentEl) absentEl.innerText = absentCount;
              if(onLeaveEl) onLeaveEl.innerText = onLeaveCount;

              const summaryCard = document.getElementById('attendanceSummaryCard');
              if(summaryCard) summaryCard.style.display = 'block';

              // Show warning if needed (check element exists)
              const warningEl = document.getElementById('attendanceWarning');
              if (warningEl && absentCount >= 2) {
                  warningEl.style.display = 'flex';
              }

          } else {
              tbody.innerHTML = `<tr><td colspan="8" class="text-center">No attendance record found for this week.</td></tr>`;
          }
      })
      .catch(err => {
          console.error('Failed to load student attendance:', err);
          tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading data: ${err.message}. Please try again.</td></tr>`;
      });
}

// --- NEW Helper to Clear Attendance Table ---
function clearAttendanceTable(message = "Select a week above to view attendance.") {
    const tbody = document.querySelector('#attendanceTable tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">${message}</td></tr>`;
    }
    document.getElementById('attendanceSummaryCard').style.display = 'none';
    document.getElementById('attendanceWarning').style.display = 'none';
}
//-------------------------------------------------------------------------------------------

async function loadStudentPlans() {
  try {
    const res = await fetch('/api/student/training-plans', {
      method: 'GET',
      credentials: 'include' // ✅ include session cookies
    });

    const data = await res.json();

    if (data.success && data.data.length > 0) {
      renderTrainingPlans(data.data); // ✅ render to table
    } else {
      console.warn('No plans found:', data.message);
    }
  } catch (err) {
    console.error('Error loading training plans:', err);
  }
}

function renderTrainingPlans(plans) {
    const tbody = document.querySelector('#studentPlanTable tbody');
    tbody.innerHTML = ''; // Clear previous

    // Destroy the old DataTable instance if it exists to prevent errors
    if ($.fn.DataTable.isDataTable('#studentPlanTable')) {
        $('#studentPlanTable').DataTable().destroy();
    }

    plans.forEach(plan => {
        const tr = document.createElement('tr');

        const dateTd = document.createElement('td');
        dateTd.textContent = plan.LogDate;

        const partsTd = document.createElement('td');
        
        // ✅ NEW RENDERING LOGIC
        // Split the string into an array and create an HTML pill for each part
        if (plan.BodyParts) {
            const partsArray = plan.BodyParts.split(', ');
            partsTd.innerHTML = partsArray.map(part => 
                `<span class="body-part-pill">${part}</span>`
            ).join('');
        } else {
            partsTd.textContent = 'N/A';
        }
        
        tr.appendChild(dateTd);
        tr.appendChild(partsTd);

        tbody.appendChild(tr);
    });
    $('#studentPlanTable').DataTable();
}

// A new helper function to generate an array of random, colorful RGBA strings
function generateColors(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);
        colors.push(`rgba(${r}, ${g}, ${b}, 0.7)`); // 0.7 opacity for a nice look
    }
    return colors;
}

// Your updated analytics function
async function loadTrainingAnalytics() {
  try {
    const res = await fetch('/api/student/training-analytics', {
      method: 'GET',
      credentials: 'include'
    });
    const result = await res.json();

    if (result.success && result.data.length > 0) {
      const labels = result.data.map(item => item.bodyPart);
      const data = result.data.map(item => item.count);

      const backgroundColors = generateColors(labels.length);

      const canvasElement = document.getElementById('bodyPartChart');
      if (!canvasElement) return;

      const ctx = canvasElement.getContext('2d');

      // Destroy existing chart if it exists
      if (bodyPartChart) bodyPartChart.destroy();

      bodyPartChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            label: 'Workouts',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Workout Focus (by Count)' }
          }
        }
      });
    }
  } catch (err) {
    console.error("Failed to load analytics chart:", err);
  }
}

//------------------------------------------------------------------------------
// REPLACE your old loadTip function with this one
function loadTip(goal) {
  // Set a fallback goal if the user's goal isn't in our database
  const fallbackGoal = "General Fitness";
  
  // Find the tip data, or use the fallback
  const tipData = goalTipsDatabase[goal] || goalTipsDatabase[fallbackGoal];

  // Create the YouTube search link
  const youtubeLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(tipData.youtubeQuery)}`;

  // Build the new HTML
  const html = `
    <div class="goal-tip-card">
      <h4>${tipData.emoji} Your Goal: ${tipData.title}</h4>
      <p class="goal-description">${tipData.description}</p>
      
      <h5>Actionable Tips:</h5>
      <ul class="goal-tips-list">
        ${tipData.tips.map(tip => `<li>${tip}</li>`).join('')}
      </ul>
      
      <div class="pro-tip-box">
        <strong><i class="bi bi-lightbulb-fill"></i> Pro-Tip:</strong> ${tipData.proTip}
      </div>
      
      <a href="${youtubeLink}" class="btn btn-outline-danger btn-youtube" target="_blank">
        <i class="bi bi-youtube"></i> Watch & Learn: ${tipData.title}
      </a>
    </div>
  `;

  document.getElementById('tipArea').innerHTML = html;
}
//--------------------------------------------------------------------------------

const partTips = {
  "Cardio": {
    desc: "Cardio helps burn calories and improve heart health. Aim for 20–30 minutes of moderate to high-intensity cardio, 3–5 times per week.",
    exercises: [
      { name: "Treadmill Running", img : "/gifs/kory-wagonmaker.gif" },
      { name: "Jump Rope", img: "/gifs/jumping-rope-brandon-william.gif" }
    ]
  },
  "Chest": {
    desc: "Chest exercises develop your pectoral muscles and improve upper body strength. Include both pressing and fly movements.",
    exercises: [
      { name: "Bench Press", img: "/gifs/Barbell-Bench-press.gif" },
      { name: "Chest Fly", img: "/gifs/03081301-Dumbbell-Fly_Chest-FIX_360.gif" }
    ]
  },
  "Back": {
    desc: "Back training improves posture and builds pulling strength. Mix vertical and horizontal pulling exercises.",
    exercises: [
      { name: "Pull-Ups", img: "/gifs/butterfly-kipping-pull-up-gif-oblique-slow-motion-butterfly-kipping-pull-up-technique.gif" },
      { name: "Bent-over Row", img: "/gifs/bai-tap-bent-over-barbell-row.gif" }
    ]
  },
  "Shoulders": {
    desc: "Target all three deltoid heads (front, side, rear) for well-rounded shoulder strength.",
    exercises: [
      { name: "Shoulder Press", img: "/gifs/dumbbell-shoulder-press.gif" },
      { name: "Lateral Raise", img: "/gifs/DB_LAT_RAISE.gif" }
    ]
  },
  "Biceps": {
    desc: "Biceps curls and pulling movements help build strong, toned arms.",
    exercises: [
      { name: "Barbell Curl", img: "/gifs/barbellcurl-1509456994.gif" },
      { name: "Hammer Curl", img: "/gifs/hammer curl.gif" }
    ]
  },
  "Triceps": {
    desc: "Triceps are key for arm size and pushing strength. Use isolation and compound lifts.",
    exercises: [
      { name: "Triceps Pushdown", img: "/gifs/triceps-pushdown-gif.gif" },
      { name: "Overhead Extension", img: "/gifs/5e22347fc864160c82d10bfe_overhead-extension-kettlebell-exericse-anabolic-aliens.gif" }
    ]
  },
  "Legs": {
    desc: "Leg training builds strength, balance, and coordination. Include squats, lunges, and deadlifts.",
    exercises: [
      { name: "Squats", img: "/gifs/air-squat-gif-side-view-air-squat-technique.gif" },
      { name: "Lunges", img: "/gifs/9c198f0c2f2b714d4f7e920bd4ac615e.gif" }
    ]
  },
  "Core": {
    desc: "Core workouts improve stability, posture, and total-body strength. Mix planks, crunches, and rotational moves.",
    exercises: [
      { name: "Plank", img: "/gifs/Plank.gif" },
      { name: "Russian Twist", img: "/gifs/russian twist.gif" }
    ]
  }
};

function loadBodyPartTips() {
  const value = document.getElementById("bodyPartSelect").value;
  const target = document.getElementById("bodyPartTips");
  target.innerHTML = "";

  if (!value || !partTips[value]) return;

  const { desc, exercises } = partTips[value];
  let html = `<p>${desc}</p><div class="row">`;

  exercises.forEach(ex => {
    html += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card h-100 shadow-sm">
          <img src="${ex.img}" class="card-img-top" alt="${ex.name}" loading="lazy">
          <div class="card-body">
            <h5 class="card-title">${ex.name}</h5>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  target.innerHTML = html;
}

//--------------------------------------------------------------------------------

function formatDate(dateString) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}


// This function now fetches AND initializes the picker
async function initializeWeekPicker() {
    const weekPickerInput = document.getElementById('weekPickerInput');
    if (!weekPickerInput) return; // Exit if the element isn't found

    try {
        // 1. Fetch eligible weeks (as before)
        const res = await fetch('/api/student/eligible-weeks', { credentials: 'include' });
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Could not fetch eligible weeks.');
        }

        cachedStudentWeeks = data.weeks || [];

        if (cachedStudentWeeks.length === 0) {
            weekPickerInput.placeholder = "No attendance weeks available yet.";
            weekPickerInput.disabled = true;
            return;
        }
        // --- Convert week start/end dates to Moment objects ONCE for efficiency ---
        const momentRanges = cachedStudentWeeks.map(week => ({
            start: moment(week.WeekStartDate), // Parse into Moment objects
            end: moment(week.WeekEndDate)
        }));
        
        // 3. Initialize Flatpickr
        flatpickrInstance = flatpickr(weekPickerInput, {
            dateFormat: "M d, Y", // How the date looks in the input
            weekNumbers: false,   // We don't need ISO week numbers
            enable: [
                function(date) {
                    // Check if 'date' falls within any of the fetched week ranges
                    const currentMoment = moment(date); // Convert the calendar date to Moment
                    // Use .some() to efficiently check if ANY range includes the date
                    return momentRanges.some(range =>
                        currentMoment.isBetween(range.start, range.end, 'day', '[]') // Inclusive check
                    );
                }
            ],
            mode: "single", // Select a single date to represent the week
            altInput: true, // Shows a user-friendly format but submits standard one
            altFormat: "D, M j, Y", // Format shown to the user
            plugins: [],
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length === 0) {
                    clearAttendanceTable(); // Clear if date is cleared
                    return;
                }
                const selectedDate = selectedDates[0]; // Get the Date object
                findAndLoadAttendanceForDate(selectedDate);
            },
        });

        // 4. (Optional) Set initial value to the current/latest week
        const today = moment.tz("Asia/Kolkata").toDate(); // Use Moment Timezone
        findAndLoadAttendanceForDate(today, true); // Pass true to set initial picker value

    } catch (err) {
        console.error('Failed to initialize week picker:', err);
        weekPickerInput.placeholder = "Error loading weeks.";
        weekPickerInput.disabled = true;
        Swal.fire({
            icon: 'error', title: 'Error',
            text: err.message || 'Could not load week data for selection.'
        });
    }
}

// --- NEW Helper Function to find the week ID and load data ---
function findAndLoadAttendanceForDate(selectedDate, setPickerValue = false) {
    // Ensure cached weeks are available
    if (cachedStudentWeeks.length === 0) {
        console.warn("No cached weeks to search within.");
        clearAttendanceTable("No attendance weeks available.");
        return;
    }

    // Find the week in our cached list that contains the selected date
    const selectedMoment = moment(selectedDate); // Use Moment for easier comparison
    const targetWeek = cachedStudentWeeks.find(week => {
        const start = moment(week.WeekStartDate);
        const end = moment(week.WeekEndDate);
        return selectedMoment.isBetween(start, end, 'day', '[]'); // '[]' includes start/end days
    });

    if (targetWeek) {
        // Found the week! Load attendance using its WeekID
        loadAttendance(targetWeek.WeekID); // Call the modified loadAttendance

        // Optionally update the Flatpickr input visually
        if (setPickerValue && flatpickrInstance) {
            // Find the *Monday* of the target week to set the picker consistently
            const weekStartMoment = moment(targetWeek.WeekStartDate);
            flatpickrInstance.setDate(weekStartMoment.toDate(), false); // Set date without triggering onChange again
        }
    } else {
        // Selected date doesn't fall into any known week range
        console.warn("Selected date is not within any eligible week:", selectedDate);
        clearAttendanceTable("Selected date is outside available attendance weeks.");
        // Optionally clear the Flatpickr input if desired:
        // if (flatpickrInstance) flatpickrInstance.clear(false);
    }
}
//----------------------------------------------------------------------------------------------------------

function savePlan() {
  const cards = document.querySelectorAll('.day-card');
  const plan = {};

  let hasContent = false;
  cards.forEach(card => {
    const day = card.getAttribute('data-day');
    const content = DOMPurify.sanitize(card.innerHTML.trim());
    plan[day] = content;
    if (content) hasContent = true;
  });

  if (!hasContent) {
    Swal.fire({
      icon: 'warning',
      title: 'Empty Plan',
      text: 'Please add at least one workout to your weekly plan.',
    });
    return;
  }

  const saveButton = document.getElementById('savePlanBtn');
  const buttonText = saveButton.querySelector('.button-text');
  const spinner = saveButton.querySelector('.spinner-border');

  // Show spinner, hide text, disable button
  buttonText.classList.add('d-none');
  spinner.classList.remove('d-none');
  saveButton.disabled = true;

  fetch('/api/save-workout-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(plan)
  })
    .then(res => {
      if (res.status === 401) {
      // If the server says we're unauthorized, redirect immediately.
      window.location.href = '../Forbidden.html';
      // Halt the rest of the function by returning a promise that never resolves.
      return new Promise(() => {}); 
    }
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Workout plan endpoint not found. Check if the backend server is running on port 10000.');
        } else if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        }
        throw new Error(`Server error: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Workout Plan Saved!',
          text: 'Your weekly plan was saved successfully.',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: data.message || 'Please try again.',
        });
      }
    })
    .catch(err => {
      console.error('Save error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Could not save. Check your connection or server status.',
      });
    })
    .finally(() => {
      // Restore button state
      buttonText.classList.remove('d-none');
      spinner.classList.add('d-none');
      saveButton.disabled = false;
    });
}

// Clear planner contents
function clearPlanner() {
  Swal.fire({
    title: 'Clear weekly planner?',
    text: 'This will remove all exercises from the current planner view.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Clear',
    confirmButtonColor: '#dc3545'
  }).then(r => {
    if (!r.isConfirmed) return;
    document.querySelectorAll('.day-card').forEach(card => { card.innerHTML = ''; });
    localStorage.removeItem('plannerDraft');
  });
}

// --- Fix #4: Helper function to correctly add exercises to cards ---
function addExerciseToCard(day, formattedExercise) {
    const dayCards = document.querySelectorAll(`.day-card[data-day="${day}"]`);
    if (dayCards.length === 0) return;

    dayCards.forEach(card => {
        // Remove placeholder text if it exists
        const placeholder = card.querySelector('.placeholder-text');
        if (placeholder) {
            card.innerHTML = '';
        }

        // Append the new exercise
        if (card.innerHTML.trim() !== '') {
            card.innerHTML += '<br>' + DOMPurify.sanitize(formattedExercise);
        } else {
            card.innerHTML = DOMPurify.sanitize(formattedExercise);
        }
    });
    
    Swal.fire({ 
        toast: true, 
        position: 'top-end', 
        icon: 'success', 
        title: `Added to ${day}!`, 
        showConfirmButton: false, 
        timer: 1600 
    });
}

/**
 * Opens a guided dialog with filterable exercises.
 * @param {string} day - The day to add the exercise to.
 */
function openQuickAddDialog(day) {
    const bodyPartOptions = ['All', ...new Set(exerciseDatabase.map(ex => ex.primaryMuscle))];

    const html = `
        <div class="exercise-explorer">
            <div class="filters">
                <select id="qa-filter-bodypart" class="swal2-select">
                    ${bodyPartOptions.map(bp => `<option value="${bp}">${bp}</option>`).join('')}
                </select>
                <select id="qa-filter-difficulty" class="swal2-select">
                    <option value="All">All Difficulties</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                </select>
            </div>
            <div id="qa-exercise-list" class="exercise-list">
                </div>
            <div id="qa-sets-reps-container" class="sets-reps-container" style="display:none;">
                <h4 id="qa-selected-exercise-name"></h4>
                <input id="qa-sets" class="swal2-input" type="number" min="1" placeholder="Sets" />
                <input id="qa-reps" class="swal2-input" type="text" placeholder="Reps (e.g., 10-12)" />
            </div>
        </div>
    `;

    Swal.fire({
        title: `Select an Exercise for ${day}`,
        html,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'Add to Plan',
        focusConfirm: false,
        didOpen: () => {
            // Render the initial list and set up filter listeners
            renderExerciseList();
            document.getElementById('qa-filter-bodypart').addEventListener('change', renderExerciseList);
            document.getElementById('qa-filter-difficulty').addEventListener('change', renderExerciseList);
        },
        preConfirm: () => {
            const selectedItem = document.querySelector('.exercise-item.selected');
            if (!selectedItem) {
                Swal.showValidationMessage('Please select an exercise from the list');
                return false;
            }
            const name = selectedItem.dataset.name;
            const sets = (document.getElementById('qa-sets').value || '').trim();
            const reps = (document.getElementById('qa-reps').value || '').trim();
            return { name, sets, reps };
        }
    }).then(result => {
            if (!result.isConfirmed) return;
            const { name, sets, reps } = result.value;
            const formatted = [name, sets && `${sets} sets`, reps && `${reps} reps`].filter(Boolean).join(' - ');
            
            // Use our new, reliable helper function
            addExerciseToCard(day, formatted);
        });
}

/**
 * Renders the list of exercises based on the current filter selections.
 */
function renderExerciseList() {
    const bodyPartFilter = document.getElementById('qa-filter-bodypart').value;
    const difficultyFilter = document.getElementById('qa-filter-difficulty').value;
    const listContainer = document.getElementById('qa-exercise-list');

    const filteredExercises = exerciseDatabase.filter(ex => {
        const bodyPartMatch = bodyPartFilter === 'All' || ex.primaryMuscle === bodyPartFilter;
        const difficultyMatch = difficultyFilter === 'All' || ex.difficulty === difficultyFilter;
        return bodyPartMatch && difficultyMatch;
    });

    if (filteredExercises.length === 0) {
        listContainer.innerHTML = '<p class="no-results">No exercises match your criteria.</p>';
        return;
    }

    listContainer.innerHTML = filteredExercises.map(ex => {
        const secondaryMusclesHtml = ex.secondaryMuscles.map(sm => `<span class="badge badge-dark">${sm}</span>`).join('');
        return `
            <div class="exercise-item" data-name="${ex.name}">
                <div class="exercise-info">
                    <strong>${ex.name}</strong>
                    <div class="tags">
                        <span class="badge badge-${{'Beginner':'green', 'Intermediate':'yellow', 'Advanced':'red'}[ex.difficulty]}">${ex.difficulty}</span>
                        ${secondaryMusclesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners to each newly rendered exercise item
    listContainer.querySelectorAll('.exercise-item').forEach(item => {
        item.addEventListener('click', () => {
            // Un-select any previously selected item
            listContainer.querySelectorAll('.exercise-item').forEach(el => el.classList.remove('selected'));
            // Select the clicked item
            item.classList.add('selected');

            // Show the sets/reps input
            document.getElementById('qa-selected-exercise-name').textContent = item.dataset.name;
            document.getElementById('qa-sets-reps-container').style.display = 'flex';
            document.getElementById('qa-sets').focus();
        });
    });
}

// Collect unique exercise names from all tips tables
function collectExerciseList() {
  const names = new Set();
  document.querySelectorAll('#workoutAccordion tbody tr td:first-child').forEach(td => {
    const txt = (td.textContent || '').trim();
    if (txt) names.add(txt);
  });
  return Array.from(names).sort();
}

// --- REPLACEMENT for loadWeeklyPlan function ---
async function loadWeeklyPlan() {
  try {
    const res = await fetch('/api/student/workout-plan', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.data)) {
      // --- NEW LOGIC FOR TODAY HUB ---
      // 1. Get today's name in IST
      moment.tz.setDefault("Asia/Kolkata");
      const todayName = moment().format('dddd'); // e.g., "Monday"

      // 2. Populate the Today's View
      const todayDateHeading = document.getElementById('today-date-heading');
      const todayCard = document.getElementById('today-day-card');
      todayDateHeading.textContent = `Today's Plan (${todayName})`;
      todayCard.dataset.day = todayName; // Set the data-day attribute for saving

      // Find today's plan from the fetched data
      const todayPlan = data.data.find(entry => entry.Day === todayName);
      if (todayPlan && todayPlan.Content) {
          todayCard.innerHTML = DOMPurify.sanitize(todayPlan.Content);
      } else {
          // If no plan, clear it and show placeholder
          todayCard.innerHTML = '<p class="placeholder-text">No workout planned for today. Add one!</p>';
      }

      // 3. Populate the Full Weekly View (no changes here)
      const weeklyCards = document.querySelectorAll('#weekly-view .day-card');
      weeklyCards.forEach(card => {
        const day = card.getAttribute('data-day');
        const planData = data.data.find(p => p.Day === day);
        if (planData) {
          card.innerHTML = DOMPurify.sanitize(planData.Content || '');
        } else {
          card.innerHTML = ''; // Clear if no plan for that day
        }
      });

      if (data.data.length === 0) {
        document.getElementById('applyLastWeekBtn').style.display = 'inline-block';
      }
    } else {
      console.warn('Invalid response from workout plan API:', data.message);
    }
  } catch (err) {
    console.error('Error loading workout plan:', err);
  }
}

async function applyLastWeeksPlan() {
  try {
    const res = await fetch('/api/student/apply-last-week', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Applied!',
        text: 'Last week’s plan applied successfully.',
        timer: 2000,
        showConfirmButton: false
      });
      loadWeeklyPlan();
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Apply Failed',
        text: data.message || 'Could not apply last week’s plan.',
      });
    }
  } catch (err) {
    console.error('Error applying last week’s plan:', err);
    Swal.fire({
      icon: 'error',
      title: 'Network Error',
      text: 'Failed to apply last week’s plan.',
    });
  }
}
//--------------------------------------------------------------------------------------------------------

// ADD this new function to student.js

function showXpInfoModal() {
    const level = parseInt(document.getElementById('fitnessLevel').textContent || '1');
    const currentXP = parseInt(document.getElementById('xpBarText').textContent.split(' / ')[0] || '0');
    const xpForNextLevel = level * 100;
    const xpNeeded = xpForNextLevel - currentXP;

    const html = `
        <div class="xp-modal-content">
            <div class="xp-modal-header">
                <h3>How to Level Up</h3>
                <p>Leveling up unlocks new header themes and bragging rights! Here's how you earn XP.</p>
            </div>

            <ul class="xp-earning-list">
                <li>
                    <span class="xp-icon">⏱️</span>
                    <span class="xp-action">Time in Gym</span>
                    <span class="xp-value">1 XP / minute</span>
                </li>
                <li>
                    <span class="xp-icon">💪</span>
                    <span class="xp-action">Body Part Logged</span>
                    <span class="xp-value">10 XP / part</span>
                </li>
                <li>
                    <span class="xp-icon">📋</span>
                    <span class="xp-action">Complete Fitness Test</span>
                    <span class="xp-value">100 XP</span>
                </li>
                <li>
                    <span class="xp-icon">🏆</span>
                    <span class="xp-action">Earn a New Badge</span>
                    <span class="xp-value">50 XP</span>
                </li>
                <li>
                    <span class="xp-icon">🧑‍🏫</span>
                    <span class="xp-action">Trainer-led Fitness Test</span>
                    <span class="xp-value">150 XP</span>
                </li>
            </ul>

            <div class="xp-modal-footer">
                <h4>Your Next Level</h4>
                <p>
                    You are <strong>Level ${level}</strong>. You need <strong>${xpNeeded} XP</strong> to reach Level ${level + 1}.
                </p>
                <div class="mini-xp-bar-wrapper">
                    <div class="mini-xp-bar-fill" style="width: ${(currentXP / xpForNextLevel) * 100}%;"></div>
                </div>
                <p class="xp-formula">Leveling up costs <strong>(Current Level x 100) XP</strong>.</p>
            </div>
        </div>
    `;

    Swal.fire({
        title: '💎 XP & Leveling Guide',
        html: html,
        width: '600px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
            popup: 'xp-info-popup'
        }
    });
}

 //----------------------------------------------------------------------------------------------------------
// REPLACE your old loadFitnessProgress function with this one

async function loadFitnessProgress() {
  try {
    const res = await fetch('/api/student/fitness-test-history', { credentials: 'include' }); 
    const result = await res.json(); 
    
    // Get the new wrapper and the canvas
    const chartWrapper = document.getElementById('fitnessChartWrapper');
    const canvasElement = document.getElementById('fitnessProgressChart');
    if (!chartWrapper || !canvasElement) return;

    // Find or create the message <p> tag
    let messageElement = chartWrapper.querySelector('p');
    if (!messageElement) {
        messageElement = document.createElement('p');
        chartWrapper.appendChild(messageElement);
    }

    if (result.success && result.data.length > 1) {
        // --- STATE 1: We have 2+ data points ---
        
        // 1. Show the chart, hide the message
        canvasElement.style.display = 'block';
        messageElement.style.display = 'none';

        // 2. Prepare data
        const labels = result.data.map(d => d.TestDate); 
        const weightData = result.data.map(d => d.Weight); 
        const bodyFatData = result.data.map(d => d.BodyFat); 

        // 3. Draw the chart
        const ctx = canvasElement.getContext('2d'); 
        if (fitnessProgressChart) fitnessProgressChart.destroy(); 
        
        fitnessProgressChart = new Chart(ctx, { 
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { 
                        label: 'Weight (kg)', 
                        data: weightData, 
                        borderColor: 'rgba(54, 162, 235, 1)', 
                        backgroundColor: 'rgba(54, 162, 235, 0.2)', 
                        fill: true,
                        tension: 0.1 
                    },
                    { 
                        label: 'Body Fat (%)', 
                        data: bodyFatData, 
                        borderColor: 'rgba(255, 99, 132, 1)', 
                        backgroundColor: 'rgba(255, 99, 132, 0.2)', 
                        fill: true,
                        tension: 0.1,
                        // This makes the line dotted if BodyFat is NULL (from weight log)
                        spanGaps: true 
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Weight & Body Fat Over Time' }
                }
            }
        });

    } else {
        // --- STATE 2 or 3: We have 0 or 1 data point ---
        
        // 1. Hide the chart, show the message
        canvasElement.style.display = 'none';
        messageElement.style.display = 'block';
        if (fitnessProgressChart) fitnessProgressChart.destroy(); 

        // 2. Set the correct message
        if (result.success && result.data.length === 1) {
            messageElement.textContent = 'You\'ve logged your weight once. Log it again to see your progression chart!';
        } else {
            messageElement.textContent = 'Log your weight or take a fitness test to start tracking your progression.';
        }
    }
  } catch (err) { 
    console.error('Failed to load fitness progress:', err); 
    
    // Handle error: Hide chart, show error message
    const chartWrapper = document.getElementById('fitnessChartWrapper');
    const canvasElement = document.getElementById('fitnessProgressChart');
    if (canvasElement) canvasElement.style.display = 'none';
    
    if (chartWrapper) {
        let messageElement = chartWrapper.querySelector('p');
        if (!messageElement) {
            messageElement = document.createElement('p');
            chartWrapper.appendChild(messageElement);
        }
        messageElement.style.display = 'block';
        messageElement.textContent = 'Could not load progression data.'; 
    }
  }
}
// New function to render the Workout Consistency heatmap
async function loadWorkoutConsistency() {
    try {
        const res = await fetch('/api/student/workout-calendar', { credentials: 'include' });
        const result = await res.json();
        
        if (result.success && result.data.length > 0) {
            const workoutData = result.data.map(dateString => {
                return { date: dateString, value: 1 }; // Format data for the library
            });

            const cal = new CalHeatmap();
            const container = document.getElementById('consistencyHeatmap');
            container.innerHTML = ''; // Clear the placeholder text

            cal.paint({
                itemSelector: container,
                domain: { type: 'month', padding: [10, 10, 10, 10] },
                subDomain: { type: 'day', radius: 2 },
                data: { source: workoutData, x: 'date', y: 'value' },
                scale: {
                    color: {
                        type: 'threshold',
                        range: ['#cce5ff', '#80bfff', '#3399ff', '#0073e6'],
                        domain: [1, 2, 3, 4]
                    }
                },
                date: { start: new Date(new Date().getFullYear(), new Date().getMonth() - 5) }, // Show last 6 months
            });
        } else {
             document.getElementById('consistencyHeatmap').innerHTML = '<p>No workout consistency data to display yet.</p>';
        }
    } catch (err) { 
        console.error('Failed to load workout consistency:', err);
        document.getElementById('consistencyHeatmap').innerHTML = '<p>Could not load consistency data.</p>';
    }
}

// Add these new functions to your script
async function loadSessionAnalytics() {
    try {
        const res = await fetch('/api/student/session-analytics', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            renderAverageSession(result.data.average);
            renderWeeklyHoursChart(result.data.weekly);
            renderSessionHistory(result.data.history);
        } else {
            console.error('Failed to load session analytics');
        }
    } catch (err) {
        console.error('Error fetching session analytics:', err);
    }
}

function renderAverageSession(avg) {
    const avgElement = document.getElementById('avg-session-time');
    avgElement.textContent = avg ? Math.round(avg) : '0';
}

function renderWeeklyHoursChart(weeklyData) {
  if (!weeklyData || weeklyData.length === 0) {
    document.getElementById('weeklyHoursChart').parentElement.innerHTML = '<p>No weekly time data available yet.</p>';
    return;
  }

  const labels = weeklyData.map(w => moment(w.WeekStartDate).format('DD MMM'));
  const data = weeklyData.map(w => w.totalHours.toFixed(2));
  
  const canvasElement = document.getElementById('weeklyHoursChart');
  if (!canvasElement) return;

  const ctx = canvasElement.getContext('2d');

  // Destroy existing chart if it exists
  if (weeklyHoursChart) weeklyHoursChart.destroy();

  weeklyHoursChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Hours',
        data: data,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('data-theme') ? 'rgba(129,199,132,0.6)' : 'rgba(76,175,80,0.6)',
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('data-theme') ? 'rgba(129,199,132,1)' : 'rgba(76,175,80,1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
      plugins: { legend: { display: false } }
    }
  });
}

// Re-apply chart theming when theme toggles
function applyChartTheme() {
  if (weeklyHoursChart) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    weeklyHoursChart.data.datasets[0].backgroundColor = isDark ? 'rgba(129,199,132,0.6)' : 'rgba(76,175,80,0.6)';
    weeklyHoursChart.data.datasets[0].borderColor = isDark ? 'rgba(129,199,132,1)' : 'rgba(76,175,80,1)';
    weeklyHoursChart.update();
  }
}

function renderSessionHistory(historyData) {
    const tbody = document.getElementById('sessionHistoryBody');
    tbody.innerHTML = ''; // Clear previous

    if ($.fn.DataTable.isDataTable('#sessionHistoryTable')) {
        $('#sessionHistoryTable').DataTable().destroy();
    }

    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No session history found.</td></tr>';
        return;
    }

    historyData.forEach(session => {
        const date = moment.utc(session.CreatedAt).tz("Asia/Kolkata").format('ddd, DD MMM YYYY');
        const inTime = moment.utc(session.CreatedAt).tz("Asia/Kolkata").format('h:mm A');
        const outTime = session.OutTime ? moment.utc(session.OutTime).tz("Asia/Kolkata").format('h:mm A') : 'N/A';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${inTime}</td>
            <td>${outTime}</td>
            <td>${session.DurationInMinutes || 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });
    $('#sessionHistoryTable').DataTable();
}

// UPDATED function to include rank medals
async function showLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const result = await res.json();
        
        if (result.success && result.data.length > 0) {
            const listElement = document.getElementById('leaderboard-list');
            const toastElement = document.getElementById('leaderboard-toast');
            
            listElement.innerHTML = ''; // Clear previous entries
            
            const medals = ['🥇', '🥈', '🥉']; // Medals for top 3 ranks
            
            result.data.forEach((student, index) => {
                // Add a medal emoji based on the student's rank (index)
                const rank_medal = medals[index] || '•';
                const li = `<li>${rank_medal} ${student.Name}</li>`;
                listElement.insertAdjacentHTML('beforeend', li);
            });

            // Show the leaderboard
            toastElement.classList.add('show');

            // Hide it after 7 seconds
            setTimeout(() => {
                toastElement.classList.remove('show');
            }, 3000);
        }
    } catch (err) {
        console.error("Could not load leaderboard:", err);
    }
}

// =================================================================== //
// 🍃 LEAVE MANAGEMENT SCRIPT
// =================================================================== //

let allLeaveRequests = []; // Cache all requests to avoid multiple API calls

/**
 * Main function to fetch all leave data for the student from the server.
 */
async function loadLeaveData() {
    try {
        const res = await fetch('/api/student/leaves', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            allLeaveRequests = data.currentMonthRequests.concat(data.historyRequests);
            document.getElementById('leavesTakenCount').textContent = data.leavesTaken;
            renderLeaveTable(allLeaveRequests);
        } else {
            Swal.fire('Error', 'Could not load your leave data.', 'error');
        }
    } catch (err) {
        console.error('Error fetching leave data:', err);
    }
}

/**
 * Renders the provided leave requests into the status table.
 * @param {Array} leaves - An array of leave request objects.
 */
function renderLeaveTable(leaves) {
    const tbody = document.querySelector('#leaveStatusTable tbody');
    tbody.innerHTML = '';

    if (leaves.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">You have no leave requests.</td></tr>`;
        return;
    }

    leaves.forEach(leave => {
        const tr = document.createElement('tr');
        const start = moment(leave.LeaveStartDate).format('MMM D');
        const end = moment(leave.LeaveEndDate).format('MMM D');
        const dates = start === end ? start : `${start} to ${end}`;

        const statusClasses = {
            'Approved': 'badge-green',
            'Rejected': 'badge-red',
            'On Hold': 'badge-yellow',
            'Pending': 'badge-gray'
        };
        const statusClass = statusClasses[leave.Status] || 'badge-gray';

        tr.innerHTML = `
            <td>${dates}</td>
            <td><span class="badge ${statusClass}">${leave.Status}</span></td>
            <td>${leave.Reason}</td>
            <td>${leave.Remarks || 'N/A'}</td>
            <td>
                ${leave.Status === 'Pending' ? `<button class="btn btn-sm btn-danger cancel-leave-btn" data-id="${leave.LeaveID}">Cancel</button>` : 'N/A'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Handles the submission of the leave request form.
 * @param {Event} e - The form submission event.
 */
async function handleLeaveSubmit(e) {
    e.preventDefault();
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!startDate || !endDate || !reason) {
        Swal.fire('Missing Information', 'Please fill out all fields.', 'warning');
        return;
    }
    if (moment(endDate).isBefore(moment(startDate))) {
        Swal.fire('Invalid Dates', 'End date cannot be before the start date.', 'error');
        return;
    }

    // Show spinner and disable button
    submitBtn.disabled = true;
    submitBtn.querySelector('.button-text').classList.add('d-none');
    submitBtn.querySelector('.spinner-border').classList.remove('d-none');

    try {
        const res = await fetch('/api/student/leaves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                leaveStartDate: startDate,
                leaveEndDate: endDate,
                reason: reason
            })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message);

        Swal.fire('Success', 'Your leave request has been submitted.', 'success');
        e.target.reset(); // Clear the form
        loadLeaveData(); // Refresh the data

    } catch (err) {
        Swal.fire('Submission Failed', err.message, 'error');
    } finally {
        // Hide spinner and re-enable button
        submitBtn.disabled = false;
        submitBtn.querySelector('.button-text').classList.remove('d-none');
        submitBtn.querySelector('.spinner-border').classList.add('d-none');
    }
}

/**
 * Handles the click event for cancelling a pending leave request.
 * @param {Event} e - The click event.
 */
function handleLeaveCancel(e) {
    if (!e.target.classList.contains('cancel-leave-btn')) return;
    
    const leaveID = e.target.dataset.id;
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, cancel it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/student/leaves/${leaveID}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                Swal.fire('Cancelled!', 'Your leave request has been cancelled.', 'success');
                loadLeaveData(); // Refresh the list
            } catch (err) {
                Swal.fire('Error', `Could not cancel request: ${err.message}`, 'error');
            }
        }
    });
}

// =================================================================== //
// 🏆 HALL OF FAME (LEADERBOARD & ACHIEVEMENTS) SCRIPT
// =================================================================== //

/**
 * Main function to load all data for the Hall of Fame section.
 */
// Find and replace the existing loadHallOfFameData function
async function loadHallOfFameData() {
    // All three functions can run in parallel for faster loading
    await Promise.all([
        loadAchievementLeaderboard(),
        loadStudentAchievements(),
        loadAchievementProgress() // <-- ADD THIS LINE
    ]);
}

/**
 * Fetches and renders the main achievement leaderboard.
 */
async function loadAchievementLeaderboard() {
    const listElement = document.getElementById('achievementLeaderboardList');
    listElement.innerHTML = '<li class="loading">Loading Leaderboard...</li>'; // Show loader
    try {
        const res = await fetch('/api/achievements/leaderboard', { credentials: 'include' });
        const result = await res.json();
        
        if (result.success && result.data.length > 0) {
            listElement.innerHTML = ''; // Clear loader
            const medals = ['🥇', '🥈', '🥉'];
            
            result.data.forEach((player, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="rank">${medals[index] || index + 1}</div>
                    <div class="name">${player.Name}</div>
                    <div class="score">${player.TotalAchievements} Badges</div>
                `;
                listElement.appendChild(li);
            });
        } else {
            listElement.innerHTML = '<li class="loading">No leaderboard data available yet.</li>';
        }
    } catch (err) {
        console.error("Could not load achievement leaderboard:", err);
        listElement.innerHTML = '<li class="loading">Error loading leaderboard.</li>';
    }
}

// REPLACE your old loadStudentAchievements function with this one
async function loadStudentAchievements() {
    const gridElement = document.getElementById('achievementsGrid');
    gridElement.innerHTML = '<div class="loading">Loading your achievements...</div>';
    try {
        const res = await fetch('/api/student/achievements', { credentials: 'include' });
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            gridElement.innerHTML = '';
            
            // --- Check for New Badges ---
            const earnedBadgeIDs = result.data.map(b => b.AchievementName); // Use name as unique ID
            const seenBadges = JSON.parse(localStorage.getItem('seenBadges') || '[]');
            
            result.data.forEach(badge => {
                // If this badge has NOT been seen before, show animation
                if (!seenBadges.includes(badge.AchievementName)) {
                    showBadgeUnlockAnimation(badge);
                }
                
                // Render the badge card in the trophy case
                const badgeCard = document.createElement('div');
                badgeCard.className = 'badge-card';
                badgeCard.innerHTML = `
                    <div class="sparkle-wrapper">
                        <img src="${badge.BadgeImageURL}" alt="${badge.AchievementName}" class="badge-image">
                    </div>
                    <div class="badge-info">
                        <h5 class="badge-name">${badge.AchievementName}</h5>
                        <p class="badge-description">${badge.Description}</p>
                        <p class="badge-earned">Earned on: ${moment(badge.DateEarned).format('MMM D, YYYY')}</p>
                    </div>
                `;
                gridElement.appendChild(badgeCard);
            });
            
            // Update localStorage with all currently earned badges
            localStorage.setItem('seenBadges', JSON.stringify(earnedBadgeIDs));

        } else {
            gridElement.innerHTML = '<div class="loading">You haven\'t earned any badges yet. Keep going!</div>';
        }
    } catch (err) {
        console.error("Could not load student achievements:", err);
        gridElement.innerHTML = '<div class="loading">Error loading your achievements.</div>';
    }
}

/**
 * Fetches and renders the live progress towards achievements.
 */
// REPLACE your old loadAchievementProgress function with this one
async function loadAchievementProgress() {
    try {
        const res = await fetch('/api/student/achievements/progress', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            const progress = result.data;
            
            // 1. Update Consistency King (with Personal Best)
            let consistencyPercent = (progress.consistency.current / progress.consistency.target) * 100;
            document.getElementById('consistency-progress-fill').style.width = `${Math.min(consistencyPercent, 100)}%`;
            document.getElementById('current-streak').textContent = `${progress.consistency.current} / ${progress.consistency.target} Day Streak`;
            if(progress.consistency.personalBest > 0) {
                 document.getElementById('best-streak').textContent = `Best: ${progress.consistency.personalBest}`;
            }

            // 2. Update Perfect 30 Days
            let monthPercent = (progress.perfectMonth.current / progress.perfectMonth.target) * 100;
            document.getElementById('perfect-month-progress-fill').style.width = `${Math.min(monthPercent, 100)}%`;
            if (monthPercent >= 100) {
                document.getElementById('perfect-month-progress-text').textContent = "Goal Met! Awaiting Sunday's Award";
            } else {
                document.getElementById('perfect-month-progress-text').textContent = `${progress.perfectMonth.current} / ${progress.perfectMonth.target} Days in last 30`;
            }
            
            // 3. Update Social Butterfly (with new score logic)
            const { current, target } = progress.socialButterfly;
            let butterflyPercent = (current / target) * 100;
            document.getElementById('social-butterfly-progress-fill').style.width = `${Math.min(butterflyPercent, 100)}%`;
            if (butterflyPercent >= 100) {
                 document.getElementById('social-butterfly-progress-text').textContent = `Weekly Score: ${current} / ${target} - Great work!`;
            } else {
                 document.getElementById('social-butterfly-progress-text').textContent = `Weekly Score: ${current} / ${target}`;
            }
            
            // 4. Update Milestone Lift (with % improvement)
            const { current_improvement, target_improvement, previous_score, current_score } = progress.milestoneLift;
            let milestonePercent = (current_improvement / target_improvement) * 100;
            document.getElementById('milestone-lift-progress-fill').style.width = `${Math.min(milestonePercent, 100)}%`;
            if(current_score === 'N/A'){
                 document.getElementById('milestone-lift-progress-text').textContent = "Take 2+ tests to see progress";
            } else {
                 document.getElementById('milestone-lift-progress-text').textContent = `Prev: ${previous_score}, Current: ${current_score} (+${current_improvement.toFixed(1)}%)`;
            }

            // 5. Update Iron Dedication
            const { current: dedicationHours, target: dedicationTarget, tierName, completed } = progress.ironDedication;

            if (completed) {
                document.getElementById('iron-dedication-fill').style.width = '100%';
                document.getElementById('iron-dedication-text').textContent = `All Tiers Completed! (${dedicationHours.toFixed(1)} Hours)`;
                document.getElementById('iron-dedication-img').src = '/images/badges/dedication-gold.png';
            } else {
                let dedicationPercent = (dedicationHours / dedicationTarget) * 100;
                document.getElementById('iron-dedication-fill').style.width = `${Math.min(dedicationPercent, 100)}%`;
                document.getElementById('iron-dedication-text').textContent = `${dedicationHours.toFixed(1)} / ${dedicationTarget} Hours toward ${tierName}`;
                // This line dynamically updates the badge image to show the next goal
                document.getElementById('iron-dedication-img').src = `/images/badges/dedication-${tierName.toLowerCase()}.png`;
            }
        }
    } catch (err) {
        console.error("Could not load achievement progress:", err);
    }
}

// ADD this new function to student.js
function showBadgeUnlockAnimation(badge) {
    Swal.fire({
        title: 'BADGE UNLOCKED!',
        html: `
            <div class="badge-unlocked-animation">
                <img src="${badge.BadgeImageURL}" alt="${badge.AchievementName}" class="badge-unlocked-image">
            </div>
            <h3 style="color:#00FFEA; margin-top:1rem;">${badge.AchievementName}</h3>
            <p style="color:#bdc3c7;">${badge.Description}</p>
        `,
        background: '#2c3e50',
        color: '#ffffff',
        showConfirmButton: true,
        confirmButtonText: 'Awesome!',
        confirmButtonColor: '#4CAF50'
    });
}

// Logout function
async function logout(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            localStorage.clear();
            window.location.href = '../homepage.html';
        } else {
            alert('Logout failed. Please try again.');
        }
    } catch (err) {
        console.error('Logout error:', err);
        alert('Could not connect to the server to log out.');
    }
}

//----------------------------------------------------------------------------------------------------------
// --- DOM CONTENT LOADED EVENT ---
//----------------------------------------------------------------------------------------------------------


document.addEventListener('DOMContentLoaded', () => {
    // --- Setup Event Listeners ---
    // Header and navigation buttons
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('xpInfoBtn').addEventListener('click', showXpInfoModal);

    // Theme: load persisted theme and set up toggle
    const rootEl = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') rootEl.setAttribute('data-theme', 'dark');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        // Set initial icon
        themeToggleBtn.innerHTML = rootEl.getAttribute('data-theme') === 'dark'
            ? '<i class="bi bi-brightness-high"></i>'
            : '<i class="bi bi-moon-stars"></i>';
        themeToggleBtn.addEventListener('click', () => {
            const isDark = rootEl.getAttribute('data-theme') === 'dark';
            if (isDark) {
                rootEl.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeToggleBtn.innerHTML = '<i class="bi bi-moon-stars"></i>';
            } else {
                rootEl.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeToggleBtn.innerHTML = '<i class="bi bi-brightness-high"></i>';
            }
            // Repaint charts to match theme
            try { applyChartTheme(); } catch {}
        });
    }

    // Init tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Leave Management
    document.getElementById('leaveRequestForm').addEventListener('submit', handleLeaveSubmit);
    document.querySelector('#leaveStatusTable tbody').addEventListener('click', handleLeaveCancel);
    
    // Planner buttons
    document.getElementById('savePlanBtn').addEventListener('click', savePlan);
    document.getElementById('applyLastWeekBtn').addEventListener('click', applyLastWeeksPlan);
    const clearBtn = document.getElementById('clearPlanBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearPlanner);

    // Planner autosave/restore (for weekly view)
    const weeklyPlannerCards = document.querySelectorAll('#weekly-view .day-card');
    const draftKey = 'plannerDraft';
    // Restore
    try {
        const draft = JSON.parse(localStorage.getItem(draftKey) || '{}');
        weeklyPlannerCards.forEach(card => {
            const day = card.getAttribute('data-day');
            if (draft[day]) card.innerHTML = draft[day];
        });
    } catch {}
    // Autosave on input
    weeklyPlannerCards.forEach(card => {
        card.addEventListener('input', () => {
            const draft = {};
            document.querySelectorAll('#weekly-view .day-card').forEach(c => {
                draft[c.getAttribute('data-day')] = c.innerHTML.trim();
            });
            localStorage.setItem(draftKey, JSON.stringify(draft));
        });
    });

    initializeWeekPicker();
    
    document.getElementById('weightLogForm').addEventListener('submit', handleWeightLogSubmit);
    document.getElementById('weightHistoryBody').addEventListener('click', handleWeightLogDelete);


document.getElementById('log-weight-shortcut').addEventListener('click', (e) => {
    e.preventDefault(); // Stop the link from just adding a '#'
    
    // This new hash will trigger our updated router
    window.location.hash = 'logs&tab=progression'; 
});
    // Tips section select dropdown
    document.getElementById('bodyPartSelect').addEventListener('change', loadBodyPartTips);

    // Quick Add buttons for each day in weekly planner
    document.querySelectorAll('#weekly-view .quick-add-btn').forEach(btn => {
        btn.addEventListener('click', () => openQuickAddDialog(btn.dataset.day));
    });

    // Analytics Tabs
    function setupAnalyticsTabs() {
        const tabNav = document.querySelector('.tab-nav');
        const tabPanes = document.querySelectorAll('.tab-pane');

        if (tabNav) { // Check if the tabs exist on the page
            tabNav.addEventListener('click', (e) => {
                if (e.target.matches('.tab-link')) {
                    const tabId = e.target.dataset.tab;

                    // Update active state on buttons
                    tabNav.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
                    e.target.classList.add('active');

                    // Update active state on content panes
                    tabPanes.forEach(pane => {
                        pane.classList.toggle('active', pane.id === tabId);
                    });
                    
                    // Trigger data loading for the new tab
                    if (tabId === 'logs') {
                        loadStudentPlans();
                        loadTrainingAnalytics();
                    }
                    if (tabId === 'history') {
                        loadSessionAnalytics();
                    }
                    if (tabId === 'progression') {
                        loadFitnessProgress();
                        loadWeightLogHistory();
                    }
                    if (tabId === 'overview') {
                        loadWorkoutConsistency();
                    }
                }
            });
        }
    }
    setupAnalyticsTabs();

    // Tips Accordion "Add to Plan" buttons
    const workoutAccordion = document.getElementById('workoutAccordion');
    if (workoutAccordion) {
        workoutAccordion.addEventListener('click', function(e) {
            if (e.target.classList.contains('add-to-plan-btn')) {
                e.preventDefault();
                const exerciseName = e.target.dataset.exercise;

                Swal.fire({
                    title: `Add "${exerciseName}"`,
                    html: `
                      <select id="qa-day" class="swal2-select">
                        <option>Monday</option>
                        <option>Tuesday</option>
                        <option>Wednesday</option>
                        <option>Thursday</option>
                        <option>Friday</option>
                        <option>Saturday</option>
                        <option>Sunday</option>
                      </select>
                      <div>
                        <input id="qa-sets" class="swal2-input" type="number" min="1" placeholder="Sets" style="flex:1;" />
                        <input id="qa-reps" class="swal2-input" type="text" placeholder="Reps (e.g., 10-12)" style="flex:1;" />
                      </div>
                    `,
                    focusConfirm: false,
                    showCancelButton: true,
                    confirmButtonText: 'Add to Plan'
                }).then(result => {
                    if (!result.isConfirmed) return;
                    const selectedDay = document.getElementById('qa-day').value;
                    const sets = (document.getElementById('qa-sets').value || '').trim();
                    const reps = (document.getElementById('qa-reps').value || '').trim();
                    const formatted = [exerciseName, sets && `${sets} sets`, reps && `${reps} reps`].filter(Boolean).join(' - ');
                    
                    // Use the single, reliable function to add to the card
                    addExerciseToCard(selectedDay, formatted);
                });
            }
        });
    }

    // Hash routing: on load and when hash changes
// WITH THIS NEW, SMARTER VERSION:
function routeFromHash() {
    let hash = window.location.hash.replace('#', '') || 'planner';
    let mainHash = hash;
    let subTab = null;

    // Check if we have a sub-tab parameter (e.g., #logs&tab=progression)
    if (hash.includes('&tab=')) {
        const parts = hash.split('&tab=');
        mainHash = parts[0];
        subTab = parts[1]; // This will be 'progression'
    }

    const map = {
        planner: 'planner-low',
        logs: 'logs-low',
        attendance: 'attendance-low',
        leaves: 'leaves-low',
        tips: 'tips-low',
        fame: 'fame-low'
    }; 
    
    const targetSectionId = map[mainHash] || 'planner-low';
    
    // This part is the same: it shows the main section card
    navigateToSection(targetSectionId); 

    // --- NEW LOGIC ---
    // If a subTab was specified (like 'progression')
    if (subTab) {
        // Find the internal tab link (e.g., the button with data-tab="progression")
        const tabLink = document.querySelector(`.tab-nav .tab-link[data-tab="${subTab}"]`);
        
        if (tabLink) {
            // Click the internal tab. This will be caught by your 
            // setupAnalyticsTabs() listener, which will load
            // the correct data and show the correct pane.
            tabLink.click();
        }
    }
}
    window.addEventListener('hashchange', routeFromHash);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const key = e.key.toLowerCase();
            if (key === '1') window.location.hash = 'planner';
            if (key === '2') window.location.hash = 'logs';
            if (key === '3') window.location.hash = 'attendance';
            if (key === '4') window.location.hash = 'leaves';
            if (key === '5') window.location.hash = 'tips';
            if (key === '6') window.location.hash = 'fame';
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            const btn = document.getElementById('savePlanBtn');
            if (btn) btn.click();
        }
    });

    // --- CORRECTED: Dashboard View Toggle Logic ---
    const plannerViewToggle = document.getElementById('plannerViewToggle');
    const dailyView = document.getElementById('daily-view');
    const weeklyView = document.getElementById('weekly-view');

    plannerViewToggle.addEventListener('change', () => {
        if (plannerViewToggle.checked) {
            // Show Weekly
            dailyView.style.display = 'none';
            weeklyView.style.display = 'block';
        } else {
            // Show Daily
            dailyView.style.display = 'block';
            weeklyView.style.display = 'none';
        }
    });

    // --- "Today" Quick Add Button ---
    document.getElementById('today-quick-add').addEventListener('click', () => {
        openQuickAddDialog(document.getElementById('today-day-card').dataset.day);
    });

    // --- Sync today's card with the weekly planner card ---
    const todayCard = document.getElementById('today-day-card');
    todayCard.addEventListener('input', () => {
        const todayName = todayCard.dataset.day;
        const correspondingWeeklyCard = document.querySelector(`#weekly-view .day-card[data-day="${todayName}"]`);
        if (correspondingWeeklyCard) {
            correspondingWeeklyCard.innerHTML = todayCard.innerHTML;
        }
    });

    // --- Initial Data Loading ---
    getStudentSession(); // This is now the ONLY call
    routeFromHash();
});