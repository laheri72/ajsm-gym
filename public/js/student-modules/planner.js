import { exerciseDatabase } from './data.js';

/**
 * Saves the current weekly workout plan to the server.
 */
export function savePlan() {
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

  buttonText.classList.add('d-none');
  spinner.classList.remove('d-none');
  saveButton.disabled = true;

  fetch('/api/save-workout-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(plan)
  })
    .then(res => {
      if (res.status === 401) {
        window.location.href = '../Forbidden.html';
        return new Promise(() => {}); 
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
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
        Swal.fire({ icon: 'error', title: 'Save Failed', text: data.message || 'Please try again.' });
      }
    })
    .catch(err => {
      console.error('Save error:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Could not save.' });
    })
    .finally(() => {
      buttonText.classList.remove('d-none');
      spinner.classList.add('d-none');
      saveButton.disabled = false;
    });
}

/**
 * Asks for confirmation and clears the planner.
 */
export function clearPlanner() {
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

/**
 * Helper to add a formatted exercise string to the correct day card(s).
 */
export function addExerciseToCard(day, formattedExercise) {
    const dayCards = document.querySelectorAll(`.day-card[data-day="${day}"]`);
    if (dayCards.length === 0) return;

    dayCards.forEach(card => {
        const placeholder = card.querySelector('.placeholder-text');
        if (placeholder) {
            card.innerHTML = '';
        }

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
 * Opens the "Add Exercise" modal.
 */
export function openQuickAddDialog(day) {
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
            <div id="qa-exercise-list" class="exercise-list"></div>
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
            addExerciseToCard(day, formatted);
        });
}

/**
 * Renders the filtered exercise list inside the modal.
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

    listContainer.innerHTML = filteredExercises.map(ex => `
            <div class="exercise-item" data-name="${ex.name}">
                <div class="exercise-info">
                    <strong>${ex.name}</strong>
                    <div class="tags">
                        <span class="badge badge-${{'Beginner':'green', 'Intermediate':'yellow', 'Advanced':'red'}[ex.difficulty]}">${ex.difficulty}</span>
                        ${ex.secondaryMuscles.map(sm => `<span class="badge badge-dark">${sm}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');

    listContainer.querySelectorAll('.exercise-item').forEach(item => {
        item.addEventListener('click', () => {
            listContainer.querySelectorAll('.exercise-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            document.getElementById('qa-selected-exercise-name').textContent = item.dataset.name;
            document.getElementById('qa-sets-reps-container').style.display = 'flex';
            document.getElementById('qa-sets').focus();
        });
    });
}

/**
 * Fetches and populates the weekly planner and "Today" view.
 */
export async function loadWeeklyPlan() {
  try {
    const res = await fetch('/api/student/workout-plan', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.data)) {
      moment.tz.setDefault("Asia/Kolkata");
      const todayName = moment().format('dddd');

      const todayDateHeading = document.getElementById('today-date-heading');
      const todayCard = document.getElementById('today-day-card');
      todayDateHeading.textContent = `Today's Plan (${todayName})`;
      todayCard.dataset.day = todayName; 

      const todayPlan = data.data.find(entry => entry.Day === todayName);
      if (todayPlan && todayPlan.Content) {
          todayCard.innerHTML = DOMPurify.sanitize(todayPlan.Content);
      } else {
          todayCard.innerHTML = '<p class="placeholder-text">No workout planned for today. Add one!</p>';
      }

      const weeklyCards = document.querySelectorAll('#weekly-view .day-card');
      weeklyCards.forEach(card => {
        const day = card.getAttribute('data-day');
        const planData = data.data.find(p => p.Day === day);
        card.innerHTML = DOMPurify.sanitize(planData?.Content || '');
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

/**
 * Applies last week's plan to the current week.
 */
export async function applyLastWeeksPlan() {
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