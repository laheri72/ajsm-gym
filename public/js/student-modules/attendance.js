import { 
    flatpickrInstance, cachedStudentWeeks, 
    setFlatpickrInstance, setCachedStudentWeeks 
} from './state.js';

/**
 * Fetches and renders the attendance table for a specific week.
 */
export function loadAttendance(selectedWeekId) {
    if (!selectedWeekId) {
        clearAttendanceTable("Invalid week selected.");
        return;
    }

    document.getElementById('attendanceSummaryCard').style.display = 'none';
    document.getElementById('attendanceWarning').style.display = 'none';

    const tbody = document.querySelector('#attendanceTable tbody');
    tbody.innerHTML = `<tr><td colspan="8" class="loader-cell"><div class="loader"></div></td></tr>`;

    fetch(`/api/student-attendance/${selectedWeekId}/me`, {
        method: 'GET',
        credentials: 'include'
    }).then(res => res.json())
      .then(result => {
          if (!result.success) throw new Error(result.error || 'Failed to fetch data.');

          tbody.innerHTML = ''; 
          const data = result.attendance;
          const weekStartDate = result.weekStartDate ? new Date(result.weekStartDate) : null;
          if (!weekStartDate) throw new Error('Week start date missing from API response.');

          if (data.length > 0 && data[0].JoinedAt) {
              const student = data[0];
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const joinedDate = new Date(student.JoinedAt);
              joinedDate.setHours(0, 0, 0, 0);

              const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              let presentCount = 0, absentCount = 0, onLeaveCount = 0;

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
                  } else if (currentDate < today) {
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
          tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading data: ${err.message}.</td></tr>`;
      });
}

/**
 * Clears the attendance table with a message.
 */
export function clearAttendanceTable(message = "Select a week above to view attendance.") {
    const tbody = document.querySelector('#attendanceTable tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">${message}</td></tr>`;
    }
    document.getElementById('attendanceSummaryCard').style.display = 'none';
    document.getElementById('attendanceWarning').style.display = 'none';
}

/**
 * Fetches eligible weeks and initializes the Flatpickr date picker.
 */
export async function initializeWeekPicker() {
    const weekPickerInput = document.getElementById('weekPickerInput');
    if (!weekPickerInput) return;

    try {
        const res = await fetch('/api/student/eligible-weeks', { credentials: 'include' });
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Could not fetch eligible weeks.');
        }

        setCachedStudentWeeks(data.weeks || []);

        if (cachedStudentWeeks.length === 0) {
            weekPickerInput.placeholder = "No attendance weeks available yet.";
            weekPickerInput.disabled = true;
            return;
        }

        const momentRanges = cachedStudentWeeks.map(week => ({
            start: moment(week.WeekStartDate),
            end: moment(week.WeekEndDate)
        }));
        
        const newPicker = flatpickr(weekPickerInput, {
            dateFormat: "M d, Y",
            enable: [
                function(date) {
                    const currentMoment = moment(date);
                    return momentRanges.some(range =>
                        currentMoment.isBetween(range.start, range.end, 'day', '[]')
                    );
                }
            ],
            mode: "single",
            altInput: true,
            altFormat: "D, M j, Y",
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length === 0) {
                    clearAttendanceTable();
                    return;
                }
                findAndLoadAttendanceForDate(selectedDates[0]);
            },
        });
        setFlatpickrInstance(newPicker); // Save instance to global state

        const today = moment.tz("Asia/Kolkata").toDate();
        findAndLoadAttendanceForDate(today, true);

    } catch (err) {
        console.error('Failed to initialize week picker:', err);
        weekPickerInput.placeholder = "Error loading weeks.";
        weekPickerInput.disabled = true;
        Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Could not load week data.' });
    }
}

/**
 * Finds the corresponding week ID for a selected date and loads attendance.
 */
function findAndLoadAttendanceForDate(selectedDate, setPickerValue = false) {
    if (cachedStudentWeeks.length === 0) {
        clearAttendanceTable("No attendance weeks available.");
        return;
    }

    const selectedMoment = moment(selectedDate);
    const targetWeek = cachedStudentWeeks.find(week => {
        const start = moment(week.WeekStartDate);
        const end = moment(week.WeekEndDate);
        return selectedMoment.isBetween(start, end, 'day', '[]');
    });

    if (targetWeek) {
        loadAttendance(targetWeek.WeekID);
        if (setPickerValue && flatpickrInstance) {
            const weekStartMoment = moment(targetWeek.WeekStartDate);
            flatpickrInstance.setDate(weekStartMoment.toDate(), false);
        }
    } else {
        clearAttendanceTable("Selected date is outside available attendance weeks.");
    }
}