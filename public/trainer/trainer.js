
import './trainer-dashboard.css';
// --- Global Elements & State ---
const elements = {
    mainContent: document.getElementById('main-content'),
    navLinks: document.querySelectorAll('.bottom-nav .nav-link'),
    profileModal: document.getElementById('studentMiniProfileModal'),
    profileName: document.getElementById('profile-name'),
    profileTR: document.getElementById('profile-tr'),
    profileGoal: document.getElementById('profile-goal'),
    profileSlot: document.getElementById('profile-slot'),
    profileTodayPlan: document.getElementById('profile-today-plan'),
    profileRecent: document.getElementById('profile-recent'),
    profileAttendanceBtn: document.getElementById('profile-attendance-btn'),
    profileHistoryBtn: document.getElementById('profile-history-btn'),
    profileTestBtn: document.getElementById('profile-test-btn')
};
let currentUser = null;
let selectedSlotID = localStorage.getItem('trainerSelectedSlotID') || null;
let activeSessionsCache = [];
let dailyAttendanceCache = [];
let searchStudentsCache = [];
let currentStudent = null;
let studentChoices = null;
let cachedStudents = null;
let searchChoices = null;
let cleanupSearchDropdownListeners = null;
let slotsCache = null;
let slotFetchPromise = null;
const prefersTouchDropdown = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let touchKeyboardSearchEnabled = false;
const SESSION_WARNING_MINUTES = 45;
const SESSION_HARD_CAP_MINUTES = 60;
const OVERDUE_TOAST_COOLDOWN_MS = 3 * 60 * 1000;
let lastOverdueToastAt = Number(localStorage.getItem('trainerLastOverdueToastAt') || 0);

// --- Utility Functions ---
function toggleButtonSpinner(button, showSpinner) {
    const btnText = button.querySelector('.btn-text') || button;
    if (showSpinner) {
        button.disabled = true;
        if (!button.querySelector('.spinner')) {
            button.insertAdjacentHTML('afterbegin', '<div class="spinner"></div>');
        }
        btnText.style.display = 'none';
    } else {
        button.disabled = false;
        const spinner = button.querySelector('.spinner');
        if (spinner) spinner.remove();
        btnText.style.display = 'inline';
    }
}

function closeSearchDropdown() {
    if (!searchChoices) return;
    if (typeof searchChoices.hideDropdown === 'function') {
        searchChoices.hideDropdown();
    }
    searchChoices.containerOuter?.element?.classList.remove('dropdown-up');
}

function isStudentMarkedPresent(student) {
    const status = String(student?.IsPresentToday ?? '').trim().toLowerCase();
    if (status === 'present' || status === 'checked in') return true;

    const presentFlag = student?.IsPresent;
    if (presentFlag === true || presentFlag === 1) return true;
    if (typeof presentFlag === 'string') {
        const normalized = presentFlag.trim().toLowerCase();
        if (normalized === '1' || normalized === 'true' || normalized === 'present') return true;
    }
    return false;
}

function getPendingAttendanceStudents(attendanceList) {
    if (!Array.isArray(attendanceList)) return [];

    const byTR = new Map();

    attendanceList.forEach((student) => {
        const tr = String(student?.TR ?? '').trim();
        if (!tr) return;

        const currentPresent = isStudentMarkedPresent(student);
        const existing = byTR.get(tr);

        if (!existing) {
            byTR.set(tr, { student, isPresent: currentPresent });
            return;
        }

        if (!existing.isPresent && currentPresent) {
            byTR.set(tr, { student, isPresent: true });
        }
    });

    return Array.from(byTR.values())
        .filter((entry) => !entry.isPresent)
        .map((entry) => entry.student)
        .sort((a, b) => String(a?.Name ?? '').localeCompare(String(b?.Name ?? ''), undefined, { sensitivity: 'base' }));
}

function getSessionElapsedMinutes(session) {
    if (Number.isFinite(Number(session?.ElapsedMinutes))) {
        return Math.max(0, Number(session.ElapsedMinutes));
    }
    if (!session?.CreatedAt) return 0;
    return Math.max(0, moment().diff(moment.utc(session.CreatedAt), 'minutes'));
}

function getSessionRiskBand(session) {
    const explicitRisk = String(session?.RiskBand || '').trim().toLowerCase();
    if (explicitRisk === 'critical' || explicitRisk === 'warning' || explicitRisk === 'normal') {
        return explicitRisk;
    }
    const elapsed = getSessionElapsedMinutes(session);
    if (elapsed >= SESSION_HARD_CAP_MINUTES) return 'critical';
    if (elapsed >= SESSION_WARNING_MINUTES) return 'warning';
    return 'normal';
}

function formatElapsedMinutes(minutes) {
    const safe = Math.max(0, Number(minutes) || 0);
    const hrs = Math.floor(safe / 60);
    const mins = safe % 60;
    if (!hrs) return `${mins}m`;
    return `${hrs}h ${mins}m`;
}

function getSessionRiskSummary(data = activeSessionsCache) {
    const summary = {
        total: 0,
        warning: 0,
        critical: 0
    };

    if (!Array.isArray(data)) return summary;

    data.forEach((session) => {
        summary.total += 1;
        const band = getSessionRiskBand(session);
        if (band === 'warning') summary.warning += 1;
        if (band === 'critical') summary.critical += 1;
    });

    return summary;
}

function navigateToCheckoutPage() {
    const checkoutLink = document.querySelector('.nav-link[data-page="checkout"]');
    if (checkoutLink) checkoutLink.click();
}

function maybeShowOverdueReminderToast(summary) {
    if (!summary || summary.critical <= 0) return;
    const now = Date.now();
    if (now - lastOverdueToastAt < OVERDUE_TOAST_COOLDOWN_MS) return;

    lastOverdueToastAt = now;
    localStorage.setItem('trainerLastOverdueToastAt', String(now));

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: `${summary.critical} session${summary.critical === 1 ? '' : 's'} reached ${SESSION_HARD_CAP_MINUTES}m cap`,
        timer: 2400,
        showConfirmButton: false
    });
}

function renderSessionReminderBanner() {
    const host = document.getElementById('session-reminder-host');
    if (!host) return;

    const summary = getSessionRiskSummary(activeSessionsCache);
    if (summary.total === 0) {
        host.innerHTML = '';
        return;
    }

    const severityClass = summary.critical > 0 ? 'is-critical' : summary.warning > 0 ? 'is-warning' : 'is-normal';
    host.innerHTML = `
            <div class="session-reminder-banner ${severityClass}">
                <div class="session-reminder-copy">
                    <strong>${summary.total} active session${summary.total === 1 ? '' : 's'}</strong>
                    <span>${summary.warning} between ${SESSION_WARNING_MINUTES}-${SESSION_HARD_CAP_MINUTES - 1}m, ${summary.critical} at ${SESSION_HARD_CAP_MINUTES}+m</span>
                </div>
            </div>
        `;

    maybeShowOverdueReminderToast(summary);
}

function setCheckInControlsEnabled(enabled) {
    const searchBtn = document.getElementById('search-btn');
    const searchModeBtn = document.getElementById('search-input-mode-btn');
    const searchCard = document.getElementById('student-search-card');

    if (searchBtn) searchBtn.disabled = !enabled;
    if (searchModeBtn) searchModeBtn.disabled = !enabled;
    if (searchCard) searchCard.classList.toggle('is-slot-required', !enabled);

    if (searchChoices && typeof searchChoices.enable === 'function' && typeof searchChoices.disable === 'function') {
        if (enabled) searchChoices.enable();
        else searchChoices.disable();
        return;
    }

    const trInput = document.getElementById('tr-input');
    if (trInput) trInput.disabled = !enabled;
}

function openSlotSelectorDropdown() {
    const slotSelector = document.getElementById('slot-selector');
    if (!slotSelector) return;
    slotSelector.focus();
    if (typeof slotSelector.showPicker === 'function') {
        slotSelector.showPicker();
        return;
    }
    if (typeof slotSelector.click === 'function') {
        slotSelector.click();
    }
}

function renderSlotSelectionWarning() {
    const warningContainer = document.getElementById('slot-selection-warning-container');
    if (!warningContainer) return;

    if (selectedSlotID) {
        warningContainer.innerHTML = '';
        warningContainer.classList.add('hidden');
        setCheckInControlsEnabled(true);
        return;
    }

    warningContainer.classList.remove('hidden');
    warningContainer.innerHTML = `
            <div>
                <strong>Select a specific slot before check-in.</strong>
                <p class="slot-required-note">All Slots keeps slot-change triggers inactive, so check-in/search is locked until one slot is selected.</p>
            </div>
            <button type="button" class="btn secondary" id="focus-slot-selector-btn">
                <span class="btn-text">Select Slot</span>
            </button>
        `;

    const focusBtn = document.getElementById('focus-slot-selector-btn');
    if (focusBtn) {
        focusBtn.addEventListener('click', () => {
            openSlotSelectorDropdown();
        });
    }

    setCheckInControlsEnabled(false);
}

async function validateTrainerSession() {
    try {
        // First get basic session info
        const sessionRes = await fetch('/api/session-user', { credentials: 'include' });
        const sessionData = await sessionRes.json();
        if (!sessionData.success || !sessionData.user) {
            window.location.href = '../Forbidden.html';
            return null;
        }

        // Then get detailed trainer profile
        const profileRes = await fetch('/api/trainer/profile', { credentials: 'include' });
        const profileData = await profileRes.json();

        if (profileData.success && profileData.user) {
            currentUser = profileData.user;
            localStorage.setItem("staffUser", JSON.stringify(profileData.user));
            return profileData.user;
        } else {
            currentUser = sessionData.user;
            localStorage.setItem("staffUser", JSON.stringify(sessionData.user));
            return sessionData.user;
        }

    } catch (err) {
        console.error('Session validation failed:', err);
        window.location.href = '../Forbidden.html';
        return null;
    }
}

// --- Student Mini Profile Logic ---
async function showMiniProfile(tr) {
    try {
        elements.profileTodayPlan.innerHTML = '<span class="text-muted italic">Loading plan...</span>';

        const [verifyRes, plansRes, studentPlanRes] = await Promise.all([
            fetch(`/api/verify-tr/${tr}`),
            fetch(`/api/training-plans/${tr}`),
            fetch(`/api/trainer/student-plan/${tr}`)
        ]);
        const verifyData = await verifyRes.json();
        const plansData = await plansRes.json();
        const studentPlanData = await studentPlanRes.json();

        if (!verifyData.valid) {
            throw new Error(verifyData.message || 'Invalid TR or membership expired');
        }

        currentStudent = verifyData.data;
        elements.profileName.textContent = currentStudent.Name;
        elements.profileTR.textContent = currentStudent.TR;
        elements.profileGoal.textContent = currentStudent.Goal || 'Not set';
        elements.profileSlot.textContent = currentStudent.SlotName || 'Not assigned';

        // --- Render Today's Plan ---
        const todayName = moment().tz("Asia/Kolkata").format('dddd'); // e.g. "Monday"
        const todayPlan = studentPlanData.success && studentPlanData.data
            ? studentPlanData.data.find(p => p.Day === todayName)
            : null;

        if (todayPlan && todayPlan.displayText && todayPlan.displayText.trim() !== "") {
            const safeHtml = todayPlan.displayText
                .split('\n')
                .map(line => line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;'))
                .join('<br>');
            elements.profileTodayPlan.innerHTML = safeHtml;
        } else {
            elements.profileTodayPlan.innerHTML = `<span class="text-muted italic">No workout planned for ${todayName}.</span>`;
        }

        elements.profileRecent.innerHTML = '';
        if (plansData.success && plansData.data.length > 0) {
            const recentActivities = plansData.data.slice(0, 2);
            recentActivities.forEach(activity => {
                const daysAgo = moment().diff(moment(activity.LogDate), 'days');
                const li = document.createElement('li');
                li.textContent = `${activity.BodyParts} (${daysAgo} day${daysAgo === 1 ? '' : 's'} ago)`;
                elements.profileRecent.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No recent workouts';
            elements.profileRecent.appendChild(li);
        }

        const modal = new bootstrap.Modal(elements.profileModal);
        closeSearchDropdown();
        modal.show();
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
}

function getSlotData() {
    if (slotsCache) return Promise.resolve(slotsCache);
    if (slotFetchPromise) return slotFetchPromise;

    slotFetchPromise = fetch('/api/slots', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
            if (data.success && Array.isArray(data.slots)) {
                slotsCache = data.slots;
                return slotsCache;
            }
            throw new Error(data.message || data.error || 'Failed to load slots');
        })
        .finally(() => {
            slotFetchPromise = null;
        });

    return slotFetchPromise;
}

function populateSlotSelector(slotSelect) {
    if (!slotSelect) return;
    slotSelect.innerHTML = '<option value="">All Slots</option>';

    getSlotData()
        .then((slots) => {
            if (!Array.isArray(slots)) return;
            slotSelect.innerHTML = '<option value="">All Slots</option>';
            slots.forEach((slot) => {
                const option = document.createElement('option');
                option.value = slot.SlotID;
                option.textContent = slot.SlotName;
                if (String(slot.SlotID) === String(selectedSlotID)) option.selected = true;
                slotSelect.appendChild(option);
            });
        })
        .catch((err) => {
            console.error('Failed to load slots:', err);
        })
        .finally(() => {
            renderSlotSelectionWarning();
        });
}

// Updated renderHomePage to fetch data once and add collapsible attendance
// show username after welcome ,and display "Talabat" when Gender is Male and "Talebaat" when Gender is Female instead of just Gender
function renderHomePage() {
    const displayName = currentUser?.Name || currentUser?.Username || 'Trainer';
    const istDate = moment().tz("Asia/Kolkata").format('YYYY-MM-DD');
    elements.mainContent.innerHTML = `
        <div class="home-flow-stack">
            <div class="card home-welcome-slot">
                <div class="welcome-copy">
                    <h3 id="welcomeText">Welcome, <span id="welcomeNameDisplay">${displayName}</span>! <br> <span>${currentUser?.Branch} - ${currentUser?.Gender === 'Male' ? 'Talabat' : 'Talebaat'}</span></h3>
                    <p><strong>Today's Date:</strong> <span>${istDate}</span></p>
                </div>
                <div class="slot-row">
                    <label for="slot-selector">Filter by Slot</label>
                    <select id="slot-selector" class="form-control">
                        <option value="">All Slots</option>
                    </select>
                </div>
                <div id="slot-selection-warning-container" class="slot-selection-warning hidden"></div>
            </div>
            <div class="card" id="quick-stats"></div>
            <div id="session-reminder-host"></div>
            <div class="card" id="student-search-card">
                <h4>Student Search</h4>
                <div class="search-group">
                    <select id="tr-input" class="form-control trainer-search-select"></select>
                    <div class="search-actions">
                        <button id="search-btn" class="btn search-submit-btn"><span class="btn-text">Search</span></button>
                        <button id="search-input-mode-btn" type="button" class="btn search-mode-btn" aria-pressed="false" title="Enable keyboard search">
                            <i class="fas fa-keyboard" aria-hidden="true"></i>
                            <span class="btn-text">Type</span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="card" id="daily-attendance-section">
                <div class="accordion-header" id="attendance-accordion-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                    <h4>Today's Attendance <span id="attendance-count-badge" class="attendance-count-badge">&nbsp;</span></h4>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="accordion-body hidden" id="attendance-accordion-body">
                    <table id="dailyAttendanceTable">
                        <thead><tr><th>TR</th><th>Name</th><th>Status</th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    const slotSelect = document.getElementById('slot-selector');
    populateSlotSelector(slotSelect);

    // Fetch data once and share, including SlotID filter
    const attendanceUrl = selectedSlotID ? `/api/daily-attendance?SlotID=${selectedSlotID}` : '/api/daily-attendance';
    renderQuickStats(null, null, null, { isLoading: true });

    Promise.all([
        fetch(attendanceUrl).then(res => res.json()),
        fetch('/api/active-sessions', { credentials: 'include' }).then(res => res.json())
    ]).then(async ([attendanceData, sessionsData]) => {
        if (attendanceData.error) throw new Error(attendanceData.error);
        if (!sessionsData.success) throw new Error(sessionsData.error);

        dailyAttendanceCache = attendanceData;
        searchStudentsCache = getPendingAttendanceStudents(attendanceData);
        activeSessionsCache = sessionsData.data;

        // Now update components with shared data
        renderDailyAttendance(dailyAttendanceCache);
        await initializeSearchSelector(searchStudentsCache); // Pass the data instead of fetching again
        renderSlotSelectionWarning();

        // --- MODIFICATION: Calculate present count ---
        const presentCount = dailyAttendanceCache.filter(s => s.IsPresentToday === 'Present').length;
        renderQuickStats(presentCount, dailyAttendanceCache.length, activeSessionsCache.length);
        renderSessionReminderBanner();
        // --- End Modification ---

    }).catch(err => {
        console.error('Failed to load home data:', err);
        // Handle error in UI
        document.getElementById('dailyAttendanceTable').querySelector('tbody').innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--error-text);">Could not load attendance.</td></tr>';
        renderQuickStats(null, null, null, { isError: true });
        renderSessionReminderBanner();
        renderSlotSelectionWarning();
    });

    updateSearchInputModeButton();
    initHomeListeners();
    renderSlotSelectionWarning();
}

// Updated renderQuickStats to show Present/Total and add ID for click, with good styling for highlighting data
function renderQuickStats(presentCount, totalAttendance, active, options = {}) {
    const { isLoading = false, isError = false } = options;
    const quickStatsEl = document.getElementById('quick-stats');
    if (!quickStatsEl) return;

    const hasValidCounts = Number.isFinite(presentCount) && Number.isFinite(totalAttendance);
    const hasValidActive = Number.isFinite(active);

    const attendancePct = hasValidCounts && totalAttendance > 0
        ? ((presentCount / totalAttendance) * 100).toFixed(1)
        : '--';

    const activeValue = hasValidActive ? active : '--';
    const presentValue = hasValidCounts ? `${presentCount}/${totalAttendance}` : '--/--';

    const activeMeta = isError
        ? 'Could not refresh'
        : isLoading
            ? 'Refreshing...'
            : `Live session${active === 1 ? '' : 's'}`;

    const presentMeta = isError
        ? 'Could not refresh stats'
        : isLoading
            ? 'Refreshing...'
            : `${attendancePct}% attendance`;

    quickStatsEl.classList.toggle('quick-stats-loading', isLoading);
    quickStatsEl.classList.toggle('quick-stats-error', isError);

    quickStatsEl.innerHTML = `
        <div class="row g-2 trainer-quick-stats">
            <div class="col-6">
                <button type="button" class="card quick-stat-card is-clickable" id="active-stats-card" title="Go to Check-out" ${isLoading || isError ? 'disabled' : ''}>
                    <span class="quick-stat-label">Active Sessions</span>
                    <span class="quick-stat-value">${activeValue}</span>
                    <span class="quick-stat-meta">${activeMeta}</span>
                    <span class="quick-stat-cta">Go to Check-out</span>
                </button>
            </div>
            <div class="col-6">
                <div class="card quick-stat-card">
                    <span class="quick-stat-label">Present Today</span>
                    <span class="quick-stat-value">${presentValue}</span>
                    <span class="quick-stat-meta">${presentMeta}</span>
                </div>
            </div>
        </div>
    `;
}

function renderCheckoutPage() {
    elements.mainContent.innerHTML = `
            <div class="card fade-in checkout-actions-card">
                <h3>Checkout Controls</h3>
                <div class="checkout-summary-line" id="checkout-summary-text">Loading active sessions...</div>
                <div class="checkout-actions-row">
                    <button id="bulk-overdue-btn" class="btn">
                        <span class="btn-text">Checkout Overdue (${SESSION_HARD_CAP_MINUTES}+m)</span>
                    </button>
                </div>
                <p class="checkout-actions-hint">Prioritize longest sessions first, then tap the buttons above to tidy the floor.</p>
            </div>
            <div class="card fade-in" id="departure-queue-card">
                <h3>Departure Queue</h3>
                <p class="departure-queue-subtext">Active Check-ins below: sorted by the longest duration.</p>
                <div id="departure-queue-list"></div>
            </div>
        `;
    initCheckoutListeners();
    loadActiveSessions();
}

function renderFitnessTestPage(preSelectedTR = null) {
    elements.mainContent.innerHTML = `
            <div class="card fade-in">
                <h3>Fitness Test</h3>
                <div class="form-group">
                    <label for="student-selector">Select Students (Max 5)</label>
                    <select id="student-selector" multiple></select>
                </div>
                <button id="addStudentsBtn" class="btn"><span class="btn-text">Add Students</span></button>
                <div id="testing-area"></div>
                <div id="submission-container" class="hidden">
                    <button id="submitAllTestsBtn" class="btn"><span class="btn-text">Submit All</span></button>
                </div>
            </div>
        `;
    initializeSelector(preSelectedTR);
    initFitnessTestListeners();
}

function renderMenuPage() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const profileAlert = !currentUser?.isProfileComplete ? `
            <div class="alert alert-warning fade-in" style="margin-bottom: 1.5rem; border-radius: 12px; border: 1px solid #ffeeba;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem; color: #856404;"></i>
                    <div>
                        <strong style="color: #856404; display: block; margin-bottom: 2px;">Incomplete Profile</strong>
                        <span style="font-size: 0.85rem; color: #856404; opacity: 0.9;">Please add your name and contact details to complete your trainer profile.</span>
                    </div>
                </div>
            </div>
        ` : '';

    elements.mainContent.innerHTML = `
            <div class="card fade-in">
                <h3>Menu</h3>
                ${profileAlert}
                <div class="list-group">
                    <div class="menu-item" id="editProfileBtn">
                    <i class="fas fa-user-edit"></i>
                    <span>Edit Profile</span>
                </div>
                    <button type="button" id="darkModeToggle" class="list-group-item list-group-item-action">
                        <i class="fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}"></i> 
                        Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode
                    </button>
                    <button type="button" id="logoutBtn" class="list-group-item list-group-item-action text-danger">
                        <i class="fas fa-sign-out-alt"></i> 
                        Logout
                    </button>
                </div>
            </div>
        `;
    initMenuListeners();
}


//----------------------------------------------------------------------------------
//------------------ Trainer Dashboard Logs ------------- --------------------------

function renderLogsPage() {
    elements.mainContent.innerHTML = `
        <div class="card fade-in">
            <h3>My Test Logs</h3>

            <input type="text" id="logSearchInput" class="glass-input" placeholder="Search by TR / Grade / Total" style="margin-bottom:10px;">

            <div id="logs-loading" style="text-align:center; padding:20px;">
                <div class="spinner"></div>
            </div>

            <div id="batchLogsContainer"></div>
        </div>
    `;

    loadLogsTable();
}


async function loadLogsTable() {
    try {
        const res = await fetch('/api/trainer/my-test-records');
        const result = await res.json();

        const loader = document.getElementById("logs-loading");
        if (loader) loader.remove();


        if (!result.success || result.data.length === 0) {
            document.getElementById("batchLogsContainer").innerHTML =
                `<p style="text-align:center;">No logs found.</p>`;
            return;
        }

        // ---- Group logs by BatchName ----
        const grouped = result.data.reduce((acc, log) => {
            if (!acc[log.BatchName]) acc[log.BatchName] = [];
            acc[log.BatchName].push(log);
            return acc;
        }, {});

        const container = document.getElementById("batchLogsContainer");
        container.innerHTML = "";

        Object.keys(grouped).forEach(batch => {
            const card = document.createElement("div");
            card.className = "card glass-card";

            card.innerHTML = `
                <div class="batch-header" data-batch="${batch}">
                <h4>${batch}</h4>
                <span class="log-count">${grouped[batch].length}</span>
                <i class="fas fa-chevron-down"></i>
                </div>


                <div class="accordion-body hidden" style="overflow-x: auto;">
                    <table class="log-table">
                        <thead>
                            <tr>
                                <th>TR</th>
                                <th>Name</th>
                                <th>Total</th>
                                <th>Grade</th>
                                <th style="text-align:center;">Action</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            container.appendChild(card);

            const tbody = card.querySelector("tbody");

            grouped[batch].forEach(r => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${r.TR}</td>
                    <td>${r.Name}</td>
                    <td>${r.Total}</td>
                    <td>${r.Grade}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-info view-log" data-id="${r.TestLog}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-log" data-id="${r.TestLog}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>

                `;
                tbody.appendChild(row);
            });
        });

        // Toggle accordion
        document.querySelectorAll(".batch-header").forEach(header => {
            header.addEventListener("click", () => {
                const body = header.nextElementSibling;
                body.classList.toggle("hidden");
                header.querySelector("i").classList.toggle("fa-chevron-up");
            });
        });

        // Bind view modal
        document.querySelectorAll(".view-log").forEach(btn =>
            btn.addEventListener("click", e =>
                showLogDetails(e.target.closest("button").dataset.id)
            )
        );

        document.querySelectorAll(".delete-log").forEach(btn => {
            btn.addEventListener("click", e => {
                const id = e.currentTarget.dataset.id;
                deleteLog(id);   // âœ… your existing delete function
            });
        });

    } catch (err) {
        Swal.fire("Error", "Failed to load logs", "error");
        console.error(err);
    }
}


async function showLogDetails(logId) {
    const res = await fetch(`/api/trainer/log-details/${logId}`);
    const json = await res.json();
    if (!json.success) return Swal.fire("Error", json.message, "error");

    const r = json.data;

    Swal.fire({
        title: `${r.BatchName || "Test Log"} - ${r.Name}`,
        html: `
<style>
.log-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); 
    gap: 6px;
    text-align:left;
}

.log-item {
    background: rgba(255, 255, 255, 0.10);     /* glass feel */
    padding: 6px 8px;
    border-radius: 10px;

    display: flex;
    flex-direction: column;
    align-items: center;                       /* center horizontally */
    justify-content: center;                   /* center vertically */
    text-align: center;

    /* subtle antique glass glow */
    box-shadow: 
        0 0 6px rgba(255, 215, 0, 0.15),       /* golden soft glow */
        inset 0 0 6px rgba(255,255,255,0.15);  /* inner shine */

    backdrop-filter: blur(6px);                /* frosted */
    -webkit-backdrop-filter: blur(6px);
}

.log-label { 
    font-size: 10px; 
    opacity: .6; 
    text-align:center;
}

.log-value {
    font-size: 13px;
    font-weight: 600;
    text-align:center;
}


.section-title {
    margin: 6px 0 4px;
    font-weight: 600;
    text-align:center;
    opacity: .85;
    font-size: 12px;
}

.modal-body-scroll {
    max-height: 65vh;         /* <-- limits height */
    overflow-y: auto;         /* <-- inside scroll not full page */
    padding: 4px 2px;
}
</style>

<div class="modal-body-scroll">

    <h4 style="text-align:center; font-weight:700; margin-bottom:4px; font-size:15px;">
        ${r.BatchName || "Test Log"}
    </h4>
    <p style="text-align:center; margin-bottom:8px; font-size:12px; opacity:.7;">
        ${r.Name} â€¢ TR ${r.TR}
    </p>

    <div class="section-title">Body</div>
    <div class="log-grid">
        <div class="log-item"><span class="log-label">Weight</span><div class="log-value">${r.Weight}</div></div>
        <div class="log-item"><span class="log-label">Height</span><div class="log-value">${r.Height}</div></div>
        <div class="log-item"><span class="log-label">Waist</span><div class="log-value">${r.Waist}</div></div>
        <div class="log-item"><span class="log-label">Hips</span><div class="log-value">${r.Hips}</div></div>
        <div class="log-item"><span class="log-label">Neck</span><div class="log-value">${r.Neck}</div></div>
        <div class="log-item"><span class="log-label">BMI</span><div class="log-value">${r.BMI} (${r.BMIStatus})</div></div>
        <div class="log-item"><span class="log-label">BodyFat</span><div class="log-value">${r.BodyFat}</div></div>
        <div class="log-item"><span class="log-label">BMR</span><div class="log-value">${r.BMR}</div></div>
        <div class="log-item"><span class="log-label">Calories</span><div class="log-value">${r.CalorieIntake}</div></div>
        <div class="log-item"><span class="log-label">VOâ‚‚Max</span><div class="log-value">${r.VO2Max}</div></div>
    </div>

    <div class="section-title">Performance & Result</div>
    <div class="log-grid">
        <div class="log-item"><span class="log-label">PushUps</span><div class="log-value">${r.PushUps}</div></div>
        <div class="log-item"><span class="log-label">SitUps</span><div class="log-value">${r.SitUps}</div></div>
        <div class="log-item"><span class="log-label">Squats</span><div class="log-value">${r.Squats}</div></div>
        <div class="log-item"><span class="log-label">Sit & Reach</span><div class="log-value">${r.SitAndReach}</div></div>
        <div class="log-item"><span class="log-label">Pulse</span><div class="log-value">${r.StepUpPulseRate}</div></div>
        <div class="log-item"><span class="log-label">Total</span><div class="log-value">${r.Total}</div></div>
        <div class="log-item"><span class="log-label">Grade</span><div class="log-value">${r.Grade}</div></div>
    </div>

    <p style="text-align:center; margin-top:6px; opacity:.6; font-size:11px;">
        ${moment(r.CreatedAt).format("DD MMM YYYY â€¢ hh:mm A")}
    </p>
</div>
`,

        confirmButtonText: "Close",
        background: "rgba(255,255,255,0.05)",
        backdrop: `rgba(0,0,0,0.8)`,
        customClass: {
            popup: "glass-card text-white"
        }
    });
}



async function deleteLog(logId) {
    const confirm = await Swal.fire({
        title: `Delete Log #${logId}?`,
        text: "This action is permanent.",
        icon: "warning",
        showCancelButton: true
    });

    if (!confirm.isConfirmed) return;

    const res = await fetch(`/api/trainer/delete-test-record/${logId}`, {
        method: "DELETE"
    });

    const data = await res.json();

    if (data.success) {
        Swal.fire("Deleted!", "Test record removed.", "success");
        await loadLogsTable();
    } else {
        Swal.fire("Error", data.message, "error");
    }
}




function renderEditProfilePage() {
    const user = JSON.parse(localStorage.getItem("staffUser"));

    document.getElementById("main-content").innerHTML = `
        <div class="glass-card fade-in">
            <h2 class="center-title">Edit Profile</h2>
            <p class="text-muted center">Update your trainer details</p>

            <form id="editProfileForm" class="form-layout">
                <label>Name</label>
                <input type="text" id="editName" class="glass-input" value="${user.Name || ''}" required>

                <label>Profession</label>
                <input type="text" id="editProfession" class="glass-input" value="${user.Profession || ''}" placeholder="Fitness Trainer / Sports / Yoga / etc." required>

                <label>Contact</label>
                <input type="text" id="editContact" class="glass-input" value="${user.Contact || ''}" placeholder="+91xxxxxxxxxx">

                <label>Email</label>
                <input type="email" id="editEmail" class="glass-input" value="${user.Email || ''}" placeholder="example@gmail.com">

                <button type="submit" class="save-btn">
                    <span>Save Changes</span>
                </button>
            </form>
        </div>
    `;

    document.getElementById("editProfileForm").addEventListener("submit", updateTrainerProfile);
}


async function updateTrainerProfile(event) {
    event.preventDefault();

    const payload = {
        Name: document.getElementById("editName").value.trim(),
        Profession: document.getElementById("editProfession").value.trim(),
        Contact: document.getElementById("editContact").value.trim(),
        Email: document.getElementById("editEmail").value.trim(),
    };

    // Show loading state
    Swal.fire({
        title: "Updating Profile...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const res = await fetch('/api/trainer/profile', {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
        Swal.fire({
            icon: "success",
            title: "Profile Updated",
            toast: true,
            timer: 2000,
            position: "top-end",
            showConfirmButton: false
        });

        // Update local values immediately
        currentUser.Name = payload.Name;
        currentUser.Profession = payload.Profession;
        currentUser.Contact = payload.Contact;
        currentUser.Email = payload.Email;
        currentUser.isProfileComplete = !!(payload.Name && payload.Contact);
        localStorage.setItem("staffUser", JSON.stringify(currentUser));

        // Refresh displayed name on Home page immediately
        const welcomeNameDisplay = document.getElementById("welcomeNameDisplay");
        if (welcomeNameDisplay) welcomeNameDisplay.innerText = payload.Name;

    } else {
        Swal.fire("Error", data.message || "Profile update failed.", "error");
    }
}


// ------------------------------------------------------------------------------------------

// --- Component Init & Load Functions ---
async function loadQuickStats() {
    const statsContainer = document.getElementById('quick-stats');
    if (!statsContainer) return;
    renderQuickStats(null, null, null, { isLoading: true });
    try {
        const attendanceUrl = selectedSlotID ? `/api/daily-attendance?SlotID=${selectedSlotID}` : '/api/daily-attendance';
        const [attendanceRes, sessionsRes] = await Promise.all([
            fetch(attendanceUrl),
            fetch('/api/active-sessions', { credentials: 'include' })
        ]);
        const attendanceData = await attendanceRes.json();
        const sessionsData = await sessionsRes.json();

        if (!attendanceRes.ok) throw new Error(attendanceData.message || 'Failed to load attendance');
        if (!sessionsData.success) throw new Error(sessionsData.error || 'Failed to load sessions');

        dailyAttendanceCache = attendanceData;
        searchStudentsCache = getPendingAttendanceStudents(attendanceData);
        activeSessionsCache = sessionsData.data;

        const active = activeSessionsCache.length;
        const totalAttendance = dailyAttendanceCache.length;

        // --- MODIFICATION: Calculate present count ---
        const presentCount = dailyAttendanceCache.filter(s => s.IsPresentToday === 'Present').length;
        // --- End Modification ---

        renderQuickStats(presentCount, totalAttendance, active);
        renderSessionReminderBanner();


    } catch (err) {
        console.error('Failed to load quick stats:', err);
        renderQuickStats(null, null, null, { isError: true });
        renderSessionReminderBanner();
    }
}

async function loadDailyAttendance() {
    const tbody = document.querySelector('#dailyAttendanceTable tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading attendance...</td></tr>';
    try {
        const attendanceUrl = selectedSlotID ? `/api/daily-attendance?SlotID=${selectedSlotID}` : '/api/daily-attendance';
        const res = await fetch(attendanceUrl);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load attendance');
        dailyAttendanceCache = data;
        searchStudentsCache = getPendingAttendanceStudents(data);
        renderDailyAttendance(data);
        if (document.getElementById('tr-input')) {
            await initializeSearchSelector(searchStudentsCache);
            renderSlotSelectionWarning();
        }
    } catch (err) {
        console.error('Failed to load daily attendance:', err);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--error-text);">Could not load attendance.</td></tr>';
    }
}

function renderDailyAttendance(data) {
    const tbody = document.querySelector('#dailyAttendanceTable tbody');
    tbody.innerHTML = '';
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="3">No attendance records.</td></tr>';
        const badge = document.getElementById('attendance-count-badge');
        if (badge) badge.textContent = 'No entries';
        return;
    }
    data.forEach(student => {
        let statusStyle = '';
        const statusText = student.IsPresentToday;
        switch (statusText) {
            case 'Present': statusStyle = `background-color: var(--success-bg); color: var(--success-text);`; break;
            case 'On Leave': statusStyle = `background-color: #fff3cd; color: #856404;`; break;
            default: statusStyle = `background-color: var(--error-bg); color: var(--error-text);`; break;
        }
        const row = `<tr><td>${student.TR}</td><td>${student.Name}</td><td style="${statusStyle}">${statusText}</td></tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    const badge = document.getElementById('attendance-count-badge');
    if (badge) badge.textContent = `${data.length} entries`;
}

async function loadActiveSessions() {
    const tbody = document.getElementById('active-sessions-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading sessions...</td></tr>';
    }
    try {
        const res = await fetch('/api/active-sessions', { credentials: 'include' });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || result.message || 'Failed to load sessions');
        activeSessionsCache = Array.isArray(result.data) ? result.data : [];
        if (tbody) renderActiveSessions(activeSessionsCache);
        renderDepartureQueue(activeSessionsCache);
        updateCheckoutSummaryInfo();
        renderSessionReminderBanner();
    } catch (err) {
        console.error('Failed to load active sessions:', err);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--error-text);">Could not load active sessions.</td></tr>';
        }
        renderSessionReminderBanner();
    }
}

function renderDepartureQueue(data) {
    const queueList = document.getElementById('departure-queue-list');
    if (!queueList) return;

    if (!Array.isArray(data) || !data.length) {
        queueList.innerHTML = '<p class="checkout-muted">No active departures pending.</p>';
        return;
    }

    const sorted = [...data].sort((a, b) => getSessionElapsedMinutes(b) - getSessionElapsedMinutes(a));
    queueList.innerHTML = '';

    sorted.forEach((session, index) => {
        const elapsed = getSessionElapsedMinutes(session);
        const riskBand = getSessionRiskBand(session);
        const checkInTime = moment.utc(session.CreatedAt).tz("Asia/Kolkata").format("h:mm A");
        const slotTag = session.SlotName ? ` • ${session.SlotName}` : '';
        const card = document.createElement('div');
        card.className = 'departure-queue-item';
        const rankLabel = index === 0 ? 'Longest running' : `#${index + 1}`;
        const rankTitle = index === 0 ? 'Longest running session in queue' : `Rank ${index + 1}`;
        card.classList.toggle('departure-queue-item-primary', index === 0);
        card.setAttribute('data-rank', String(index + 1));
        card.innerHTML = `
                <div class="departure-queue-meta">
                    <div class="departure-queue-meta-line">
                        <div class="departure-queue-meta-title">
                            <strong>${session.Name}</strong>
                            <span class="departure-queue-rank" title="${rankTitle}">${rankLabel}</span>
                        </div>
                        <span class="departure-queue-elapsed-chip risk-${riskBand}">
                            <i class="fas fa-clock" aria-hidden="true"></i>
                            <span>${formatElapsedMinutes(elapsed)}</span>
                            <small>elapsed</small>
                        </span>
                    </div>
                    <span class="departure-queue-meta-sub">
                        TR ${session.TR} • Checked in ${checkInTime}${slotTag}
                    </span>
                </div>
                <button class="btn departure-queue-checkout" aria-label="Check out ${session.Name}">
                    <span class="btn-text">Check Out</span>
                </button>
            `;

        const checkoutBtn = card.querySelector('.departure-queue-checkout');
        checkoutBtn.addEventListener('click', () => handleCheckout(session, checkoutBtn));
        queueList.appendChild(card);
    });
}

function renderActiveSessions(data) {
    const tbody = document.getElementById('active-sessions-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5">No active sessions.</td></tr>';
        return;
    }

    data.forEach((session) => {
        const checkInTime = moment.utc(session.CreatedAt).tz("Asia/Kolkata").format("h:mm A");
        const elapsed = getSessionElapsedMinutes(session);
        const riskBand = getSessionRiskBand(session);
        const row = document.createElement('tr');
        row.innerHTML = `
                <td>${session.TR}</td>
                <td>${session.Name}</td>
                <td>${checkInTime}</td>
                <td><span class="elapsed-pill risk-${riskBand}">${formatElapsedMinutes(elapsed)}</span></td>
            `;

        const buttonCell = document.createElement('td');
        const checkoutBtn = document.createElement('button');
        checkoutBtn.classList.add('btn');
        checkoutBtn.innerHTML = '<span class="btn-text">Check Out</span>';
        checkoutBtn.onclick = () => handleCheckout(session, checkoutBtn);
        buttonCell.appendChild(checkoutBtn);
        row.appendChild(buttonCell);
        tbody.appendChild(row);
    });
}

function updateCheckoutSummaryInfo() {
    const summaryHost = document.getElementById('checkout-summary-text');
    if (!summaryHost) return;

    const summary = getSessionRiskSummary(activeSessionsCache);
    summaryHost.classList.remove('summary-normal', 'summary-warning', 'summary-critical');

    if (summary.total === 0) {
        summaryHost.textContent = 'No active sessions right now.';
        summaryHost.classList.add('summary-normal');
        return;
    }

    const severityClass = summary.critical > 0 ? 'summary-critical'
        : summary.warning > 0 ? 'summary-warning'
            : 'summary-normal';
    summaryHost.classList.add(severityClass);
    summaryHost.innerHTML = `<strong>${summary.total}</strong> active session${summary.total === 1 ? '' : 's'} • ${summary.warning} warning • ${summary.critical} critical`;
}

async function handleCheckout(session, button) {
    if (button) toggleButtonSpinner(button, true);

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ TR: session.TR })
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.code === 'ALREADY_CLOSED') {
                await loadActiveSessions();
                if (document.getElementById('quick-stats')) await loadQuickStats();
                Swal.fire('Already Closed', data.message || 'Session is already checked out.', 'info');
                return;
            }
            throw new Error(data.message || 'Checkout failed');
        }

        const durationMinutes = Number.isFinite(Number(data.duration))
            ? Number(data.duration)
            : getSessionElapsedMinutes(session);
        const awardedXP = Number.isFinite(Number(data.awardedXP))
            ? Number(data.awardedXP)
            : durationMinutes * 10;
        const xpText = data.levelUpInfo?.levelledUp
            ? `Earned ${awardedXP} XP and reached Level ${data.levelUpInfo.newLevel}.`
            : `Earned ${awardedXP} XP this session.`;
        const capText = data.wasCapped ? `<br><small>Duration capped at ${SESSION_HARD_CAP_MINUTES} minutes for data safety.</small>` : '';

        await Swal.fire({
            title: 'Checked Out',
            html: `<strong>${session.Name}</strong> completed a <b>${durationMinutes}-minute</b> workout.<br>${xpText}${capText}`,
            icon: 'success',
            timer: 2400,
            showConfirmButton: false
        });

        await loadActiveSessions();
        if (document.getElementById('quick-stats')) {
            await loadQuickStats();
        }
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        if (button && button.isConnected) {
            toggleButtonSpinner(button, false);
        }
    }
}
async function initializeSelector(preSelectedTR = null) {
    try {
        // ًں”¥ Use cached data if available
        if (!cachedStudents) {
            const stored = localStorage.getItem("studentsList");
            if (stored) cachedStudents = JSON.parse(stored);
            else {
                const res = await fetch('/api/students-list');
                cachedStudents = await res.json();
                localStorage.setItem("studentsList", JSON.stringify(cachedStudents));
            }
        }


        // If already initialized, destroy existing instance before rebuilding UI
        if (studentChoices) {
            studentChoices.destroy();
        }

        // Build selector using cached data
        studentChoices = new Choices('#student-selector', {
            removeItemButton: true,
            maxItemCount: 5,
            placeholderValue: 'Search by name or TR...',
            choices: cachedStudents.map(s => ({
                value: String(s.value),
                label: s.label
            }))
        });

        if (preSelectedTR) {
            studentChoices.setChoiceByValue(String(preSelectedTR));
        }

    } catch (err) {
        console.error('Failed to initialize student selector:', err);
        Swal.fire('Error', 'Failed to load student list.', 'error');
    }
}


// Updated initializeSearchSelector to use passed data
function bindSearchDropdownAdaptivePosition(choiceInstance) {
    const outerElement = choiceInstance?.containerOuter?.element;
    if (!outerElement) return () => { };

    const selectElement = choiceInstance?.passedElement?.element || document.getElementById('tr-input');

    const updateDropdownDirection = () => {
        const nav = document.querySelector('.bottom-nav');
        const navHeight = nav ? nav.getBoundingClientRect().height : 0;
        const rect = outerElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const spaceBelow = viewportHeight - rect.bottom - navHeight - 12;
        const spaceAbove = rect.top - 12;
        const shouldOpenUp = spaceBelow < 220 && spaceAbove > spaceBelow;

        outerElement.classList.toggle('dropdown-up', shouldOpenUp);
    };

    const onViewportChange = () => updateDropdownDirection();
    const onDropdownShow = () => updateDropdownDirection();

    updateDropdownDirection();

    if (selectElement) {
        selectElement.addEventListener('showDropdown', onDropdownShow);
        selectElement.addEventListener('search', onDropdownShow);
    }
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('scroll', onViewportChange, { passive: true });

    return () => {
        if (selectElement) {
            selectElement.removeEventListener('showDropdown', onDropdownShow);
            selectElement.removeEventListener('search', onDropdownShow);
        }
        window.removeEventListener('resize', onViewportChange);
        window.removeEventListener('scroll', onViewportChange);
    };
}

function updateSearchInputModeButton() {
    const modeBtn = document.getElementById('search-input-mode-btn');
    if (!modeBtn) return;

    if (!prefersTouchDropdown) {
        modeBtn.classList.add('is-hidden');
        return;
    }

    modeBtn.classList.remove('is-hidden');
    modeBtn.classList.toggle('is-active', touchKeyboardSearchEnabled);
    modeBtn.setAttribute('aria-pressed', String(touchKeyboardSearchEnabled));
    modeBtn.title = touchKeyboardSearchEnabled ? 'Switch to browse mode' : 'Enable keyboard search';

    const textEl = modeBtn.querySelector('.btn-text');
    if (textEl) {
        textEl.textContent = touchKeyboardSearchEnabled ? 'Browse' : 'Type';
    }
}

async function initializeSearchSelector(students) {
    try {
        if (!Array.isArray(students)) throw new Error('Invalid student list format');
        if (cleanupSearchDropdownListeners) {
            cleanupSearchDropdownListeners();
            cleanupSearchDropdownListeners = null;
        }
        if (searchChoices) {
            searchChoices.destroy();
            searchChoices = null;
        }
        const rawSearchSelect = document.getElementById('tr-input');
        if (rawSearchSelect) {
            // Clear raw select so recreated Choices doesn't append duplicate entries.
            rawSearchSelect.innerHTML = '';
        }
        const keyboardSearchEnabled = !prefersTouchDropdown || touchKeyboardSearchEnabled;
        const hasPendingStudents = students.length > 0;
        searchChoices = new Choices('#tr-input', {
            removeItemButton: true,
            maxItemCount: 1,
            searchEnabled: keyboardSearchEnabled,
            shouldSort: false,
            searchResultLimit: 15,
            searchFields: ['label', 'value'],
            itemSelectText: '',
            noResultsText: 'No matching student',
            noChoicesText: 'All students in this slot are already marked present',
            placeholderValue: keyboardSearchEnabled
                ? (hasPendingStudents ? 'Search pending by name or TR...' : 'No pending students')
                : (hasPendingStudents ? 'Browse pending students...' : 'No pending students'),
            choices: students.map(student => ({
                value: String(student.TR),
                label: `${student.Name} [${student.TR}]`
            }))
        });
        searchChoices.containerOuter.element.classList.add('trainer-search-choices');
        cleanupSearchDropdownListeners = bindSearchDropdownAdaptivePosition(searchChoices);
        updateSearchInputModeButton();
    } catch (err) {
        console.error('Failed to initialize search selector:', err);
        Swal.fire('Error', 'Failed to load student list for search.', 'error');
    }
}

function persistSelectedSlot(slotID) {
    selectedSlotID = slotID || null;
    if (selectedSlotID) {
        localStorage.setItem('trainerSelectedSlotID', selectedSlotID);
    } else {
        localStorage.removeItem('trainerSelectedSlotID');
    }
}

async function handleSlotChangeWithGuardrail(previousSlotID, nextSlotID) {
    persistSelectedSlot(nextSlotID);

    if (!previousSlotID || String(previousSlotID) === String(nextSlotID)) {
        renderHomePage();
        return;
    }

    const activeInPreviousSlot = activeSessionsCache.filter(
        (session) => String(session?.SlotID || '') === String(previousSlotID)
    );

    if (!activeInPreviousSlot.length) {
        renderHomePage();
        return;
    }

    const prompt = await Swal.fire({
        title: 'Previous Slot Check-out',
        html: `${activeInPreviousSlot.length} active session${activeInPreviousSlot.length === 1 ? '' : 's'} found in the previous slot.`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Auto checkout previous slot',
        denyButtonText: 'Go to check-out',
        cancelButtonText: 'Skip'
    });

    if (prompt.isConfirmed) {
        try {
            const result = await checkoutSessionsBulk('slot', previousSlotID);
            const checkedOut = result?.summary?.checkedOut || 0;
            Swal.fire('Done', `Checked out ${checkedOut} session${checkedOut === 1 ? '' : 's'} from previous slot.`, 'success');
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
        renderHomePage();
        return;
    }

    if (prompt.isDenied) {
        navigateToCheckoutPage();
        return;
    }

    renderHomePage();
}

function initCheckoutListeners() {
    const overdueBtn = document.getElementById('bulk-overdue-btn');

    if (overdueBtn) {
        overdueBtn.addEventListener('click', async () => {
            toggleButtonSpinner(overdueBtn, true);
            try {
                const result = await checkoutSessionsBulk('overdue');
                const checkedOut = result?.summary?.checkedOut || 0;
                Swal.fire('Done', `Checked out ${checkedOut} overdue session${checkedOut === 1 ? '' : 's'}.`, 'success');
                await loadActiveSessions();
                if (document.getElementById('quick-stats')) await loadQuickStats();
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            } finally {
                toggleButtonSpinner(overdueBtn, false);
            }
        });
    }
}

// --- Listeners Init ---
// Updated initHomeListeners for new click events
function initHomeListeners() {
    const trInput = document.getElementById('tr-input');
    const searchBtn = document.getElementById('search-btn');
    const searchModeBtn = document.getElementById('search-input-mode-btn');
    const slotSelector = document.getElementById('slot-selector');

    // --- MODIFICATION: Listener for Slot Selector ---
    if (slotSelector) {
        slotSelector.addEventListener('change', async (e) => {
            const previousSlotID = selectedSlotID;
            const nextSlotID = e.target.value || null;

            // Guard against redundant events
            if (String(previousSlotID) === String(nextSlotID)) return;

            // Update state immediately
            selectedSlotID = nextSlotID;
            persistSelectedSlot(nextSlotID);

            // Fetch current active sessions for the guardrail check
            try {
                const res = await fetch('/api/active-sessions', { credentials: 'include' });
                const result = await res.json();
                if (result.success) {
                    activeSessionsCache = Array.isArray(result.data) ? result.data : [];
                }
            } catch (err) {
                console.error('Failed to refresh sessions for guardrail:', err);
            }

            await handleSlotChangeWithGuardrail(previousSlotID, nextSlotID);
        });
    }
    // --- End Modification ---

    // --- MODIFICATION: Listener for Active Stats Card (using event delegation) ---
    const quickStatsCard = document.getElementById('quick-stats');
    if (quickStatsCard) {
        quickStatsCard.addEventListener('click', (e) => {
            // Check if the click was on the active card or its child elements
            const activeCard = e.target.closest('#active-stats-card');
            if (activeCard) {
                const checkoutLink = document.querySelector('.nav-link[data-page="checkout"]');
                if (checkoutLink) checkoutLink.click();
            }
        });
    }
    // --- End Modification ---

    // --- MODIFICATION: Listener for Collapsible Attendance Card ---
    const attendanceHeader = document.getElementById('attendance-accordion-header');
    if (attendanceHeader) {
        attendanceHeader.addEventListener('click', () => {
            const body = document.getElementById('attendance-accordion-body');
            const icon = attendanceHeader.querySelector('i');
            if (body) body.classList.toggle('hidden');
            if (icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    }
    // --- End Modification ---

    if (searchModeBtn) {
        searchModeBtn.addEventListener('click', async () => {
            if (!prefersTouchDropdown) return;

            const rawSelected = searchChoices ? searchChoices.getValue(true) : '';
            const selectedValue = Array.isArray(rawSelected) ? rawSelected[0] : rawSelected;

            touchKeyboardSearchEnabled = !touchKeyboardSearchEnabled;
            await initializeSearchSelector(searchStudentsCache);

            if (selectedValue && searchChoices) {
                searchChoices.setChoiceByValue(String(selectedValue));
            }

            if (touchKeyboardSearchEnabled && searchChoices) {
                searchChoices.showDropdown();
                window.setTimeout(() => {
                    const inputEl = searchChoices?.input?.element;
                    if (inputEl) inputEl.focus();
                }, 40);
            }
        });
    }

    const handleSearch = debounce(async () => {
        if (!selectedSlotID) {
            Swal.fire('Select Slot', 'Choose a specific slot before searching/checking-in students.', 'info');
            return;
        }

        // Always try to get value from Choices first, fallback to raw input if needed
        let query = '';
        if (searchChoices) {
            const val = searchChoices.getValue(true);
            query = Array.isArray(val) ? val[0] : val;
        } else {
            query = trInput.value.trim();
        }

        if (query) {
            toggleButtonSpinner(searchBtn, true);
            try {
                closeSearchDropdown();
                await showMiniProfile(query);
                if (searchChoices) {
                    searchChoices.removeActiveItems();
                    searchChoices.clearInput();
                }
            } finally {
                toggleButtonSpinner(searchBtn, false);
            }
        }
    }, 300);

    // trInput change might be triggered by Choices.js internal events, 
    // so we mainly rely on Choice's internal selection or the Search button.
    trInput.addEventListener('change', () => {
        // We can keep it but handleSearch already debounces
        handleSearch();
    });

    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSearch();
    });
}

// --- ًں§  Unit Validation Helper for Trainer Fitness Test ---
function detectInchLikeValues(form) {
    const tr = form.dataset.tr;
    const waist = parseFloat(form.querySelector('[name="Waist"]').value);
    const neck = parseFloat(form.querySelector('[name="Neck"]').value);
    const hips = parseFloat(form.querySelector('[name="Hips"]').value);

    let warnings = [];

    // Likely inches if smaller than realistic cm values
    if (waist > 0 && waist < 50) warnings.push("Waist");
    if (neck > 0 && neck < 25) warnings.push("Neck");
    if (hips > 0 && hips < 50) warnings.push("Hips");

    if (warnings.length > 0) {
        return { tr, fields: warnings };
    }
    return null;
}


function initFitnessTestListeners() {
    document.getElementById('addStudentsBtn').addEventListener('click', async () => {
        const button = document.getElementById('addStudentsBtn');
        toggleButtonSpinner(button, true);
        try {
            const selected = studentChoices.getValue(true);
            if (!selected.length) {
                Swal.fire('No Selection', 'Select at least one student.', 'info');
                return;
            }
            // Fetch FULL student data including DOB
            const data = await Promise.all(
                selected.map(tr => fetch(`/api/testmaster/${tr}`, { credentials: 'include' }).then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch data for TR ${tr}`);
                    return res.json();
                }))
            );
            const testingArea = document.getElementById('testing-area');
            testingArea.innerHTML = '';
            data.forEach(student => {
                if (student.TR) {
                    const accordion = createAccordionForm(student);
                    testingArea.appendChild(accordion);
                }
            });
            document.getElementById('submission-container').classList.remove('hidden');
        } catch (err) {
            Swal.fire('Error', 'Failed to load student data.', 'error');
        } finally {
            toggleButtonSpinner(button, false);
        }
    });

    document.getElementById('submitAllTestsBtn').addEventListener('click', async () => {
        const button = document.getElementById('submitAllTestsBtn');
        toggleButtonSpinner(button, true);
        const forms = document.querySelectorAll('.student-test-form');
        const allRecordsPayload = [];
        let allFormsValid = true;

        for (const form of forms) {
            if (!form.checkValidity()) {
                form.reportValidity();
                allFormsValid = false;
                break;
            }
            const record = calculateFitnessRecord(form);
            if (record) {
                allRecordsPayload.push(record);
            } else {
                allFormsValid = false;
                Swal.fire('Calculation Error', `Could not calculate report for TR ${form.dataset.tr}. Check all inputs.`, 'error');
                break;
            }
        }

        if (!allFormsValid) {
            if (forms.length > 0) {
                Swal.fire('Error', 'Please fill all required fields for every student.', 'error');
            }
            toggleButtonSpinner(button, false);
            return;
        }

        // --- Inch/CM mismatch check before submission ---
        const mismatchRecords = [];
        for (const form of forms) {
            const mismatch = detectInchLikeValues(form);
            if (mismatch) mismatchRecords.push(mismatch);
        }

        // Create warning HTML if mismatches found
        let warningHTML = `<p>You are about to submit <b>${allRecordsPayload.length}</b> fitness records.</p>`;
        if (mismatchRecords.length > 0) {
            warningHTML += `<div style="margin-top:10px; text-align:left; color:#b91c1c;">
                âڑ ï¸ڈ <b>Possible Unit Mismatch Detected:</b><br>
                <ul style="margin:0; padding-left:20px;">${mismatchRecords
                    .map(
                        (m) =>
                            `<li><b>TR ${m.tr}</b> â€” check ${m.fields.join(", ")} values (too small for cm; may be in inches)</li>`
                    )
                    .join("")}</ul>
                <br><b>Please verify before final submission.</b>
                </div>`;
        }

        Swal.fire({
            title: 'Confirm Submission',
            html: warningHTML,
            icon: mismatchRecords.length > 0 ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Submit All',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch('/api/trainer-test-records', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(allRecordsPayload)
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'An unknown error occurred.');

                    Swal.fire('Success!', data.message, 'success').then(() => {
                        location.reload();
                    });
                } catch (err) {
                    Swal.fire('Submission Failed', err.message, 'error');
                } finally {
                    toggleButtonSpinner(button, false);
                }
            } else {
                toggleButtonSpinner(button, false);
            }
        });

    });
}

function createAccordionForm(student) {
    const div = document.createElement('div');
    div.classList.add('accordion-item');
    div.innerHTML = `
            <div class="accordion-header">${student.Name} (TR: ${student.TR})</div>
            <div class="accordion-body hidden">
                <form class="student-test-form" data-tr="${student.TR}" data-dob="${student.DOB || ''}" data-gender="${student.Gender || ''}">
                    <div class="row mb-3">
                        <div class="col"><label>Weight (kg)</label><input type="number" step="any" class="form-control" name="Weight" required></div>
                        <div class="col"><label>Height (cm)</label><input type="number" step="any" class="form-control" name="Height" required></div>
                        <div class="col"><label>Waist (cm)</label><input type="number" step="any" class="form-control" name="Waist" required></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col"><label>Hips (cm)</label><input type="number" step="any" class="form-control" name="Hips" required></div>
                        <div class="col"><label>Neck (cm)</label><input type="number" step="any" class="form-control" name="Neck" required></div>
                        <div class="col"><label>Push-ups (30 sec)</label><input type="number" class="form-control" name="PushUps" required></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col"><label>Sit-ups (30 sec)</label><input type="number" class="form-control" name="SitUps" required></div>
                        <div class="col"><label>Squats (30 sec)</label><input type="number" class="form-control" name="Squats" required></div>
                        <div class="col"><label>Sit and Reach</label><input type="number" step="any" class="form-control" name="SitReach" required></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col"><label>Step-Up Pulse Rate</label><input type="number" class="form-control" name="PulseRate" required></div>
                    </div>
                </form>
            </div>
        `;
    div.querySelector('.accordion-header').addEventListener('click', () => {
        div.querySelector('.accordion-body').classList.toggle('hidden');
    });
    return div;
}

function calculateFitnessRecord(formElement) {
    try {
        const calculated = {};
        const Weight = parseFloat(formElement.querySelector('[name="Weight"]').value);
        const Height = parseFloat(formElement.querySelector('[name="Height"]').value);
        const Waist = parseFloat(formElement.querySelector('[name="Waist"]').value);
        const Hips = parseFloat(formElement.querySelector('[name="Hips"]').value);
        const Neck = parseFloat(formElement.querySelector('[name="Neck"]').value);
        const PulseRate = parseFloat(formElement.querySelector('[name="PulseRate"]').value);
        const PushUps = parseInt(formElement.querySelector('[name="PushUps"]').value) || 0;
        const SitUps = parseInt(formElement.querySelector('[name="SitUps"]').value) || 0;
        const Squats = parseInt(formElement.querySelector('[name="Squats"]').value) || 0;
        const SitReach = parseFloat(formElement.querySelector('[name="SitReach"]').value) || 0;
        // --- Get Gender from dataset ---
        const Gender = formElement.dataset.gender?.toLowerCase(); // Get gender, default to lowercase
        if (!Gender) {
            // Handle case where gender might be missing, although it shouldn't be
            console.error(`Gender missing for TR ${formElement.dataset.tr}. Defaulting calculations.`);
            // Optionally throw an error or use a default
            // throw new Error(`Gender is missing for student TR ${formElement.dataset.tr}. Cannot calculate accurately.`);
        }
        const dobString = formElement.dataset.dob;
        let Age = 18; // Default if DOB is missing/invalid
        if (dobString && /^\d{4}-\d{2}-\d{2}$/.test(dobString)) {
            const birthDate = new Date(dobString);
            const today = new Date();
            Age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                Age--;
            }
        } else if (dobString) {
            // Warn if DOB format is bad, but proceed with default age
            console.warn(`Invalid DOB format for TR ${formElement.dataset.tr}: ${dobString}. Using default age 18.`);
        }

        const heightInM = Height / 100;
        const bmi = Weight / (heightInM * heightInM);
        calculated.BMI = parseFloat(bmi.toFixed(1));
        calculated.BMIStatus = bmi < 18.5 ? "Underweight" : bmi < 24.9 ? "Normal weight" : bmi < 29.9 ? "Overweight" : "Obese";

        if (Waist && Neck && Height) {
            if (Gender === "male") {
                calculated.BodyFat = parseFloat((495 / (1.0324 - 0.19077 * Math.log10(Waist - Neck) + 0.15456 * Math.log10(Height)) - 450).toFixed(1));
            } else if (Gender === "female" && Hips) { // Female formula needs Hips
                calculated.BodyFat = parseFloat((495 / (1.29579 - 0.35004 * Math.log10(Waist + Hips - Neck) + 0.22100 * Math.log10(Height)) - 450).toFixed(1));
            } else if (Gender === "female" && !Hips) {
                console.warn(`Hips measurement missing for female student TR ${formElement.dataset.tr}. Cannot calculate Body Fat.`);
                calculated.BodyFat = "N/A"; // Or handle as needed
            } else {
                calculated.BodyFat = "N/A"; // Handle unknown gender or missing values
            }
        } else {
            calculated.BodyFat = "N/A";
        }


        if (Weight && Height && Age) {
            if (Gender === "male") {
                calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age + 5);
            } else if (Gender === "female") {
                calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age - 161);
            } else {
                // Default or average if gender unknown
                calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age - 78); // Average offset
            }
            calculated.CalorieIntake = Math.round(calculated.BMR * 1.55); // Assuming moderate activity
        } else {
            calculated.BMR = "N/A";
            calculated.CalorieIntake = "N/A";
        }

        calculated.VO2Max = PulseRate ? Math.round(15 * (220 - Age) / PulseRate) : "N/A";
        const totalScore = Math.round(
            (PushUps / 2) + (SitUps / 2) + (Squats / 2) + SitReach + (calculated.VO2Max !== "N/A" ? calculated.VO2Max / 2 : 0)
        );
        calculated.Total = totalScore;
        calculated.Grade = totalScore >= 80 ? "A+" : totalScore >= 70 ? "A" : totalScore >= 60 ? "B" : totalScore >= 50 ? "C" : "D";

        return {
            TR: formElement.dataset.tr,
            Weight, Height, Waist, Hips, Neck,
            BMI: calculated.BMI,
            BMIStatus: calculated.BMIStatus,
            BodyFat: calculated.BodyFat,
            BMR: calculated.BMR,
            CalorieIntake: calculated.CalorieIntake,
            VO2Max: calculated.VO2Max,
            Total: calculated.Total,
            Grade: calculated.Grade,
            PushUps,
            SitUps,
            Squats,
            SitReach,
            PulseRate
        };
    } catch (e) {
        console.error(`Calculation failed for TR ${formElement.dataset.tr}`, e);
        Swal.fire('Calculation Error', `Could not calculate results for TR ${formElement.dataset.tr}. Please check all inputs, especially DOB format if entered. Error: ${e.message}`, 'error');
        return null;
    }
}

async function promptForWorkoutAndSubmit(tr, studentName) {
    if (!selectedSlotID) {
        Swal.fire('Select Slot', 'Choose a specific slot before marking attendance/check-in.', 'info');
        return;
    }

    const bodyParts = ['Cardio', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Full Body', 'Upper Body', 'Lower Body'];
    const bodyPartsHtml = bodyParts.map(part =>
        `<div class="body-part-chip" data-part="${part}">${part}</div>`
    ).join('');

    const swalResult = await Swal.fire({
        title: `Workout for ${studentName}`,
        html: `
                <p>Select body parts to train today (max 3).</p>
                <div class="body-parts-container">${bodyPartsHtml}</div>
                <div id="max-selection-warning"></div>
            `,
        confirmButtonText: 'Log Attendance & Workout',
        showCancelButton: true,
        focusConfirm: false,
        width: '600px',
        didOpen: () => {
            const container = document.querySelector('.body-parts-container');
            const chips = container.querySelectorAll('.body-part-chip');
            const warningEl = document.getElementById('max-selection-warning');

            chips.forEach(chip => {
                chip.addEventListener('click', () => {
                    const selectedCount = container.querySelectorAll('.selected').length;
                    if (chip.classList.contains('selected')) {
                        chip.classList.remove('selected');
                        warningEl.textContent = '';
                    } else if (selectedCount < 3) {
                        chip.classList.add('selected');
                        warningEl.textContent = '';
                    } else {
                        warningEl.textContent = 'Maximum of 3 parts can be selected.';
                        setTimeout(() => { warningEl.textContent = ''; }, 2000);
                    }
                });
            });
        },
        preConfirm: () => {
            const selectedChips = document.querySelectorAll('.body-part-chip.selected');
            return Array.from(selectedChips).map(chip => chip.dataset.part);
        }
    });

    if (swalResult.isConfirmed) {
        const selectedParts = swalResult.value;

        Swal.fire({
            title: 'Submitting...',
            text: 'Please wait while we log the session.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const today = new Date();
            const weekStart = new Date(today);
            const day = weekStart.getDay();
            const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
            weekStart.setDate(diff);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const weekResponse = await fetch('/api/get-or-create-week', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    WeekStartDate: weekStart.toISOString().split('T')[0],
                    WeekEndDate: weekEnd.toISOString().split('T')[0]
                })
            });
            const weekData = await weekResponse.json();
            if (!weekResponse.ok) throw new Error(weekData.message || 'Failed to create week');
            const WeekID = weekData.WeekID;

            const attendanceRes = await fetch('/api/attendance-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ TR: tr, WeekID, IsPresent: 1 })
            });
            const attendanceData = await attendanceRes.json();
            if (!attendanceRes.ok) throw new Error(attendanceData.error || 'Attendance submission failed');

            if (selectedParts.length > 0) {
                const planRes = await fetch('/api/log-training-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: tr, BodyParts: selectedParts })
                });
                const planData = await planRes.json();
                if (!planRes.ok) throw new Error(planData.message || 'Plan logging failed');
            }

            Swal.fire('Success!', 'Attendance and workout plan logged successfully.', 'success');
            dailyAttendanceCache = [];
            if (document.getElementById('daily-attendance-section')) {
                loadDailyAttendance();
            }
            if (document.getElementById('quick-stats')) {
                loadQuickStats();
            }
        } catch (error) {
            Swal.fire('Submission Error', error.message, 'error');
        }
    }
}

function initMenuListeners() {
    document.getElementById('darkModeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        renderMenuPage();
    });
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        toggleButtonSpinner(document.getElementById('logoutBtn'), true);
        try {
            const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                localStorage.clear();
                window.location.href = '../homepage.html';
            } else {
                throw new Error(data.message || 'Logout failed');
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            toggleButtonSpinner(document.getElementById('logoutBtn'), false);
        }
    });

    document.getElementById("editProfileBtn")?.addEventListener("click", () => {
        renderEditProfilePage();
    });

}

// --- Modal Action Buttons ---
// --- Modal Action Buttons ---
function initProfileModalListeners() {
    elements.profileAttendanceBtn.addEventListener('click', async () => {
        const button = elements.profileAttendanceBtn;
        toggleButtonSpinner(button, true);
        const modal = bootstrap.Modal.getInstance(elements.profileModal);
        modal.hide();
        await promptForWorkoutAndSubmit(currentStudent.TR, currentStudent.Name);
        toggleButtonSpinner(button, false);
    });

    // --- MODIFIED "View History" Button ---
    elements.profileHistoryBtn.addEventListener('click', () => {
        // 1. Get the modal instance and hide it
        const modal = bootstrap.Modal.getInstance(elements.profileModal);
        modal.hide();

        elements.profileHistoryBtn.blur();

        // 2. Render the history page with a new "Back" button
        elements.mainContent.innerHTML = `
                <div class="card fade-in">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">History: ${currentStudent.Name}</h3>
                        
                        <button id="backToModalBtn" class="btn" style="width: auto; background-color: var(--text-color); color: var(--card-bg);">
                            <i class="fas fa-arrow-left"></i> Back to Profile
                        </button>
                    </div>
                    <div class="table-responsive">
                        <table id="planHistoryTable">
                            <thead><tr><th>Date</th><th>Body Parts</th></tr></thead>
                            <tbody id="plan-history-body"></tbody>
                        </table>
                    </div>
                </div>`;

        // 3. Add a listener to the new "Back" button
        document.getElementById('backToModalBtn').addEventListener('click', () => {
            // (a) Re-render the home page content (to remove the history table)
            renderHomePage();

            // (b) Get the modal instance again and show it.
            // The modal element still exists in the DOM and its content is preserved.
            const modalInstance = bootstrap.Modal.getInstance(elements.profileModal);
            if (modalInstance) {
                modalInstance.show();
            } else {
                // Fallback in case instance was lost (shouldn't happen)
                showMiniProfile(currentStudent.TR);
            }
        });

        // 4. Load the training plan data
        loadTrainingPlans(currentStudent.TR);
    });
    // --- End of Modification ---

    elements.profileTestBtn.addEventListener('click', () => {
        const modal = bootstrap.Modal.getInstance(elements.profileModal);
        modal.hide();
        renderFitnessTestPage(currentStudent.TR);
    });
}

async function loadTrainingPlans(tr) {
    try {
        const res = await fetch(`/api/training-plans/${tr}`);
        const data = await res.json();
        const tbody = document.getElementById('plan-history-body');
        tbody.innerHTML = '';
        if (data.success && data.data.length > 0) {
            data.data.forEach(entry => {
                const row = `<tr><td>${moment(entry.LogDate).format('YYYY-MM-DD')}</td><td>${entry.BodyParts}</td></tr>`;
                tbody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="2">No recent plans found.</td></tr>`;
        }
    } catch (err) {
        console.error('Failed to load plan history:', err);
        Swal.fire('Error', 'Failed to load training plan history.', 'error');
    }
}

function handleInitialPasswordSet() {
    const form = document.getElementById('setPasswordForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        toggleButtonSpinner(button, true);
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            Swal.fire('Error', 'Passwords do not match.', 'error');
            toggleButtonSpinner(button, false);
            return;
        }

        if (newPassword.length < 6) {
            Swal.fire('Error', 'Password must be at least 6 characters.', 'error');
            toggleButtonSpinner(button, false);
            return;
        }

        try {
            const res = await fetch('/api/staff/set-initial-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to set password');

            Swal.fire('Success!', 'Your new password has been set.', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('forcePasswordChangeModal'));
            modal.hide();
            sessionStorage.removeItem('isDefaultPassword');
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            toggleButtonSpinner(button, false);
        }
    });
}

// --- Navigation Handler ---
elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        elements.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const page = link.dataset.page;
        switch (page) {
            case 'home': renderHomePage(); break;
            case 'checkout': renderCheckoutPage(); break;
            case 'test': renderFitnessTestPage(); break;
            case 'menu': renderMenuPage(); break;
            case "logs": renderLogsPage(); break;
        }
    });
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    const user = await validateTrainerSession();
    if (user) {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
        renderHomePage();
        initProfileModalListeners();
        if (sessionStorage.getItem('isDefaultPassword') === 'true') {
            const modal = new bootstrap.Modal(document.getElementById('forcePasswordChangeModal'));
            modal.show();
            handleInitialPasswordSet();
        }
    }
});

// --- Debounce Utility ---
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}
