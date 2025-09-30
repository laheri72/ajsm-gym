
let studentTR, studentName, branch, gender;
let bodyPartChart = null;
let fitnessProgressChart = null;
let weeklyHoursChart = null;

async function getStudentSession() {
  try {
    const res = await fetch('/api/student-session', {
      method: 'GET',
      credentials: 'include' // ✅ Include cookies
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

    // Update welcome UI
    document.getElementById('studentName').innerText = studentName || 'Student';
    document.getElementById('welcomeText').innerText =
      `Fitness ${studentName} | ${branch.toUpperCase()} | ${gender.toUpperCase()}`;


    // Load extra info (Darajah, Goal etc.)
    fetch(`/api/student-info/${studentTR}`, {
      method: 'GET',
      credentials: 'include' // ✅ Include cookies here too
    })
      .then(res => res.json()) 
      .then(data => {
        if (data.success) {
          const stu = data.student;

          document.getElementById('studentSlot').innerText =
            stu.SlotName ? `🕒  ${stu.SlotName}` : 'No slot assigned';

          document.getElementById('studentDarajah').innerText = stu.Darajah;
          document.getElementById('studentGoal').innerText = `🎯 Goal: ${stu.Goal}`;
          document.getElementById('studentTR').innerText = studentTR;

          loadTip(stu.Goal);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Student info not found.',
          });
        }
      });



  } catch (err) {
    console.error('Error fetching student session:', err);
    window.location.href = '../Forbidden.html';
  }
}




function loadAttendance() {
    const selectedWeek = document.getElementById('weekSelect').value;
    const loadButton = document.getElementById('loadAttendanceBtn');
    
    if (!selectedWeek) {
        Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Please select a week.' });
        return;
    }

    loadButton.textContent = 'Loading...';
    loadButton.disabled = true;

    // ✅ HIDE BOTH CARDS BEFORE LOADING NEW DATA
    document.getElementById('attendanceSummaryCard').style.display = 'none';
    document.getElementById('attendanceWarning').style.display = 'none';
    document.getElementById('attendanceSpinner').style.display = 'block';  // Show spinner

    if (!studentTR) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not find student TR. Please log in again.' });
        loadButton.textContent = 'Load Attendance';
        loadButton.disabled = false;
        document.getElementById('attendanceSpinner').style.display = 'none';  // Hide spinner
        return;
    }

    fetch(`/api/student-attendance/${selectedWeek}/${studentTR}`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.querySelector('#attendanceTable tbody');
            tbody.innerHTML = '';

            if (data.length > 0) {
                const student = data[0];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const weekStartDate = new Date(student.WeekStartDate);
                const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                
                let presentCount = 0;
                let absentCount = 0;
                let onLeaveCount = 0;

                const cells = daysOfWeek.map((day, i) => {
                    const status = student[day];
                    const currentDate = new Date(weekStartDate);
                    currentDate.setDate(currentDate.getDate() + i);
                    
                    if (status === 'Present') {
                        presentCount++;
                        return `<td class="present">Present</td>`;
                    } else if (status === 'On Leave') {
                        onLeaveCount++;
                        return `<td class="on-leave" style="color: #f59e0b; font-weight: bold;">On Leave</td>`;
                    } else if (currentDate <= today) {
                        absentCount++;
                        return `<td class="absent" style="color: red; font-weight: bold;">Absent</td>`;
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

                // Update and show the summary card
                document.getElementById('presentCount').innerText = presentCount;
                document.getElementById('absentCount').innerText = absentCount;
                document.getElementById('onLeaveCount').innerText = onLeaveCount;
                document.getElementById('attendanceSummaryCard').style.display = 'block';

                // ✅ SHOW WARNING IF ABSENCES ARE 2 OR MORE
                if (absentCount >= 2) {
                    document.getElementById('attendanceWarning').style.display = 'flex';
                }
            }
        })
        .catch(err => console.error('Failed to load student attendance:', err))
        .finally(() => {
            loadButton.textContent = 'Load Attendance';
            loadButton.disabled = false;
            document.getElementById('attendanceSpinner').style.display = 'none';  // Hide spinner
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
      { name: "Treadmill Running", img : "../gifs/kory-wagonmaker.gif" },
      { name: "Jump Rope", img: "../gifs/jumping-rope-brandon-william.gif" }
    ]
  },
  "Chest": {
    desc: "Chest exercises develop your pectoral muscles and improve upper body strength. Include both pressing and fly movements.",
    exercises: [
      { name: "Bench Press", img: "../gifs/Barbell-Bench-press.gif" },
      { name: "Chest Fly", img: "../gifs/03081301-Dumbbell-Fly_Chest-FIX_360.gif" }
    ]
  },
  "Back": {
    desc: "Back training improves posture and builds pulling strength. Mix vertical and horizontal pulling exercises.",
    exercises: [
      { name: "Pull-Ups", img: "../gifs/butterfly-kipping-pull-up-gif-oblique-slow-motion-butterfly-kipping-pull-up-technique.gif" },
      { name: "Bent-over Row", img: "../gifs/bai-tap-bent-over-barbell-row.gif" }
    ]
  },
  "Shoulders": {
    desc: "Target all three deltoid heads (front, side, rear) for well-rounded shoulder strength.",
    exercises: [
      { name: "Shoulder Press", img: "../gifs/dumbbell-shoulder-press.gif" },
      { name: "Lateral Raise", img: "../gifs/DB_LAT_RAISE.gif" }
    ]
  },
  "Biceps": {
    desc: "Biceps curls and pulling movements help build strong, toned arms.",
    exercises: [
      { name: "Barbell Curl", img: "../gifs/barbellcurl-1509456994.gif" },
      { name: "Hammer Curl", img: "../gifs/hammer curl.gif" }
    ]
  },
  "Triceps": {
    desc: "Triceps are key for arm size and pushing strength. Use isolation and compound lifts.",
    exercises: [
      { name: "Triceps Pushdown", img: "../gifs/triceps-pushdown-gif.gif" },
      { name: "Overhead Extension", img: "../gifs/5e22347fc864160c82d10bfe_overhead-extension-kettlebell-exericse-anabolic-aliens.gif" }
    ]
  },
  "Legs": {
    desc: "Leg training builds strength, balance, and coordination. Include squats, lunges, and deadlifts.",
    exercises: [
      { name: "Squats", img: "../gifs/air-squat-gif-side-view-air-squat-technique.gif" },
      { name: "Lunges", img: "../gifs/9c198f0c2f2b714d4f7e920bd4ac615e.gif" }
    ]
  },
  "Core": {
    desc: "Core workouts improve stability, posture, and total-body strength. Mix planks, crunches, and rotational moves.",
    exercises: [
      { name: "Plank", img: "../gifs/Plank.gif" },
      { name: "Russian Twist", img: "../gifs/russian twist.gif" }
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

  cards.forEach(card => {
    const day = card.getAttribute('data-day');
    const content = DOMPurify.sanitize(card.innerHTML.trim()); // Sanitize user input
    plan[day] = content;
  });

  fetch('/save-workout-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(plan)
  })
    .then(res => {
      if (!res.ok) throw new Error('Server error');
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
          text: 'Please try again.',
        });
      }
    })
    .catch(err => {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Could not save. Check your connection.',
      });
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
            }, 7000);
        }
    } catch (err) {
        console.error("Could not load leaderboard:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Setup Event Listeners ---
    // Header and navigation buttons
    document.getElementById('logoutBtn').addEventListener('click', logout);

    
    // document.getElementById('planner-main').addEventListener('click', () => showSection('planner'));
    // document.getElementById('tips-main').addEventListener('click', () => showSection('tips'));
    // document.getElementById('attendance-main').addEventListener('click', () => showSection('attendance'));
    // document.getElementById('logs-main').addEventListener('click', () => showSection('logs'));

    // Planner buttons
    document.getElementById('savePlanBtn').addEventListener('click', savePlan);
    document.getElementById('applyLastWeekBtn').addEventListener('click', applyLastWeeksPlan);

    // Attendance button
    document.getElementById('loadAttendanceBtn').addEventListener('click', loadAttendance);

    // Tips section select dropdown
    document.getElementById('bodyPartSelect').addEventListener('change', loadBodyPartTips);

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

