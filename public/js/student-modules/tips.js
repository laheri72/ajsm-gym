import { goalTipsDatabase } from './data.js';
import { studentGoal } from './state.js';
/* =====================================================
   🚀 Auto initialize when section becomes visible
   ===================================================== */
// at top: import { goalTipsDatabase } from './data.js';


// This is the data for the *accordion* tips, not the goal tips.
const partTips = {
  "Cardio": {
    desc: "Cardio helps burn calories and improve heart health. Aim for 20–30 minutes of moderate to high-intensity cardio, 3–5 times per week.",
    exercises: [ { name: "Treadmill Running", img : "/gifs/kory-wagonmaker.gif" }, { name: "Jump Rope", img: "/gifs/jumping-rope-brandon-william.gif" } ]
  },
  "Chest": {
    desc: "Chest exercises develop your pectoral muscles and improve upper body strength. Include both pressing and fly movements.",
    exercises: [ { name: "Bench Press", img: "/gifs/Barbell-Bench-press.gif" }, { name: "Chest Fly", img: "/gifs/03081301-Dumbbell-Fly_Chest-FIX_360.gif" } ]
  },
  "Back": {
    desc: "Back training improves posture and builds pulling strength. Mix vertical and horizontal pulling exercises.",
    exercises: [ { name: "Pull-Ups", img: "/gifs/butterfly-kipping-pull-up-gif-oblique-slow-motion-butterfly-kipping-pull-up-technique.gif" }, { name: "Bent-over Row", img: "/gifs/bai-tap-bent-over-barbell-row.gif" } ]
  },
  "Shoulders": {
    desc: "Target all three deltoid heads (front, side, rear) for well-rounded shoulder strength.",
    exercises: [ { name: "Shoulder Press", img: "/gifs/dumbbell-shoulder-press.gif" }, { name: "Lateral Raise", img: "/gifs/DB_LAT_RAISE.gif" } ]
  },
  "Biceps": {
    desc: "Biceps curls and pulling movements help build strong, toned arms.",
    exercises: [ { name: "Barbell Curl", img: "/gifs/barbellcurl-1509456994.gif" }, { name: "Hammer Curl", img: "/gifs/hammer curl.gif" } ]
  },
  "Triceps": {
    desc: "Triceps are key for arm size and pushing strength. Use isolation and compound lifts.",
    exercises: [ { name: "Triceps Pushdown", img: "/gifs/triceps-pushdown-gif.gif" }, { name: "Overhead Extension", img: "/gifs/5e22347fc864160c82d10bfe_overhead-extension-kettlebell-exericse-anabolic-aliens.gif" } ]
  },
  "Legs": {
    desc: "Leg training builds strength, balance, and coordination. Include squats, lunges, and deadlifts.",
    exercises: [ { name: "Squats", img: "/gifs/air-squat-gif-side-view-air-squat-technique.gif" }, { name: "Lunges", img: "/gifs/9c198f0c2f2b714d4f7e920bd4ac615e.gif" } ]
  },
  "Core": {
    desc: "Core workouts improve stability, posture, and total-body strength. Mix planks, crunches, and rotational moves.",
    exercises: [ { name: "Plank", img: "/gifs/Plank.gif" }, { name: "Russian Twist", img: "/gifs/russian twist.gif" } ]
  }
};

/**
 * Loads the main "Goal Tip" card based on the student's goal.
 */
export function loadTip(goal) {
  const fallbackGoal = "General Fitness";
  const tipData = goalTipsDatabase[goal] || goalTipsDatabase[fallbackGoal];
  const youtubeLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(tipData.youtubeQuery)}`;

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

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

/**
 * Loads tips for the selected body part in the accordion section.
 */
export function loadBodyPartTips() {
  const selectEl = document.getElementById("bodyPartSelect");
  const value = selectEl?.value;
  const target = document.getElementById("bodyPartTips");
  if (!target) return;
  target.innerHTML = "";

  if (!value || !partTips[value]) return;

  const { desc, exercises } = partTips[value];
  let html = `<p class="body-part-desc mb-3">${desc}</p><div class="row g-3">`;

  exercises.forEach(ex => {
    html += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card h-100 shadow-sm tip-exercise-card">
          <div class="tip-card-img-wrap">
            <img src="${ex.img}" class="card-img-top" alt="${escapeHtml(ex.name)}" loading="lazy">
          </div>
          <div class="card-body d-flex flex-column justify-content-between p-3">
            <div>
              <h5 class="card-title mb-1">${escapeHtml(ex.name)}</h5>
              <span class="badge bg-light text-primary border mb-2"><i class="bi bi-tag"></i> ${escapeHtml(value)}</span>
            </div>
            <button class="btn btn-sm btn-primary w-100 mt-2 tip-add-to-plan-btn"
              data-exercise="${escapeHtml(ex.name)}" data-bodypart="${escapeHtml(value)}">
              <i class="bi bi-plus-circle me-1"></i> Add to Today's Plan
            </button>
          </div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  target.innerHTML = html;

  // Bind click handlers for all buttons in this section
  target.querySelectorAll('.tip-add-to-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const exercise = btn.dataset.exercise;
      const bodyPart = btn.dataset.bodypart;
      handleAddExerciseToToday(btn, exercise, bodyPart);
    });
  });
}

function handleAddExerciseToToday(button, exercise, bodyPart) {
  const today = moment.tz('Asia/Kolkata').format('dddd');
  if (today === 'Sunday') {
    Swal.fire({
      icon: 'info',
      title: 'Gym Closed on Sunday',
      text: 'Would you like to add this exercise to Monday\'s workout plan instead?',
      showCancelButton: true,
      confirmButtonText: 'Add to Monday',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        addExerciseFromTip('Monday', exercise, bodyPart, button);
      }
    });
    return;
  }

  addExerciseFromTip(today, exercise, bodyPart, button);
}

function addExerciseFromTip(day, exercise, bodyPart, button) {
  import('./planner.js').then(mod => {
    mod.addExerciseToCard(day, {
      exercise,
      bodyPart,
      sets: 3,
      reps: '10-12',
      source: 'tutorial'
    });

    if (button) {
      const originalHtml = button.innerHTML;
      button.classList.remove('btn-primary', 'btn-outline-primary');
      button.classList.add('btn-success');
      button.innerHTML = `<i class="bi bi-check2"></i> Added to ${day}!`;
      setTimeout(() => {
        button.classList.remove('btn-success');
        button.classList.add('btn-primary');
        button.innerHTML = originalHtml;
      }, 2500);
    }
  });
}

/* =====================================================
   🧭 Tips Tab Handling (Final Fix)
===================================================== */
function initTipsTabs() {
  const tabs = document.querySelectorAll('#tips-low .tab-link');
  const panes = document.querySelectorAll('#tips-low .tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Deactivate all
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      // Activate selected
      tab.classList.add('active');
      document.getElementById(`tab-${target}`)?.classList.add('active');

      // --- 🚀 Lazy load content when tab becomes visible ---
      if (target === 'body') {
        const targetEl = document.getElementById('bodyPartTips');
        if (targetEl && targetEl.innerHTML.trim() === '') {
          targetEl.innerHTML = `<p class="text-muted">Select a body part above to view GIF-based tips.</p>`;
        }
      }
      if (target === 'personal') {
        const goal = window.studentGoal || (window.stu && stu.Goal) || localStorage.getItem('userGoal') || 'General Fitness';
        try {
          loadTip(goal);
        } catch (err) {
          console.error('Failed to load personalized tip:', err);
        }
      }
    });
  });
}


export function loadTipsSection() {
  initTipsTabs();

  // --- Ensure correct default tab ---
  const defaultTab = document.querySelector('#tips-low .tab-link.active');
  const defaultPane = document.querySelector('#tab-list');
  if (defaultPane) defaultPane.classList.add('active');

  // Delay to let DOM settle before wiring listeners
  setTimeout(() => {
    const select = document.getElementById('bodyPartSelect');
    const target = document.getElementById('bodyPartTips');
    if (target && select) {
      target.innerHTML = `<p class="text-muted">Select a body part above to view GIF-based tips.</p>`;
      select.addEventListener('change', () => {
        const active = document.querySelector('#tips-low .tab-link.active');
        if (active && active.dataset.tab === 'body') {
          loadBodyPartTips();
        }
      });
    }

    // ✅ Force first visible tab logic
    const activeTab = document.querySelector('#tips-low .tab-link.active');
    if (activeTab && activeTab.dataset.tab === 'body') {
      document.getElementById('tab-body')?.classList.add('active');
    } else if (activeTab && activeTab.dataset.tab === 'personal') {
      document.getElementById('tab-personal')?.classList.add('active');
    } else {
      document.getElementById('tab-list')?.classList.add('active');
    }

    // ✅ Load personalized card
    const userGoal = studentGoal || localStorage.getItem('userGoal') || 'General Fitness';
    try {
      loadTip(userGoal);
    } catch (err) {
      console.error('loadTip error', err);
    }
  }, 500); // let animations + collapses settle fully
}
