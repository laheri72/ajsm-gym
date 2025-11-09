import { 
    studentHeight, fitnessProgressChart,
    setStudentHeight, setFitnessProgressChart 
} from './state.js';

/**
 * Handles the submission of the new weight log form.
 */
export async function handleWeightLogSubmit(e) {
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
        
        weightInput.value = '';
        
        loadWeightLogHistory();
        loadFitnessProgress();
        loadCurrentWeightStat();

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        buttonText.classList.remove('d-none');
        spinner.classList.add('d-none');
        logButton.disabled = false;
        weightInput.disabled = false;
    }
}

/**
 * Fetches and renders the ad-hoc weight log history table.
 */
export async function loadWeightLogHistory() {
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

        tbody.innerHTML = '';
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
 * Handles the click event for deleting a weight log.
 */
export function handleWeightLogDelete(e) {
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
            
            loadWeightLogHistory();
            loadFitnessProgress();
            loadCurrentWeightStat();

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });
}

/**
 * Fetches and displays the most recent weight log AND BMI on the dashboard stat card.
 */
export async function loadCurrentWeightStat() {
    const weightEl = document.getElementById('stat-current-weight');
    const dateEl = document.getElementById('stat-weight-date');
    const motivationLink = document.getElementById('log-weight-shortcut');
    const bmiArea = document.getElementById('bmi-display-area');

    bmiArea.innerHTML = '<span class="bmi-value-loading">...</span>';

    try {
        const weightRes = await fetch('/api/student/weight-history', { credentials: 'include' });
        const weightResult = await weightRes.json();
        
        let currentWeight = null;
        
        if (weightResult.success && weightResult.data.length > 0) {
            const recentLog = weightResult.data[0];
            currentWeight = recentLog.Weight;
            
            weightEl.textContent = currentWeight.toFixed(1);
            dateEl.textContent = `Logged: ${recentLog.FormattedDate}`;
            motivationLink.textContent = "Great job! Keep logging to see your trend.";
            
        } else {
            weightEl.textContent = '--';
            dateEl.textContent = 'Log your weight to start!';
            motivationLink.textContent = 'Click here to log Your weight';
        }

        // Handle BMI display
        if (studentHeight) {
            if (currentWeight) {
                const bmi = currentWeight / (studentHeight * studentHeight);
                let category = 'Healthy';
                let categoryClass = 'bmi-healthy';

                if (bmi < 18.5) { category = 'Underweight'; categoryClass = 'bmi-underweight'; }
                else if (bmi >= 25 && bmi < 30) { category = 'Overweight'; categoryClass = 'bmi-overweight'; }
                else if (bmi >= 30) { category = 'Obese'; categoryClass = 'bmi-obese'; }
                
                bmiArea.innerHTML = `
                    <div class="bmi-value-wrapper">
                        <span class="bmi-value ${categoryClass}" id="stat-bmi-value">${bmi.toFixed(1)}</span>
                        <button id="edit-height-btn" class="btn-edit-height" title="Edit Height">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                    </div>
                    <p class="stat-category ${categoryClass}" id="stat-bmi-category">${category}</p>
                `;
                document.getElementById('edit-height-btn').addEventListener('click', handleSetHeight);
            } else {
                bmiArea.innerHTML = '<span class="bmi-value-loading">--.-</span>';
            }
        } else {
            bmiArea.innerHTML = '<button id="add-height-btn" class="btn btn-sm btn-outline-primary">Add Height</button>';
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
 * Shows a popup to ask for and save the student's height.
 */
export async function handleSetHeight() {
    const { value: heightCm } = await Swal.fire({
        title: 'Enter Your Height',
        input: 'number',
        inputLabel: 'Height (in cm)',
        inputPlaceholder: 'e.g., 175',
        inputAttributes: { min: 100, max: 300, step: 1 },
        showCancelButton: true,
        confirmButtonText: 'Save',
        inputValidator: (value) => {
            if (!value) return 'You need to enter a value!'
            if (value < 100 || value > 300) return 'Please enter a realistic height (100-300 cm)'
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
            setStudentHeight(result.newHeight); // Update global state
            loadCurrentWeightStat(); 

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }
}

/**
 * Fetches and renders the main fitness progression line chart.
 */
export async function loadFitnessProgress() {
  try {
    const res = await fetch('/api/student/fitness-test-history', { credentials: 'include' }); 
    const result = await res.json(); 
    
    const chartWrapper = document.getElementById('fitnessChartWrapper');
    const canvasElement = document.getElementById('fitnessProgressChart');
    if (!chartWrapper || !canvasElement) return;

    let messageElement = chartWrapper.querySelector('p');
    if (!messageElement) {
        messageElement = document.createElement('p');
        chartWrapper.appendChild(messageElement);
    }

    if (result.success && result.data.length > 1) {
        canvasElement.style.display = 'block';
        messageElement.style.display = 'none';

        const labels = result.data.map(d => d.TestDate); 
        const weightData = result.data.map(d => d.Weight); 
        const bodyFatData = result.data.map(d => d.BodyFat); 

        const ctx = canvasElement.getContext('2d'); 
        if (fitnessProgressChart) fitnessProgressChart.destroy(); 
        
        const newChart = new Chart(ctx, { 
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { 
                        label: 'Weight (kg)', data: weightData, 
                        borderColor: 'rgba(54, 162, 235, 1)', 
                        backgroundColor: 'rgba(54, 162, 235, 0.2)', 
                        fill: true, tension: 0.1 
                    },
                    { 
                        label: 'Body Fat (%)', data: bodyFatData, 
                        borderColor: 'rgba(255, 99, 132, 1)', 
                        backgroundColor: 'rgba(255, 99, 132, 0.2)', 
                        fill: true, tension: 0.1, spanGaps: true 
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Weight & Body Fat Over Time' } }
            }
        });
        setFitnessProgressChart(newChart); // Save instance to global state

    } else {
        canvasElement.style.display = 'none';
        messageElement.style.display = 'block';
        if (fitnessProgressChart) fitnessProgressChart.destroy(); 

        if (result.success && result.data.length === 1) {
            messageElement.textContent = 'You\'ve logged your weight once. Log it again to see your progression chart!';
        } else {
            messageElement.textContent = 'Log your weight or take a fitness test to start tracking your progression.';
        }
    }
  } catch (err) { 
    console.error('Failed to load fitness progress:', err); 
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