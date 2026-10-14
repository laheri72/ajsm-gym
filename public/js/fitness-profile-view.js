import { openFitnessReportPreview } from './fitness-report-preview.js';
import { resolveFitnessMetric } from './fitness-metric-display.mjs';
const themeObservers = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = value => value ? new Date(value).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata' }) : '—';
const n = (value, digits = 1) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const source = value => value === 'Student' ? 'Self submitted' : value === 'Trainer' ? 'Trainer submitted' : 'Legacy / unknown source';
const ageAt = (dob, testDate) => {
  if (!dob || !testDate) return null;
  const birth = new Date(dob), test = new Date(testDate);
  const years = test.getUTCFullYear() - birth.getUTCFullYear() - (test.getUTCMonth() < birth.getUTCMonth() || (test.getUTCMonth() === birth.getUTCMonth() && test.getUTCDate() < birth.getUTCDate()) ? 1 : 0);
  return Number.isFinite(years) && years >= 0 && years < 120 ? years : null;
};
const scaleHtml = scale => {
  if (!scale || !(scale.max > scale.min)) return '';
  const span = scale.max - scale.min;
  const marker = Math.max(0, Math.min(100, (scale.value - scale.min) / span * 100));
  return `<div class="fp-scale" role="img" aria-label="${esc(scale.caption)}; result position on guide scale"><div class="fp-scale-bar">${scale.segments.map(segment => `<span class="fp-scale-segment fp-tone-${esc(segment.tone)}" style="width:${Math.max(0, (segment.to - segment.from) / span * 100)}%" title="${esc(segment.label)}"></span>`).join('')}<i class="fp-scale-marker" style="left:${marker}%"></i></div><small>${esc(scale.caption || '')}</small></div>`;
};
const metric = (label, assessment) => {
  const m = assessment || {};
  const hasReading = m.value != null;
  const delta = m.delta == null ? 'First reading' : m.delta === 0 ? 'Holding steady' : `${m.delta > 0 ? '↑' : '↓'} ${n(Math.abs(m.delta))} from prior test`;
  const status = m.band?.label || (hasReading ? 'Personal baseline' : 'Not measured');
  const severity = m.band?.severity || 'neutral';
  return `<div class="fp-card fp-vital fp-vital-${esc(severity)}"><div class="fp-vital-top"><span class="label">${label}${m.estimated ? ' · estimate' : ''}</span><span class="fp-vital-tag">${esc(status)}</span></div><div class="fp-vital-value"><span class="value">${n(m.value)}</span><span class="unit">${hasReading ? esc(m.unit || '') : ''}</span></div>${hasReading ? `<span class="fp-delta">${delta}</span>${scaleHtml(m.band?.scale)}${m.band?.detail ? `<small class="fp-band-detail">${esc(m.band.detail)}</small>` : ''}` : ''}</div>`;
};
const renderComments = comments => {
  if (!comments.length) return '<div class="fp-empty">Evaluator feedback will appear here after review.</div>';
  const groups = new Map();
  for (const comment of comments) {
    const category = comment.CategoryName || 'General';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(comment);
  }
  return `<div class="fp-list">${[...groups].map(([category, entries]) => `<section><h3 class="fp-comment-heading">${esc(category)}</h3>${entries.map(c => `<article class="fp-comment"><p>${esc(c.CommentText)}</p><small>${esc(c.EvaluatorName)} · ${esc(c.Profession || 'Evaluator')} · ${date(c.DateEvaluated)}</small></article>`).join('')}</section>`).join('')}</div>`;
};

export async function mountFitnessProfile(host, { tr = null, embedded = false, role = 'Student' } = {}) {
  if (!host) return;
  themeObservers.get(host)?.disconnect();
  host.innerHTML = '<div class="fp-loading" role="status"><div class="fp-loading-line wide"></div><div class="fp-loading-line"></div><div class="fp-loading-cards"><span></span><span></span><span></span><span></span></div><p>Loading fitness profile and test history…</p></div>';
  try {
    const response = await fetch(tr ? `/api/fitness-profiles/${encodeURIComponent(tr)}` : '/api/fitness-profiles/me', { credentials:'include' });
    if (!response.ok) throw new Error(response.status === 403 ? 'This profile is outside your access.' : 'Could not load the profile.');
    const { data } = await response.json();
    const { student, tests } = data;
    const initials = student.Name.split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase();
    let selected = 0, charts = [], reportTemplate = 'dark';
    const render = () => {
      const test = tests[selected];
      host.innerHTML = `<div class="fp-shell">
        <div class="fp-hero"><div class="fp-identity"><div class="fp-avatar" aria-label="Photo placeholder">${esc(initials)}</div><div><span class="fp-kicker">Student fitness profile</span><h1>${esc(student.Name)}</h1><p>TR ${esc(student.TR)} · ${esc(student.Darajah || 'Class not recorded')} · ${esc(student.Gender || '')}${test && ageAt(student.DOB, test.CreatedAt) != null ? ` · Age ${ageAt(student.DOB, test.CreatedAt)} at test` : ''}</p></div></div>
          <div class="fp-actions">${embedded && document.body.classList.contains('fitness-only') ? '<a class="fp-action secondary" href="#fitness&tab=test">Take a fitness test</a>' : ''}${test ? `${role === 'Admin' ? `<label class="fp-template-picker">PDF template<select data-report-template aria-label="PDF report template"><option value="dark" ${reportTemplate === 'dark' ? 'selected' : ''}>Dark teal and gold</option><option value="light" ${reportTemplate === 'light' ? 'selected' : ''}>Light teal</option></select></label>` : ''}<button type="button" class="fp-action" data-report-preview>Preview selected test PDF</button>` : ''}${role === 'Evaluator' && test?.SubmittedBy === 'Trainer' && test.BatchID ? `<a class="fp-action secondary" href="/staff/comment-entry.html?testlog=${encodeURIComponent(test.TestLog)}&batch=${encodeURIComponent(test.BatchID)}">Add evaluator comment</a>` : ''}${role === 'Trainer' ? `<a class="fp-action secondary" href="/trainer/trainer-dashboard.html?testTR=${encodeURIComponent(student.TR)}">Open trainer test form</a>` : ''}${!embedded && !tr ? '<a class="fp-action secondary" href="/student/student-dashboard.html#fitness">Student dashboard</a>' : ''}</div></div>
        ${tests.length ? `<div class="fp-toolbar"><div><strong>${date(test.CreatedAt)}</strong> · ${esc(test.BatchName || 'Unbatched')} · ${esc(source(test.SubmittedBy))}<br><span class="fp-status">Recorded score ${n(test.Total)} · Grade ${esc(test.Grade || '—')}</span></div><div class="fp-nav"><button type="button" data-move="-1" ${selected <= 0 ? 'disabled' : ''} aria-label="Newer test">← Newer</button><select aria-label="Select fitness test">${tests.map((item,i)=>`<option value="${i}" ${i===selected?'selected':''}>${date(item.CreatedAt)} · ${esc(item.BatchName || 'Unbatched')} · ${esc(source(item.SubmittedBy))}</option>`).join('')}</select><button type="button" data-move="1" ${selected >= tests.length-1 ? 'disabled' : ''} aria-label="Older test">Older →</button></div></div>
        <div class="fp-grid">${metric('VO₂ max',resolveFitnessMetric('VO2Max',test,student,tests[selected+1]))}${metric('BMI',resolveFitnessMetric('BMI',test,student,tests[selected+1]))}${metric('Body fat',resolveFitnessMetric('BodyFat',test,student,tests[selected+1]))}${metric('BMR',resolveFitnessMetric('BMR',test,student,tests[selected+1]))}</div>
        <div class="fp-layout"><section class="fp-panel"><h2>Body composition & measurements</h2><div class="fp-metrics">${[['Weight',test.Weight,'kg'],['Height',test.Height,'cm'],['Waist',test.Waist,'cm'],['Hips',test.Hips,'cm'],['Neck',test.Neck,'cm']].map(([label,value,unit])=>`<div class="fp-metric"><small>${label}</small><strong>${n(value)} ${unit}</strong></div>`).join('')}</div></section>
          <section class="fp-panel"><h2>Physical performance</h2><div class="fp-metrics">${[['Squats',test.Squats,'reps'],['Sit ups',test.SitUps,'reps'],['Push ups',test.PushUps,'reps'],['Sit & reach',test.SitAndReach,'cm'],['Step up pulse',test.StepUpPulseRate,'bpm']].map(([label,value,unit])=>`<div class="fp-metric"><small>${label}</small><strong>${n(value,0)} ${unit}</strong></div>`).join('')}</div></section></div>
        <div class="fp-layout"><section class="fp-panel"><h2>Four vital trends</h2><div class="fp-vital-trends">${[['VO2Max','VO₂ max'],['BMI','BMI'],['BodyFat','Body fat'],['BMR','BMR']].map(([key,title])=>`<div><h3>${title}</h3><div class="fp-chart"><canvas data-chart="${key}" aria-label="${title} trend chart"></canvas></div></div>`).join('')}</div></section><section class="fp-panel"><h2>Weight & composition over time</h2><div class="fp-chart"><canvas data-chart="composition" aria-label="Weight and body fat trend chart"></canvas></div></section></div>
        <section class="fp-panel" style="margin-top:16px"><h2>Physical test history</h2><div class="fp-table-wrap"><table class="fp-table"><thead><tr><th>Test date</th><th>Source</th><th>Push ups</th><th>Sit ups</th><th>Squats</th><th>Sit & reach</th><th>Step up pulse</th></tr></thead><tbody>${tests.map(item=>`<tr><td>${date(item.CreatedAt)}</td><td>${esc(source(item.SubmittedBy))}</td><td>${n(item.PushUps,0)}</td><td>${n(item.SitUps,0)}</td><td>${n(item.Squats,0)}</td><td>${n(item.SitAndReach)}</td><td>${n(item.StepUpPulseRate,0)}</td></tr>`).join('')}</tbody></table></div></section>
        <div class="fp-layout"><section class="fp-panel"><h2>Evaluator feedback</h2>${renderComments(test.comments)}</section>
          <section class="fp-panel"><h2>Test history</h2><div class="fp-history">${tests.map((item,i)=>`<button type="button" data-index="${i}" aria-current="${i===selected}"><span>${date(item.CreatedAt)}<br><small>${esc(item.BatchName || 'Unbatched')} · ${esc(source(item.SubmittedBy))}</small></span><strong>${esc(item.Grade || '—')}</strong></button>`).join('')}</div></section></div>
        ${Object.hasOwn(data, 'medicalHistory') && !embedded ? `<section class="fp-panel" style="margin-top:16px"><h2>Medical history</h2>${data.medicalHistory ? `<div class="fp-metrics">${[['Allergies',data.medicalHistory.Allergies],['Medications',data.medicalHistory.Medications],['Family history',data.medicalHistory.FamilyHistory],['Previous injuries',data.medicalHistory.PreviousInjuries]].map(([label,value])=>`<div class="fp-metric"><small>${label}</small><strong>${esc(value || 'Not recorded')}</strong></div>`).join('')}</div>` : '<div class="fp-empty">No medical history recorded.</div>'}</section>` : ''}
        </div>` : `<div class="fp-empty" style="margin-top:22px">No fitness tests recorded yet. Your profile is ready when the first test is saved.</div></div>`}`;
      if (!tests.length && Object.hasOwn(data, 'medicalHistory') && !embedded) {
        host.insertAdjacentHTML('beforeend', `<section class="fp-panel" style="margin-top:16px"><h2>Medical history</h2>${data.medicalHistory ? `<div class="fp-metrics">${[['Allergies',data.medicalHistory.Allergies],['Medications',data.medicalHistory.Medications],['Family history',data.medicalHistory.FamilyHistory],['Previous injuries',data.medicalHistory.PreviousInjuries]].map(([label,value])=>`<div class="fp-metric"><small>${label}</small><strong>${esc(value || 'Not recorded')}</strong></div>`).join('')}</div>` : '<div class="fp-empty">No medical history recorded.</div>'}</section>`);
      }
      host.querySelector('[data-report-preview]')?.addEventListener('click', () => openFitnessReportPreview(test.TestLog, role === 'Admin' ? host.querySelector('[data-report-template]')?.value || 'dark' : 'dark'));
      host.querySelector('[data-report-template]')?.addEventListener('change', event => { reportTemplate = event.target.value; });
      host.querySelector('.fp-nav select')?.addEventListener('change', e => { selected = Number(e.target.value); destroyCharts(); render(); });
      host.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => { selected += Number(button.dataset.move); destroyCharts(); render(); }));
      host.querySelectorAll('[data-index]').forEach(button => button.addEventListener('click', () => { selected = Number(button.dataset.index); destroyCharts(); render(); }));
      drawCharts();
    };
    const destroyCharts = () => { charts.forEach(chart => chart.destroy()); charts = []; };
    const drawCharts = () => {
      if (!window.Chart || tests.length < 2) {
        host.querySelectorAll('.fp-chart').forEach(el => el.innerHTML = '<div class="fp-empty">Two or more tests are needed for a trend.</div>'); return;
      }
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      Chart.defaults.color = dark ? '#b8cbd2' : '#647980';
      Chart.defaults.borderColor = dark ? '#354c5a' : '#dce9e9';
      const ordered = [...tests].reverse(), labels = ordered.map(item => date(item.CreatedAt));
      const make = (key, fields) => {
        const canvas = host.querySelector(`[data-chart="${key}"]`); if (!canvas) return;
        const colors = ['#087f82','#e39633','#6574bd','#bd6074','#697985'];
        charts.push(new Chart(canvas, { type:'line', data:{ labels, datasets:fields.map(([field,label],i)=>({ label, data:ordered.map(item => item[field] == null ? null : Number(item[field])), borderColor:colors[i], backgroundColor:colors[i], tension:.25, spanGaps:false, yAxisID:key === 'composition' && field === 'BodyFat' ? 'percentage' : 'y' })) }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:key === 'composition' ? { y:{beginAtZero:false,title:{display:true,text:'Weight (kg)'}}, percentage:{position:'right',beginAtZero:false,title:{display:true,text:'Body fat (%)'},grid:{drawOnChartArea:false}} } : {y:{beginAtZero:false}} } }));
      };
      [['VO2Max','VO₂ max'],['BMI','BMI'],['BodyFat','Body fat %'],['BMR','BMR']].forEach(([key,title]) => make(key, [[key,title]]));
      make('composition', [['Weight','Weight kg'],['BodyFat','Body fat %']]);
    };
    render();
    const observer = new MutationObserver(() => { destroyCharts(); drawCharts(); });
    observer.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
    themeObservers.set(host, observer);
  } catch (error) { host.innerHTML = `<div class="fp-empty" role="alert">${esc(error.message)} <button type="button" class="fp-retry">Try again</button>${embedded && document.body.classList.contains('fitness-only') ? ' <a class="fp-retry" href="#fitness&tab=test">Take a fitness test</a>' : ''}</div>`; host.querySelector('.fp-retry').addEventListener('click', () => mountFitnessProfile(host, { tr, embedded, role })); }
}
