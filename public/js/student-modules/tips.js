import { goalTipsDatabase } from './data.js';

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

/**
 * Loads tips for the selected body part in the accordion section.
 */
export function loadBodyPartTips() {
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