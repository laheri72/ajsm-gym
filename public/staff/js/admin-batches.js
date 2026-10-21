const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const byId = id => document.getElementById(id);
const labels = { Male:'Talabat', Female:'Talebaat' };
const ids = {
    Male: { active:'maleActiveBatch', history:'maleBatchHistory', name:'newMaleBatchName', mode:'maleBatchMode', count:'maleUnbatchedCount', select:'assignMaleBatchSelect', assign:'assignMaleBtn' },
    Female: { active:'femaleActiveBatch', history:'femaleBatchHistory', name:'newFemaleBatchName', mode:'femaleBatchMode', count:'femaleUnbatchedCount', select:'assignFemaleBatchSelect', assign:'assignFemaleBtn' }
};

function createdLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return { relative:'Date not recorded', exact:'' };
    const elapsed = Math.max(0, Date.now() - date.getTime());
    const units = [['year', 31536000000], ['month', 2592000000], ['day', 86400000], ['hour', 3600000], ['minute', 60000]];
    const [unit, millis] = units.find(([, duration]) => elapsed >= duration) || ['minute', 60000];
    const amount = Math.max(1, Math.floor(elapsed / millis));
    const relative = elapsed < 60000 ? 'Created just now' : `Created ${amount} ${unit}${amount === 1 ? '' : 's'} ago`;
    const exact = `${new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true }).format(date)} IST`;
    return { relative, exact };
}

function renameForm(batch) {
    return `<form class="batch-rename-form" data-batch-id="${Number(batch.BatchID)}" hidden>
        <label class="visually-hidden" for="rename-batch-${Number(batch.BatchID)}">New name for ${escapeHtml(batch.BatchName)}</label>
        <input id="rename-batch-${Number(batch.BatchID)}" class="form-control" name="BatchName" maxlength="100" required value="${escapeHtml(batch.BatchName)}">
        <button class="btn btn-sm btn-primary" type="submit">Save name</button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-batch-action="cancel-rename" data-batch-id="${Number(batch.BatchID)}">Cancel</button>
    </form>`;
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials:'include', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || 'This action could not be completed.');
    return body;
}

export function initAdminBatches() {
    const manager = document.querySelector('.batch-manager');
    if (!manager) return;
    const status = byId('batch-management-status');
    let batches = { Male:[], Female:[] };
    let loading = 0;

    function renderSection(gender) {
        const section = ids[gender];
        const list = batches[gender] || [];
        const active = list.find(batch => batch.IsActive);
        const activeEl = byId(section.active);
        activeEl.classList.toggle('is-empty', !active);
        if (active) {
            const created = createdLabel(active.CreatedAt);
            activeEl.innerHTML = `<div class="batch-active-top"><span class="batch-chip is-active">Active</span><span class="batch-chip" title="${escapeHtml(created.exact)}">${escapeHtml(created.relative)}</span></div>
                <div class="batch-active-name">${escapeHtml(active.BatchName)}</div>
                <div class="batch-active-meta"><span>Batch #${Number(active.BatchID)}</span><span>${Number(active.TestCount) || 0} trainer tests</span><span>${Number(active.StudentCount) || 0} students</span><span>${escapeHtml(created.exact)}</span></div>
                <div class="batch-actions"><button type="button" class="btn btn-sm btn-outline-primary" data-batch-action="rename" data-batch-id="${Number(active.BatchID)}">Rename</button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-batch-action="lock" data-batch-id="${Number(active.BatchID)}">Lock batch</button></div>${renameForm(active)}`;
        } else {
            activeEl.innerHTML = '<span class="batch-chip is-locked">No active batch</span><p class="batch-empty">Trainer tests will remain unbatched until you activate a draft or create an active batch.</p>';
        }
        const mode = byId(section.mode);
        mode.querySelector('option[value="active"]').disabled = Boolean(active);
        mode.value = active ? 'locked' : 'active';
        const locked = list.filter(batch => !batch.IsActive);
        byId(section.history).innerHTML = locked.length ? locked.map(batch => {
            const created = createdLabel(batch.CreatedAt);
            const canActivate = !active && Number(batch.TestCount) === 0;
            return `<div class="batch-history-row"><div><div class="batch-history-name">${escapeHtml(batch.BatchName)}</div>
                <div class="batch-history-meta"><span class="batch-chip is-locked">${Number(batch.TestCount) ? 'Locked' : 'Draft'}</span><span>Batch #${Number(batch.BatchID)}</span><span>${Number(batch.TestCount) || 0} tests</span><span title="${escapeHtml(created.exact)}">${escapeHtml(created.relative)}</span></div>
                ${renameForm(batch)}</div><div class="batch-actions"><button type="button" class="btn btn-sm btn-outline-primary" data-batch-action="rename" data-batch-id="${Number(batch.BatchID)}">Rename</button>
                ${canActivate ? `<button type="button" class="btn btn-sm btn-primary" data-batch-action="activate" data-batch-id="${Number(batch.BatchID)}">Activate</button>` : ''}</div></div>`;
        }).join('') : '<p class="batch-empty">No locked batches yet.</p>';
    }

    function renderUnbatched(gender, count) {
        const section = ids[gender];
        byId(section.count).textContent = String(Number(count) || 0);
        const select = byId(section.select);
        const previous = select.value;
        const locked = (batches[gender] || []).filter(batch => !batch.IsActive);
        select.replaceChildren(new Option('Select a locked batch...', ''), ...locked.map(batch =>
            new Option(`${batch.BatchName} · ${Number(batch.TestCount) || 0} tests`, String(batch.BatchID))));
        if (locked.some(batch => String(batch.BatchID) === previous)) select.value = previous;
        select.disabled = !Number(count) || !locked.length;
        byId(section.assign).disabled = select.disabled;
    }

    async function load() {
        const run = ++loading;
        status.textContent = 'Loading batches...';
        try {
            const [batchResult, unbatchedResult] = await Promise.all([
                requestJson('/api/admin/batches'), requestJson('/api/admin/unbatched-records')
            ]);
            if (run !== loading) return;
            batches = batchResult.data;
            for (const gender of ['Male', 'Female']) {
                renderSection(gender);
                renderUnbatched(gender, unbatchedResult.data[gender]);
            }
            status.textContent = 'Batch status is up to date.';
        } catch (error) { if (run === loading) status.textContent = error.message; }
    }

    for (const gender of ['Male', 'Female']) {
        const createForm = byId(gender === 'Male' ? 'createMaleBatchForm' : 'createFemaleBatchForm');
        createForm.addEventListener('submit', async event => {
            event.preventDefault();
            const name = byId(ids[gender].name).value.trim();
            const activate = byId(ids[gender].mode).value === 'active';
            if (!name || name.length > 100) { status.textContent = 'Enter a batch name of 1 to 100 characters.'; return; }
            const button = createForm.querySelector('button[type="submit"]');
            button.disabled = true;
            try {
                const result = await requestJson('/api/admin/batches', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ BatchName:name, Gender:gender, activate }) });
                byId(ids[gender].name).value = '';
                await load();
                status.textContent = result.message;
            } catch (error) { status.textContent = error.message; }
            finally { button.disabled = false; }
        });
        const assignForm = byId(gender === 'Male' ? 'assignMaleUnbatchedForm' : 'assignFemaleUnbatchedForm');
        assignForm.addEventListener('submit', async event => {
            event.preventDefault();
            const TargetBatchID = byId(ids[gender].select).value;
            if (!TargetBatchID) return;
            const button = byId(ids[gender].assign);
            button.disabled = true;
            try {
                const result = await requestJson('/api/admin/assign-unbatched', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ Gender:gender, TargetBatchID }) });
                await load();
                status.textContent = result.message;
            } catch (error) { status.textContent = error.message; button.disabled = false; }
        });
    }

    manager.addEventListener('click', async event => {
        const button = event.target.closest('button[data-batch-action]');
        if (!button) return;
        const action = button.dataset.batchAction;
        const id = Number(button.dataset.batchId);
        const batch = [...batches.Male, ...batches.Female].find(item => item.BatchID === id);
        if (!batch) { status.textContent = 'Batch changed. Refresh and try again.'; return; }
        const rename = manager.querySelector(`.batch-rename-form[data-batch-id="${id}"]`);
        if (action === 'rename') { rename.hidden = false; rename.querySelector('input').focus(); return; }
        if (action === 'cancel-rename') { rename.hidden = true; return; }
        const prompt = action === 'lock'
            ? `Lock ${batch.BatchName}? New trainer tests will remain unbatched until another batch is active.`
            : `Activate ${batch.BatchName}? New trainer tests for ${labels[batch.Gender]} will use this batch.`;
        const confirmed = await Swal.fire({ title:action === 'lock' ? 'Lock batch' : 'Activate draft', text:prompt, icon:'question', showCancelButton:true, confirmButtonText:action === 'lock' ? 'Lock batch' : 'Activate draft' });
        if (!confirmed.isConfirmed) return;
        button.disabled = true;
        try {
            const result = await requestJson(`/api/admin/batches/${id}/${action}`, { method:'PUT' });
            await load();
            status.textContent = result.message;
        } catch (error) { status.textContent = error.message; button.disabled = false; }
    });

    manager.addEventListener('submit', async event => {
        const form = event.target.closest('.batch-rename-form');
        if (!form) return;
        event.preventDefault();
        const id = Number(form.dataset.batchId);
        const name = form.elements.BatchName.value.trim();
        if (!name || name.length > 100) { status.textContent = 'Enter a batch name of 1 to 100 characters.'; return; }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const result = await requestJson(`/api/admin/batches/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ BatchName:name }) });
            await load();
            status.textContent = result.message;
        } catch (error) { status.textContent = error.message; button.disabled = false; }
    });

    manager.addEventListener('keydown', event => {
        if (event.key === 'Escape' && event.target.closest('.batch-rename-form')) {
            const form = event.target.closest('.batch-rename-form');
            form.hidden = true;
            manager.querySelector(`button[data-batch-action="rename"][data-batch-id="${Number(form.dataset.batchId)}"]`)?.focus();
        }
    });
    load();
}
