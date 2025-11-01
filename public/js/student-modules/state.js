/* =================================================================== */
/* 1. SHARED STATE
/* All global variables for the student dashboard.
/* =================================================================== */

// These variables are set by auth.js and read by many others.
export let studentTR;
export let studentName;
export let branch;
export let gender;
export let membersince;
export let studentHeight;

// Chart instances
export let bodyPartChart = null;
export let fitnessProgressChart = null;
export let weeklyHoursChart = null;

// Other component instances
export let flatpickrInstance = null;
export let leaveHistoryTable = null;

// Caches
export let cachedStudentWeeks = [];
export let allLeaveRequests = [];

/* =================================================================== */
/* 2. STATE SETTERS
/* Functions to safely modify the state from other modules.
/* =================================================================== */
export function setStudentAuthData(data) {
    studentTR = data.TR;
    studentName = data.Name;
    branch = data.Branch;
    gender = data.Gender;
    membersince = data.membersince;
}
export function setStudentHeight(height) { studentHeight = height; }
export function setBodyPartChart(chart) { bodyPartChart = chart; }
export function setFitnessProgressChart(chart) { fitnessProgressChart = chart; }
export function setWeeklyHoursChart(chart) { weeklyHoursChart = chart; }
export function setFlatpickrInstance(instance) { flatpickrInstance = instance; }
export function setLeaveHistoryTable(table) { leaveHistoryTable = table; }
export function setCachedStudentWeeks(weeks) { cachedStudentWeeks = weeks; }
export function setAllLeaveRequests(requests) { allLeaveRequests = requests; }

// ... (at the end of the file)
export let isPlannerDirty = false;
export function setPlannerDirty(value) { isPlannerDirty = value; }