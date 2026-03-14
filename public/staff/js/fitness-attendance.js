const POLL_INTERVAL_MS = 30000;
let pollTimer = null;
let isLoading = false;
let pendingTable = null;
let latestEmailExports = { newlineList: '', semicolonList: '' };

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function showBanner(type, message) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    banner.className = `alert alert-${type}`;
    banner.textContent = message;
    banner.classList.remove('d-none');
}

function hideBanner() {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    banner.classList.add('d-none');
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function buildEmptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="text-center text-muted">${message}</td></tr>`;
}

function initializePendingTable() {
    if (pendingTable) return;

    pendingTable = $('#pendingTable').DataTable({
        data: [],
        deferRender: true,
        pageLength: 25,
        lengthMenu: [10, 25, 50, 100],
        order: [[0, 'asc']],
        orderCellsTop: true,
        autoWidth: false,
        columns: [
            { data: 'TR' },
            { data: 'Name' },
            { data: 'Darajah' },
            {
                data: 'Email',
                render: (data, type) => type === 'display' ? `<code>${data}</code>` : data
            },
            {
                data: 'CompletionStatus',
                render: (data, type) => type === 'display' ? `<span class="badge bg-danger">${data}</span>` : data
            }
        ],
        language: {
            emptyTable: 'No pending students.'
        },
        initComplete: function () {
            const api = this.api();
            $('#pendingTable thead tr.filters th').each(function (colIdx) {
                const columnTitle = $(api.column(colIdx).header()).text().trim();
                $(this).html(`<input type="text" placeholder="Filter ${columnTitle}" />`);

                $('input', this).on('keyup change clear', function () {
                    if (api.column(colIdx).search() !== this.value) {
                        api.column(colIdx).search(this.value).draw();
                    }
                });
            });
        }
    });
}

function updatePendingTable(rows) {
    initializePendingTable();

    const tableRows = rows.map(row => ({
        TR: row.TR ?? '-',
        Name: row.Name || '-',
        Darajah: row.Darajah || '-',
        Email: row.Email || '-',
        CompletionStatus: row.CompletionStatus || 'Pending'
    }));

    pendingTable.clear();
    pendingTable.rows.add(tableRows);
    pendingTable.draw(false);

    if (!tableRows.length) {
        pendingTable.search('').columns().search('').draw();
        $('#pendingTable thead tr.filters input').val('');
    }
}

function renderCompletedTable(rows) {
    const tbody = document.querySelector('#completedTable tbody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = buildEmptyRow(7, 'No completed students yet.');
        return;
    }

    tbody.innerHTML = rows.map(row => {
        const duplicateBadge = row.RecordCountInBatch > 1
            ? ` <span class="badge bg-warning text-dark">Duplicate</span>`
            : '';

        return `
            <tr>
                <td>${row.TR}</td>
                <td>${row.Name || '-'}</td>
                <td>${row.Darajah || '-'}</td>
                <td>${formatDateTime(row.CompletedAt)}</td>
                <td>${row.RecordCountInBatch || 0}${duplicateBadge}</td>
                <td><code>${row.Email}</code></td>
                <td><span class="badge bg-success">${row.CompletionStatus}</span></td>
            </tr>
        `;
    }).join('');
}

async function copyText(value, label) {
    if (!value) {
        Swal.fire('No Pending Emails', 'There are no pending emails to copy.', 'info');
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        Swal.fire('Copied', `${label} copied to clipboard.`, 'success');
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        Swal.fire('Copied', `${label} copied to clipboard.`, 'success');
    }
}

function renderData(payload) {
    const context = payload.context || {};
    const summary = payload.summary || {};
    const pending = payload.pending || [];
    const completed = payload.completed || [];
    const emailExports = payload.emailExports || {};
    const hasActiveBatch = Boolean(context.activeBatch);

    hideBanner();

    setText('ctxBranch', context.branch || '-');
    setText('ctxGender', context.gender || '-');
    setText('ctxGeneratedAt', formatDateTime(context.generatedAt));

    if (hasActiveBatch) {
        setText('ctxActiveBatch', `${context.activeBatch.BatchName} (#${context.activeBatch.BatchID})`);
    } else {
        setText('ctxActiveBatch', 'No active batch');
        showBanner('warning', 'No active evaluation batch exists for this section. Checklist is paused until an active batch is available.');
    }

    const conflictWarning = document.getElementById('ctxConflictWarning');
    if (conflictWarning) {
        if ((context.activeBatchConflictCount || 0) > 1) {
            conflictWarning.classList.remove('d-none');
            conflictWarning.textContent = `Data warning: ${context.activeBatchConflictCount} active batches found. Showing latest active batch only.`;
        } else {
            conflictWarning.classList.add('d-none');
            conflictWarning.textContent = '';
        }
    }

    setText('kpiTotal', summary.totalActiveStudents || 0);
    setText('kpiCompleted', summary.completedCount || 0);
    setText('kpiPending', summary.pendingCount || 0);
    setText('kpiPercent', `${summary.completionPercent || 0}%`);

    latestEmailExports = {
        newlineList: emailExports.newlineList || '',
        semicolonList: emailExports.semicolonList || ''
    };

    const hasPendingEmails = Boolean(latestEmailExports.newlineList.trim());
    const copyPendingDropdownBtn = document.getElementById('copyPendingDropdownBtn');
    if (copyPendingDropdownBtn) copyPendingDropdownBtn.disabled = !hasPendingEmails;

    updatePendingTable(pending);
    renderCompletedTable(completed);
}

async function loadAttendanceChecklist(showLoader = true) {
    if (isLoading) return;
    isLoading = true;
    const refreshBtn = document.getElementById('refreshAttendanceBtn');
    const originalBtnText = refreshBtn.textContent;

    try {
        if (showLoader) refreshBtn.textContent = 'Refreshing...';
        refreshBtn.disabled = true;

        const response = await fetch('/api/staff/fitness-test-attendance', {
            method: 'GET',
            credentials: 'include'
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to fetch attendance checklist.');
        }

        renderData(payload);
    } catch (err) {
        console.error(err);
        showBanner('danger', err.message || 'Could not load attendance checklist.');
    } finally {
        refreshBtn.textContent = originalBtnText;
        refreshBtn.disabled = false;
        isLoading = false;
    }
}

function startPolling() {
    if (pollTimer || document.hidden) return;
    pollTimer = setInterval(() => loadAttendanceChecklist(false), POLL_INTERVAL_MS);
}

function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshAttendanceBtn');
    const copyEmailsNewlineOption = document.getElementById('copyEmailsNewlineOption');
    const copyEmailsSemicolonOption = document.getElementById('copyEmailsSemicolonOption');

    refreshBtn.addEventListener('click', () => loadAttendanceChecklist(true));
    copyEmailsNewlineOption.addEventListener('click', () => copyText(latestEmailExports.newlineList, 'Newline email list'));
    copyEmailsSemicolonOption.addEventListener('click', () => copyText(latestEmailExports.semicolonList, 'Semicolon email list'));

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else {
            loadAttendanceChecklist(false);
            startPolling();
        }
    });

    loadAttendanceChecklist(true);
    startPolling();
});
