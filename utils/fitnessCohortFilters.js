const { METRICS, summarizeMetric, percentile } = require('./fitnessAnalytics');

const clean = value => String(value ?? '').trim().slice(0, 100);

function parseFilters(query, role) {
  const metric = METRICS.includes(query.metric) ? query.metric : 'VO2Max';
  const min = query.min === '' || query.min === undefined ? null : Number(query.min);
  const max = query.max === '' || query.max === undefined ? null : Number(query.max);
  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max)) ||
      (min !== null && max !== null && min > max)) {
    const error = new Error('Invalid metric range.');
    error.status = 400;
    throw error;
  }
  return {
    q: clean(query.q).toLowerCase(),
    gender: role === 'Admin' && ['Male', 'Female'].includes(query.gender) ? query.gender : '',
    darajah: clean(query.darajah),
    grade: clean(query.grade),
    metric, min, max,
    sort: METRICS.includes(query.sort) ? query.sort : 'CreatedAt',
    direction: query.direction === 'asc' ? 1 : -1
  };
}

function selectCohort(rows, filters) {
  const cohortRows = rows.filter(row =>
    (!filters.q || String(row.TR).startsWith(filters.q) || String(row.Name ?? '').toLowerCase().includes(filters.q)) &&
    (!filters.gender || row.Gender === filters.gender) &&
    (!filters.darajah || row.Darajah === filters.darajah) &&
    (!filters.grade || row.Grade === filters.grade));
  const metrics = Object.fromEntries(METRICS.map(key => [key, summarizeMetric(cohortRows, key,
    key === filters.metric ? filters.min : null, key === filters.metric ? filters.max : null)]));
  const sorted = cohortRows.filter(row => {
    if (filters.min === null && filters.max === null) return true;
    const value = row[filters.metric] == null ? NaN : Number(row[filters.metric]);
    return Number.isFinite(value) && value > 0 &&
      (filters.min === null || value >= filters.min) && (filters.max === null || value <= filters.max);
  }).sort((a, b) => {
    const field = filters.sort;
    const direction = filters.direction;
    if (field === 'CreatedAt') {
      return direction * (new Date(a.CreatedAt) - new Date(b.CreatedAt)) || Number(a.TR) - Number(b.TR);
    }
    const aValue = a[field] == null ? NaN : Number(a[field]);
    const bValue = b[field] == null ? NaN : Number(b[field]);
    if (!Number.isFinite(aValue)) return Number.isFinite(bValue) ? 1 : Number(a.TR) - Number(b.TR);
    if (!Number.isFinite(bValue)) return -1;
    return direction * (aValue - bValue) || Number(a.TR) - Number(b.TR);
  });
  return { cohortRows, metrics, sorted };
}

module.exports = { parseFilters, selectCohort, percentile };
