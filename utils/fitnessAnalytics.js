const METRICS = ['VO2Max', 'BMI', 'BodyFat', 'BMR'];

function summarizeMetric(rows, key, rangeMin, rangeMax) {
  const values = rows.map(row => Number(row[key])).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const count = values.length;
  const median = count ? (values[Math.floor((count - 1) / 2)] + values[Math.floor(count / 2)]) / 2 : null;
  const hasRange = Number.isFinite(rangeMin) || Number.isFinite(rangeMax);
  const matching = hasRange ? values.filter(value =>
    (!Number.isFinite(rangeMin) || value >= rangeMin) && (!Number.isFinite(rangeMax) || value <= rangeMax)).length : null;
  return {
    count, missing: rows.length - count,
    min: count ? values[0] : null, median, max: count ? values[count - 1] : null,
    matching, matchingPercent: hasRange && count ? Math.round(matching / count * 1000) / 10 : null,
    // Five equal-width bins are descriptive only; they are not health categories.
    distribution: count ? Array.from({ length: 5 }, (_, i) => {
      if (values[0] === values[count - 1]) return i === 0 ? count : 0;
      return values.filter(value => Math.min(4, Math.floor((value - values[0]) / (values[count - 1] - values[0]) * 5)) === i).length;
    }) : [0, 0, 0, 0, 0]
  };
}

function percentile(rows, key, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  const values = rows.map(row => Number(row[key])).filter(item => Number.isFinite(item) && item > 0);
  if (!values.length) return null;
  const below = values.filter(item => item < value).length;
  const equal = values.filter(item => item === value).length;
  return Math.round((below + equal / 2) / values.length * 1000) / 10;
}

module.exports = { METRICS, summarizeMetric, percentile };
