
let studentTR, studentName, branch, gender;
let bodyPartChart = null;
let fitnessProgressChart = null;
let weeklyHoursChart = null;


// ADD THESE TWO NEW FUNCTIONS TO student.js

/**
 * Updates the XP bar UI with the student's current level and XP.
 * @param {number} level - The student's current fitness level.
 * @param {number} xp - The student's current XP.
 */
// REPLACE your old updateXPBarUI function in student.js

// REPLACE your old updateXPBarUI function in student.js

function updateXPBarUI(level, xp) {
    const xpForNextLevel = level * 100;
    const progressPercent = (xp / xpForNextLevel) * 100;

    const xpContainer = document.querySelector('.xp-level-container');
    const rankTag = document.getElementById('rankTag');
    
    // 1. Determine the current tier and rank name
    let tierClass = 'xp-tier-bronze';
    let rankName = 'Challenger'; // Default from Level 5

    if (level < 5) {
        rankName = 'Rookie';
    }
    if (level >= 10) {
        tierClass = 'xp-tier-silver';
        rankName = 'Athlete';
    }
    if (level >= 20) {
        tierClass = 'xp-tier-gold';
        rankName = 'Pro';
    }
    if (level >= 30) {
        tierClass = 'xp-tier-emerald';
        rankName = 'Elite';
    }

    // 2. Update the tier class on the main container
    xpContainer.classList.remove('xp-tier-bronze', 'xp-tier-silver', 'xp-tier-gold', 'xp-tier-emerald');
    xpContainer.classList.add(tierClass);

    // 3. Update the Rank Tag's text and class
    if (rankTag) {
        rankTag.textContent = rankName;
        rankTag.className = `rank-tag ${tierClass}`; // Use the same tier class for color
    }

    // 4. Update the rest of the UI elements
    document.getElementById('fitnessLevel').textContent = level;
    document.getElementById('xpBarFill').style.width = `${progressPercent}%`;
    document.getElementById('xpBarText').textContent = `${xp} / ${xpForNextLevel} XP`;
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

// REPLACE your existing getStudentSession function with this one

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
    const user = data.user;
    studentTR = user.TR;
    studentName = user.Name;
    branch = user.Branch;
    gender = user.Gender;

    // --- NEW: Check for Level-Up on page load ---
    const lastSeenLevel = parseInt(localStorage.getItem('lastSeenLevel') || '0');
    if (user.FitnessLevel > lastSeenLevel) {
        showLevelUpAnimation(user.FitnessLevel);
        localStorage.setItem('lastSeenLevel', user.FitnessLevel);
    }
    
    // --- NEW: Update the XP Bar UI ---
    updateXPBarUI(user.FitnessLevel, user.CurrentXP);

    // Update welcome UI
    document.getElementById('studentName').innerText = studentName || 'Student';
    const title =
      gender?.toLowerCase() === 'male'
        ? 'Talabat'
        : gender?.toLowerCase() === 'female'
          ? 'Talebaat'
          : 'Student';

    document.getElementById('welcomeText').innerText =
      `Your personal Fitness Dashboard 
       ${branch} | ${title}`;

        // --- NEW: Check if password change is needed ---
    if (data.user.HasLoggedInBefore === false) {
        const passwordModal = new bootstrap.Modal(document.getElementById('forcePasswordChangeModal'));
        passwordModal.show();
        handleInitialPasswordSet(); // Set up the form listener
    }

    // Load extra info (Darajah, Goal etc.)
    fetch(`/api/student-info/me`, {
      method: 'GET',
      credentials: 'include'
    })
      .then(res => res.json()) 
      .then(infoData => {
        if (infoData.success) {
          const stu = infoData.student;
          document.getElementById('studentSlot').innerText = stu.SlotName ? `🕒  ${stu.SlotName}` : 'No slot assigned';
          document.getElementById('studentDarajah').innerText = stu.Darajah;
          document.getElementById('studentGoal').innerText = `🎯 Goal: ${stu.Goal}`;
          document.getElementById('studentTR').innerText = studentTR;
          loadTip(stu.Goal);
        }
      });
  } catch (err) {
    console.error('Error fetching student session:', err);
    window.location.href = '../Forbidden.html';
  }
}

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
    if (targetSectionId === 'fame-low') loadHallOfFameData();
    if (targetSectionId === 'leaves-low') loadLeaveData();
}


//-------------------------------------------------------------------------------------------
// ADD THIS NEW GUIDE FUNCTION

// A flag to track if the user is in the middle of the interactive tour
let isGuideActive = false;

/**
 * Launches the FIRST PART of the interactive tour.
 * This version completely finishes and cleans up after pointing to the 'Add' button.
 */
function startPlannerGuide() {
    if (isGuideActive) return;

    const driver = window.driver.js.driver;

    const driverObj = driver({
        showProgress: true,
        onDestroyStarted: () => {
            // This flag is set when the tour is successfully closed.
            isGuideActive = true;
        },
        steps: [
            {
                element: '#tips-main',
                popover: {
                    title: 'Step 1: Find Workouts',
                    description: "Let's go to the 'Tips' section to find exercises."
                },
                onHighlightStarted: (element) => element.click()
            },
            {
                element: '#workoutAccordion .accordion-item:first-child',
                popover: {
                    title: 'Step 2: Your Turn!',
                    // --- THE FIX: PART 1 ---
                    // We add our own button directly into the description HTML.
                    description: `
                        <p>Now, click the button below to close this guide, then click any 'Add' button.</p>
                        <button id="custom-driver-done-btn" class="btn btn-primary btn-sm">Done, I'll Click It!</button>
                    `,
                    // We explicitly hide the default buttons to avoid confusion.
                    showButtons: [], 
                },
                // --- THE FIX: PART 2 ---
                // This hook runs *after* the popover is added to the page.
                onHighlighted: (element) => {
                    // Find our custom button that we just created.
                    const customBtn = document.getElementById('custom-driver-done-btn');
                    if (customBtn) {
                        // Attach a standard, reliable click event listener.
                        customBtn.onclick = () => {
                            // This command will now reliably destroy the tour and its overlay.
                            driverObj.destroy();
                        };
                    }
                }
            }
        ]
    });

    driverObj.drive();
}

/**
 * Launches the FINAL step of the tour after the user action is complete.
 */
function continueAndFinishGuide() {
    const driver = window.driver.js.driver;
    const driverObj = driver({
        showProgress: false,
        steps: [{
            element: '#planner-low',
            popover: {
                title: 'Great Job!',
                description: "The exercise has been added to your planner. You're all set!"
            },
            onHighlightStarted: () => document.getElementById('planner-main').click()
        }],
        onDestroyed: () => {
            // Final cleanup
            isGuideActive = false;
            localStorage.setItem('plannerTourCompleted', 'true');
        }
    });
    driverObj.drive();
}

//-------------------------------------------------------------------------------------------
// REPLACE your old loadAttendance function with this one

function loadAttendance() {
    const selectedWeek = document.getElementById('weekSelect').value;
    const loadButton = document.getElementById('loadAttendanceBtn');
    
    if (!selectedWeek) {
        return Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Please select a week.' });
    }

    loadButton.disabled = true;
    document.getElementById('attendanceSummaryCard').style.display = 'none';
    document.getElementById('attendanceWarning').style.display = 'none';

    const tbody = document.querySelector('#attendanceTable tbody');
    // --- NEW: Inject the loader directly into the table body ---
    tbody.innerHTML = `<tr><td colspan="8" class="loader-cell"><div class="loader"></div></td></tr>`;

    fetch(`/api/student-attendance/${selectedWeek}/me`, {
        method: 'GET',
        credentials: 'include'
    }).then(res => res.json())
      .then(result => {
          if (!result.success) throw new Error(result.error || 'Failed to fetch data.');

          tbody.innerHTML = ''; // Clear the loader

          const data = result.attendance;
          const weekStartDate = new Date(result.weekStartDate);

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
                  const currentDate = new Date(weekStartDate);
                  currentDate.setDate(weekStartDate.getDate() + i);
                  
                  if (currentDate < joinedDate) return `<td>-</td>`;
                  if (status === 'Present') {
                      presentCount++;
                      return `<td class="present">Present</td>`;
                  } else if (status === 'On Leave') {
                      onLeaveCount++;
                      return `<td class="on-leave">On Leave</td>`;
                  } else if (currentDate <= today) {
                      absentCount++;
                      return `<td class="absent">Absent</td>`;
                  } else {
                      return `<td></td>`;
                  }
              });

              const row = document.createElement('tr');
              row.innerHTML = `
                  <td>${student.TR}</td>
                  <td>${student.Name}</td>
                  ${cells.join('')}
              `;
              tbody.appendChild(row);

              document.getElementById('presentCount').innerText = presentCount;
              document.getElementById('absentCount').innerText = absentCount;
              document.getElementById('onLeaveCount').innerText = onLeaveCount;
              document.getElementById('attendanceSummaryCard').style.display = 'block';

              if (absentCount >= 2) {
                  document.getElementById('attendanceWarning').style.display = 'flex';
              }
          } else {
              tbody.innerHTML = `<tr><td colspan="8" class="text-center">No attendance record found for this week.</td></tr>`;
          }
      })
      .catch(err => {
          console.error('Failed to load student attendance:', err);
          tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading data. Please try again.</td></tr>`;
      })
      .finally(() => {
          loadButton.disabled = false;
      });
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


  function loadTip(goal) {
    let title = "💡 General Tip";
    let html = "Stay active and hydrated!";
    let video = "";

    if (goal.includes('Fat Loss')) {
      title = "🔥 Fat Loss Guide";
      html = `
        <ul>
          <li>Focus on high-protein, low-carb meals.</li>
          <li>Try HIIT (High Intensity Interval Training) workouts.</li>
          <li>Get enough sleep to support fat metabolism.</li>
        </ul>
        <p><strong>Starter Workout:</strong></p>
        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/ml6cT4AZdqI" frameborder="0" allowfullscreen></iframe>
      `;
    } else if (goal.includes('Muscle Gain')) {
      title = "💪 Muscle Gain Tips";
      html = `
        <ul>
          <li>Increase protein intake (2g per kg bodyweight).</li>
          <li>Train each muscle group 2x per week with progressive overload.</li>
          <li>Rest well—recovery is key for growth.</li>
        </ul>
        <p><strong>Starter Workout:</strong></p>
        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/XpP1gZzDMHY" frameborder="0" allowfullscreen></iframe>
      `;
    } else if (goal.includes('Fitness') || goal.includes('Endurance')) {
      title = "🏃 Fitness Boost";
      html = `
        <ul>
          <li>Do steady cardio 3–4x/week (e.g., jogging, cycling).</li>
          <li>Add bodyweight strength training for all-around performance.</li>
          <li>Focus on flexibility and mobility too!</li>
        </ul>
        <p><strong>Starter Workout:</strong></p>
        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/3p8EBPVZ2Iw" frameborder="0" allowfullscreen></iframe>
      `;
    }



    // Also update the basic area (for fallback)
    document.getElementById('tipArea').innerHTML = html;
    // document.getElementById('tips-low').style.display = 'block';
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

// Function to load weeks from the API
function loadWeeks() {
    // --- THIS IS THE UPDATED PART ---
    // We now call the new, secure endpoint and include session credentials
    fetch('/api/student/eligible-weeks', {
        method: 'GET',
        credentials: 'include' // IMPORTANT: This sends the session cookie
    })
    // ---------------------------------
        .then(res => {
            if (!res.ok) {
                // Handle potential errors like if the session expired
                throw new Error('Could not fetch weeks. Please log in again.');
            }
            return res.json();
        })
        .then(data => {
            const weekSelect = document.getElementById('weekSelect');
            weekSelect.innerHTML = '<option value="" disabled selected>Select Range</option>'; // Reset dropdown

            if (data.success && data.weeks.length > 0) {
                data.weeks.forEach(week => {
                    const option = document.createElement('option');
                    option.value = week.WeekID;

                    const startFormatted = formatDate(week.WeekStartDate);
                    const endFormatted = formatDate(week.WeekEndDate);

                    option.text = `(${startFormatted} → ${endFormatted})`;

                    weekSelect.appendChild(option);
                });
            } else {
                 // If a student has no eligible weeks yet, show a message
                 weekSelect.innerHTML = '<option value="" disabled selected>No attendance weeks yet</option>';
            }
        })
        .catch(err => {
            console.error('Failed to load weeks:', err);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: err.message || 'Failed to load week data. Please check your connection and try again.'
            });
        });
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

async function loadWeeklyPlan() {
  try {
    const res = await fetch('/api/student/workout-plan', {
      method: 'GET',
      credentials: 'include'
    });

    const data = await res.json();

    if (data.success && Array.isArray(data.data)) {
      if (data.data.length === 0) {
        console.warn('No plan for current week.');
        document.getElementById('applyLastWeekBtn').style.display = 'inline-block';
      } else {
        data.data.forEach(entry => {
          const card = document.querySelector(`.day-card[data-day="${entry.Day}"]`);
          if (card) {
            card.innerHTML = DOMPurify.sanitize(entry.Content || ''); // Sanitize loaded content
          }
        });
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

 //----------------------------------------------------------------------------------------------------------

const mainNav = document.querySelector('.navbar');
const contentSections = document.querySelectorAll('.content .card');

mainNav.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default link behavior
    const targetId = e.target.id;

    if (targetId) {
        // Deactivate all links
        mainNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        // Activate the clicked link
        e.target.classList.add('active');

        // Hide all sections
        contentSections.forEach(section => {
            section.style.display = 'none';
        });

        // Show the target section
        const sectionId = targetId.replace('-main', '-low');
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            if (sectionId === 'logs-low') {
                loadStudentPlans();
                loadTrainingAnalytics();
                loadFitnessProgress();
                loadWorkoutConsistency();
                loadSessionAnalytics();
            }
            // Inside the mainNav click listener
            if (sectionId === 'leaves-low') {
                loadLeaveData(); // Load data when the section is shown
            }
            if (sectionId === 'fame-low') {
                loadHallOfFameData(); // Load data when this section is shown
            }
        }
    }
});

// Updated function to render the Fitness Progression chart
async function loadFitnessProgress() {
  try {
    const res = await fetch('/api/student/fitness-test-history', { credentials: 'include' });
    const result = await res.json();
    
    if (result.success && result.data.length > 1) {
      const labels = result.data.map(d => d.TestDate);
      const weightData = result.data.map(d => d.Weight);
      const bodyFatData = result.data.map(d => d.BodyFat);

      const canvasElement = document.getElementById('fitnessProgressChart');
      if (!canvasElement) return;

      const ctx = canvasElement.getContext('2d');

      // Destroy existing chart if it exists
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
              tension: 0.1 
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
      document.getElementById('fitnessProgressChart').parentElement.innerHTML = '<p>Take at least two fitness tests to see your progression chart.</p>';
    }
  } catch (err) { 
    console.error('Failed to load fitness progress:', err);
    document.getElementById('fitnessProgressChart').parentElement.innerHTML = '<p>Could not load progression data.</p>';
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
        backgroundColor: 'rgba(76, 175, 80, 0.6)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
      plugins: { legend: { display: false } }
    }
  });
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

        const statusColors = {
            'Approved': 'status-approved',
            'Rejected': 'status-rejected',
            'On Hold': 'status-on-hold',
            'Pending': 'status-pending'
        };
        const statusClass = statusColors[leave.Status] || '';

        tr.innerHTML = `
            <td>${dates}</td>
            <td><span class="status-badge ${statusClass}">${leave.Status}</span></td>
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
            // Add this block inside your progress rendering function

            // Find and update this block in both student.js and profile.js

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
//----------------------------------------------------------------------------------------------------------
// --- DOM CONTENT LOADED EVENT ---
//----------------------------------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // --- Setup Event Listeners ---
    // Header and navigation buttons
    document.getElementById('logoutBtn').addEventListener('click', logout);

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    // document.getElementById('planner-main').addEventListener('click', () => showSection('planner'));
    // document.getElementById('tips-main').addEventListener('click', () => showSection('tips'));
    // document.getElementById('attendance-main').addEventListener('click', () => showSection('attendance'));
    // document.getElementById('logs-main').addEventListener('click', () => showSection('logs'));
    // Inside the DOMContentLoaded listener
    document.getElementById('leaveRequestForm').addEventListener('submit', handleLeaveSubmit);
    document.querySelector('#leaveStatusTable tbody').addEventListener('click', handleLeaveCancel);
    // Planner buttons
    document.getElementById('savePlanBtn').addEventListener('click', savePlan);
    document.getElementById('applyLastWeekBtn').addEventListener('click', applyLastWeeksPlan);

    // Attendance button
    document.getElementById('loadAttendanceBtn').addEventListener('click', loadAttendance);

    // Tips section select dropdown
    document.getElementById('bodyPartSelect').addEventListener('change', loadBodyPartTips);


    document.getElementById('startPlannerGuideBtn').addEventListener('click', startPlannerGuide);

    // Add this inside your DOMContentLoaded event listener
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
                    if (pane.id === tabId) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });
            }
        });
    }
}

// Add this code inside your DOMContentLoaded event listener in student.js

const workoutAccordion = document.getElementById('workoutAccordion');

if (workoutAccordion) {
    workoutAccordion.addEventListener('click', function(e) {
        // Check if an "Add to Plan" button was clicked
        if (e.target.classList.contains('add-to-plan-btn')) {
            e.preventDefault();
            
            const exerciseName = e.target.dataset.exercise;

            // Use SweetAlert2 to show a dropdown for selecting the day
            Swal.fire({
                title: `Add "${exerciseName}" to which day?`,
                input: 'select',
                inputOptions: {
                    'Monday': 'Monday',
                    'Tuesday': 'Tuesday',
                    'Wednesday': 'Wednesday',
                    'Thursday': 'Thursday',
                    'Friday': 'Friday',
                    'Saturday': 'Saturday',
                    'Sunday': 'Sunday'
                },
                inputPlaceholder: 'Select a day',
                showCancelButton: true,
                confirmButtonText: 'Add Exercise',
                confirmButtonColor: '#4CAF50'
            }).then((result) => {
                // If a day was selected
                if (result.isConfirmed && result.value) {
                    const selectedDay = result.value;
                    
                    // Find the correct day-card in the planner section
                    const dayCard = document.querySelector(`.day-card[data-day="${selectedDay}"]`);

                    if (dayCard) {
                        // Check if the card already has content
                        if (dayCard.innerHTML.trim() !== '') {
                            // If it has content, add a line break before the new exercise
                            dayCard.innerHTML += `<br>${exerciseName}`;
                        } else {
                            // If it's empty, just add the exercise name
                            dayCard.innerHTML = exerciseName;
                        }

                        // Show a success toast
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: `Added to ${selectedDay}!`,
                            showConfirmButton: false,
                            timer: 2000
                        });

                        if (isGuideActive) {
                // We need to use a small timeout to allow the SweetAlert to close
                // before the next Driver.js step tries to appear.
                setTimeout(() => {
                    continueAndFinishGuide();
                }, 500); // 500ms delay
                    }
                  }
                }
            });
        }
    });
}

// And call this new function inside DOMContentLoaded
setupAnalyticsTabs();


    // --- Initial Data Loading ---
    getStudentSession();
    loadWeeklyPlan();
    loadWeeks(); 
});
//----------------------------------------------------------------------------------------------------------


function logout() {
        localStorage.clear();
        window.location.href = '../homepage.html';
    }


  
// Replace YouTube links with embedded iframes
  document.addEventListener("DOMContentLoaded", function () {
    const links = document.querySelectorAll("a.embed-link");

    links.forEach(link => {
      const videoURL = new URL(link.href);
      const videoID = videoURL.searchParams.get("v");

      if (!videoID) return; // skip non-YouTube links

      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoID}`;
      iframe.width = "100%";
      iframe.height = "180";
      iframe.frameBorder = "0";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";

      // Replace the link with iframe
      const td = link.parentElement;
      td.innerHTML = "";
      td.appendChild(iframe);
    });
  });

