const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFilters, selectCohort } = require('../utils/fitnessCohortFilters');

const rows = [
  { TestLog:1, TR:101, Name:'Amina', Gender:'Female', Darajah:'7A', Grade:'A', BMI:22, CreatedAt:'2026-08-01' },
  { TestLog:2, TR:102, Name:'Bina', Gender:'Female', Darajah:'7A', Grade:'A', BMI:28, CreatedAt:'2026-08-02' },
  { TestLog:3, TR:103, Name:'Cina', Gender:'Female', Darajah:'7A', Grade:'B', BMI:24, CreatedAt:'2026-08-03' },
  { TestLog:4, TR:104, Name:'Dina', Gender:'Female', Darajah:'7B', Grade:'A', BMI:23, CreatedAt:'2026-08-04' },
  { TestLog:5, TR:105, Name:'Evan', Gender:'Male', Darajah:'7A', Grade:'A', BMI:20, CreatedAt:'2026-08-05' }
];

test('cohort selection applies all filters before sorting and pagination', () => {
  const filters = parseFilters({ gender:'Female', darajah:'7A', grade:'A', metric:'BMI', min:'21', max:'29', sort:'BMI', direction:'desc' }, 'Admin');
  const { cohortRows, sorted, metrics } = selectCohort(rows, filters);
  assert.deepEqual(cohortRows.map(row => row.TestLog), [1, 2]);
  assert.deepEqual(sorted.map(row => row.TestLog), [2, 1]);
  assert.equal(metrics.BMI.count, 2);
  assert.equal(sorted.slice(25, 50).length, 0);
  assert.deepEqual(selectCohort(rows, parseFilters({ q:'102' }, 'Admin')).sorted.map(row => row.TestLog), [2]);
  assert.deepEqual(selectCohort(rows, parseFilters({ q:'ina' }, 'Admin')).sorted.map(row => row.TestLog), [4, 3, 2, 1]);
  assert.deepEqual(selectCohort(rows, parseFilters({ gender:'Male' }, 'Staff')).sorted.map(row => row.TestLog), [5, 4, 3, 2, 1]);
});

test('range exclusion and invalid ranges are handled consistently', () => {
  assert.deepEqual(selectCohort(rows, parseFilters({ metric:'BMI', min:'30' }, 'Admin')).sorted, []);
  assert.throws(() => parseFilters({ min:'29', max:'20' }, 'Admin'), /Invalid metric range/);
});
