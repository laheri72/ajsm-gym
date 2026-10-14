const specifications = {
  VO2Max: { unit:'mL/kg/min', estimated:true, valid:value => value > 0 && value <= 110 },
  BMI: { unit:'kg/m2', estimated:false, valid:value => value > 0 && value <= 80 },
  BodyFat: { unit:'%', estimated:true, valid:value => value >= 0 && value <= 100 },
  BMR: { unit:'kcal/day', estimated:true, valid:value => value > 0 && value <= 10000 }
};
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const segment = (from, to, label, tone) => ({ from, to, label, tone });

function ageAt(dob, testDate) {
  if (!dob || !testDate) return null;
  const birth = new Date(dob), test = new Date(testDate);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(test.getTime()) || test < birth) return null;
  return test.getUTCFullYear() - birth.getUTCFullYear() - (test.getUTCMonth() < birth.getUTCMonth() ||
    (test.getUTCMonth() === birth.getUTCMonth() && test.getUTCDate() < birth.getUTCDate()) ? 1 : 0);
}

function personalBand(value, label, detail) {
  const min = Math.max(0, +(value * .65).toFixed(1));
  const max = +(value * 1.35).toFixed(1);
  return { label, severity:'neutral', detail, scale:{ min, max, value, caption:'Your recorded baseline',
    segments:[segment(min, max, 'Personal baseline', 'neutral')] } };
}

function rangeBand(value, low, high, labels, detail, unit = '') {
  const span = high - low;
  const min = Math.max(0, low - span), max = high + span;
  const position = value < low ? 0 : value >= high ? 2 : 1;
  return { label:labels[position], severity:position === 0 ? 'moderate' : 'neutral', detail,
    scale:{ min, max, value, caption:`Guide zone: ${low} to ${high}${unit}`,
      segments:[segment(min,low,'Building','moderate'),segment(low,high,'Guide zone','neutral'),segment(high,max,'Strong','above')] } };
}

// These display guides cover older assessment payloads. The server assessment takes precedence.
function fallbackBand(key, value, student, test) {
  const age = ageAt(student?.DOB, test?.CreatedAt);
  const gender = /^male$/i.test(student?.Gender) ? 'Male' : /^female$/i.test(student?.Gender) ? 'Female' : null;
  if (key === 'BMI') {
    if (age === null || age < 20) return personalBand(value, 'BMI baseline', 'Follow your BMI across tests');
    const label = value < 18.5 ? 'Underweight' : value < 25 ? 'Healthy weight' : value < 30 ? 'Overweight' : 'Obesity';
    return { label, severity:label === 'Healthy weight' ? 'neutral' : label === 'Overweight' ? 'moderate' : label === 'Obesity' ? 'high' : 'low',
      detail:'Adult BMI guide', scale:{ min:15, max:40, value, caption:'Healthy zone: 18.5 to <25', segments:[
        segment(15,18.5,'Underweight','low'),segment(18.5,25,'Healthy weight','neutral'),
        segment(25,30,'Overweight','moderate'),segment(30,40,'Obesity','high') ] } };
  }
  if (key === 'VO2Max') {
    const [low,high] = age !== null && age < 20 ? gender === 'Female' ? [35,45] : [40,52] :
      gender === 'Female' ? age !== null && age >= 50 ? [20,33] : [28,37] :
      gender === 'Male' ? age !== null && age >= 50 ? [24,38] : [35,44] : [25,45];
    return rangeBand(value,low,high,['Room to build','On track','Strong capacity'],'Aerobic fitness guide');
  }
  if (key === 'BodyFat') {
    const [low,high] = gender === 'Male' ? [8,25] : gender === 'Female' ? [18,32] : [10,35];
    const padding = Math.max(5,(high-low)*.25), min = Math.max(0,low-padding), max = Math.min(100,high+padding);
    return { label:value < low ? 'Below guide zone' : value > high ? 'Above guide zone' : 'In guide zone',
      severity:value < low || value > high ? 'moderate' : 'neutral', detail:'Body composition guide',
      scale:{ min,max,value,caption:`Guide zone: ${low} to ${high}%`,segments:[
        segment(min,low,'Below guide','moderate'),segment(low,high,'Guide zone','neutral'),
        segment(high,max,'Above guide','moderate') ] } };
  }
  return personalBand(value, 'Daily baseline', 'Estimated energy used at rest');
}

export function resolveFitnessMetric(key, test, student, previous = null) {
  const spec = specifications[key];
  if (!spec) throw new Error(`Unknown fitness metric: ${key}`);
  const assessed = test?.assessment?.metrics?.[key] || {};
  const assessedValue = finite(assessed.value), rawValue = finite(test?.[key]);
  const value = assessedValue !== null && spec.valid(assessedValue) ? assessedValue :
    rawValue !== null && spec.valid(rawValue) ? rawValue : null;
  if (value === null) return { value:null, unit:spec.unit, estimated:spec.estimated, delta:null, band:null };
  const previousValue = finite(previous?.[key]);
  const delta = assessed.delta != null && Number.isFinite(Number(assessed.delta)) ? Number(assessed.delta) :
    previousValue !== null && spec.valid(previousValue) ? Math.round((value-previousValue)*10)/10 : null;
  return { value, unit:spec.unit, estimated:spec.estimated, delta,
    band:assessed.band?.scale ? assessed.band : fallbackBand(key,value,student,test) };
}
