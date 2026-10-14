const test = require('node:test');
const assert = require('node:assert/strict');

test('recorded values retain useful cues when an older payload has no assessment bands', async () => {
  const { resolveFitnessMetric } = await import('../public/js/fitness-metric-display.mjs');
  const student = { Gender:'Male', DOB:'2003-01-01' };
  const record = { CreatedAt:'2026-09-02', VO2Max:25, BMI:26.8, BodyFat:18.7, BMR:1853,
    assessment:{ metrics:{ VO2Max:{ value:25, band:null }, BMI:{ value:26.8, band:null },
      BodyFat:{ value:18.7, band:null }, BMR:{ value:1853, band:null } } } };
  const expected = { VO2Max:'Room to build', BMI:'Overweight', BodyFat:'In guide zone', BMR:'Daily baseline' };
  for (const [key,label] of Object.entries(expected)) {
    const metric = resolveFitnessMetric(key,record,student);
    assert.equal(metric.band.label,label);
    assert.equal(metric.band.scale.value,record[key]);
    assert.ok(metric.band.scale.max > metric.band.scale.min);
  }
});

test('server assessment takes precedence and missing values do not get invented cues', async () => {
  const { resolveFitnessMetric } = await import('../public/js/fitness-metric-display.mjs');
  const band = { label:'Server guide', severity:'neutral', scale:{ min:0,max:100,value:40,segments:[] } };
  assert.equal(resolveFitnessMetric('VO2Max', { VO2Max:40, assessment:{ metrics:{ VO2Max:{ value:40, band } } } }, {}).band,band);
  const missing = resolveFitnessMetric('BodyFat', { BodyFat:null }, {});
  assert.equal(missing.value,null);
  assert.equal(missing.band,null);
});

test('a minor never receives an adult BMI category from the display fallback', async () => {
  const { resolveFitnessMetric } = await import('../public/js/fitness-metric-display.mjs');
  const metric = resolveFitnessMetric('BMI',{ CreatedAt:'2026-09-02', BMI:29 },{ DOB:'2012-05-24', Gender:'Female' });
  assert.equal(metric.band.label,'BMI baseline');
  assert.equal(metric.band.severity,'neutral');
});
