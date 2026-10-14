const test = require('node:test');
const assert = require('node:assert/strict');
const { ageAt, assessTest } = require('../utils/fitnessAssessment');
const { createReportDocument, renderFitnessReportPage } = require('../utils/fitnessReportPdf');

const student = { TR:28546, Name:'Ruqaiyah bai Mulla Mufaddal bhai Khandwala', Gender:'Female', DOB:'2012-05-24', Darajah:'1 A F' };
const result = { TestLog:1247, CreatedAt:'2025-05-24', BatchName:'Annual evaluation', SubmittedBy:'Trainer', VO2Max:41, BMI:16, BodyFat:17, BMR:1148, Total:67, Grade:'B', Weight:38, Height:159, Waist:58, Neck:27, Hips:79, PushUps:23, SitUps:24, Squats:31, SitAndReach:22, StepUpPulseRate:118, comments:[] };

test('age-specific cues do not use adult BMI bands for a 13-year-old', () => {
  assert.equal(ageAt(student.DOB, result.CreatedAt).years, 13);
  const assessment = assessTest(student, result, { VO2Max:38, BMI:15, BodyFat:18, BMR:1100 });
  assert.equal(assessment.metrics.BMI.band.label, 'Healthy weight');
  assert.match(assessment.metrics.BMI.band.detail, /Age-based guide/);
  assert.equal(assessment.metrics.VO2Max.band.label, 'On track');
  assert.equal(assessment.metrics.BodyFat.band.label, 'Below guide zone');
  assert.equal(assessment.metrics.BMR.band.label, 'Daily baseline');
  assert.equal(assessment.metrics.VO2Max.delta, 3);
});

test('missing age shows a personal BMI baseline and implausible estimates have no alert', () => {
  const assessment = assessTest({ ...student, DOB:null }, { ...result, BodyFat:118, VO2Max:-4 }, null);
  assert.equal(assessment.metrics.BMI.band.label, 'BMI baseline');
  assert.equal(assessment.metrics.BMI.band.severity, 'neutral');
  assert.equal(assessment.metrics.BodyFat.value, null);
  assert.equal(assessment.metrics.VO2Max.band, null);
  const adult = assessTest({ ...student, DOB:'2000-01-01' }, { ...result, BMI:25 }, null);
  assert.equal(adult.metrics.BMI.band.label, 'Overweight');
});

test('adult BMI 29 shows an overweight amber position and BMR a neutral baseline', () => {
  const assessment = assessTest({ ...student, DOB:'2000-01-01' }, { ...result, BMI:29 }, null);
  assert.equal(assessment.metrics.BMI.band.label, 'Overweight');
  assert.equal(assessment.metrics.BMI.band.severity, 'moderate');
  assert.equal(assessment.metrics.BMI.band.scale.value, 29);
  assert.equal(assessment.metrics.BMI.band.scale.segments[2].label, 'Overweight');
  assert.equal(assessment.metrics.BMR.band.label, 'Daily baseline');
  assert.equal(assessment.metrics.BMR.band.severity, 'neutral');
});

test('older ages receive a visible VO2 guide without a missing-reference message', () => {
  const assessment = assessTest({ ...student, Gender:'Male', DOB:'1965-01-01' }, result, null);
  assert.equal(assessment.metrics.VO2Max.band.label, 'Strong capacity');
  assert.match(assessment.metrics.VO2Max.band.scale.caption, /Guide zone/);
});

async function pdfPages(template, count) {
  const doc = createReportDocument();
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const complete = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
  const long = { ...result, comments:[{ CategoryName:'Fitness', EvaluatorName:'Evaluator', DateEvaluated:'2025-05-25', CommentText:'Long note. '.repeat(1000) }] };
  for (let i = 0; i < count; i++) renderFitnessReportPage(doc, { student, test:long, template });
  doc.end();
  await complete;
  const pdf = Buffer.concat(chunks).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  return (pdf.match(/\/Type\s*\/Page\b/g) || []).length;
}

test('both templates keep long comments on one A4 page per student', async () => {
  assert.equal(await pdfPages('light', 1), 1);
  assert.equal(await pdfPages('dark', 1), 1);
  assert.equal(await pdfPages('light', 3), 3);
});
