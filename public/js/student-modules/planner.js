import { exerciseDatabase } from './data.js';
import { setPlannerDirty, studentFeatureFlags } from './state.js';

const PLANNER_SCHEMA_VERSION = 1;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DRAFT_KEY = 'plannerDraftV2';

let plannerState = buildEmptyWeekState();
let plannerInsights = null;
let plannerEventsBound = false;
let focusedDay = null;

function isPlannerV2Enabled() {
  return studentFeatureFlags?.planner_v2_ui !== false;
}

function buildEmptyDayPlan() {
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    items: [],
    notes: ''
  };
}

function buildEmptyWeekState() {
  const week = {};
  DAYS.forEach((day) => { week[day] = buildEmptyDayPlan(); });
  return week;
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeItem(item, idx = 0) {
  if (!item || typeof item !== 'object') return null;

  const exercise = String(item.exercise || item.name || '').trim();
  const bodyPart = String(item.bodyPart || '').trim();
  const note = String(item.note || '').trim();
  if (!exercise && !bodyPart && !note) return null;

  return {
    id: String(item.id || `item-${idx + 1}`),
    type: String(item.type || (bodyPart ? 'bodypart' : 'exercise')),
    exercise: exercise.slice(0, 120),
    bodyPart: bodyPart.slice(0, 40),
    sets: normalizeNumber(item.sets),
    reps: String(item.reps || '').trim().slice(0, 40),
    durationMinutes: normalizeNumber(item.durationMinutes),
    note: note.slice(0, 255),
    source: String(item.source || 'manual').slice(0, 24)
  };
}

function normalizeDayPlan(raw = {}) {
  const items = Array.isArray(raw.items)
    ? raw.items.map((item, idx) => normalizeItem(item, idx)).filter(Boolean).slice(0, 16)
    : [];

  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    items,
    notes: String(raw.notes || '').trim().slice(0, 800)
  };
}

function parseLegacyContent(content = '') {
  const lines = String(content)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return normalizeDayPlan({
    items: lines.map((line, idx) => ({
      id: `legacy-${idx + 1}`,
      exercise: line,
      source: 'legacy'
    }))
  });
}

function parseServerPlan(entry) {
  if (entry?.Plan && typeof entry.Plan === 'object') {
    return normalizeDayPlan(entry.Plan);
  }

  if (typeof entry?.Content === 'string') {
    try {
      const parsed = JSON.parse(entry.Content);
      if (parsed && typeof parsed === 'object') {
        return normalizeDayPlan(parsed);
      }
    } catch (_) {
      return parseLegacyContent(entry.Content);
    }
  }

  return buildEmptyDayPlan();
}

function hasDayContent(dayPlan) {
  return (Array.isArray(dayPlan.items) && dayPlan.items.length > 0) || String(dayPlan.notes || '').trim().length > 0;
}

function hasAnyPlanContent() {
  return DAYS.some((day) => hasDayContent(plannerState[day]));
}

function getTodayName() {
  return moment.tz('Asia/Kolkata').format('dddd');
}

function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatItemLabel(item) {
  const primary = item.exercise || (item.bodyPart ? `${item.bodyPart} Focus` : 'Workout Item');
  const details = [];
  if (item.sets) details.push(`${item.sets} sets`);
  if (item.reps) details.push(`${item.reps} reps`);
  if (item.durationMinutes) details.push(`${item.durationMinutes} min`);
  const suffix = details.length ? ` (${details.join(' - ')})` : '';
  return `${primary}${suffix}`;
}

let _autoSaveTimeout = null;

function markPlannerDirty() {
  setPlannerDirty(true);
  const statusEl = document.getElementById('planner-save-status');
  if (statusEl) {
    statusEl.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> Syncing...';
    statusEl.classList.remove('text-success');
    statusEl.classList.add('text-muted');
  }
  queueAutoSave();
}

function markPlannerSaved() {
  setPlannerDirty(false);
  const statusEl = document.getElementById('planner-save-status');
  if (statusEl) {
    statusEl.innerHTML = '<i class="bi bi-check2-circle"></i> Saved';
    statusEl.classList.remove('text-muted');
    statusEl.classList.add('text-success');
  }
}

function queueAutoSave() {
  if (_autoSaveTimeout) clearTimeout(_autoSaveTimeout);
  _autoSaveTimeout = setTimeout(() => {
    if (hasAnyPlanContent()) {
      savePlan(true); // true means silent auto-save
    }
  }, 1000);
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(plannerState));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const normalized = buildEmptyWeekState();
    DAYS.forEach((day) => {
      if (parsed[day]) normalized[day] = normalizeDayPlan(parsed[day]);
    });
    return normalized;
  } catch {
    return null;
  }
}

function renderItemsInCard(card, dayPlan) {
  const listEl = card.querySelector('[data-role="items"]');
  const emptyEl = card.querySelector('.planner-empty-text');
  const notesInput = card.querySelector('[data-role="notes"]');

  if (!listEl || !emptyEl || !notesInput) return;

  listEl.innerHTML = '';
  dayPlan.items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'planner-item-row';
    li.innerHTML = `
      <span class="planner-item-text">${escapeHtml(formatItemLabel(item))}</span>
      <button type="button" class="planner-item-remove" data-item-id="${escapeHtml(item.id)}" aria-label="Remove item">&times;</button>
    `;
    listEl.appendChild(li);
  });

  emptyEl.style.display = dayPlan.items.length === 0 ? 'block' : 'none';
  notesInput.value = dayPlan.notes || '';
}

function renderHistoryChips(card, day) {
  const historyRow = card.querySelector('.history-chip-row');
  if (!historyRow) return;
  historyRow.innerHTML = '';
  historyRow.style.display = isPlannerV2Enabled() ? '' : 'none';
  if (!isPlannerV2Enabled()) return;

  const history = plannerInsights?.weekdayHistory?.[day] || [];
  history.slice(0, 3).forEach((entry) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'planner-chip history-chip';
    chip.textContent = `${entry.bodyPart} (${entry.count})`;
    chip.dataset.action = 'add-bodypart';
    chip.dataset.bodyPart = entry.bodyPart;
    chip.dataset.day = day;
    historyRow.appendChild(chip);
  });
}

function deriveSuggestionsForDay(day) {
  const history = plannerInsights?.weekdayHistory?.[day] || [];
  const fromHistory = history.slice(0, 2).map((h) => h.bodyPart).filter(Boolean);
  const balance = plannerInsights?.recommendations?.bodyPartBalance || {};
  const fromBalance = Object.entries(balance)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter(Boolean);

  return [...new Set([...fromHistory, ...fromBalance])].slice(0, 3);
}

function renderSuggestionChips(card, day) {
  const suggestionRow = card.querySelector('.suggestion-chip-row');
  if (!suggestionRow) return;
  suggestionRow.innerHTML = '';
  suggestionRow.style.display = isPlannerV2Enabled() ? '' : 'none';
  if (!isPlannerV2Enabled()) return;

  deriveSuggestionsForDay(day).forEach((bodyPart) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'planner-chip suggestion-chip';
    chip.textContent = `${bodyPart} Focus`;
    chip.dataset.action = 'add-bodypart';
    chip.dataset.bodyPart = bodyPart;
    chip.dataset.day = day;
    suggestionRow.appendChild(chip);
  });
}

const SHORT_DAYS = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN'
};

function renderDayGlanceStrip() {
  const container = document.getElementById('plannerGlanceStrip');
  const summaryEl = document.getElementById('plannerGlanceSummary');
  if (!container) return;

  const todayName = getTodayName();
  if (!focusedDay) focusedDay = todayName;

  let plannedCount = 0;
  container.innerHTML = '';

  DAYS.forEach((day) => {
    const dayPlan = plannerState[day] || buildEmptyDayPlan();
    const itemsCount = Array.isArray(dayPlan.items) ? dayPlan.items.length : 0;
    const hasNotes = String(dayPlan.notes || '').trim().length > 0;
    const isToday = (day === todayName);
    const isFocused = (day === focusedDay);
    const isSunday = (day === 'Sunday');

    let status = 'empty';
    let icon = '➕';
    let badgeText = 'Open';

    if (isSunday) {
      status = 'sunday';
      icon = '😴';
      badgeText = 'Rest';
    } else if (itemsCount > 0) {
      status = 'planned';
      icon = '✅';
      badgeText = `${itemsCount} ex`;
      plannedCount++;
    } else if (hasNotes) {
      status = 'notes';
      icon = '📝';
      badgeText = 'Notes';
      plannedCount++;
    } else {
      status = 'empty';
      icon = '➕';
      badgeText = 'Open';
    }

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `glance-day-chip status-${status} ${isToday ? 'is-today' : ''} ${isFocused ? 'is-focused' : ''}`;
    chip.dataset.day = day;
    chip.title = `${day}: ${itemsCount > 0 ? `${itemsCount} exercises planned` : (isSunday ? 'Rest day' : 'No workout planned')}`;
    chip.innerHTML = `
      <div class="glance-day-header">
        <span class="glance-day-name">${SHORT_DAYS[day] || day.slice(0, 3)}</span>
        ${isToday ? '<span class="glance-today-badge">TODAY</span>' : ''}
      </div>
      <div class="glance-day-status">
        <span class="glance-status-icon">${icon}</span>
        <span class="glance-status-text">${badgeText}</span>
      </div>
    `;

    chip.addEventListener('click', () => {
      focusedDay = day;
      updateSingleDayView();
      renderDayGlanceStrip();

      // If weekly view is active, scroll smoothly to that day card
      const weeklyView = document.getElementById('weekly-view');
      if (weeklyView && weeklyView.style.display !== 'none') {
        const targetCard = weeklyView.querySelector(`.structured-day-card[data-day="${day}"]`) ||
                           weeklyView.querySelector(`.day-wrapper:has([data-day="${day}"])`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    container.appendChild(chip);
  });

  if (summaryEl) {
    if (plannedCount === 6) {
      summaryEl.innerHTML = `🔥 Full Week (${plannedCount}/6 Days Planned)`;
      summaryEl.className = 'glance-summary-pill pill-complete';
    } else if (plannedCount > 0) {
      summaryEl.innerHTML = `💪 ${plannedCount} of 6 Days Planned`;
      summaryEl.className = 'glance-summary-pill pill-active';
    } else {
      summaryEl.innerHTML = `📝 Plan your week`;
      summaryEl.className = 'glance-summary-pill pill-empty';
    }
  }
}

function renderDay(day) {
  const dayPlan = plannerState[day] || buildEmptyDayPlan();
  document.querySelectorAll(`.structured-day-card[data-day="${day}"]`).forEach((card) => {
    renderItemsInCard(card, dayPlan);
    renderHistoryChips(card, day);
    renderSuggestionChips(card, day);
  });
  renderDayGlanceStrip();
}

function updateSingleDayView() {
  if (!focusedDay) focusedDay = getTodayName();
  const heading = document.getElementById('today-date-heading');
  const todayName = getTodayName();
  if (heading) {
    if (focusedDay === todayName) {
      heading.textContent = `Today's Plan (${focusedDay})`;
    } else {
      heading.textContent = `${focusedDay}'s Plan`;
    }
  }
  const todayCard = document.getElementById('today-day-card');
  if (todayCard) todayCard.dataset.day = focusedDay;

  const autofillBtn = document.getElementById('today-autofill-btn');
  if (autofillBtn) autofillBtn.innerHTML = `Smart Fill ${focusedDay}`;

  renderDay(focusedDay);
}

function renderAllDays() {
  DAYS.forEach(renderDay);
  updateSingleDayView();
  renderDayGlanceStrip();
}

function updateCoachStrip() {
  if (!isPlannerV2Enabled()) return;

  const weekly = plannerInsights?.consistency?.weeklyAdherence || [];
  const latest = weekly.length ? weekly[weekly.length - 1] : null;
  const adherenceValue = latest ? `${latest.adherencePct}%` : '--%';
  const streakValue = plannerInsights?.consistency?.daysSinceLastWorkout ?? '--';
  const focus = Object.entries(plannerInsights?.recommendations?.bodyPartBalance || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '--';

  const durations = plannerInsights?.durationBaseline || {};
  const values = Object.values(durations)
    .map((d) => Number(d.median || 0))
    .filter((n) => n > 0);
  const avgDuration = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

  const adherenceEl = document.getElementById('planner-adherence-value');
  const streakEl = document.getElementById('planner-streak-value');
  const durationEl = document.getElementById('planner-duration-value');
  const focusEl = document.getElementById('planner-focus-value');

  if (adherenceEl) adherenceEl.textContent = adherenceValue;
  if (streakEl) streakEl.textContent = streakValue === null ? '--' : `${streakValue}d`;
  if (durationEl) durationEl.textContent = avgDuration ? `${avgDuration} min` : '-- min';
  if (focusEl) focusEl.textContent = focus;
}

async function fetchPlannerInsights() {
  if (!isPlannerV2Enabled()) return null;

  const res = await fetch('/api/student/planner/insights', { credentials: 'include' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch planner insights.');
  plannerInsights = data.data;
  updateCoachStrip();
  renderAllDays();
  return plannerInsights;
}

function noteInputHandler(event) {
  const target = event.target;
  if (!target.matches('.planner-note-input')) return;

  const card = target.closest('.structured-day-card');
  if (!card) return;
  const day = card.dataset.day;
  if (!DAYS.includes(day)) return;

  plannerState[day].notes = target.value.slice(0, 800);
  markPlannerDirty();
  saveDraft();
}

function clickHandler(event) {
  const removeBtn = event.target.closest('.planner-item-remove');
  if (removeBtn) {
    const card = removeBtn.closest('.structured-day-card');
    const day = card?.dataset.day;
    const itemID = removeBtn.dataset.itemId;
    if (day && itemID && plannerState[day]) {
      plannerState[day].items = plannerState[day].items.filter((item) => item.id !== itemID);
      renderDay(day);
      markPlannerDirty();
      saveDraft();
    }
    return;
  }

  const chip = event.target.closest('.planner-chip[data-action="add-bodypart"]');
  if (chip) {
    const day = chip.dataset.day;
    const bodyPart = chip.dataset.bodyPart;
    if (day && bodyPart) {
      addExerciseToCard(day, {
        exercise: `${bodyPart} Focus`,
        bodyPart,
        sets: 3,
        reps: '10-12',
        source: 'suggested'
      });
    }
  }
}

function bindPlannerEvents() {
  if (plannerEventsBound) return;

  const plannerSection = document.getElementById('planner-low');
  if (plannerSection) {
    plannerSection.addEventListener('click', clickHandler);
    plannerSection.addEventListener('input', noteInputHandler);
  }

  document.getElementById('prevDayBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!focusedDay) focusedDay = getTodayName();
    const idx = DAYS.indexOf(focusedDay);
    focusedDay = DAYS[(idx - 1 + 7) % 7];
    updateSingleDayView();
  });

  document.getElementById('nextDayBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!focusedDay) focusedDay = getTodayName();
    const idx = DAYS.indexOf(focusedDay);
    focusedDay = DAYS[(idx + 1) % 7];
    updateSingleDayView();
  });

  // Bind magic fill buttons
  document.getElementById('autoFillWeekBtn')?.addEventListener('click', (e) => { e.preventDefault(); autoFillWeek(); });
  document.getElementById('reuseBestWeekdayBtn')?.addEventListener('click', (e) => { e.preventDefault(); reuseBestWeekday(); });
  document.getElementById('applyLastCompletedMondayBtn')?.addEventListener('click', (e) => { e.preventDefault(); applyLastCompletedMonday(); });
  document.getElementById('clearPlanBtn')?.addEventListener('click', (e) => { e.preventDefault(); clearPlanner(); });
  document.getElementById('applyLastWeekBtn')?.addEventListener('click', (e) => { e.preventDefault(); applyLastWeeksPlan(); });

  plannerEventsBound = true;
}

function applyPlannerFeatureGate() {
  const enabled = isPlannerV2Enabled();
  const coachStrip = document.getElementById('planner-coach-strip');
  const gatedActionIds = [
    'magicFillDropdown',
    'applyLastWeekBtn',
    'today-autofill-btn'
  ];

  if (coachStrip) coachStrip.style.display = enabled ? '' : 'none';
  gatedActionIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
        // Dropdowns are tricky with display: inline-block vs none
        if (id === 'magicFillDropdown') {
            element.closest('.dropdown').style.display = enabled ? 'inline-block' : 'none';
        } else {
            element.style.display = enabled ? '' : 'none';
        }
    }
  });
}

function buildPayload() {
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    days: DAYS.reduce((acc, day) => {
      acc[day] = normalizeDayPlan(plannerState[day]);
      return acc;
    }, {})
  };
}

function nextItemID(day) {
  return `${day.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addExerciseToCard(day, itemLike) {
  if (!DAYS.includes(day)) return;

  let normalized = null;
  if (typeof itemLike === 'string') {
    const [exercise, ...rest] = itemLike.split(' - ').map((s) => s.trim());
    normalized = normalizeItem({
      id: nextItemID(day),
      exercise,
      note: rest.join(' '),
      source: 'manual'
    });
  } else {
    normalized = normalizeItem({
      id: nextItemID(day),
      ...itemLike
    });
  }

  if (!normalized) return;

  plannerState[day].items.push(normalized);
  renderDay(day);
  markPlannerDirty();
  saveDraft();

  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: `Added to ${day}`,
    showConfirmButton: false,
    timer: 1600
  });
}

export async function savePlan(silent = false) {
  if (!hasAnyPlanContent()) {
    if (!silent) {
      Swal.fire({ icon: 'warning', title: 'Empty Plan', text: 'Please add at least one exercise or note before saving.' });
    }
    return;
  }

  const statusEl = document.getElementById('planner-save-status');
  if (statusEl) {
    statusEl.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> Syncing...';
    statusEl.classList.remove('text-success');
    statusEl.classList.add('text-muted');
  }

  try {
    const res = await fetch('/api/save-workout-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(buildPayload())
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || `Server error: ${res.status}`);

    localStorage.removeItem(DRAFT_KEY);
    markPlannerSaved();

    if (!silent) {
      Swal.fire({
        icon: 'success',
        title: 'Workout Plan Saved',
        text: 'Your structured weekly plan has been saved.',
        timer: 1600,
        showConfirmButton: false
      });
    }
  } catch (err) {
    console.error('Save error:', err);
    if (!silent) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message || 'Could not save planner.' });
    }
    if (statusEl) {
      statusEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Save Failed';
      statusEl.classList.add('text-danger');
    }
  }
}

export function clearPlanner() {
  Swal.fire({
    title: 'Clear planner?',
    text: 'This removes all planned items and notes for this week.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Clear',
    confirmButtonColor: '#dc3545'
  }).then((result) => {
    if (!result.isConfirmed) return;

    plannerState = buildEmptyWeekState();
    renderAllDays();
    markPlannerDirty();
    saveDraft();
  });
}

export function openQuickAddDialog(day) {
  const bodyPartOptions = ['All', ...new Set(exerciseDatabase.map((ex) => ex.primaryMuscle))];

  const html = `
    <div class="exercise-explorer">
      <div class="filters">
        <select id="qa-filter-bodypart" class="swal2-select">
          ${bodyPartOptions.map((bp) => `<option value="${bp}">${bp}</option>`).join('')}
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
    title: `Select Exercise for ${day}`,
    html,
    width: '620px',
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
        Swal.showValidationMessage('Please select an exercise from the list.');
        return false;
      }

      const sets = normalizeNumber(document.getElementById('qa-sets').value);
      const reps = String(document.getElementById('qa-reps').value || '').trim();

      return {
        exercise: selectedItem.dataset.name,
        bodyPart: selectedItem.dataset.bodypart || '',
        sets,
        reps,
        source: 'manual'
      };
    }
  }).then((result) => {
    if (!result.isConfirmed) return;
    addExerciseToCard(day, result.value);
  });
}

function renderExerciseList() {
  const bodyPartFilter = document.getElementById('qa-filter-bodypart').value;
  const difficultyFilter = document.getElementById('qa-filter-difficulty').value;
  const listContainer = document.getElementById('qa-exercise-list');

  const filtered = exerciseDatabase.filter((ex) => {
    const bodyMatch = bodyPartFilter === 'All' || ex.primaryMuscle === bodyPartFilter;
    const diffMatch = difficultyFilter === 'All' || ex.difficulty === difficultyFilter;
    return bodyMatch && diffMatch;
  });

  if (!filtered.length) {
    listContainer.innerHTML = '<p class="no-results">No exercises match your criteria.</p>';
    return;
  }

  listContainer.innerHTML = filtered.map((ex) => `
    <div class="exercise-item" data-name="${escapeHtml(ex.name)}" data-bodypart="${escapeHtml(ex.primaryMuscle)}">
      <div class="exercise-info">
        <strong>${escapeHtml(ex.name)}</strong>
        <div class="tags">
          <span class="badge badge-${{ 'Beginner': 'green', 'Intermediate': 'yellow', 'Advanced': 'red' }[ex.difficulty]}">${escapeHtml(ex.difficulty)}</span>
          ${ex.secondaryMuscles.map((sm) => `<span class="badge badge-dark">${escapeHtml(sm)}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');

  listContainer.querySelectorAll('.exercise-item').forEach((item) => {
    item.addEventListener('click', () => {
      listContainer.querySelectorAll('.exercise-item').forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      document.getElementById('qa-selected-exercise-name').textContent = item.dataset.name;
      document.getElementById('qa-sets-reps-container').style.display = 'flex';
      document.getElementById('qa-sets').focus();
    });
  });
}

export async function applyLastWeeksPlan() {
  try {
    const res = await fetch('/api/student/apply-last-week', {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Could not apply plan.');
    }

    localStorage.removeItem(DRAFT_KEY);
    await loadWeeklyPlan();
    Swal.fire({ icon: 'success', title: 'Applied', text: 'Previous week plan copied.', timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error('Apply last week error:', err);
    Swal.fire({ icon: 'warning', title: 'Apply Failed', text: err.message || 'Could not apply previous week plan.' });
  }
}

export async function autoFillWeek() {
  if (!isPlannerV2Enabled()) {
    Swal.fire({ icon: 'info', title: 'Unavailable', text: 'Auto-fill is not enabled for your account yet.' });
    return;
  }

  try {
    const res = await fetch('/api/student/planner/v2/autofill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mode: 'week' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to auto-fill week.');

    localStorage.removeItem(DRAFT_KEY);
    await loadWeeklyPlan();
    markPlannerSaved();
    Swal.fire({ icon: 'success', title: 'Auto-filled', text: 'Week filled using your workout history.', timer: 1600, showConfirmButton: false });
  } catch (err) {
    console.error('Auto-fill error:', err);
    Swal.fire({ icon: 'error', title: 'Auto-fill Failed', text: err.message || 'Could not auto-fill planner.' });
  }
}

export function reuseBestWeekday() {
  if (!isPlannerV2Enabled()) {
    Swal.fire({ icon: 'info', title: 'Unavailable', text: 'This option is not enabled for your account yet.' });
    return;
  }

  const bestDay = DAYS
    .map((day) => ({ day, count: (plannerInsights?.weekdayHistory?.[day] || []).reduce((sum, entry) => sum + Number(entry.count || 0), 0) }))
    .sort((a, b) => b.count - a.count)[0];

  if (!bestDay || !bestDay.count || !hasDayContent(plannerState[bestDay.day])) {
    Swal.fire({ icon: 'info', title: 'No Best Day Yet', text: 'Not enough history to reuse a best weekday.' });
    return;
  }

  const sourcePlan = normalizeDayPlan(plannerState[bestDay.day]);
  DAYS.forEach((day) => {
    if (day === bestDay.day) return;
    if (!hasDayContent(plannerState[day])) {
      plannerState[day] = normalizeDayPlan(sourcePlan);
    }
  });

  renderAllDays();
  markPlannerDirty();
  saveDraft();

  Swal.fire({ icon: 'success', title: 'Copied', text: `${bestDay.day} template applied to empty days.` });
}

export async function applyLastCompletedMonday() {
  if (!isPlannerV2Enabled()) {
    Swal.fire({ icon: 'info', title: 'Unavailable', text: 'Monday template is not enabled for your account yet.' });
    return;
  }

  try {
    const res = await fetch('/api/student/planner/v2/autofill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mode: 'monday' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to apply Monday template.');

    localStorage.removeItem(DRAFT_KEY);
    await loadWeeklyPlan();
    markPlannerSaved();
    Swal.fire({ icon: 'success', title: 'Applied', text: 'Latest completed Monday pattern applied.' });
  } catch (err) {
    console.error('Apply Monday error:', err);
    Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not apply Monday template.' });
  }
}

export async function smartFillToday() {
  if (!isPlannerV2Enabled()) {
    Swal.fire({ icon: 'info', title: 'Unavailable', text: 'Smart Fill is not enabled for your account yet.' });
    return;
  }

  if (!focusedDay) focusedDay = getTodayName();
  const candidates = deriveSuggestionsForDay(focusedDay);
  if (!candidates.length) {
    Swal.fire({ icon: 'info', title: 'No Suggestions Yet', text: 'Log a few sessions to unlock smart suggestions.' });
    return;
  }

  candidates.slice(0, 2).forEach((bodyPart) => {
    addExerciseToCard(focusedDay, {
      exercise: `${bodyPart} Focus`,
      bodyPart,
      sets: 3,
      reps: '10-12',
      source: 'smart-fill'
    });
  });
}

export async function loadWeeklyPlan() {
  bindPlannerEvents();
  applyPlannerFeatureGate();

  // Inject skeleton loaders to provide immediate visual feedback
  document.querySelectorAll('.structured-day-card').forEach(card => {
    const listEl = card.querySelector('[data-role="items"]');
    const emptyEl = card.querySelector('.planner-empty-text');
    if (listEl) {
      listEl.innerHTML = `
        <li class="planner-item-row"><div class="skeleton skeleton-text medium my-1" style="width: 60%"></div></li>
        <li class="planner-item-row"><div class="skeleton skeleton-text short my-1" style="width: 40%"></div></li>
      `;
    }
    if (emptyEl) emptyEl.style.display = 'none';
  });

  try {
    const res = await fetch('/api/student/workout-plan', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to load planner.');
    }

    plannerState = buildEmptyWeekState();
    if (Array.isArray(data.data)) {
      data.data.forEach((entry) => {
        if (!DAYS.includes(entry.Day)) return;
        plannerState[entry.Day] = parseServerPlan(entry);
      });
    }

    const draft = loadDraft();
    if (draft) {
      DAYS.forEach((day) => {
        if (hasDayContent(draft[day])) {
          plannerState[day] = normalizeDayPlan(draft[day]);
        }
      });
      markPlannerDirty();
    } else {
      markPlannerSaved();
    }

    renderAllDays();

    const applyLastBtn = document.getElementById('applyLastWeekBtn');
    if (applyLastBtn) {
      applyLastBtn.style.display = hasAnyPlanContent() ? 'none' : 'inline-block';
    }

    await fetchPlannerInsights();
  } catch (err) {
    console.error('Error loading workout plan:', err);
  }
}

export async function loadPlannerInsights() {
  try {
    await fetchPlannerInsights();
  } catch (err) {
    console.error('Error loading planner insights:', err);
  }
}

export function initializePlannerInteractions() {
  bindPlannerEvents();
  applyPlannerFeatureGate();
}

// ============================================================
// exerciseModule — Phase 3B + 3C
// Dynamically renders the Gym Workout List from /api/exercises
// and provides in-session set logging via POST /api/student/log-performance
// ============================================================
export const exerciseModule = (() => {
  let _exerciseData = null; // cached API response

  // Body part emoji map
  const EMOJI = {
    'Cardio':    '🔁',
    'Chest':     '💪',
    'Back':      '🏋️',
    'Shoulders': '🧱',
    'Biceps':    '💪',
    'Triceps':   '💪',
    'Legs':      '🦵',
    'Core':      '🧘',
    'General':   '⚙️'
  };

  async function fetchExercises() {
    if (_exerciseData) return _exerciseData;
    const res = await fetch('/api/exercises');
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load exercises');
    _exerciseData = json.data;
    return _exerciseData;
  }

  async function renderWorkoutList() {
    const accordion = document.getElementById('workoutAccordion');
    const spinner   = document.getElementById('exerciseListLoading');
    if (!accordion) return;

    try {
      const data = await fetchExercises();
      if (spinner) spinner.style.display = 'none';

      // Clear any hardcoded static content
      accordion.innerHTML = '';

      const bodyParts = Object.keys(data).sort();

      bodyParts.forEach((bp, idx) => {
        const collapseID = `collapse-${bp.replace(/\s+/g,'_')}`;
        const headingID  = `heading-${bp.replace(/\s+/g,'_')}`;
        const emoji = EMOJI[bp] || '🏋️';
        const isFirst = idx === 0;

        const rows = data[bp].exercises.map(ex => {
          const watchLink = ex.videoURL
            ? `<a href="${ex.videoURL}" target="_blank" rel="noopener">Watch</a>`
            : `<span class="text-muted">—</span>`;
          const diffBadge = ex.difficulty === 'Beginner'
            ? `<span class="badge bg-success bg-opacity-75">${ex.difficulty}</span>`
            : ex.difficulty === 'Intermediate'
              ? `<span class="badge bg-warning text-dark">${ex.difficulty}</span>`
              : `<span class="badge bg-danger">${ex.difficulty}</span>`;

          return `<tr>
            <td>${ex.name} ${diffBadge}</td>
            <td>${ex.equipment || '—'}</td>
            <td>${watchLink}</td>
            <td>
              <button class="btn btn-sm btn-primary add-to-plan-btn"
                data-exercise="${ex.name}"
                data-exercise-id="${ex.id}">Add</button>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-success log-session-btn"
                data-exercise-id="${ex.id}"
                data-exercise-name="${ex.name}"
                title="Log sets performed today">
                <i class="bi bi-lightning-fill"></i>
              </button>
            </td>
          </tr>`;
        }).join('');

        accordion.insertAdjacentHTML('beforeend', `
          <div class="accordion-item">
            <h2 class="accordion-header" id="${headingID}">
              <button class="accordion-button ${isFirst ? '' : 'collapsed'}" type="button"
                data-bs-toggle="collapse" data-bs-target="#${collapseID}"
                aria-expanded="${isFirst}" aria-controls="${collapseID}">
                ${emoji} ${bp}
              </button>
            </h2>
            <div id="${collapseID}" class="accordion-collapse collapse ${isFirst ? 'show' : ''}"
              aria-labelledby="${headingID}" data-bs-parent="#workoutAccordion">
              <div class="accordion-body p-0">
                <div class="table-responsive">
                  <table class="table table-bordered mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Exercise</th>
                        <th>Equipment</th>
                        <th>Video</th>
                        <th>Add to Plan</th>
                        <th>Log Sets</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>`);
      });

      // Bind add-to-plan buttons
      accordion.querySelectorAll('.add-to-plan-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const exercise = btn.dataset.exercise;
          const bodyPart = btn.closest('.accordion-item')?.querySelector('.accordion-button')?.textContent?.replace(/^[^\w]+/, '').trim() || 'General';
          const today = moment.tz('Asia/Kolkata').format('dddd');
          const targetDay = today === 'Sunday' ? 'Monday' : today;

          addExerciseToCard(targetDay, {
            exercise,
            bodyPart,
            sets: 3,
            reps: '10-12',
            source: 'workout-list'
          });

          const originalText = btn.textContent;
          btn.textContent = 'Added!';
          btn.classList.add('btn-success');
          btn.classList.remove('btn-primary');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
          }, 2000);
        });
      });

      // Bind log-session buttons
      accordion.querySelectorAll('.log-session-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openLogModal(
            parseInt(btn.dataset.exerciseId, 10),
            btn.dataset.exerciseName
          );
        });
      });

    } catch (err) {
      console.error('renderWorkoutList error:', err);
      if (spinner) spinner.innerHTML = '<p class="text-danger">Failed to load exercises.</p>';
    }
  }

  // --------------------------------------------------------
  // In-session set logger modal (Phase 3C)
  // --------------------------------------------------------
  function openLogModal(exerciseID, exerciseName) {
    // Remove existing modal if any
    document.getElementById('logSessionModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'logSessionModal';
    modal.innerHTML = `
      <div class="modal fade show" tabindex="-1" style="display:block; background:rgba(0,0,0,0.55)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">⚡ Log Sets — ${exerciseName}</h5>
              <button type="button" class="btn-close" id="closeLogModal"></button>
            </div>
            <div class="modal-body">
              <div id="logSetRows">
                ${buildSetRow(1)}
              </div>
              <button class="btn btn-sm btn-outline-secondary mt-2" id="addSetRowBtn">
                + Add Set
              </button>
              <div class="mt-3">
                <label class="form-label small">Overall RPE (1–10)</label>
                <input type="number" id="logRPE" class="form-control form-control-sm"
                  min="1" max="10" placeholder="e.g. 7">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" id="closeLogModal2">Cancel</button>
              <button class="btn btn-success btn-sm" id="submitLogBtn">
                <i class="bi bi-cloud-upload"></i> Save to Log
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    let setCount = 1;

    modal.querySelector('#addSetRowBtn').addEventListener('click', () => {
      setCount++;
      modal.querySelector('#logSetRows').insertAdjacentHTML('beforeend', buildSetRow(setCount));
    });

    const closeModal = () => modal.remove();
    modal.querySelector('#closeLogModal').addEventListener('click', closeModal);
    modal.querySelector('#closeLogModal2').addEventListener('click', closeModal);

    modal.querySelector('#submitLogBtn').addEventListener('click', async () => {
      const sets = [];
      modal.querySelectorAll('.set-row').forEach((row, i) => {
        sets.push({
          setNumber:    i + 1,
          repsPerformed: parseInt(row.querySelector('.set-reps').value, 10) || null,
          weightUsed:    parseFloat(row.querySelector('.set-weight').value) || null,
        });
      });

      const rpe = parseInt(modal.querySelector('#logRPE').value, 10) || null;
      const btn = modal.querySelector('#submitLogBtn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const res = await fetch('/api/student/log-performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exerciseID, sets, rpe })
        });
        const json = await res.json();

        if (json.success) {
          closeModal();
          if (json.newPR) {
            showPRCelebration(exerciseName);
          } else {
            showToast(`✅ ${sets.length} set(s) logged for ${exerciseName}`, 'success');
          }
        } else {
          showToast(json.message || 'Log failed', 'danger');
          btn.disabled = false;
          btn.textContent = 'Save to Log';
        }
      } catch (err) {
        console.error('log-performance error:', err);
        btn.disabled = false;
        btn.textContent = 'Save to Log';
      }
    });
  }

  function buildSetRow(n) {
    return `<div class="set-row d-flex align-items-center gap-2 mb-2">
      <span class="badge bg-secondary">Set ${n}</span>
      <input type="number" class="form-control form-control-sm set-reps"
        placeholder="Reps" min="0" style="width:80px">
      <input type="number" step="0.5" class="form-control form-control-sm set-weight"
        placeholder="kg" min="0" style="width:90px">
    </div>`;
  }

  function showPRCelebration(exerciseName) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:linear-gradient(135deg,#f59e0b,#ef4444);
      color:#fff; padding:2rem 3rem; border-radius:1rem;
      font-size:1.4rem; font-weight:700; z-index:9999;
      box-shadow:0 20px 60px rgba(0,0,0,0.4); text-align:center;
      animation: fadeInScale .3s ease;`;
    el.innerHTML = `🏆 New Personal Record!<br><span style="font-size:1rem;font-weight:400">${exerciseName}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
    t.style.cssText = 'z-index:9999; min-width:260px; animation:fadeIn .2s ease';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  return { renderWorkoutList, openLogModal };
})();

