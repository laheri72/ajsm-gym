const form = document.getElementById('cohort-filters');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const fmt = value => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(1);
const labels = { VO2Max:'VO₂ max', BMI:'BMI', BodyFat:'Body fat', BMR:'BMR' };
let page = 1, last = null, role = null, lastAppliedParams = null, loadSequence = 0;

function markFiltersDirty() {
  if (!lastAppliedParams || new URLSearchParams(new FormData(form)).toString() === lastAppliedParams.toString()) return;
  document.getElementById('bulk-download').disabled = true;
  document.getElementById('bulk-status').textContent = 'Apply filters to update the PDF selection.';
}

async function load() {
  const params = new URLSearchParams(new FormData(form));
  params.set('page', String(page));
  if (!params.get('batchId')) return;
  const currentLoad = ++loadSequence;
  const status = document.getElementById('cohort-status');
  status.textContent = 'Loading cohort…';
  document.getElementById('bulk-download').disabled = true;
  try {
    const response = await fetch(`/api/fitness-cohorts?${params}`, { credentials:'include' });
    if (!response.ok) throw new Error('Cohort unavailable. Please try again.');
    const { data } = await response.json();
    if (currentLoad !== loadSequence) return;
    last = data;
    lastAppliedParams = new URLSearchParams(params);
    lastAppliedParams.delete('page');
    status.textContent = `${data.cohortCount} students after filters · ${data.total} shown after metric range · ${data.batchSize} in the entire batch.`;
    document.getElementById('cohort-stats').innerHTML = Object.entries(data.metrics).map(([key,item]) => {
      const maxBar = Math.max(...item.distribution, 1);
      return `<div class="fp-card"><span class="label">${labels[key]} · ${item.count} valid / ${item.missing} missing</span><span class="value">${fmt(item.median)}</span><span class="unit">Median · ${fmt(item.min)} to ${fmt(item.max)}</span>${item.count ? `<div class="fp-bars" aria-label="Five-bin distribution ${item.distribution.join(', ')}">${item.distribution.map(value => `<span title="${value} results" style="height:${Math.max(3,value / maxBar * 32)}px"></span>`).join('')}</div>` : '<p class="fp-note">No valid values in this cohort.</p>'}${key === params.get('metric') && item.matching !== null ? `<p class="fp-note">${item.matching}/${item.count} (${item.matchingPercent ?? '—'}%) in selected range</p>` : ''}</div>`;
    }).join('');
    document.getElementById('cohort-rows').innerHTML = data.rows.length ? data.rows.map(row => `<tr><td><a href="/fitness/profile.html?tr=${encodeURIComponent(row.TR)}">${esc(row.Name)}</a><br><small>TR ${esc(row.TR)} · ${esc(row.Darajah || '—')}</small></td><td>${new Date(row.CreatedAt).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata' })}</td><td>${esc(row.Grade || '—')}</td>${['VO2Max','BMI','BodyFat','BMR'].map(key => `<td>${fmt(row[key])}<br><small>${row.percentiles[key] == null ? '—' : `${row.percentiles[key]}th percentile`}</small></td>`).join('')}<td>${esc(row.CommentStatus)}</td></tr>`).join('') : '<tr><td colspan="8">No results for these filters.</td></tr>';
    document.getElementById('cohort-page-label').textContent = `Page ${page} · ${data.total} matching students`;
    document.getElementById('prev-page').disabled = page === 1;
    document.getElementById('next-page').disabled = page * data.pageSize >= data.total;
    const selectedBatch = form.elements.batchId.value;
    const exportable = ['Staff','Admin'].includes(role) && selectedBatch !== 'unbatched';
    document.getElementById('bulk-actions').hidden = !exportable;
    document.getElementById('bulk-download').disabled = !data.total;
    document.getElementById('bulk-download').textContent = `Download ${data.total} ${data.total === 1 ? 'report' : 'reports'} as one PDF`;
    document.getElementById('bulk-status').textContent = data.total ? 'Includes every matching student across all pages.' : 'No reports match these filters.';
    markFiltersDirty();
  } catch (error) { if (currentLoad === loadSequence) { last = null; lastAppliedParams = null; status.textContent = error.message; } }
}

async function loadDarajahs() {
  const selected = form.elements.darajah.value;
  const gender = role === 'Admin' ? form.elements.gender.value : '';
  const response = await fetch(`/api/fitness-cohorts/darajahs?gender=${encodeURIComponent(gender)}`, { credentials:'include' });
  if (!response.ok) throw new Error('Could not load Darajahs.');
  const { data } = await response.json();
  form.elements.darajah.replaceChildren(new Option('All Darajahs', ''), ...data.map(value => new Option(value, value)));
  if (data.includes(selected)) form.elements.darajah.value = selected;
}

async function downloadBatch() {
  const id = lastAppliedParams?.get('batchId');
  if (!/^\d+$/.test(id || '') || !last?.total || document.getElementById('bulk-download').disabled) return;
  const button = document.getElementById('bulk-download');
  const status = document.getElementById('bulk-status');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  status.dataset.loading = 'true';
  status.textContent = `Preparing ${last.total} individual one-page reports in a combined PDF…`;
  try {
    const template = role === 'Admin' ? document.getElementById('bulk-template').value : 'dark';
    const query = new URLSearchParams(lastAppliedParams);
    query.delete('batchId');
    query.set('template', template);
    const response = await fetch(`/api/fitness-cohorts/${encodeURIComponent(id)}/reports.pdf?${query}`, { credentials:'include' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Could not generate the filtered PDF. Please try again.');
    }
    const reportCount = Number(response.headers.get('X-Report-Count')) || last.total;
    let blob;
    if (response.body?.getReader) {
      const reader = response.body.getReader(), chunks = [];
      let bytes = 0, lastUpdate = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bytes += value.byteLength;
        if (Date.now() - lastUpdate > 150) {
          status.textContent = `Receiving ${reportCount} reports… ${Math.round(bytes / 1024)} KB generated`;
          lastUpdate = Date.now();
        }
      }
      blob = new Blob(chunks, { type:'application/pdf' });
    } else blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitness-batch-${id}-${template}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = `Downloaded ${reportCount} reports in one PDF.`;
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = !last?.total; button.removeAttribute('aria-busy'); delete status.dataset.loading; markFiltersDirty(); }
}

form.addEventListener('submit', event => { event.preventDefault(); page = 1; load(); });
form.addEventListener('input', markFiltersDirty);
form.addEventListener('change', markFiltersDirty);
form.elements.batchId.addEventListener('change', () => { page = 1; last = null; lastAppliedParams = null; document.getElementById('bulk-download').disabled = true; load(); });
form.elements.gender.addEventListener('change', async () => { try { await loadDarajahs(); page = 1; load(); } catch (error) { document.getElementById('cohort-status').textContent = error.message; } });
document.getElementById('bulk-download').addEventListener('click', downloadBatch);
document.getElementById('prev-page').addEventListener('click', () => { if (page > 1) { page--; load(); } });
document.getElementById('next-page').addEventListener('click', () => { if (last && page * last.pageSize < last.total) { page++; load(); } });

async function init() {
  const response = await fetch('/api/session-user', { credentials:'include' });
  const session = await response.json();
  if (!session.success || !['Staff','Admin','Trainer','Evaluator'].includes(session.user?.Role)) { location.replace('/Forbidden.html'); return; }
  role = session.user.Role;
  document.getElementById('back-link').href = role === 'Trainer' ? '/trainer/trainer-dashboard.html' : role === 'Evaluator' ? '/staff/evaluation.html' : '/staff/test.html';
  document.getElementById('cohort-gender-field').hidden = role !== 'Admin';
  document.getElementById('bulk-template-field').hidden = role !== 'Admin';
  const batchesResponse = await fetch('/api/fitness-cohorts/batches', { credentials:'include' });
  if (!batchesResponse.ok) throw new Error('Could not load batches.');
  const { data } = await batchesResponse.json();
  const select = form.elements.batchId;
  select.replaceChildren(...data.map(batch => new Option(`${batch.BatchName} · ${batch.Gender}${batch.IsActive ? ' · Active' : ''}`, batch.BatchID)), new Option('Unbatched trainer tests', 'unbatched'));
  select.value = data.length ? String(data[0].BatchID) : 'unbatched';
  await loadDarajahs();
  await load();
}
init().catch(error => { document.getElementById('cohort-status').textContent = error.message; });
