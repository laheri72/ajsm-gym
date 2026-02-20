/**
 * 🏋️ ENHANCED FITNESS MODULE
 * Handles Fitness Test, Evaluations, Medical History, and Activity Logs.
 */

import { getTR } from './auth.js';

let studentData = null;
let calculated = null;
let historyDataTable = null;
let historyData = [];

/**
 * Initializes the fitness module
 */
export async function initializeFitness() {
    setupEventListeners();
    await loadFitnessData();
}

function setupEventListeners() {
    const testForm = document.getElementById('testForm');
    if (testForm) {
        testForm.addEventListener('input', updateFormProgress);
    }

    // Medical History Buttons
    const editMedicalBtn = document.getElementById('editMedicalBtn');
    if (editMedicalBtn) {
        editMedicalBtn.addEventListener('click', () => {
            document.getElementById('medical-view').classList.add('animate__animated', 'animate__fadeOut');
            setTimeout(() => {
                document.getElementById('medical-view').style.display = 'none';
                document.getElementById('medical-view').classList.remove('animate__animated', 'animate__fadeOut');
                document.getElementById('medical-form').style.display = 'block';
                document.getElementById('medical-form').classList.add('animate__animated', 'animate__fadeIn');
                editMedicalBtn.style.display = 'none';
            }, 300);
        });
    }

    const cancelMedicalBtn = document.getElementById('cancelMedicalBtn');
    if (cancelMedicalBtn) {
        cancelMedicalBtn.addEventListener('click', () => {
            document.getElementById('medical-form').classList.add('animate__animated', 'animate__fadeOut');
            setTimeout(() => {
                document.getElementById('medical-form').style.display = 'none';
                document.getElementById('medical-form').classList.remove('animate__animated', 'animate__fadeOut');
                document.getElementById('medical-view').style.display = 'block';
                document.getElementById('medical-view').classList.add('animate__animated', 'animate__fadeIn');
                document.getElementById('editMedicalBtn').style.display = 'block';
                loadMedicalHistory();
            }, 300);
        });
    }

    const saveMedicalBtn = document.getElementById('saveMedicalBtn');
    if (saveMedicalBtn) {
        saveMedicalBtn.addEventListener('click', handleMedicalSave);
    }

    // Tab Navigation for Fitness Sub-tabs
    const fitnessTabs = document.querySelectorAll('.fitness-tabs .tab-link');
    fitnessTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.tab;
            showFitnessTab(tabId);
        });
    });
}

export function showFitnessTab(tabId) {
    // UI toggle logic for fitness sub-tabs
    document.querySelectorAll('.fitness-tabs .tab-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.fitness-tabs .tab-link[data-tab="${tabId}"]`);
    if (activeLink) activeLink.classList.add('active');

    document.querySelectorAll('.fitness-tab-pane').forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `fit-tab-${tabId}`) {
            pane.classList.add('active');
        }
    });

    // Specific loaders
    if (tabId === 'history') initializeHistoryTable();
    if (tabId === 'evaluations') loadMyEvaluations();
}

async function loadFitnessData() {
    try {
        const res = await fetch(`/api/testmaster/me`, { credentials: 'include' });
        if (!res.ok) return;
        
        const student = await res.json();
        if (student && student.Name) {
            studentData = student;
            calculateAge(student.DOB);
            
            const genderSelect = document.querySelector('#testForm [name="Gender"]');
            if (genderSelect && student.Gender) {
                genderSelect.value = student.Gender.toLowerCase();
            }
        }

        await Promise.all([
            loadTestHistory(),
            loadMedicalHistory(),
            loadActivityTable()
        ]);

        updateFormProgress();
    } catch (err) {
        console.error("Failed to load fitness data", err);
    }
}

function calculateAge(dob) {
    if (!dob) {
        studentData.calculatedAge = 18;
        return;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    studentData.calculatedAge = age;
}

export function updateFormProgress() {
    const testForm = document.getElementById('testForm');
    if (!testForm) return;

    const requiredFields = testForm.querySelectorAll('[required]');
    let completedFields = 0;
    requiredFields.forEach(field => {
        if (field.value && field.value.trim() !== "") {
            completedFields++;
        }
    });

    const progress = requiredFields.length > 0 ? Math.round((completedFields / requiredFields.length) * 100) : 0;
    const progressBar = document.getElementById('formProgressBar');
    const progressText = document.getElementById('formProgressText');

    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.classList.remove('bg-danger', 'bg-warning', 'bg-success');
        if (progress < 30) progressBar.classList.add('bg-danger');
        else if (progress < 70) progressBar.classList.add('bg-warning');
        else progressBar.classList.add('bg-success');
    }
    if (progressText) progressText.textContent = `${progress}% Complete`;
}

export function generateReport() {
    const form = document.getElementById('testForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const Weight = parseFloat(form.querySelector('[name="Weight"]').value);
    const Height = parseFloat(form.querySelector('[name="Height"]').value);
    let Waist = parseFloat(form.querySelector('[name="Waist"]').value);
    let Hips = parseFloat(form.querySelector('[name="Hips"]').value) || 0;
    let Neck = parseFloat(form.querySelector('[name="Neck"]').value);
    let PulseRate = parseFloat(form.querySelector('[name="PulseRate"]').value);
    const Gender = form.querySelector('[name="Gender"]').value;
    const Age = studentData?.calculatedAge || 18;

    const PushUps = parseInt(form.querySelector('[name="PushUps"]').value) || 0;
    const SitUps = parseInt(form.querySelector('[name="SitUps"]').value) || 0;
    const Squats = parseInt(form.querySelector('[name="Squats"]').value) || 0;
    const SitReach = parseFloat(form.querySelector('[name="SitReach"]').value) || 0;

    if (Waist < 50) Waist *= 2.54;
    if (Neck < 25) Neck *= 2.54;
    if (Gender === 'female' && Hips < 50) Hips *= 2.54;

    calculated = {
        Weight, Height, Waist, Hips, Neck, PulseRate, Gender, Age,
        PushUps, SitUps, Squats, SitReach
    };

    const heightInM = Height / 100;
    calculated.BMI = (Weight / (heightInM * heightInM)).toFixed(1);
    if (calculated.BMI < 18.5) calculated.BMIStatus = "Underweight";
    else if (calculated.BMI < 24.9) calculated.BMIStatus = "Normal weight";
    else if (calculated.BMI < 29.9) calculated.BMIStatus = "Overweight";
    else calculated.BMIStatus = "Obese";

    let bodyFat = null;
    if (Gender === "male") {
        if ((Waist - Neck) > 0) {
            const denom = 1.0324 - 0.19077 * Math.log10(Waist - Neck) + 0.15456 * Math.log10(Height);
            bodyFat = 495 / denom - 450;
        }
    } else {
        if ((Waist + Hips - Neck) > 0) {
            const denom = 1.29579 - 0.35004 * Math.log10(Waist + Hips - Neck) + 0.22100 * Math.log10(Height);
            bodyFat = 495 / denom - 450;
        }
    }
    calculated.BodyFat = bodyFat ? parseFloat(bodyFat.toFixed(1)) : "N/A";

    if (Gender === "male") {
        calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age + 5);
    } else {
        calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age - 161);
    }
    calculated.CalorieIntake = Math.round(calculated.BMR * 1.55);
    calculated.VO2Max = PulseRate ? Math.round(15 * (220 - Age) / PulseRate) : "N/A";

    const totalScore = Math.round(
        (PushUps / 2) + (SitUps / 2) + (Squats / 2) + SitReach + (calculated.VO2Max !== "N/A" ? calculated.VO2Max / 2 : 0)
    );
    calculated.Total = totalScore;

    if (totalScore >= 80) calculated.Grade = "A+";
    else if (totalScore >= 70) calculated.Grade = "A";
    else if (totalScore >= 60) calculated.Grade = "B";
    else if (totalScore >= 50) calculated.Grade = "C";
    else calculated.Grade = "D";

    renderReport();
    
    // Smooth scroll to report
    document.getElementById('reportSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderReport() {
    const tbody = document.getElementById("reportTableBody");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr><th><i class="bi bi-person-bounding-box me-2"></i>BMI</th><td>${calculated.BMI}</td><td class="fw-bold">${calculated.BMIStatus}</td></tr>
        <tr><th><i class="bi bi-droplet-half me-2"></i>Body Fat %</th><td>${calculated.BodyFat}%</td><td>Calculated</td></tr>
        <tr><th><i class="bi bi-fire me-2"></i>BMR</th><td>${calculated.BMR} kcal</td><td>Basal Rate</td></tr>
        <tr><th><i class="bi bi-wind me-2"></i>VO2 Max</th><td>${calculated.VO2Max}</td><td>Cardio</td></tr>
        <tr><th><i class="bi bi-star-fill me-2 text-warning"></i>Total Score</th><td class="fs-5 fw-bold text-primary">${calculated.Total}</td><td>Overall</td></tr>
        <tr><th><i class="bi bi-award me-2"></i>Final Grade</th><td colspan="2"><span class="badge bg-success fs-6 px-3">${calculated.Grade}</span></td></tr>
    `;
    document.getElementById("reportSection").classList.remove('hidden', 'animate__animated', 'animate__fadeInUp');
    document.getElementById("reportSection").classList.add('animate__animated', 'animate__fadeInUp');
    
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.dataset.reportData = JSON.stringify(calculated);
}

export async function saveRecord() {
    const saveBtn = document.getElementById("saveBtn");
    const reportData = saveBtn.dataset.reportData;
    if (!reportData) return Swal.fire('Error', 'Please generate your report first.', 'error');

    const body = JSON.parse(reportData);

    const result = await Swal.fire({
        title: 'Confirm Submission',
        html: `Submit your fitness record for this week?<br><br><div class="badge bg-primary p-2">Score: ${body.Total}</div> <div class="badge bg-success p-2">Grade: ${body.Grade}</div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Save it!',
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#95a5a6',
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch('/api/testrecords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            Swal.fire({
                title: 'Success!',
                text: 'Your fitness test has been recorded.',
                icon: 'success',
                timer: 3000
            });
            
            loadTestHistory();
            document.getElementById("reportSection").classList.add("hidden");
            document.getElementById('testForm').reset();
            updateFormProgress();
            showFitnessTab('overview');
        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
        }
    }
}

async function loadTestHistory() {
    try {
        const res = await fetch(`/api/testrecords/me`, { credentials: 'include' });
        historyData = await res.json();
        
        const latest = historyData[0];
        renderSnapshot(latest);

        const saveBtn = document.getElementById('saveBtn');
        const saveWarning = document.getElementById('saveWarning');
        if (latest) {
            const lastDate = new Date(latest.CreatedAt);
            const diffDays = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                if (saveBtn) saveBtn.style.display = 'none';
                if (saveWarning) {
                    saveWarning.innerHTML = `<div class="alert alert-info py-2"><i class="bi bi-info-circle me-2"></i>Next test available in <strong>${7 - diffDays} days</strong>.</div>`;
                    saveWarning.style.display = 'block';
                }
            }
        }
    } catch (err) {
        console.error("History load failed", err);
    }
}

function renderSnapshot(record) {
    const container = document.getElementById('latest-test-snapshot');
    if (!container) return;

    if (!record) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-light text-center border-dashed">No test data yet. Take your first test!</div></div>';
        return;
    }

    const gradeClass = `grade-${record.Grade.charAt(0)}`;
    container.innerHTML = `
        <div class="snapshot-card ${gradeClass}">
            <span class="label">Grade</span>
            <div class="value">${record.Grade}</div>
        </div>
        <div class="snapshot-card">
            <span class="label">Score</span>
            <div class="value">${record.Total.toFixed(1)}</div>
        </div>
        <div class="snapshot-card">
            <span class="label">BMI</span>
            <div class="value">${record.BMI.toFixed(1)}</div>
        </div>
        <div class="snapshot-card">
            <span class="label">Body Fat</span>
            <div class="value">${record.BodyFat.toFixed(1)}%</div>
        </div>
    `;
}

async function loadMedicalHistory() {
    const viewDiv = document.getElementById('medical-view');
    if (!viewDiv) return;

    try {
        const res = await fetch('/api/medical-history/me', { credentials: 'include' });
        const { data } = await res.json();

        if (data) {
            document.getElementById('medAllergies').value = data.Allergies || '';
            document.getElementById('medMedications').value = data.Medications || '';
            document.getElementById('medFamilyHistory').value = data.FamilyHistory || '';
            document.getElementById('medPreviousInjuries').value = data.PreviousInjuries || '';

            const format = (val) => val ? val.replace(/\n/g, '<br>') : '<span class="text-muted italic">No information provided</span>';

            viewDiv.innerHTML = `
                <div class="med-info animate__animated animate__fadeIn">
                    <div class="mb-3">
                        <strong><i class="bi bi-virus me-2"></i>Known Allergies</strong>
                        <p class="mb-0 mt-1">${format(data.Allergies)}</p>
                    </div>
                    <div class="mb-3">
                        <strong><i class="bi bi-capsule me-2"></i>Current Medications</strong>
                        <p class="mb-0 mt-1">${format(data.Medications)}</p>
                    </div>
                    <div class="mb-3">
                        <strong><i class="bi bi-people me-2"></i>Family History</strong>
                        <p class="mb-0 mt-1">${format(data.FamilyHistory)}</p>
                    </div>
                    <div>
                        <strong><i class="bi bi-bandaid me-2"></i>Past Injuries</strong>
                        <p class="mb-0 mt-1">${format(data.PreviousInjuries)}</p>
                    </div>
                </div>
            `;
        } else {
            viewDiv.innerHTML = '<div class="alert alert-light text-center border-dashed">No medical history recorded. Click edit to add your health details.</div>';
        }
    } catch (err) { console.error(err); }
}

async function handleMedicalSave() {
    const button = document.getElementById('saveMedicalBtn');
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    button.disabled = true;

    const payload = {
        Allergies: document.getElementById('medAllergies').value,
        Medications: document.getElementById('medMedications').value,
        FamilyHistory: document.getElementById('medFamilyHistory').value,
        PreviousInjuries: document.getElementById('medPreviousInjuries').value
    };

    try {
        const res = await fetch('/api/medical-history/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Medical history saved!', timer: 2000, showConfirmButton: false });
            await loadMedicalHistory();
            document.getElementById('cancelMedicalBtn').click();
        }
    } catch (err) { 
        Swal.fire('Error', 'Save failed', 'error'); 
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function loadMyEvaluations() {
    const container = document.getElementById('evaluation-accordion-container');
    if (!container) return;

    try {
        container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Retrieving expert feedback...</p></div>';
        const res = await fetch('/api/evaluations/me', { credentials: 'include' });
        const result = await res.json();
        
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<div class="alert alert-info text-center">No evaluations from trainers or doctors yet.</div>';
            return;
        }

        container.innerHTML = `
            <div class="eval-list animate__animated animate__fadeIn">
                ${result.data.map((log, i) => `
                    <div class="eval-item">
                        <div class="eval-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <div>
                                <h6 class="mb-0 text-primary">${log.BatchName || 'Fitness Test Record'}</h6>
                                <small class="text-muted">${new Date(log.CreatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                            </div>
                            <div class="d-flex align-items-center gap-3">
                                <span class="badge bg-light text-dark border">Grade ${log.Grade}</span>
                                <i class="bi bi-chevron-down text-muted"></i>
                            </div>
                        </div>
                        <div class="eval-body" style="display: ${i === 0 ? 'block' : 'none'}">
                            ${log.comments.length > 0 ? log.comments.map(c => `
                                <div class="comment-block">
                                    <h6 class="small mb-1">${c.CategoryName}</h6>
                                    <p class="mb-2 small text-dark">${c.CommentText}</p>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="avatar-mini">${c.EvaluatorName.charAt(0)}</div>
                                        <small class="text-muted italic">By ${c.EvaluatorName} (${c.Profession})</small>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-muted p-3 text-center small">This record is pending evaluation by our experts.</p>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) { 
        container.innerHTML = '<div class="alert alert-danger">Error loading evaluations.</div>';
    }
}

async function loadActivityTable() {
    const container = document.getElementById('activity-card');
    if (!container) return;

    try {
        const res = await fetch('/api/testactivity/me', { credentials: 'include' });
        const result = await res.json();
        if (result.success && result.data.length) {
            container.innerHTML = `
                <h4 class="mb-3 mt-4"><i class="bi bi-lightning-charge"></i> Activity History</h4>
                <div class="table-responsive rounded-3 border">
                    <table class="table table-sm table-hover mb-0 align-middle">
                        <thead class="bg-light">
                            <tr class="small text-muted"><th>DATE</th><th>PUSH-UPS</th><th>SIT-UPS</th><th>SQUATS</th><th>S&R</th></tr>
                        </thead>
                        <tbody class="small">
                            ${result.data.map(row => `
                                <tr>
                                    <td class="fw-bold">${new Date(row.CreatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</td>
                                    <td>${row.PushUps ?? '-'}</td>
                                    <td>${row.SitUps ?? '-'}</td>
                                    <td>${row.Squats ?? '-'}</td>
                                    <td>${row.SitAndReach ?? '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    } catch (err) { console.error(err); }
}

function initializeHistoryTable() {
    if (historyDataTable) {
        historyDataTable.clear().rows.add(historyData).draw();
        return;
    }
    if (!historyData.length) return;

    historyDataTable = $('#historyTable').DataTable({
        data: historyData,
        columns: [
            { data: 'CreatedAt', render: d => `<span class="fw-bold">${new Date(d).toLocaleDateString('en-GB')}</span>` },
            { data: 'BMI', render: d => `<span>${parseFloat(d).toFixed(1)}</span>` },
            { data: 'Total', render: d => `<span class="text-primary fw-bold">${d.toFixed(1)}</span>` },
            { data: 'Grade', render: d => `<span class="badge rounded-pill ${d.includes('A') ? 'bg-success' : 'bg-primary'}">${d}</span>` }
        ],
        responsive: true,
        order: [[0, 'desc']],
        dom: 'rtp', // Simplified layout
        pageLength: 5
    });
}

export function showTestInfo() {
    Swal.fire({
        title: "Fitness Test Guide",
        customClass: {
            popup: 'fitness-swal-popup'
        },
        html: `
            <div class="text-start small">
                <div class="mb-3 p-2 bg-light rounded">
                    <h6 class="text-primary mb-1"><i class="bi bi-info-circle me-2"></i>Measurements</h6>
                    <p class="mb-0">Enter your weight, height, and body circumferences in <strong>CM</strong>. Our system auto-calculates BMI and Body Fat %.</p>
                </div>
                <div class="mb-3 p-2 bg-light rounded">
                    <h6 class="text-primary mb-1"><i class="bi bi-stopwatch me-2"></i>Physical Tests</h6>
                    <p class="mb-0">Perform as many reps as possible in <strong>30 seconds</strong> for Push-ups, Sit-ups, and Squats.</p>
                </div>
                <div class="p-2 bg-light rounded">
                    <h6 class="text-primary mb-1"><i class="bi bi-heart-pulse me-2"></i>Step Test</h6>
                    <p class="mb-0">Perform the 3-minute step test and measure your pulse rate immediately after.</p>
                </div>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Got it!',
        confirmButtonColor: '#4CAF50'
    });
}

export function showConverter() {
    Swal.fire({
        title: 'Inches to Centimeters',
        input: 'number',
        inputAttributes: { step: '0.1' },
        inputPlaceholder: 'Enter inches...',
        showCancelButton: true,
        confirmButtonText: 'Convert',
        confirmButtonColor: '#2196F3',
        preConfirm: (val) => {
            if (!val) return Swal.showValidationMessage('Please enter a value');
            return val * 2.54;
        }
    }).then(res => {
        if (res.isConfirmed) {
            Swal.fire({
                title: `${res.value.toFixed(2)} cm`,
                text: 'You can now enter this in the form.',
                icon: 'success'
            });
        }
    });
}

// Expose to window for inline HTML onclicks
window.fitnessModule = {
    generateReport,
    saveRecord,
    showFitnessTab,
    showTestInfo,
    showConverter
};
