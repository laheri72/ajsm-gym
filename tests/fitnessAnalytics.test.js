const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeMetric, percentile } = require('../utils/fitnessAnalytics');

test('metric summary excludes missing values and exposes its denominator', () => {
  const rows = [{ BMI: 18 }, { BMI: 20 }, { BMI: null }, { BMI: 24 }];
  assert.deepEqual(summarizeMetric(rows, 'BMI', 19, 21), {
    count: 3, missing: 1, min: 18, median: 20, max: 24,
    matching: 1, matchingPercent: 33.3, distribution: [1, 1, 0, 0, 1]
  });
});

test('ties share a midrank percentile and an empty metric stays empty', () => {
  const rows = [{ VO2Max: 30 }, { VO2Max: 30 }, { VO2Max: 50 }, { VO2Max: null }];
  assert.equal(percentile(rows, 'VO2Max', 30), 33.3);
  assert.equal(percentile(rows, 'VO2Max', 50), 83.3);
  assert.equal(percentile(rows, 'VO2Max', null), null);
  assert.equal(summarizeMetric([{ BMR: null }], 'BMR', null, null).count, 0);
});
