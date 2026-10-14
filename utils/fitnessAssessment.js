const reference = require('../data/fitness-reference.json');

const SOURCES = { ...reference.sources, bmiAdult:'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html' };
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

function ageAt(dob, date) {
  if (!dob || !date) return null;
  const birth = new Date(dob), test = new Date(date);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(test.getTime()) || test < birth) return null;
  let months = (test.getUTCFullYear() - birth.getUTCFullYear()) * 12 + test.getUTCMonth() - birth.getUTCMonth();
  if (test.getUTCDate() < birth.getUTCDate()) months--;
  return months >= 0 && months < 1440 ? { years: Math.floor(months / 12), months } : null;
}

// Normal CDF approximation, sufficient for display-only BMI percentile labels.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const density = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const area = 1 - density * (0.319381530 * t - 0.356563782 * t ** 2 + 1.781477937 * t ** 3 - 1.821255978 * t ** 4 + 1.330274429 * t ** 5);
  return z >= 0 ? area : 1 - area;
}

function personalBand(value, title = 'Personal baseline') {
  const min = Math.max(0, Math.round(value * .65 * 10) / 10);
  const max = Math.round(value * 1.35 * 10) / 10;
  return { label:title, tone:'neutral', severity:'neutral', detail:'Follow your change over time', scale:{
    min, max, value, caption:'Your starting point', segments:[{ from:min, to:max, label:'Personal scale', tone:'neutral' }]
  } };
}

function bmiBand(value, age, gender) {
  if (value <= 0 || value > 80) return null;
  if (!age) return personalBand(value, 'BMI baseline');
  if (age.years >= 20) {
    const label = value < 18.5 ? 'Underweight' : value < 25 ? 'Healthy weight' : value < 30 ? 'Overweight' : 'Obesity';
    return { label, tone: label === 'Healthy weight' ? 'neutral' : 'attention', severity: label === 'Healthy weight' ? 'neutral' : label === 'Obesity' ? 'high' : label === 'Overweight' ? 'moderate' : 'low', detail: 'Adult BMI guide', scale: {
    min:15, max:40, value, unit:'kg/m2', caption:'Healthy zone: 18.5 to <25', segments:[
        { from:15, to:18.5, label:'Underweight', tone:'low' },
        { from:18.5, to:25, label:'Healthy weight', tone:'neutral' },
        { from:25, to:30, label:'Overweight', tone:'moderate' },
        { from:30, to:40, label:'Obesity', tone:'high' }
      ]
    } };
  }
  const row = reference.bmiLms[gender]?.[age.months];
  if (!row) return personalBand(value, 'BMI baseline');
  const [L, M, S] = row;
  const z = L === 0 ? Math.log(value / M) / S : ((value / M) ** L - 1) / (L * S);
  const percentile = Math.max(0, Math.min(100, normalCdf(z) * 100));
  const label = percentile < 5 ? 'Underweight' : percentile < 85 ? 'Healthy weight' : percentile < 95 ? 'Overweight' : 'Obesity';
  return { label, tone: label === 'Healthy weight' ? 'neutral' : 'attention', severity: label === 'Healthy weight' ? 'neutral' : label === 'Obesity' ? 'high' : label === 'Overweight' ? 'moderate' : 'low', detail: `Age-based guide: ${Math.round(percentile)}th percentile`, percentile: Math.round(percentile), scale: {
    min:0, max:100, value:percentile, unit:'percentile', caption:'Healthy zone: 5th to <85th percentile', segments:[
      { from:0, to:5, label:'Underweight', tone:'low' },
      { from:5, to:85, label:'Healthy weight', tone:'neutral' },
      { from:85, to:95, label:'Overweight', tone:'moderate' },
      { from:95, to:100, label:'Obesity', tone:'high' }
    ]
  } };
}

const vo2Adult = {
  Male: [[20,29,37.14,44.23],[30,39,35.36,42.42],[40,49,33.05,39.89]],
  Female: [[20,29,30.64,36.64],[30,39,28.71,34.60],[40,49,26.55,32.31]]
};
function vo2Band(value, age, gender) {
  if (value <= 0 || value > 110) return null;
  let low, high;
  if (!age || !['Male','Female'].includes(gender)) {
    [low, high] = [25, 45];
  } else if (age.years >= 12 && age.years <= 19) {
    if (gender === 'Male') [low, high] = [42, 52];
    else if (age.years === 12) [low, high] = [37, 46];
    else if (age.years === 13) [low, high] = [36, 45];
    else if (age.years === 14) [low, high] = [35, 44];
    else [low, high] = [35, 43];
  } else {
    const range = vo2Adult[gender].find(([start,end]) => age.years >= start && age.years <= end);
    if (range) [, , low, high] = range;
    else if (age.years < 12) [low, high] = gender === 'Male' ? [28,45] : [25,42];
    else [low, high] = gender === 'Male' ? [24,38] : [20,33];
  }
  const label = value < low ? 'Room to build' : value >= high ? 'Strong capacity' : 'On track';
  return { label, tone: value < low ? 'attention' : 'neutral', severity:value < low ? 'moderate' : 'neutral', detail:'Aerobic fitness guide', scale: {
    min:Math.max(0, low - (high - low)), max:high + (high - low), value, unit:'mL/kg/min', caption:`Guide zone: ${low} to ${high}`, segments:[
      { from:Math.max(0, low - (high - low)), to:low, label:'Building', tone:'moderate' },
      { from:low, to:high, label:'Guide zone', tone:'neutral' },
      { from:high, to:high + (high - low), label:'Strong', tone:'above' }
    ]
  } };
}

function bodyFatBand(value, age, gender) {
  if (value < 0 || value > 100) return null;
  const pair = age && reference.bodyFatP5P95[gender]?.[String(Math.floor(age.months / 6))] ||
    (gender === 'Male' ? [8,25] : gender === 'Female' ? [18,32] : [10,35]);
  const [p5, p95] = pair;
  const label = value < p5 ? 'Below guide zone' : value > p95 ? 'Above guide zone' : 'In guide zone';
  const padding = Math.max(5, (p95 - p5) * .25);
  return { label, tone: value < p5 || value > p95 ? 'attention' : 'neutral', severity:value < p5 || value > p95 ? 'moderate' : 'neutral', detail:'Body composition guide', scale: {
    min:Math.max(0, p5 - padding), max:Math.min(100, p95 + padding), value, unit:'%', caption:`Guide zone: ${p5} to ${p95}%`, segments:[
      { from:Math.max(0, p5 - padding), to:p5, label:'Below guide', tone:'moderate' },
      { from:p5, to:p95, label:'Guide zone', tone:'neutral' },
      { from:p95, to:Math.min(100, p95 + padding), label:'Above guide', tone:'moderate' }
    ]
  } };
}

function assessTest(student, test, previous) {
  const age = ageAt(student.DOB, test.CreatedAt);
  const gender = /^male$/i.test(student.Gender) ? 'Male' : /^female$/i.test(student.Gender) ? 'Female' : null;
  const result = {};
  for (const [key, unit, estimated, plausible] of [
    ['VO2Max','mL/kg/min',true,v => v > 0 && v <= 110],
    ['BMI','kg/m2',false,v => v > 0 && v <= 80],
    ['BodyFat','%',true,v => v >= 0 && v <= 100],
    ['BMR','kcal/day',true,v => v > 0 && v <= 10000]
  ]) {
    const raw = finite(test[key]);
    const value = raw !== null && plausible(raw) ? raw : null;
    const prior = finite(previous?.[key]);
    const delta = value !== null && prior !== null && plausible(prior) ? Math.round((value - prior) * 10) / 10 : null;
    const band = value === null ? null : key === 'BMI' ? bmiBand(value, age, gender) : key === 'VO2Max' ? vo2Band(value, age, gender) : key === 'BodyFat' ? bodyFatBand(value, age, gender) : personalBand(value, 'Daily baseline');
    if (key === 'BMR' && band) { band.detail = 'Estimated energy used at rest'; band.scale.caption = 'Your resting energy baseline'; }
    result[key] = { value, unit, estimated, delta, band };
  }
  return { ageYears: age?.years ?? null, metrics: result };
}

function assessTests(student, tests) {
  return tests.map((test, index) => ({ ...test, assessment: assessTest(student, test, tests[index + 1]) }));
}

module.exports = { ageAt, assessTest, assessTests, SOURCES };
